"use strict";

const EventEmitter = require("events");
const path = require("path");

const { IndexSession } = require("./indexSession.cjs");
const { IndexQueue, createIndexTask } = require("./indexQueue.cjs");
const { IndexWorker } = require("./indexWorker.cjs");
const { IndexComparator } = require("./indexComparator.cjs");
const { IndexOperation, SessionStatus } = require("./indexState.cjs");
const { IndexErrorCode, IndexerError } = require("./indexErrors.cjs");
const { FileScanner } = require("../discovery/fileScanner.cjs");

/**
 * Central Index Manager orchestrating Discovery, Queue, Comparison, and Database Storage
 */
class IndexManager extends EventEmitter {
  constructor(databaseManager, options = {}) {
    super();
    this.db = databaseManager;
    this.options = {
      batchSize: 100,
      autoReconcile: true,
      ...options,
    };

    this.resourceManager = options.resourceManager || null;
    this.extractionManager = options.extractionManager || null;
    this.pauseSource = "NONE"; // 'NONE' | 'USER' | 'AUTO'
    this.queue = new IndexQueue();
    this.worker = null;
    this.activeSession = null;
    this.scanner = null;
    this.isInitialized = false;

    if (this.resourceManager) {
      this.attachResourceManager(this.resourceManager);
    }
  }

  attachResourceManager(rm) {
    this.resourceManager = rm;
    this.resourceManager.on("auto_pause", () => {
      this.pause(false); // Automated pause
    });
    this.resourceManager.on("auto_resume", () => {
      this.resume(false); // Automated resume
    });
  }

  /**
   * Initializes database and indexer components
   */
  async initialize() {
    if (!this.db.isOpen) {
      await this.db.initialize();
    }
    this.worker = new IndexWorker(this.queue, this.db.files, {
      batchSize: this.options.batchSize,
      resourceManager: this.resourceManager,
      extractionManager: this.extractionManager,
      db: this.db,
    });
    this.isInitialized = true;
    return { success: true };
  }

  /**
   * Starts an explicit indexing run across specified locations
   *
   * @param {Object} options - Locations and scanner options
   * @returns {Promise<Object>} Final session summary
   */
  async start(options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.activeSession && this.activeSession.status === SessionStatus.RUNNING) {
      throw new IndexerError(IndexErrorCode.INDEX_SESSION_FAILED, "An indexing session is already running.");
    }

    const locations = options.locations || this.db.config.indexedLocations || [];
    if (!Array.isArray(locations) || locations.length === 0) {
      throw new IndexerError(IndexErrorCode.INDEX_SESSION_FAILED, "No locations provided for indexing.");
    }

    this.activeSession = new IndexSession(locations, options);
    this.activeSession.start();
    this.emit("session_start", this.activeSession.getProgress());

    const discoveredPathSet = new Set();
    const failedFolderSet = new Set();

    this.scanner = new FileScanner({
      ...options,
      locations,
      maxConcurrency: options.maxConcurrency || 16,
      includeHidden: options.includeHidden || false,
    });

    // Handle scanner progress
    this.scanner.on("progress", (p) => {
      this.activeSession.setCurrentPath(p.currentPath);
      this.activeSession.counters.foldersScanned = p.foldersScanned;
      this._emitProgress();
    });

    // Handle scanner error
    this.scanner.on("error", (err) => {
      if (err?.path) {
        failedFolderSet.add(path.normalize(err.path).toLowerCase());
      }
      this.activeSession.recordFailed(err, err.path);
      this._emitProgress();
    });

    // Handle discovered file: evaluate via IndexComparator and enqueue if needed
    this.scanner.on("file", (fileRecord) => {
      this.activeSession.recordDiscovered();
      const normPath = path.normalize(fileRecord.path).toLowerCase();
      discoveredPathSet.add(normPath);

      // Compare against existing DB record
      const existing = this.db.files.findByPath(fileRecord.path);
      const { operation } = IndexComparator.compare(fileRecord, existing);

      if (operation === IndexOperation.UNCHANGED) {
        // Fast skip - already indexed and unmodified
        this.activeSession.recordSkipped(1);
      } else {
        // Enqueue new or modified file for batch indexing
        const task = createIndexTask(fileRecord, operation);
        this.queue.push(task);
      }

      this._emitProgress();
    });

