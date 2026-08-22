"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

// Reuse existing storage services
const driveCapacity = require("./driveCapacity.cjs");
const driveDetection = require("./driveDetection.cjs");
const driveHealth = require("./driveHealth.cjs");

// Cache file path
const cachePath = path.join(os.homedir(), ".gemini", "antigravity", "storage_analytics_cache.json");

// Cancellation status
let scanCancelled = false;

// Categories configuration
const CATEGORY_MAP = {
  Video: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".mpeg", ".mpg", ".m4v"],
  Audio: [".mp3", ".wav", ".aac", ".flac", ".ogg", ".wma", ".m4a", ".alac", ".mid"],
  Image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".svg", ".ico"],
  Documents: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".odt", ".ods", ".odp", ".csv"],
  Archives: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".iso", ".img", ".cab"],
  Applications: [".exe", ".msi", ".apk", ".bat", ".cmd", ".app"],
  Code: [".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".json", ".py", ".java", ".cpp", ".c", ".h", ".cs", ".go", ".rs", ".php", ".sh", ".cjs", ".mjs"]
};

function getCategory(ext) {
  const e = ext.toLowerCase();
  for (const [cat, exts] of Object.entries(CATEGORY_MAP)) {
    if (exts.includes(e)) return cat;
  }
  return "Other";
}

