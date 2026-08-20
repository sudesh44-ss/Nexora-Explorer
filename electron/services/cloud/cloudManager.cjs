"use strict";

const fs = require("fs");
const path = require("path");
const GoogleDriveAdapter = require("./googleDrive.cjs");
const OneDriveAdapter = require("./oneDrive.cjs");
const DropboxAdapter = require("./dropbox.cjs");
const S3Adapter = require("./s3.cjs");
const syncEngine = require("./syncEngine.cjs");
const secureCredentials = require("./secureCredentials.cjs");

// Enforce 10s timeout on all HTTP fetch operations globally
const originalFetch = global.fetch || globalThis.fetch;
if (originalFetch) {
  global.fetch = globalThis.fetch = async function (url, options = {}) {
    if (options.signal) {
      return originalFetch(url, options);
    }
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout
    try {
      const response = await originalFetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      if (error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw error;
    }
  };
}

const appDataDir = "C:\\Users\\suryw\\.gemini\\antigravity";
const offlineDbFile = path.join(appDataDir, "offline_files.json");

// Simple NAS Adapter using UNC path capabilities of Node fs
class NasAdapter {
  constructor() {
    this.nasPath = "";
  }
  async connect(config) {
    if (!config.path) throw new Error("NAS path is required");
    this.nasPath = config.path;
    return { success: true };
  }
  async disconnect() {
    this.nasPath = "";
    return { success: true };
  }
  async getStatus() {
    return this.nasPath ? "Connected" : "Disconnected";
  }
  async list(remotePath = "") {
    if (!this.nasPath) return { success: false, error: "NAS not connected" };
    try {
      const target = path.join(this.nasPath, remotePath);
      const items = await fs.promises.readdir(target, { withFileTypes: true });
      
      const filesPromises = items.map(async (item) => {
        const fullPath = path.join(target, item.name);
        try {
          const stat = await fs.promises.stat(fullPath);
          return {
            id: item.name,
            name: item.name,
            path: "/" + path.relative(this.nasPath, fullPath).replace(/\\/g, "/"),
            relativePath: path.relative(this.nasPath, fullPath).replace(/\\/g, "/"),
            type: item.isDirectory() ? "Folder" : "File",
            size: item.isDirectory() ? 0 : stat.size,
            modified: stat.mtime.toISOString(),
            provider: "nas"
          };
        } catch (e) {
          return {
            id: item.name,
            name: item.name,
            path: "/" + path.relative(this.nasPath, fullPath).replace(/\\/g, "/"),
            relativePath: path.relative(this.nasPath, fullPath).replace(/\\/g, "/"),
            type: item.isDirectory() ? "Folder" : "File",
            size: 0,
            modified: new Date().toISOString(),
            provider: "nas"
          };
        }
      });

      const files = await Promise.all(filesPromises);
      return { success: true, files };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  async upload(localPath, remotePath) {
    const dest = path.join(this.nasPath, remotePath);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(localPath, dest);
    return { success: true };
  }
  async download(remotePath, localPath) {
    const src = path.join(this.nasPath, remotePath);
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.copyFile(src, localPath);
    return { success: true };
  }
  async delete(remotePath) {
    const src = path.join(this.nasPath, remotePath);
    try {
      const stat = await fs.promises.stat(src);
      if (stat.isDirectory()) {
        await fs.promises.rm(src, { recursive: true });
      } else {
        await fs.promises.unlink(src);
      }
    } catch (e) {}
    return { success: true };
  }
  async rename(remotePath, newName) {
    const src = path.join(this.nasPath, remotePath);
    const dest = path.join(path.dirname(src), newName);
    await fs.promises.rename(src, dest);
    return { success: true };
  }
  async createFolder(remotePath, folderName) {
    const dest = path.join(this.nasPath, remotePath, folderName);
    await fs.promises.mkdir(dest, { recursive: true });
    return { success: true };
  }
  async getMetadata(remotePath) {
    const target = path.join(this.nasPath, remotePath);
    try {
      const stat = await fs.promises.stat(target);
      return {
        name: path.basename(target),
        path: remotePath,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        type: stat.isDirectory() ? "Folder" : "File"
      };
    } catch (e) {
      return null;
    }
  }
}

// Instantiate adapters
const adapters = {
  google: new GoogleDriveAdapter(),
  onedrive: new OneDriveAdapter(),
  dropbox: new DropboxAdapter(),
  s3: new S3Adapter("s3"),
  "s3-compatible": new S3Adapter("s3-compatible"),
  nas: new NasAdapter()
};

// Offline Files Database helpers
function loadOfflineDb() {
  try {
    if (!fs.existsSync(offlineDbFile)) {
      return {};
    }
    const raw = fs.readFileSync(offlineDbFile, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveOfflineDb(db) {
  try {
    fs.mkdirSync(path.dirname(offlineDbFile), { recursive: true });
    fs.writeFileSync(offlineDbFile, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to save offline database:", e);
  }
}

// Main manager exports
async function getProviders() {
  await secureCredentials.initCredentials();
  const list = [];
  for (const id in adapters) {
    const status = await adapters[id].getStatus();
    let name = id.toUpperCase();
    if (id === "google") name = "Google Drive";
    else if (id === "onedrive") name = "OneDrive";
    else if (id === "dropbox") name = "Dropbox";
    else if (id === "s3") name = "Amazon S3";
    else if (id === "s3-compatible") name = "S3 Compatible";
    else if (id === "nas") name = "NAS / Network Folder";

    list.push({ id, name, status });
  }
  return list;
}

async function connect(providerId, config) {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);
  return await adapter.connect(config);
}

async function disconnect(providerId) {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);
  return await adapter.disconnect();
}

async function getStatus(providerId) {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);
  return await adapter.getStatus();
}

async function listFiles(providerId, remotePath = "") {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);
  return await adapter.list(remotePath);
}

async function uploadFile(providerId, localPath, remotePath) {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);
  return await adapter.upload(localPath, remotePath);
}

async function downloadFile(providerId, remotePath, localPath) {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);
  return await adapter.download(remotePath, localPath);
}

async function renameFile(providerId, remotePath, newName) {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);
  return await adapter.rename(remotePath, newName);
}

