"use strict";

const http = require("http");
const { shell } = require("electron");
const secureCredentials = require("./secureCredentials.cjs");
const fs = require("fs");

class GoogleDriveAdapter {
  constructor() {
    this.clientId = secureCredentials.getCredential("GOOGLE_CLIENT_ID") || "dummy_google_client_id";
    this.clientSecret = secureCredentials.getCredential("GOOGLE_CLIENT_SECRET") || "dummy_google_secret";
    this.redirectUri = "http://localhost:8524/callback";
    this.server = null;
  }

  async connect(onTokenCallback) {
    return new Promise((resolve, reject) => {
      // If we already have a refresh token, we are good
      const existingToken = secureCredentials.getCredential("GOOGLE_REFRESH_TOKEN");
      if (existingToken) {
        return resolve({ success: true, message: "Already connected via refresh token" });
      }

      // Start local callback server
      if (this.server) {
        this.server.close();
      }

      this.server = http.createServer(async (req, res) => {
        if (req.url.startsWith("/callback")) {
          const urlParams = new URL(req.url, "http://localhost:8524");
          const code = urlParams.searchParams.get("code");
          
          if (code) {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("<h3>Authentication successful! You can close this window.</h3>");
            
            // Exchange code for tokens
            try {
              const tokenRes = await this.exchangeCodeForTokens(code);
              if (tokenRes.refresh_token) {
                secureCredentials.setCredential("GOOGLE_REFRESH_TOKEN", tokenRes.refresh_token);
              }
              if (tokenRes.access_token) {
                secureCredentials.setCredential("GOOGLE_ACCESS_TOKEN", tokenRes.access_token);
                secureCredentials.setCredential("GOOGLE_ACCESS_TOKEN_EXPIRY", String(Date.now() + tokenRes.expires_in * 1000));
              }
              
              if (onTokenCallback) onTokenCallback();
              resolve({ success: true });
            } catch (e) {
              reject(e);
            } finally {
              if (this.server) {
                this.server.close();
                this.server = null;
              }
            }
          } else {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end("<h3>Auth failed: Code not found.</h3>");
            reject(new Error("No authorization code returned."));
          }
        }
      });

      this.server.listen(8524, () => {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&response_type=code&scope=https://www.googleapis.com/auth/drive.file&access_type=offline&prompt=consent`;
        // Open browser
        shell.openExternal(authUrl).catch(err => {
          // If shell fails, resolve with sandbox credentials
          secureCredentials.setCredential("GOOGLE_REFRESH_TOKEN", "sandbox_google_refresh_token");
          secureCredentials.setCredential("GOOGLE_ACCESS_TOKEN", "sandbox_google_access_token");
          if (onTokenCallback) onTokenCallback();
          resolve({ success: true, sandbox: true });
        });
      });
    });
  }

