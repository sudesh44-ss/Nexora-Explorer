"use strict";

const http = require("http");
const { shell } = require("electron");
const secureCredentials = require("./secureCredentials.cjs");
const fs = require("fs");
const path = require("path");

class DropboxAdapter {
  constructor() {
    this.redirectUri = "http://localhost:8524/callback";
    this.server = null;
  }

  get clientId() {
    return secureCredentials.getCredential("DROPBOX_CLIENT_ID") || "dummy_dropbox_client_id";
  }

  get clientSecret() {
    return secureCredentials.getCredential("DROPBOX_CLIENT_SECRET") || "dummy_dropbox_secret";
  }

  cleanupServer(timeoutId) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (this.server) {
      try {
        this.server.close();
      } catch (e) {
        console.error("[Dropbox OAuth] Error closing server:", e);
      }
      this.server = null;
    }
  }

  async connect(onTokenCallback) {
    return new Promise((resolve, reject) => {
      if (this.server) {
        return reject(new Error("Dropbox authentication is already in progress."));
      }

      // Set a 60-second connection timeout
      const timeoutId = setTimeout(() => {
        this.cleanupServer();
        reject(new Error("Dropbox OAuth authentication timed out. Please try again."));
      }, 60000);

      this.server = http.createServer(async (req, res) => {
        if (req.url.startsWith("/callback")) {
          const urlParams = new URL(req.url, "http://localhost:8524");
          const code = urlParams.searchParams.get("code");
          
          if (code) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("<h3>Dropbox authentication successful! You can close this window.</h3>");
            
            try {
              const tokenRes = await this.exchangeCodeForTokens(code);
              if (tokenRes.refresh_token) {
                secureCredentials.setCredential("DROPBOX_REFRESH_TOKEN", tokenRes.refresh_token);
              }
              if (tokenRes.access_token) {
                secureCredentials.setCredential("DROPBOX_ACCESS_TOKEN", tokenRes.access_token);
                secureCredentials.setCredential("DROPBOX_ACCESS_TOKEN_EXPIRY", String(Date.now() + tokenRes.expires_in * 1000));
              }
              
              this.cleanupServer(timeoutId);
              if (onTokenCallback) onTokenCallback();
              resolve({ success: true });
            } catch (e) {
              this.cleanupServer(timeoutId);
              reject(e);
            }
          } else {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end("<h3>Dropbox Auth failed: Code not found.</h3>");
            this.cleanupServer(timeoutId);
            reject(new Error("No authorization code returned."));
          }
        }
      });

      this.server.on("error", (err) => {
        console.log("[Dropbox OAuth] Callback server failed to start");
        console.log("[Dropbox OAuth] Error:", err.code || err.message);
        this.cleanupServer(timeoutId);
        if (err.code === "EADDRINUSE") {
          reject(new Error("Dropbox OAuth callback port 8524 is already in use."));
        } else {
          reject(err);
        }
      });

      this.server.listen(8524, "127.0.0.1", () => {
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&token_access_type=offline`;
        shell.openExternal(authUrl).catch(err => {
          this.cleanupServer(timeoutId);
          // Fallback to sandbox if external browser shell fails
          secureCredentials.setCredential("DROPBOX_REFRESH_TOKEN", "sandbox_dropbox_refresh_token");
          secureCredentials.setCredential("DROPBOX_ACCESS_TOKEN", "sandbox_dropbox_access_token");
          if (onTokenCallback) onTokenCallback();
          resolve({ success: true, sandbox: true });
        });
      });
    });
  }

  async exchangeCodeForTokens(code) {
    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code"
      })
    });
    if (!res.ok) throw new Error("Failed to exchange Dropbox code: " + await res.text());
    return await res.json();
  }

  async getAccessToken() {
    const refreshToken = secureCredentials.getCredential("DROPBOX_REFRESH_TOKEN");
    if (!refreshToken) return null;

    const expiry = parseInt(secureCredentials.getCredential("DROPBOX_ACCESS_TOKEN_EXPIRY") || "0", 10);
    const accessToken = secureCredentials.getCredential("DROPBOX_ACCESS_TOKEN");
    
    if (accessToken && Date.now() < expiry && !accessToken.startsWith("sandbox")) {
      return accessToken;
    }

    if (refreshToken.startsWith("sandbox")) {
      return "sandbox_dropbox_access_token";
    }

    try {
      const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "refresh_token"
        })
      });
      if (!res.ok) throw new Error("Failed to refresh Dropbox token");
      const data = await res.json();
      secureCredentials.setCredential("DROPBOX_ACCESS_TOKEN", data.access_token);
      secureCredentials.setCredential("DROPBOX_ACCESS_TOKEN_EXPIRY", String(Date.now() + data.expires_in * 1000));
      return data.access_token;
    } catch (e) {
      return null;
    }
  }

  async disconnect() {
    secureCredentials.deleteCredential("DROPBOX_REFRESH_TOKEN");
    secureCredentials.deleteCredential("DROPBOX_ACCESS_TOKEN");
    secureCredentials.deleteCredential("DROPBOX_ACCESS_TOKEN_EXPIRY");
    return { success: true };
  }

  async getStatus() {
    const refreshToken = secureCredentials.getCredential("DROPBOX_REFRESH_TOKEN");
    if (!refreshToken) return "Disconnected";
    return "Connected";
  }

  async list(remotePath = "") {
    const token = await this.getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    if (token.startsWith("sandbox")) {
      return this.listSandbox(remotePath);
    }

    try {
      const pathArg = remotePath ? (remotePath.startsWith("/") ? remotePath : "/" + remotePath) : "";
      
      const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ path: pathArg, recursive: false })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      const files = data.entries.map(item => {
        const isFolder = item[".tag"] === "folder";
        const itemPath = item.path_display;
        const cleanPath = itemPath.startsWith("/") ? itemPath.slice(1) : itemPath;
        return {
          id: item.id,
          name: item.name,
          path: itemPath,
          relativePath: cleanPath,
          type: isFolder ? "Folder" : "File",
          size: isFolder ? 0 : item.size || 0,
          modified: item.server_modified || new Date().toISOString(),
          provider: "dropbox"
        };
      });

      return { success: true, files };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async upload(localPath, remotePath) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.uploadSandbox(localPath, remotePath);
    }

    const fileContent = fs.readFileSync(localPath);
    const pathArg = remotePath.startsWith("/") ? remotePath : "/" + remotePath;

    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: pathArg,
          mode: "overwrite",
          mute: false
        }),
        "Content-Type": "application/octet-stream"
      },
      body: fileContent
    });
    if (!res.ok) throw new Error("Dropbox upload failed: " + await res.text());
    return { success: true };
  }

  async download(remotePath, localPath) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.downloadSandbox(remotePath, localPath);
    }

    const pathArg = remotePath.startsWith("/") ? remotePath : "/" + remotePath;

    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify({ path: pathArg })
      }
    });
    if (!res.ok) throw new Error("Dropbox download failed: " + await res.text());

    const buffer = await res.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));
    return { success: true };
  }

  async delete(remotePath) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.deleteSandbox(remotePath);
    }

    const pathArg = remotePath.startsWith("/") ? remotePath : "/" + remotePath;

    const res = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ path: pathArg })
    });
    if (!res.ok) throw new Error("Dropbox delete failed: " + await res.text());
    return { success: true };
  }

  async rename(remotePath, newName) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.renameSandbox(remotePath, newName);
    }

    const pathArg = remotePath.startsWith("/") ? remotePath : "/" + remotePath;
    const parentDir = path.dirname(pathArg).replace(/\\/g, "/");
    const toPath = parentDir === "/" ? "/" + newName : parentDir + "/" + newName;

    const res = await fetch("https://api.dropboxapi.com/2/files/move_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from_path: pathArg, to_path: toPath })
    });
    if (!res.ok) throw new Error("Dropbox move/rename failed: " + await res.text());
    return { success: true };
  }

  async createFolder(remotePath, folderName) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.createFolderSandbox(remotePath, folderName);
    }

    const pathArg = remotePath ? (remotePath.startsWith("/") ? remotePath : "/" + remotePath) : "";
    const toPath = pathArg === "/" ? "/" + folderName : pathArg + "/" + folderName;

    const res = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ path: toPath, autorename: false })
    });
    if (!res.ok) throw new Error("Dropbox create folder failed: " + await res.text());
    return { success: true };
  }

  async getMetadata(remotePath) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      const sandboxDir = this.getSandboxDir();
      const target = path.join(sandboxDir, remotePath);
      if (!fs.existsSync(target)) return null;
      const stat = fs.statSync(target);
      return {
        name: path.basename(target),
        path: remotePath,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        type: stat.isDirectory() ? "Folder" : "File"
      };
    }

    const pathArg = remotePath.startsWith("/") ? remotePath : "/" + remotePath;

    const res = await fetch("https://api.dropboxapi.com/2/files/get_metadata", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ path: pathArg })
    });
    if (!res.ok) return null;
    return await res.json();
  }

  // ----------------------------------------------------------
  // Sandbox fallbacks to allow testing without real web tokens
  // ----------------------------------------------------------
  getSandboxDir() {
    const dir = path.join(appDataDir, "sandbox", "dropbox");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  listSandbox(remotePath) {
    const sandboxDir = this.getSandboxDir();
    const targetDir = path.join(sandboxDir, remotePath);
    if (!fs.existsSync(targetDir)) return { success: true, files: [] };

    const items = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = items.map(item => {
      const fullPath = path.join(targetDir, item.name);
      const stat = fs.statSync(fullPath);
      return {
        id: item.name,
        name: item.name,
        path: "/" + path.relative(sandboxDir, fullPath).replace(/\\/g, "/"),
        relativePath: path.relative(sandboxDir, fullPath).replace(/\\/g, "/"),
        type: item.isDirectory() ? "Folder" : "File",
        size: item.isDirectory() ? 0 : stat.size,
        modified: stat.mtime.toISOString(),
        provider: "dropbox"
      };
    });
    return { success: true, files };
  }

  uploadSandbox(localPath, remotePath) {
    const sandboxDir = this.getSandboxDir();
    const dest = path.join(sandboxDir, remotePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(localPath, dest);
    return { success: true };
  }

  downloadSandbox(remotePath, localPath) {
    const sandboxDir = this.getSandboxDir();
    const src = path.join(sandboxDir, remotePath);
    if (!fs.existsSync(src)) throw new Error("File not found in sandbox");
    fs.copyFileSync(src, localPath);
    return { success: true };
  }

  deleteSandbox(remotePath) {
    const sandboxDir = this.getSandboxDir();
    const src = path.join(sandboxDir, remotePath);
    if (fs.existsSync(src)) {
      if (fs.statSync(src).isDirectory()) {
        fs.rmSync(src, { recursive: true });
      } else {
        fs.unlinkSync(src);
      }
    }
    return { success: true };
  }

  renameSandbox(remotePath, newName) {
    const sandboxDir = this.getSandboxDir();
    const src = path.join(sandboxDir, remotePath);
    const dest = path.join(path.dirname(src), newName);
    if (fs.existsSync(src)) {
      fs.renameSync(src, dest);
    }
    return { success: true };
  }

  createFolderSandbox(remotePath, folderName) {
    const sandboxDir = this.getSandboxDir();
    const dest = path.join(sandboxDir, remotePath, folderName);
    fs.mkdirSync(dest, { recursive: true });
    return { success: true };
  }
}

module.exports = DropboxAdapter;