// Ancestor recursive size mapping helpers
function registerFolderToAncestors(folderPath, rootPath, folderMap) {
  const folderNormalized = path.normalize(folderPath).toLowerCase();
  if (!folderMap.has(folderNormalized)) {
    folderMap.set(folderNormalized, {
      name: path.basename(folderPath) || folderPath,
      path: folderPath,
      size: 0,
      fileCount: 0,
      subfolderCount: 0
    });
  }

  let dir = path.dirname(folderPath);
  const rootNormalized = path.normalize(rootPath).toLowerCase();

  while (true) {
    const dirNormalized = path.normalize(dir).toLowerCase();
    let info = folderMap.get(dirNormalized);
    if (!info) {
      info = {
        name: path.basename(dir) || dir,
        path: dir,
        size: 0,
        fileCount: 0,
        subfolderCount: 0
      };
      folderMap.set(dirNormalized, info);
    }
    info.subfolderCount += 1;

    if (dirNormalized === rootNormalized) {
      break;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
}

function addFileToAncestors(filePath, size, rootPath, folderMap) {
  let dir = path.dirname(filePath);
  const rootNormalized = path.normalize(rootPath).toLowerCase();

  while (true) {
    const dirNormalized = path.normalize(dir).toLowerCase();
    let info = folderMap.get(dirNormalized);
    if (!info) {
      info = {
        name: path.basename(dir) || dir,
        path: dir,
        size: 0,
        fileCount: 0,
        subfolderCount: 0
      };
      folderMap.set(dirNormalized, info);
    }
    info.size += size;
    info.fileCount += 1;

    if (dirNormalized === rootNormalized) {
      break;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
}

// Drives overview aggregator
async function getDrivesOverview() {
  try {
    const logical = await driveDetection.getLogicalDrives();
    if (!logical.success) {
      return { success: false, error: logical.error };
    }

    const driveOverview = [];
    for (const d of logical.drives) {
      const letter = d.driveLetter;
      const capacity = await driveCapacity.getDriveCapacity(letter);

      let used = 0;
      let total = 0;
      let free = 0;
      let pct = 0;

      if (capacity.success) {
        used = capacity.used || 0;
        total = capacity.total || 0;
        free = capacity.free || 0;
        pct = capacity.usedPercentage || 0;
      } else {
        used = d.size - d.freeSpace || 0;
        total = d.size || 0;
        free = d.freeSpace || 0;
        pct = total > 0 ? Math.round((used / total) * 100) : 0;
      }

      // Health checks
      let health = "Unknown";
      if (d.isLocal) {
        const hRes = await driveHealth.getAllDriveHealth();
        if (hRes.success) {
          const found = hRes.drives.find(pd => pd.size === total || pd.name.toLowerCase().includes(d.label.toLowerCase()));
          if (found) {
            health = found.healthStatus || "Healthy";
          } else {
            health = "Healthy";
          }
        }
      }

      driveOverview.push({
        driveLetter: letter,
        label: d.label || d.description || "Local Disk",
        totalCapacity: total,
        usedCapacity: used,
        freeCapacity: free,
        percentageUsed: pct,
        filesystem: d.fileSystem || "NTFS",
        driveType: d.type,
        isRemovable: d.isRemovable,
        health
      });
    }

    return { success: true, drives: driveOverview };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Asynchronous directory scanner
async function runStorageScan(rootPath, eventSender) {
  scanCancelled = false;

  let totalUsedBytes = 0;
  const driveLetter = rootPath.slice(0, 2);
  const capacityRes = await driveCapacity.getDriveCapacity(driveLetter);
  if (capacityRes.success) {
    totalUsedBytes = capacityRes.used;
  }

  const folderMap = new Map();
  const categoryStats = {
    Video: { size: 0, count: 0 },
    Audio: { size: 0, count: 0 },
    Image: { size: 0, count: 0 },
    Documents: { size: 0, count: 0 },
    Archives: { size: 0, count: 0 },
    Applications: { size: 0, count: 0 },
    Code: { size: 0, count: 0 },
    Other: { size: 0, count: 0 }
  };

  let largestFiles = [];
  const cleanupCandidates = {
    temp: [],
    cache: [],
    empty: [],
    large: [],
    old: []
  };

  let filesScanned = 0;
  let foldersScanned = 0;
  let bytesAnalyzed = 0;

  const queue = [rootPath];
  let processedItems = 0;

  registerFolderToAncestors(rootPath, rootPath, folderMap);

  while (queue.length > 0) {
    if (scanCancelled) {
      break;
    }

    const currentDir = queue.shift();
    let entries = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      foldersScanned++;
    } catch (e) {
      continue;
    }

    if (entries.length === 0) {
      const norm = path.normalize(currentDir).toLowerCase();
      cleanupCandidates.empty.push({ name: path.basename(currentDir) || currentDir, path: currentDir });
    }

    for (const entry of entries) {
      if (scanCancelled) break;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        queue.push(fullPath);
        registerFolderToAncestors(fullPath, rootPath, folderMap);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          filesScanned++;
          bytesAnalyzed += stat.size;

          const ext = path.extname(entry.name).toLowerCase();
          const cat = getCategory(ext);

          categoryStats[cat].size += stat.size;
          categoryStats[cat].count += 1;

          addFileToAncestors(fullPath, stat.size, rootPath, folderMap);

          largestFiles.push({
            name: entry.name,
            path: fullPath,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            ext
          });

          if (largestFiles.length > 150) {
            largestFiles.sort((a, b) => b.size - a.size);
            largestFiles = largestFiles.slice(0, 100);
          }

          // Cleanup classification
          const isTempDir = fullPath.toLowerCase().includes("\\temp\\") || fullPath.toLowerCase().includes("\\tmp\\");
          const isCacheDir = fullPath.toLowerCase().includes("\\cache\\") || fullPath.toLowerCase().includes("\\caches\\");
          const isOld = (Date.now() - stat.mtimeMs) > 180 * 24 * 60 * 60 * 1000;
          const isLarge = stat.size > 100 * 1024 * 1024; // 100 MB

          if (ext === ".tmp" || ext === ".temp" || ext === ".dmp" || isTempDir) {
            cleanupCandidates.temp.push({ name: entry.name, path: fullPath, size: stat.size });
          } else if (ext === ".log" || ext === ".cache" || ext === ".chk" || isCacheDir) {
            cleanupCandidates.cache.push({ name: entry.name, path: fullPath, size: stat.size });
          }

          if (isOld) {
            cleanupCandidates.old.push({ name: entry.name, path: fullPath, size: stat.size, mtime: stat.mtime.toISOString() });
          }
          if (isLarge) {
            cleanupCandidates.large.push({ name: entry.name, path: fullPath, size: stat.size });
          }

        } catch (err) {
          // File error, skip stat
        }
      }

      processedItems++;
      if (processedItems % 300 === 0) {
        let progress = -1;
        if (totalUsedBytes > 0) {
          progress = Math.min(99, Math.round((bytesAnalyzed / totalUsedBytes) * 100));
        }

        if (eventSender) {
          eventSender.send("storageAnalytics:progress", {
            currentPath: fullPath,
            filesScanned,
            foldersScanned,
            bytesAnalyzed,
            progress
          });
        }

        await new Promise(resolve => setImmediate(resolve));
      }
    }
  }

  if (scanCancelled) {
    return { success: false, error: "Scan cancelled" };
  }

  largestFiles.sort((a, b) => b.size - a.size);
  const top100Files = largestFiles.slice(0, 100);

  const foldersList = Array.from(folderMap.values());
  foldersList.sort((a, b) => b.size - a.size);
  const top100Folders = foldersList.slice(0, 100);

  const result = {
    success: true,
    rootPath,
    timestamp: new Date().toISOString(),
    filesScanned,
    foldersScanned,
    bytesAnalyzed,
    categoryStats,
    largestFiles: top100Files,
    largestFolders: top100Folders,
    cleanupCandidates
  };

  await writeCache(rootPath, result);

  return result;
}

function cancelStorageScan() {
  scanCancelled = true;
  return { success: true };
}

// Cleanup Deletion Executor
async function deleteAnalyticsItem(itemPath) {
  try {
    const stat = await fs.promises.stat(itemPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(itemPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(itemPath);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Caching handlers
async function getCache(targetPath) {
  try {
    if (!fs.existsSync(cachePath)) return { success: true, data: null };
    const data = await fs.promises.readFile(cachePath, "utf8");
    const json = JSON.parse(data || "{}");
    const key = path.normalize(targetPath).toLowerCase();
    return { success: true, data: json[key] || null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function writeCache(targetPath, data) {
  try {
    await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
    let json = {};
    if (fs.existsSync(cachePath)) {
      const existing = await fs.promises.readFile(cachePath, "utf8");
      json = JSON.parse(existing || "{}");
    }
    const key = path.normalize(targetPath).toLowerCase();
    json[key] = data;
    await fs.promises.writeFile(cachePath, JSON.stringify(json, null, 2), "utf8");
  } catch (e) {
    console.error("Cache write failed:", e);
  }
}

async function clearCache() {
  try {
    if (fs.existsSync(cachePath)) {
      await fs.promises.unlink(cachePath);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  getDrivesOverview,
  runStorageScan,
  cancelStorageScan,
  deleteAnalyticsItem,
  getCache,
  clearCache
};