    try {
      // 1. Run filesystem scanner
      const scanPromise = this.scanner.scan();

      // 2. Concurrently drain queue with worker
      const workerPromise = (async () => {
        while (this.activeSession.status === SessionStatus.RUNNING) {
          if (!this.queue.isEmpty()) {
            await this.worker.processAll(this.activeSession);
            this._emitProgress();
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
          // If scanner finished and queue is empty, exit worker loop
          if (this.scanner.status !== "scanning" && this.queue.isEmpty()) {
            break;
          }
        }
      })();

      await Promise.all([scanPromise, workerPromise]);

      // Drain any final items in queue
      if (!this.queue.isEmpty()) {
        await this.worker.processAll(this.activeSession);
      }

      // 3. Optional Reconciliation of missing files (only in completely scanned folders)
      if (this.options.autoReconcile && this.activeSession.status !== SessionStatus.CANCELLING) {
        await this._reconcileMissingFiles(locations, discoveredPathSet, failedFolderSet);
      }

      const finalStatus = this.activeSession.status === SessionStatus.CANCELLING
        ? SessionStatus.CANCELLED
        : SessionStatus.COMPLETED;

      this.activeSession.complete(finalStatus);
      this.emit("session_complete", this.activeSession.getProgress());

      return this.activeSession.getProgress();
    } catch (err) {
      if (this.activeSession) {
        this.activeSession.complete(SessionStatus.FAILED);
      }
      throw new IndexerError(
        IndexErrorCode.INDEX_SESSION_FAILED,
        `Indexing session encountered an error: ${err.message}`,
        err
      );
    } finally {
      this.scanner = null;
    }
  }

  /**
   * Pauses the active indexing session
   * @param {boolean} [isUser=true] - Whether pause was initiated by user or automated resource throttling
   */
  pause(isUser = true) {
    if (this.activeSession && this.activeSession.status === SessionStatus.RUNNING) {
      this.pauseSource = isUser ? "USER" : "AUTO";
      this.activeSession.pause();
      this.queue.pause();
      this.emit("session_pause", {
        ...this.activeSession.getProgress(),
        pauseSource: this.pauseSource,
      });
    }
  }

  /**
   * Resumes a paused indexing session
   * @param {boolean} [isUser=true] - Whether resume was initiated by user or automated resource recovery
   */
  resume(isUser = true) {
    // If automated resume triggered, but user manually paused, strictly keep paused!
    if (!isUser && this.pauseSource === "USER") {
      return false;
    }

    if (this.activeSession && this.activeSession.status === SessionStatus.PAUSED) {
      this.pauseSource = "NONE";
      this.activeSession.resume();
      this.queue.resume();
      this.emit("session_resume", this.activeSession.getProgress());
      return true;
    }
    return false;
  }

  /**
   * Cancels the active indexing session safely
   */
  cancel() {
    if (this.activeSession) {
      this.activeSession.cancel();
      if (this.scanner) {
        this.scanner.cancel();
      }
      if (this.worker) {
        this.worker.stop();
      }
      this.emit("session_cancel", this.activeSession.getProgress());
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      session: this.activeSession ? this.activeSession.getProgress() : null,
      queueSize: this.queue.size(),
      dbStats: this.db.isOpen ? this.db.getStats() : null,
    };
  }

  /**
   * Reconciles missing files under successfully scanned locations
   */
  async _reconcileMissingFiles(locations, discoveredPaths, failedFolders) {
    try {
      for (const loc of locations) {
        const normLoc = path.normalize(loc).toLowerCase();
        
        // Fetch all files in DB under this location
        const dbFiles = this.db.files.list({ limit: 10000 });
        for (const file of dbFiles) {
          const normFilePath = path.normalize(file.path).toLowerCase();
          
          if (normFilePath.startsWith(normLoc)) {
            // Check if file was discovered
            if (!discoveredPaths.has(normFilePath)) {
              // Safety Check: Was parent folder in failedFolders?
              const isUnderFailedFolder = Array.from(failedFolders).some((fDir) =>
                normFilePath.startsWith(fDir)
              );

              if (!isUnderFailedFolder) {
                // Folder was scanned cleanly, but file was missing -> Mark unavailable
                this.db.files.updateStatus(file.file_id, "unavailable", "File no longer present on disk");
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[IndexManager] Warning during missing file reconciliation:", err.message);
    }
  }

  _emitProgress() {
    if (this.activeSession) {
      this.emit("progress", this.activeSession.getProgress());
    }
  }

  /**
   * Shuts down indexing subsystem safely
   */
  async shutdown() {
    this.cancel();
    this.queue.clear();
    this.isInitialized = false;
    this.activeSession = null;
  }
}

module.exports = {
  IndexManager,
};
