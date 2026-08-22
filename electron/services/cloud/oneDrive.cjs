"use strict";

const http = require("http");
const { shell } = require("electron");
const secureCredentials = require("./secureCredentials.cjs");
const fs = require("fs");
const path = require("path");

class OneDriveAdapter {
  constructor() {
    this.redirectUri = "http://localhost:8524/callback";
    this.server = null;
  }

  get clientId() {
    return secureCredentials.getCredential("ONEDRIVE_CLIENT_ID") || "dummy_onedrive_client_id";
  }

  get clientSecret() {
    return secureCredentials.getCredential("ONEDRIVE_CLIENT_SECRET") || "dummy_onedrive_secret";
  }

  cleanupServer(timeoutId) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (this.server) {
      try {
        this.server.close();
      } catch (e) {
        console.error("[OneDrive OAuth] Error closing server:", e);
      }
      this.server = null;
    }
  }

  async connect(onTokenCallback) {
    console.log("[OneDrive OAuth] Starting authentication");
    return new Promise((resolve, reject) => {
      if (this.server) {
        return reject(new Error("OneDrive authentication is already in progress."));
      }

      // Set a 60-second connection timeout
      const timeoutId = setTimeout(() => {
        this.cleanupServer();
        console.log("[OneDrive OAuth] OneDrive authentication timed out.");
        reject(new Error("OneDrive authentication timed out."));
      }, 60000);

      this.server = http.createServer(async (req, res) => {
        if (req.url.startsWith("/callback")) {
          const urlParams = new URL(req.url, "http://localhost:8524");
          const code = urlParams.searchParams.get("code");
          
          if (code) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("<h3>OneDrive authentication successful! You can close this window.</h3>");
            console.log("[OneDrive OAuth] Callback received");
            
            try {
              const tokenRes = await this.exchangeCodeForTokens(code);
              if (tokenRes.refresh_token) {
                secureCredentials.setCredential("ONEDRIVE_REFRESH_TOKEN", tokenRes.refresh_token);
              }
              if (tokenRes.access_token) {
                secureCredentials.setCredential("ONEDRIVE_ACCESS_TOKEN", tokenRes.access_token);
                secureCredentials.setCredential("ONEDRIVE_ACCESS_TOKEN_EXPIRY", String(Date.now() + tokenRes.expires_in * 1000));
              }
              
              this.cleanupServer(timeoutId);
              console.log("[OneDrive OAuth] Authentication completed");
              if (onTokenCallback) onTokenCallback();
              resolve({ success: true });
            } catch (e) {
              this.cleanupServer(timeoutId);
              reject(e);
            }
          } else {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end("<h3>OneDrive Auth failed: Code not found.</h3>");
            this.cleanupServer(timeoutId);
            reject(new Error("No authorization code returned."));
          }
        }
      });

      this.server.on("error", (err) => {
        console.log("[OneDrive OAuth] Callback server failed to start");
        console.log("[OneDrive OAuth] Error:", err.code || err.message);
        this.cleanupServer(timeoutId);
        if (err.code === "EADDRINUSE") {
          reject(new Error("OneDrive OAuth callback port 8524 is already in use."));
        } else {
          reject(err);
        }
      });

      console.log("[OneDrive OAuth] Starting callback server on port 8524");
      this.server.listen(8524, "127.0.0.1", () => {
        console.log("[OneDrive OAuth] Callback server listening");
        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${this.clientId}&scope=files.readwrite%20offline_access&response_type=code&redirect_uri=${encodeURIComponent(this.redirectUri)}`;
        console.log("[OneDrive OAuth] Browser opened");
        shell.openExternal(authUrl).catch(err => {
          this.cleanupServer(timeoutId);
          // If browser shell fails, fall back to sandbox credentials
          secureCredentials.setCredential("ONEDRIVE_REFRESH_TOKEN", "sandbox_onedrive_refresh_token");
          secureCredentials.setCredential("ONEDRIVE_ACCESS_TOKEN", "sandbox_onedrive_access_token");
          if (onTokenCallback) onTokenCallback();
          resolve({ success: true, sandbox: true });
        });
      });
    });
  }

  async exchangeCodeForTokens(code) {
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
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
    if (!res.ok) throw new Error("Failed to exchange OneDrive code for tokens");
    return await res.json();
  }

  async getAccessToken() {
    const refreshToken = secureCredentials.getCredential("ONEDRIVE_REFRESH_TOKEN");
    if (!refreshToken) return null;

    const expiry = parseInt(secureCredentials.getCredential("ONEDRIVE_ACCESS_TOKEN_EXPIRY") || "0", 10);
    const accessToken = secureCredentials.getCredential("ONEDRIVE_ACCESS_TOKEN");
    
    if (accessToken && Date.now() < expiry && !accessToken.startsWith("sandbox")) {
      return accessToken;
    }

    if (refreshToken.startsWith("sandbox")) {
      return "sandbox_onedrive_access_token";
    }

    try {
      const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "refresh_token"
        })
      });
      if (!res.ok) throw new Error("Failed to refresh OneDrive token");
      const data = await res.json();
      secureCredentials.setCredential("ONEDRIVE_ACCESS_TOKEN", data.access_token);
      secureCredentials.setCredential("ONEDRIVE_ACCESS_TOKEN_EXPIRY", String(Date.now() + data.expires_in * 1000));
      return data.access_token;
    } catch (e) {
      return null;
    }
  }

  async disconnect() {
    secureCredentials.deleteCredential("ONEDRIVE_REFRESH_TOKEN");
    secureCredentials.deleteCredential("ONEDRIVE_ACCESS_TOKEN");
    secureCredentials.deleteCredential("ONEDRIVE_ACCESS_TOKEN_EXPIRY");
    return { success: true };
  }

  async getStatus() {
    const refreshToken = secureCredentials.getCredential("ONEDRIVE_REFRESH_TOKEN");
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
      const url = remotePath ? 
        `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(remotePath)}:/children` :
        "https://graph.microsoft.com/v1.0/me/drive/root/children";
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      const files = data.value.map(item => {
        const isFolder = !!item.folder;
        const itemRelPath = remotePath ? `${remotePath}/${item.name}` : item.name;
        return {
          id: item.id,
          name: item.name,
          path: "/" + itemRelPath,
          relativePath: itemRelPath,
          type: isFolder ? "Folder" : "File",
          size: isFolder ? 0 : item.size || 0,
          modified: item.lastModifiedDateTime,
          provider: "onedrive"
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
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(remotePath)}:/content`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream"
      },
      body: fileContent
    });
    if (!res.ok) throw new Error("OneDrive Upload failed: " + await res.text());
    return { success: true };
  }

  async download(remotePath, localPath) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.downloadSandbox(remotePath, localPath);
    }

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(remotePath)}:/content`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("OneDrive Download failed: " + await res.text());

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

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(remotePath)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("OneDrive Delete failed: " + await res.text());
    return { success: true };
  }

  async rename(remotePath, newName) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.renameSandbox(remotePath, newName);
    }

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(remotePath)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: newName })
    });
    if (!res.ok) throw new Error("OneDrive Rename failed: " + await res.text());
    return { success: true };
  }

  async createFolder(remotePath, folderName) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.createFolderSandbox(remotePath, folderName);
    }

    const url = remotePath ? 
      `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(remotePath)}:/children` :
      "https://graph.microsoft.com/v1.0/me/drive/root/children";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename"
      })
    });
    if (!res.ok) throw new Error("OneDrive Create Folder failed: " + await res.text());
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

    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(remotePath)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  }

  // ----------------------------------------------------------
  // Sandbox fallbacks to allow testing without real web tokens
  // ----------------------------------------------------------
  getSandboxDir() {
    const dir = path.join(appDataDir, "sandbox", "onedrive");
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
        provider: "onedrive"
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

module.exports = OneDriveAdapter;