async function deleteFile(providerId, remotePath) {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);
  return await adapter.delete(remotePath);
}

async function createFolder(providerId, remotePath, folderName) {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);
  return await adapter.createFolder(remotePath, folderName);
}

// ----------------------------------------------------------
// Sync Engine bindings
// ----------------------------------------------------------
async function syncJob(jobId, eventSender) {
  await secureCredentials.initCredentials();
  const db = syncEngine.loadSyncDb();
  const job = db.syncJobs[jobId];
  if (!job) throw new Error("Sync job not configured.");
  
  const adapter = adapters[job.providerId];
  if (!adapter) throw new Error("Adapter not loaded for sync: " + job.providerId);

  return await syncEngine.runSync(jobId, adapter, eventSender);
}

function getConflicts() {
  const db = syncEngine.loadSyncDb();
  return db.conflicts || [];
}

async function resolveConflict(jobId, relativePath, resolution) {
  await secureCredentials.initCredentials();
  const db = syncEngine.loadSyncDb();
  const conflictIdx = db.conflicts.findIndex(c => c.jobId === jobId && c.relativePath === relativePath);
  if (conflictIdx === -1) return { success: false, error: "Conflict not found" };
  
  const conflict = db.conflicts[conflictIdx];
  const job = db.syncJobs[jobId];
  const adapter = adapters[job.providerId];

  try {
    if (resolution === "keep-local") {
      // Overwrite remote with local
      await adapter.upload(conflict.localPath, conflict.remotePath);
    } else if (resolution === "keep-cloud") {
      // Overwrite local with remote
      await adapter.download(conflict.remotePath, conflict.localPath);
    } else if (resolution === "keep-both") {
      // Rename local file and upload remote with suffix
      const ext = path.extname(conflict.localPath);
      const base = conflict.localPath.replace(ext, "");
      const newLocal = `${base}_local_${Date.now()}${ext}`;
      fs.renameSync(conflict.localPath, newLocal);
      
      // Download cloud version to the original path
      await adapter.download(conflict.remotePath, conflict.localPath);
    }

    // Clear conflict entry
    db.conflicts.splice(conflictIdx, 1);
    
    // Update job file mapping status
    if (job.files && job.files[relativePath]) {
      job.files[relativePath].status = "Synced";
    }
    
    syncEngine.saveSyncDb(db);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ----------------------------------------------------------
// Offline Cache Management
// ----------------------------------------------------------
async function markOffline(providerId, remotePath) {
  await secureCredentials.initCredentials();
  const adapter = adapters[providerId];
  if (!adapter) throw new Error("Unknown provider: " + providerId);

  const db = loadOfflineDb();
  db[providerId] = db[providerId] || {};

  const localCachePath = path.join(appDataDir, "CloudCache", providerId, remotePath.replace(/\//g, "\\"));
  fs.mkdirSync(path.dirname(localCachePath), { recursive: true });

  const meta = await adapter.getMetadata(remotePath);
  if (!meta) throw new Error("Remote file not found.");

  await adapter.download(remotePath, localCachePath);

  db[providerId][remotePath] = {
    localPath: localCachePath,
    size: meta.size,
    modified: meta.modified || new Date().toISOString(),
    status: "Synced"
  };

  saveOfflineDb(db);
  return { success: true, localPath: localCachePath };
}

function removeOffline(providerId, remotePath) {
  const db = loadOfflineDb();
  if (db[providerId] && db[providerId][remotePath]) {
    const entry = db[providerId][remotePath];
    if (fs.existsSync(entry.localPath)) {
      fs.unlinkSync(entry.localPath);
    }
    delete db[providerId][remotePath];
    saveOfflineDb(db);
  }
  return { success: true };
}

function getOfflineFiles() {
  const db = loadOfflineDb();
  const list = [];
  for (const providerId in db) {
    for (const remotePath in db[providerId]) {
      const entry = db[providerId][remotePath];
      const existsLocally = fs.existsSync(entry.localPath);
      list.push({
        name: remotePath.split("/").pop(),
        path: remotePath,
        localPath: entry.localPath,
        size: entry.size,
        modified: entry.modified,
        status: existsLocally ? "Available Offline" : "Cloud Only",
        provider: providerId
      });
    }
  }
  return list;
}

module.exports = {
  getProviders,
  connect,
  disconnect,
  getStatus,
  listFiles,
  uploadFile,
  downloadFile,
  renameFile,
  deleteFile,
  createFolder,
  syncJob,
  getConflicts,
  resolveConflict,
  markOffline,
  removeOffline,
  getOfflineFiles
};
