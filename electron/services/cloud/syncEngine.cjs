"use strict";

const fs = require("fs");
const path = require("path");

const os = require("os");
const appDataDir = path.join(os.homedir(), ".gemini", "antigravity");
const syncDbFile = path.join(appDataDir, "sync_db.json");

function loadSyncDb() {
  try {
    if (!fs.existsSync(syncDbFile)) {
      return { syncJobs: {}, conflicts: [] };
    }
    const raw = fs.readFileSync(syncDbFile, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load sync database:", e);
    return { syncJobs: {}, conflicts: [] };
  }
}

function saveSyncDb(db) {
  try {
    fs.mkdirSync(path.dirname(syncDbFile), { recursive: true });
    fs.writeFileSync(syncDbFile, JSON.stringify(db, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("Failed to save sync database:", e);
    return false;
  }
}

// Perform folder synchronization
async function runSync(jobId, providerAdapter, eventSender = null) {
  const db = loadSyncDb();
  const job = db.syncJobs[jobId];
  if (!job) {
    throw new Error(`Sync job ${jobId} not found.`);
  }

  // Clear existing conflicts for this job
  db.conflicts = db.conflicts.filter(c => c.jobId !== jobId);
  saveSyncDb(db);

  const localRoot = job.localPath;
  const remoteRoot = job.remotePath;
  const syncMode = job.syncMode; // "one-way" (local -> cloud), "two-way" (both ways), "manual"

  try {
    // 1. Gather local files metadata
    const localFiles = walkLocalDir(localRoot);
    
    // 2. Gather remote files metadata
    const remoteRes = await providerAdapter.list(remoteRoot);
    if (!remoteRes.success) {
      throw new Error(`Failed to list remote directory: ${remoteRes.error}`);
    }
    const remoteFiles = remoteRes.files || [];

    // Create maps for easy lookup
    const localMap = new Map(localFiles.map(f => [f.relativePath, f]));
    const remoteMap = new Map(remoteFiles.map(f => [f.relativePath || f.path, f]));

    // Track statistics
    let filesProcessed = 0;
    const totalFiles = localMap.size + remoteMap.size;
    let bytesRemaining = 0;

    const reportProgress = (details) => {
      if (eventSender) {
        eventSender.send("cloud:sync-progress", {
          jobId,
          progress: Math.floor((filesProcessed / (totalFiles || 1)) * 100),
          filesProcessed,
          totalFiles,
          bytesRemaining,
          statusText: details
        });
      }
    };

    // Calculate initial bytes remaining
    for (const [relPath, lf] of localMap.entries()) {
      const rf = remoteMap.get(relPath);
      if (!rf || lf.size !== rf.size) {
        bytesRemaining += lf.size;
      }
    }

    job.files = job.files || {};

    // 3. Sync local -> cloud
    for (const [relPath, lf] of localMap.entries()) {
      const rf = remoteMap.get(relPath);
      const lastSyncFile = job.files[relPath];

      if (!rf) {
        // Exists only locally
        if (syncMode === "one-way" || syncMode === "two-way") {
          reportProgress(`Uploading: ${lf.name}`);
          const destRemotePath = path.join(remoteRoot, relPath).replace(/\\/g, "/");
          await providerAdapter.upload(lf.fullPath, destRemotePath);
          job.files[relPath] = {
            size: lf.size,
            localMtime: lf.mtime,
            remoteMtime: Date.now(),
            status: "Synced"
          };
        }
      } else {
        // Exists on both sides
        const localChanged = !lastSyncFile || lf.mtime > lastSyncFile.localMtime;
        const remoteChanged = !lastSyncFile || new Date(rf.modified).getTime() > lastSyncFile.remoteMtime;

        if (localChanged && remoteChanged && syncMode === "two-way") {
          // Conflict!
          job.files[relPath] = {
            size: lf.size,
            localMtime: lf.mtime,
            remoteMtime: new Date(rf.modified).getTime(),
            status: "Conflict"
          };
          db.conflicts.push({
            jobId,
            relativePath: relPath,
            localPath: lf.fullPath,
            remotePath: rf.path,
            localMtime: lf.mtime,
            remoteMtime: new Date(rf.modified).getTime(),
            size: lf.size
          });
        } else if (localChanged) {
          // Only local changed
          reportProgress(`Uploading modified: ${lf.name}`);
          await providerAdapter.upload(lf.fullPath, rf.path);
          job.files[relPath] = {
            size: lf.size,
            localMtime: lf.mtime,
            remoteMtime: Date.now(),
            status: "Synced"
          };
        } else if (remoteChanged && syncMode === "two-way") {
          // Only remote changed
          reportProgress(`Downloading modified: ${rf.name}`);
          await providerAdapter.download(rf.path, lf.fullPath);
          job.files[relPath] = {
            size: rf.size,
            localMtime: fs.statSync(lf.fullPath).mtimeMs,
            remoteMtime: new Date(rf.modified).getTime(),
            status: "Synced"
          };
        } else {
          job.files[relPath].status = "Synced";
        }
      }
      filesProcessed++;
      reportProgress(`Processed ${lf.name}`);
    }

    // 4. Sync cloud -> local (Files that exist only in cloud)
    if (syncMode === "two-way") {
      for (const [relPath, rf] of remoteMap.entries()) {
        if (!localMap.has(relPath)) {
          reportProgress(`Downloading new remote file: ${rf.name}`);
          const destLocalPath = path.join(localRoot, relPath);
          fs.mkdirSync(path.dirname(destLocalPath), { recursive: true });
          
          await providerAdapter.download(rf.path, destLocalPath);
          job.files[relPath] = {
            size: rf.size,
            localMtime: fs.statSync(destLocalPath).mtimeMs,
            remoteMtime: new Date(rf.modified).getTime(),
            status: "Synced"
          };
          filesProcessed++;
        }
      }
    }

    // Save final status
    db.syncJobs[jobId] = job;
    saveSyncDb(db);

    if (eventSender) {
      eventSender.send("cloud:sync-complete", { jobId, conflictsCount: db.conflicts.filter(c => c.jobId === jobId).length });
    }

    return { success: true, conflicts: db.conflicts.filter(c => c.jobId === jobId) };
  } catch (err) {
    if (eventSender) {
      eventSender.send("cloud:sync-failed", { jobId, error: err.message });
    }
    return { success: false, error: err.message };
  }
}

// Local filesystem helper to map relative paths
function walkLocalDir(dirPath, rootPath = dirPath) {
  let files = [];
  if (!fs.existsSync(dirPath)) return files;
  
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const relPath = path.relative(rootPath, fullPath).replace(/\\/g, "/");
    
    if (item.isDirectory()) {
      files = files.concat(walkLocalDir(fullPath, rootPath));
    } else {
      const stat = fs.statSync(fullPath);
      files.push({
        name: item.name,
        fullPath,
        relativePath: relPath,
        size: stat.size,
        mtime: stat.mtimeMs
      });
    }
  }
  return files;
}

module.exports = {
  loadSyncDb,
  saveSyncDb,
  runSync
};
