"use strict";

const EventEmitter = require("events");
const fsp = require("fs").promises;
const path = require("path");
const { getDefaultScanOptions, ScanStatus } = require("./scanTypes.cjs");
const { readMetadata } = require("./metadataReader.cjs");
const { classifyNodeError, ScanErrorCode } = require("./scanErrors.cjs");

/**
 * Concurrency Limiter (Semaphore)
 */
class ConcurrencyLimiter {
  constructor(limit = 16) {
    this.limit = limit;
    this.activeCount = 0;
    this.queue = [];
  }

  run(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._next();
    });
  }

  _next() {
    if (this.activeCount >= this.limit || this.queue.length === 0) {
      return;
    }

    const { fn, resolve, reject } = this.queue.shift();
    this.activeCount++;

    Promise.resolve()
      .then(() => fn())
      .then((val) => {
        this.activeCount--;
        resolve(val);
        this._next();
      })
      .catch((err) => {
        this.activeCount--;
        reject(err);
        this._next();
      });
  }
}

/**
 * Match glob-like exclusion pattern on subpaths
 */
function matchesPattern(subPath, pattern) {
  const normalized = ("/" + subPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") + "/").toLowerCase();
  let cleanPattern = pattern.replace(/\\/g, "/").toLowerCase();
  
  if (cleanPattern.startsWith("**/")) {
    cleanPattern = cleanPattern.slice(3);
  }
  if (cleanPattern.endsWith("/**")) {
    cleanPattern = cleanPattern.slice(0, -3);
  }

  const segment = "/" + cleanPattern.replace(/^\/+|\/+$/g, "") + "/";
  return normalized.includes(segment);
}

/**
 * Robust, Non-Blocking, Event-Driven File Discovery Engine
 */
class FileScanner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = { ...getDefaultScanOptions(), ...options };
    this.status = ScanStatus.IDLE;
    this._abortController = null;
    this._visitedRealPaths = new Set();
    this._limiter = new ConcurrencyLimiter(this.options.maxConcurrency || 16);
    this.stats = {
      filesDiscovered: 0,
      foldersScanned: 0,
      errorsCount: 0,
      startedAt: null,
      endedAt: null,
      elapsedMs: 0,
    };
  }

  /**
   * Starts file discovery scan across the configured or provided locations
   *
   * @param {Object} [scanOverrides] - Override locations or options for this run
   * @returns {Promise<{files: Array, folders: Array, errors: Array, stats: Object, cancelled: boolean}>}
   */
  async scan(scanOverrides = {}) {
    if (this.status === ScanStatus.SCANNING) {
      throw new Error("FileScanner is already running. Cancel existing scan first.");
    }

    const config = { ...this.options, ...scanOverrides };
    const locations = Array.isArray(config.locations) ? config.locations : [config.locations].filter(Boolean);

    if (locations.length === 0) {
      throw new Error("No locations provided for file discovery scan.");
    }

    this.status = ScanStatus.SCANNING;
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    this._visitedRealPaths.clear();
    this._limiter = new ConcurrencyLimiter(config.maxConcurrency || 16);

    this.stats = {
      filesDiscovered: 0,
      foldersScanned: 0,
      errorsCount: 0,
      startedAt: new Date().toISOString(),
      endedAt: null,
      elapsedMs: 0,
    };

    const discoveredFiles = [];
    const discoveredFolders = [];
    const scanErrors = [];
    const startTime = Date.now();

    this._emitProgress("Starting scan...", null);

    try {
      for (const loc of locations) {
        if (signal.aborted) break;
        await this._scanRootLocation(loc, config, signal, discoveredFiles, discoveredFolders, scanErrors);
      }
    } finally {
      this.stats.endedAt = new Date().toISOString();
      this.stats.elapsedMs = Date.now() - startTime;
      const cancelled = signal.aborted;
      this.status = cancelled ? ScanStatus.CANCELLED : ScanStatus.COMPLETED;

      const summary = {
        files: discoveredFiles,
        folders: discoveredFolders,
        errors: scanErrors,
        stats: { ...this.stats },
        cancelled,
      };

      this.emit("done", summary);
      this._emitProgress(cancelled ? "Scan cancelled." : "Scan complete.", null);

      return summary;
    }
  }

  /**
   * Cancels any active scan safely
   */
  cancel() {
    if (this.status === ScanStatus.SCANNING && this._abortController) {
      this._abortController.abort();
      this.status = ScanStatus.CANCELLED;
      this.emit("cancelled");
    }
  }

  getStatus() {
    return {
      status: this.status,
      stats: { ...this.stats },
    };
  }

  // ----------------------------------------------------------
  // Internal Traversal Logic
  // ----------------------------------------------------------

  _emitProgress(statusText, currentPath) {
    const payload = {
      status: this.status,
      message: statusText,
      currentPath: currentPath || "",
      filesDiscovered: this.stats.filesDiscovered,
      foldersScanned: this.stats.foldersScanned,
      errorsCount: this.stats.errorsCount,
      elapsedMs: this.stats.startedAt ? Date.now() - new Date(this.stats.startedAt).getTime() : 0,
    };
    this.emit("progress", payload);
  }

  _emitError(err) {
    if (this.listenerCount("error") > 0) {
      this.emit("error", err);
    }
  }

  _isExcluded(targetPath, config) {
    if (!config.excludedPatterns || !Array.isArray(config.excludedPatterns)) {
      return false;
    }
    return config.excludedPatterns.some((pattern) => matchesPattern(targetPath, pattern));
  }

  async _scanRootLocation(rawLocation, config, signal, fileAcc, folderAcc, errorAcc) {
    const rootPath = path.normalize(rawLocation.trim());

    try {
      // Check realpath for junction/symlink loop detection
      const real = await fsp.realpath(rootPath).catch(() => rootPath);
      if (this._visitedRealPaths.has(real)) {
        return;
      }
      this._visitedRealPaths.add(real);
    } catch (err) {
      const classified = classifyNodeError(err, rootPath);
      this.stats.errorsCount++;
      errorAcc.push(classified);
      this._emitError(classified);
      return;
    }

    // Inspect Root entry itself
    const rootMeta = await readMetadata(rootPath, { ...config, signal });
    if (!rootMeta.success) {
      if (rootMeta.error) {
        this.stats.errorsCount++;
        errorAcc.push(rootMeta.error);
        this._emitError(rootMeta.error);
      }
      return;
    }

    if (!rootMeta.isDirectory) {
      // Root location is a single file
      if (rootMeta.record) {
        this.stats.filesDiscovered++;
        fileAcc.push(rootMeta.record);
        this.emit("file", rootMeta.record);
      }
      return;
    }

    if (rootMeta.record) {
      this.stats.foldersScanned++;
      folderAcc.push(rootMeta.record);
      this.emit("folder", rootMeta.record);
    }

    // Traverse directory tree recursively
    await this._traverseDirectory(rootPath, rootPath, 1, config, signal, fileAcc, folderAcc, errorAcc);
  }

  async _traverseDirectory(rootPath, currentDir, currentDepth, config, signal, fileAcc, folderAcc, errorAcc) {
    if (signal.aborted) return;
    if (currentDepth > (config.maxDepth || Infinity)) return;

    this._emitProgress("Scanning folder...", currentDir);

    let entries = [];
    try {
      entries = await fsp.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      const errorObj = classifyNodeError(err, currentDir);
      this.stats.errorsCount++;
      errorAcc.push(errorObj);
      this._emitError(errorObj);
      return;
    }

    const subdirectories = [];
    const fileTasks = [];

    for (const entry of entries) {
      if (signal.aborted) break;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootPath, fullPath);

      // Check exclusions on relative path within root
      if (this._isExcluded(relPath, config) || this._isExcluded(entry.name, config)) {
        continue;
      }

      // Check hidden filter
      if (!config.includeHidden && entry.name.startsWith(".")) {
        continue;
      }

      if (entry.isDirectory()) {
        subdirectories.push(fullPath);
      } else if (entry.isFile()) {
        fileTasks.push(fullPath);
      } else if (entry.isSymbolicLink()) {
        if (config.followSymlinks) {
          subdirectories.push(fullPath);
        }
      }
    }

    // Process files in this folder with bounded concurrency
    const processFile = async (filePath) => {
      if (signal.aborted) return;
      const meta = await readMetadata(filePath, { ...config, signal });
      if (meta.success && meta.record) {
        this.stats.filesDiscovered++;
        fileAcc.push(meta.record);
        this.emit("file", meta.record);
      } else if (meta.error) {
        this.stats.errorsCount++;
        errorAcc.push(meta.error);
        this._emitError(meta.error);
      }
    };

    // Run file metadata readers through limiter
    await Promise.all(fileTasks.map((fPath) => this._limiter.run(() => processFile(fPath))));

    // Traverse subdirectories recursively
    if (config.recursive) {
      for (const subDir of subdirectories) {
        if (signal.aborted) break;

        // Loop detection
        try {
          const real = await fsp.realpath(subDir).catch(() => subDir);
          if (this._visitedRealPaths.has(real)) {
            const loopErr = {
              code: ScanErrorCode.SYMLINK_LOOP_DETECTED,
              path: subDir,
              message: `Symlink or junction loop detected; skipped: ${subDir}`,
              timestamp: new Date().toISOString(),
            };
            this.stats.errorsCount++;
            errorAcc.push(loopErr);
            this._emitError(loopErr);
            continue;
          }
          this._visitedRealPaths.add(real);
        } catch {}

        this.stats.foldersScanned++;
        const folderRec = {
          name: path.basename(subDir),
          path: path.normalize(subDir),
          parent_path: currentDir,
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          is_hidden: path.basename(subDir).startsWith("."),
          is_system: false,
          is_symlink: false,
        };
        folderAcc.push(folderRec);
        this.emit("folder", folderRec);

        await this._traverseDirectory(rootPath, subDir, currentDepth + 1, config, signal, fileAcc, folderAcc, errorAcc);
      }
    }
  }
}

module.exports = {
  FileScanner,
  ConcurrencyLimiter,
};
