"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { spawn, execFile, exec } = require("child_process");
const os = require("os");
const dns = require("dns").promises;
const net = require("net");

// Network Libraries
const ftp = require("basic-ftp");
const SftpClient = require("ssh2-sftp-client");
const { createClient } = require("webdav");

// Session Management
const activeSessions = new Map();
let sessionCounter = 1;

// NAS Storage Location
const nasStoreDir = path.join(os.homedir(), ".gemini", "antigravity");
const nasStorePath = path.join(nasStoreDir, "nas_shares.json");

// ============================================================
// Helper Utilities
// ============================================================
async function ensureNasDirectory() {
  try {
    await fsp.mkdir(nasStoreDir, { recursive: true });
  } catch (e) {
    // Ignore folder creation errors
  }
}

// ============================================================
// 1. Network Discovery Service
// ============================================================
function getLocalInterfaces() {
  const interfaces = os.networkInterfaces();
  const list = [];
  for (const name of Object.keys(interfaces)) {
    for (const info of interfaces[name]) {
      if (info.family === "IPv4" && !info.internal) {
        list.push({
          interface: name,
          ip: info.address,
          netmask: info.netmask,
          mac: info.mac
        });
      }
    }
  }
  return list;
}

function scanSubnet() {
  return new Promise((resolve) => {
    // Execute arp -a to get currently dynamic/static addresses
    exec("arp -a", (err, stdout) => {
      if (err) {
        return resolve([]);
      }
      
      const lines = stdout.split(/\r?\n/);
      const devices = [];
      const arpRegex = /^\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\s+([0-9a-fA-F:-]{17})\s+(\w+)/;
      
      for (const line of lines) {
        const match = line.match(arpRegex);
        if (match) {
          const ip = match[1];
          const mac = match[2].toUpperCase().replace(/:/g, "-");
          
          if (ip.startsWith("224.") || ip.startsWith("255.") || ip.endsWith(".255") || ip.startsWith("239.") || ip.startsWith("169.254")) {
            continue;
          }
          
          devices.push({ ip, mac });
        }
      }
      resolve(devices);
    });
  });
}

async function resolveHostname(ip) {
  try {
    const hostnames = await dns.reverse(ip);
    return hostnames[0] || ip;
  } catch (err) {
    return ip;
  }
}

function checkPort(ip, port, timeout = 300) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let conn = false;
    
    socket.setTimeout(timeout);
    
    socket.on("connect", () => {
      conn = true;
      socket.destroy();
    });
    
    socket.on("error", () => {
      socket.destroy();
    });
    
    socket.on("timeout", () => {
      socket.destroy();
    });
    
    socket.on("close", () => {
      resolve(conn);
    });
    
    socket.connect(port, ip);
  });
}

async function discoverDevices() {
  try {
    const arpDevices = await scanSubnet();
    const results = [];
    
    // Scan in parallel with port checks
    await Promise.all(arpDevices.map(async (dev) => {
      try {
        const hostname = await resolveHostname(dev.ip);
        
        // Fast port scanning to identify SMB/SSH/FTP
        const [hasSmb, hasSsh, hasFtp, hasHttp] = await Promise.all([
          checkPort(dev.ip, 445),
          checkPort(dev.ip, 22),
          checkPort(dev.ip, 21),
          checkPort(dev.ip, 80)
        ]);

        let type = "Network Device";
        if (hasSmb) {
          type = hostname.toLowerCase().includes("nas") ? "NAS" : "Computer";
        } else if (hasSsh || hasFtp) {
          type = "Server";
        } else if (hasHttp) {
          type = "Web Device";
        }

        results.push({
          name: hostname === dev.ip ? `Device-${dev.ip.replace(/\./g, "-")}` : hostname,
          address: dev.ip,
          type,
          status: "Online",
          shares: hasSmb ? 3 : 0 // Mock share counts dynamically
        });
      } catch (e) {
        // Ignore single scan errors
      }
    }));

    return { success: true, devices: results };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 2. SMB Share Service (Windows Credential mounting)
// ============================================================
function connectSMBShare(pathStr, username, password) {
  return new Promise((resolve) => {
    const cleanPath = path.normalize(pathStr).replace(/[/\\]+$/, "");
    
    // Disconnect existing session if any, so we can re-auth
    execFile("net.exe", ["use", cleanPath, "/delete", "/y"], () => {
      const args = ["use", cleanPath];
      if (password) {
        args.push(password);
      }
      if (username) {
        args.push(`/user:${username}`);
      }
      args.push("/persistent:No");

      execFile("net.exe", args, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr?.trim() || error.message });
        } else {
          resolve({ success: true, message: "SMB Share connected successfully." });
        }
      });
    });
  });
}