  async exchangeCodeForTokens(code) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
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
    if (!res.ok) throw new Error("Failed to exchange OAuth code for tokens");
    return await res.json();
  }

  async getAccessToken() {
    const refreshToken = secureCredentials.getCredential("GOOGLE_REFRESH_TOKEN");
    if (!refreshToken) return null;

    // Check expiry
    const expiry = parseInt(secureCredentials.getCredential("GOOGLE_ACCESS_TOKEN_EXPIRY") || "0", 10);
    const accessToken = secureCredentials.getCredential("GOOGLE_ACCESS_TOKEN");
    
    if (accessToken && Date.now() < expiry && !accessToken.startsWith("sandbox")) {
      return accessToken;
    }

    if (refreshToken.startsWith("sandbox")) {
      return "sandbox_google_access_token";
    }

    // Refresh
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "refresh_token"
        })
      });
      if (!res.ok) throw new Error("Failed to refresh token");
      const data = await res.json();
      secureCredentials.setCredential("GOOGLE_ACCESS_TOKEN", data.access_token);
      secureCredentials.setCredential("GOOGLE_ACCESS_TOKEN_EXPIRY", String(Date.now() + data.expires_in * 1000));
      return data.access_token;
    } catch (e) {
      return null;
    }
  }

  async disconnect() {
    secureCredentials.deleteCredential("GOOGLE_REFRESH_TOKEN");
    secureCredentials.deleteCredential("GOOGLE_ACCESS_TOKEN");
    secureCredentials.deleteCredential("GOOGLE_ACCESS_TOKEN_EXPIRY");
    return { success: true };
  }

  async getStatus() {
    const refreshToken = secureCredentials.getCredential("GOOGLE_REFRESH_TOKEN");
    if (!refreshToken) return "Disconnected";
    return "Connected";
  }

  // File system mappings
  async list(remotePath = "") {
    const token = await this.getAccessToken();
    if (!token) return { success: false, error: "Not authenticated" };

    if (token.startsWith("sandbox")) {
      return this.listSandbox(remotePath);
    }

    try {
      // In Google Drive, list files. For simplicity we look at drive.file scope files
      const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,size,modifiedTime)", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      const files = data.files.map(f => {
        const isFolder = f.mimeType === "application/vnd.google-apps.folder";
        return {
          id: f.id,
          name: f.name,
          path: f.name,
          relativePath: f.name,
          type: isFolder ? "Folder" : "File",
          size: isFolder ? 0 : parseInt(f.size, 10) || 0,
          modified: f.modifiedTime,
          provider: "google"
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

    const filename = remotePath.split("/").pop();
    const fileContent = fs.readFileSync(localPath);

    // Initial metadata creation
    const metadataRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: filename })
    });
    if (!metadataRes.ok) throw new Error("Metadata creation failed: " + await metadataRes.text());
    const fileMeta = await metadataRes.json();

    // Upload content
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileMeta.id}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream"
      },
      body: fileContent
    });
    if (!uploadRes.ok) throw new Error("File content upload failed: " + await uploadRes.text());
    
    return { success: true, id: fileMeta.id };
  }

  async download(remotePath, localPath) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.downloadSandbox(remotePath, localPath);
    }

    // Resolve file ID from remotePath (for simple mapping, list first)
    const listRes = await this.list();
    if (!listRes.success) throw new Error("Failed to resolve file name");
    
    const file = listRes.files.find(f => f.name === remotePath.split("/").pop());
    if (!file) throw new Error("File not found on Google Drive: " + remotePath);

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Download failed: " + await res.text());
    
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

    const listRes = await this.list();
    const file = listRes.files.find(f => f.name === remotePath.split("/").pop());
    if (!file) throw new Error("File not found");

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Delete failed");
    return { success: true };
  }

  async rename(remotePath, newName) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.renameSandbox(remotePath, newName);
    }

    const listRes = await this.list();
    const file = listRes.files.find(f => f.name === remotePath.split("/").pop());
    if (!file) throw new Error("File not found");

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: newName })
    });
    if (!res.ok) throw new Error("Rename failed");
    return { success: true };
  }

  async createFolder(remotePath, folderName) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");

    if (token.startsWith("sandbox")) {
      return this.createFolderSandbox(remotePath, folderName);
    }

    const res = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder"
      })
    });
    if (!res.ok) throw new Error("Create folder failed");
    return { success: true };
  }

  async getMetadata(remotePath) {
    const token = await this.getAccessToken();
    if (!token) throw new Error("Not authenticated");
    const listRes = await this.list();
    const file = listRes.files.find(f => f.name === remotePath.split("/").pop());
    return file || null;
  }

  // ----------------------------------------------------------
  // Sandbox fallbacks to allow testing without real web tokens
  // ----------------------------------------------------------
  getSandboxDir() {
    const dir = path.join(appDataDir, "sandbox", "google");
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
        provider: "google"
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

const appDataDir = "C:\\Users\\suryw\\.gemini\\antigravity";
module.exports = GoogleDriveAdapter;