async function browseSMB(pathStr) {
  try {
    const cleanPath = path.normalize(pathStr);
    const entries = await fsp.readdir(cleanPath, { withFileTypes: true });
    const files = [];
    
    for (const entry of entries) {
      const fullPath = path.join(cleanPath, entry.name);
      let size = 0;
      let mtime = "";
      try {
        const stat = await fsp.stat(fullPath);
        size = stat.size;
        mtime = stat.mtime.toISOString();
      } catch (e) {
        // Skip inaccessible entries
      }
      files.push({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        size,
        mtime
      });
    }

    return { success: true, files };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 3. FTP Connection Service
// ============================================================
async function testFTP(host, port, username, password, secure = false) {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    const portVal = Number(port) || 21;
    await client.access({
      host,
      port: portVal,
      user: username || "anonymous",
      password: password || "",
      secure: secure
    });
    await client.list("/");
    client.close();
    return { success: true, message: "FTP connection test successful." };
  } catch (err) {
    client.close();
    return { success: false, error: err.message };
  }
}

async function connectFTP(host, port, username, password, secure = false) {
  const client = new ftp.Client();
  try {
    const portVal = Number(port) || 21;
    await client.access({
      host,
      port: portVal,
      user: username || "anonymous",
      password: password || "",
      secure: secure
    });
    
    const sessionId = `ftp-session-${sessionCounter++}`;
    activeSessions.set(sessionId, { client, type: "ftp" });
    
    return { success: true, sessionId };
  } catch (err) {
    client.close();
    return { success: false, error: err.message };
  }
}

// ============================================================
// 4. SFTP Connection Service
// ============================================================
async function testSFTP(host, port, username, password, privateKeyPath) {
  const sftp = new SftpClient();
  try {
    const config = {
      host,
      port: Number(port) || 22,
      username: username || "root"
    };

    if (privateKeyPath) {
      const cleanPath = path.normalize(privateKeyPath);
      if (!fs.existsSync(cleanPath)) {
        return { success: false, error: `SSH private key path not found: ${privateKeyPath}` };
      }
      config.privateKey = await fsp.readFile(cleanPath, "utf8");
    } else {
      config.password = password || "";
    }

    await sftp.connect(config);
    await sftp.list("/");
    await sftp.end();
    return { success: true, message: "SFTP connection test successful." };
  } catch (err) {
    try { await sftp.end(); } catch (e) {}
    return { success: false, error: err.message };
  }
}

async function connectSFTP(host, port, username, password, privateKeyPath) {
  const sftp = new SftpClient();
  try {
    const config = {
      host,
      port: Number(port) || 22,
      username: username || "root"
    };

    if (privateKeyPath) {
      const cleanPath = path.normalize(privateKeyPath);
      if (!fs.existsSync(cleanPath)) {
        return { success: false, error: `SSH private key path not found: ${privateKeyPath}` };
      }
      config.privateKey = await fsp.readFile(cleanPath, "utf8");
    } else {
      config.password = password || "";
    }

    await sftp.connect(config);
    
    const sessionId = `sftp-session-${sessionCounter++}`;
    activeSessions.set(sessionId, { client: sftp, type: "sftp" });
    
    return { success: true, sessionId };
  } catch (err) {
    try { await sftp.end(); } catch (e) {}
    return { success: false, error: err.message };
  }
}

// ============================================================
// 5. WebDAV Connection Service
// ============================================================
async function connectWebDAV(url, username, password) {
  try {
    const client = createClient(url, {
      username: username || "",
      password: password || ""
    });
    // Test connection by listing contents of Root
    await client.getDirectoryContents("/");
    
    const sessionId = `webdav-session-${sessionCounter++}`;
    activeSessions.set(sessionId, { client, type: "webdav" });
    
    return { success: true, sessionId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 6. NAS Configurations
// ============================================================
async function getNasLocations() {
  await ensureNasDirectory();
  try {
    if (!fs.existsSync(nasStorePath)) {
      return { success: true, nasList: [] };
    }
    const data = await fsp.readFile(nasStorePath, "utf8");
    const nasList = JSON.parse(data || "[]");
    return { success: true, nasList };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function addNasLocation(name, protocol, pathOrHost, port, username, password) {
  await ensureNasDirectory();
  try {
    const listRes = await getNasLocations();
    if (!listRes.success) return listRes;

    const list = listRes.nasList || [];
    
    // Obscure password slightly using base64 (credentials security request)
    const base64Password = password ? Buffer.from(password).toString("base64") : "";

    const newNas = {
      id: `nas-${Date.now()}`,
      name: name || "My NAS",
      protocol: protocol || "SMB",
      pathOrHost,
      port: port || "",
      username: username || "",
      password: base64Password,
      status: "Connected"
    };

    list.push(newNas);
    await fsp.writeFile(nasStorePath, JSON.stringify(list, null, 2), "utf8");
    return { success: true, nas: newNas };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function removeNasLocation(id) {
  await ensureNasDirectory();
  try {
    const listRes = await getNasLocations();
    if (!listRes.success) return listRes;

    const list = listRes.nasList || [];
    const filtered = list.filter(n => n.id !== id);
    
    await fsp.writeFile(nasStorePath, JSON.stringify(filtered, null, 2), "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 7. Network Mapped Drives (net use parsing)
// ============================================================
function getMappedDrives() {
  return new Promise((resolve) => {
    execFile("net.exe", ["use"], (error, stdout) => {
      if (error) {
        // net use exits with non-zero if no connections exist
        return resolve({ success: true, drives: [] });
      }
      
      const lines = stdout.split(/\r?\n/);
      const drives = [];
      let parseStarted = false;
      
      for (const line of lines) {
        if (line.includes("----")) {
          parseStarted = true;
          continue;
        }
        if (parseStarted && line.trim()) {
          if (line.includes("The command completed successfully")) {
            break;
          }
          
          const parts = line.trim().split(/\s{2,}/);
          if (parts.length >= 2) {
            let status = "Connected";
            let local = "";
            let remote = "";
            
            if (["OK", "Disconnected", "Unavailable"].includes(parts[0])) {
              status = parts[0] === "OK" ? "Connected" : parts[0];
              local = parts[1];
              remote = parts[2];
            } else {
              local = parts[0];
              remote = parts[1];
            }
            
            if (local && local.includes(":")) {
              drives.push({
                letter: local,
                path: remote,
                label: remote.split(/[/\\]/).pop() || "Network Drive",
                status,
                persistent: true
              });
            }
          }
        }
      }
      resolve({ success: true, drives });
    });
  });
}

function mapDrive(letter, remotePath, username, password) {
  return new Promise((resolve) => {
    const args = ["use", letter, remotePath];
    if (password) {
      args.push(password);
    }
    if (username) {
      args.push(`/user:${username}`);
    }
    args.push("/persistent:Yes");

    execFile("net.exe", args, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr?.trim() || error.message });
      } else {
        resolve({ success: true, message: `Successfully mapped drive ${letter}.` });
      }
    });
  });
}

function unmapDrive(letter) {
  return new Promise((resolve) => {
    execFile("net.exe", ["use", letter, "/delete", "/y"], (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr?.trim() || error.message });
      } else {
        resolve({ success: true, message: `Successfully unmapped drive ${letter}.` });
      }
    });
  });
}

// ============================================================
// 8. Session-Based File Browsing & Transfer Operations
// ============================================================
async function browseRemote(sessionId, remotePath) {
  const session = activeSessions.get(sessionId);
  if (!session) return { success: false, error: "Session expired or invalid connection." };

  try {
    if (session.type === "ftp") {
      const list = await session.client.list(remotePath || "/");
      return {
        success: true,
        files: list.map(f => ({
          name: f.name,
          isDirectory: f.isDirectory,
          size: f.size,
          mtime: f.modifiedAt ? f.modifiedAt.toISOString() : ""
        }))
      };
    } else if (session.type === "sftp") {
      const list = await session.client.list(remotePath || "/");
      return {
        success: true,
        files: list.map(f => ({
          name: f.name,
          isDirectory: f.type === "d",
          size: f.size,
          mtime: new Date(f.modifyTime).toISOString()
        }))
      };
    } else if (session.type === "webdav") {
      const list = await session.client.getDirectoryContents(remotePath || "/");
      return {
        success: true,
        files: list.map(f => ({
          name: f.basename,
          isDirectory: f.type === "directory",
          size: f.size || 0,
          mtime: f.lastmod
        }))
      };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function uploadFile(sessionId, localFilePath, remoteFilePath) {
  const session = activeSessions.get(sessionId);
  if (!session) return { success: false, error: "Session expired or invalid connection." };

  try {
    if (!fs.existsSync(localFilePath)) {
      return { success: false, error: `Local file not found: ${localFilePath}` };
    }

    if (session.type === "ftp") {
      await session.client.uploadFrom(localFilePath, remoteFilePath);
    } else if (session.type === "sftp") {
      await session.client.put(localFilePath, remoteFilePath);
    } else if (session.type === "webdav") {
      const data = await fsp.readFile(localFilePath);
      await session.client.putFileContents(remoteFilePath, data);
    }
    return { success: true, message: "File uploaded successfully." };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function downloadFile(sessionId, remoteFilePath, localFilePath) {
  const session = activeSessions.get(sessionId);
  if (!session) return { success: false, error: "Session expired or invalid connection." };

  try {
    if (session.type === "ftp") {
      await session.client.downloadTo(localFilePath, remoteFilePath);
    } else if (session.type === "sftp") {
      await session.client.get(remoteFilePath, localFilePath);
    } else if (session.type === "webdav") {
      const data = await session.client.getFileContents(remoteFilePath, { format: "binary" });
      await fsp.writeFile(localFilePath, data);
    }
    return { success: true, message: "File downloaded successfully." };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function renameRemote(sessionId, remoteOldPath, remoteNewPath) {
  const session = activeSessions.get(sessionId);
  if (!session) return { success: false, error: "Session expired or invalid connection." };

  try {
    if (session.type === "ftp") {
      await session.client.rename(remoteOldPath, remoteNewPath);
    } else if (session.type === "sftp") {
      await session.client.rename(remoteOldPath, remoteNewPath);
    } else if (session.type === "webdav") {
      await session.client.moveFile(remoteOldPath, remoteNewPath);
    }
    return { success: true, message: "Renamed successfully." };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function deleteRemote(sessionId, remotePath, isDir) {
  const session = activeSessions.get(sessionId);
  if (!session) return { success: false, error: "Session expired or invalid connection." };

  try {
    if (session.type === "ftp") {
      if (isDir) {
        await session.client.removeDir(remotePath);
      } else {
        await session.client.remove(remotePath);
      }
    } else if (session.type === "sftp") {
      if (isDir) {
        await session.client.rmdir(remotePath, true);
      } else {
        await session.client.delete(remotePath);
      }
    } else if (session.type === "webdav") {
      await session.client.deleteFile(remotePath);
    }
    return { success: true, message: "Deleted successfully." };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function createRemoteFolder(sessionId, remotePath) {
  const session = activeSessions.get(sessionId);
  if (!session) return { success: false, error: "Session expired or invalid connection." };

  try {
    if (session.type === "ftp") {
      await session.client.ensureDir(remotePath);
    } else if (session.type === "sftp") {
      await session.client.mkdir(remotePath, true);
    } else if (session.type === "webdav") {
      await session.client.createDirectory(remotePath);
    }
    return { success: true, message: "Folder created successfully." };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  getLocalInterfaces,
  discoverDevices,
  connectSMBShare,
  browseSMB,
  testFTP,
  connectFTP,
  testSFTP,
  connectSFTP,
  connectWebDAV,
  getNasLocations,
  addNasLocation,
  removeNasLocation,
  getMappedDrives,
  mapDrive,
  unmapDrive,
  browseRemote,
  uploadFile,
  downloadFile,
  renameRemote,
  deleteRemote,
  createRemoteFolder
};
