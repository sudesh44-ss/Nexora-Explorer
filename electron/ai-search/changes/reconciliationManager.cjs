"use strict";

const fs = require("fs");
const { FileScanner } = require("../discovery/fileScanner.cjs");
const { ChangeType, EventSource, createChangeEvent } = require("./changeEvents.cjs");

class ReconciliationManager {
  constructor(db, changeCoordinator) {
    this.db = db;
    this.coordinator = changeCoordinator;
    this.scanner = new FileScanner();
  }

  /**
   * Reconciles a directory comparing actual disk files against SQLite index
   */
  async reconcileDirectory(targetDir, options = {}) {
    if (!fs.existsSync(targetDir)) {
      return { success: false, error: `Directory not found: ${targetDir}` };
    }

    const scanResult = await this.scanner.scan({ locations: [targetDir], ...options });
    const diskFiles = scanResult.files || [];
    const diskPathMap = new Map(diskFiles.map((f) => [f.path, f]));

    // Query existing records in SQLite for this folder
    const raw = this.db?.db || this.db;
    const dbFiles = raw && typeof raw.prepare === "function"
      ? raw.prepare("SELECT * FROM files").all()
      : (this.db?.files?.list({ limit: 10000 })?.items || []);
    const relevantDbFiles = dbFiles.filter((f) => f.path && f.path.startsWith(targetDir));
    const dbPathMap = new Map(relevantDbFiles.map((f) => [f.path, f]));

    const detectedChanges = [];

    // 1. Check for New and Modified files on disk
    for (const [diskPath, diskRecord] of diskPathMap.entries()) {
      const dbRec = dbPathMap.get(diskPath);
      if (!dbRec) {
        // New file
        detectedChanges.push(createChangeEvent({
          type: ChangeType.CREATE,
          path: diskPath,
          source: EventSource.RECONCILIATION,
          extra: { fileRecord: diskRecord },
        }));
      } else if (dbRec.hash && diskRecord.hash && dbRec.hash !== diskRecord.hash) {
        // Modified file
        detectedChanges.push(createChangeEvent({
          type: ChangeType.CONTENT_MODIFIED,
          path: diskPath,
          source: EventSource.RECONCILIATION,
          extra: { fileRecord: diskRecord, oldHash: dbRec.hash, newHash: diskRecord.hash },
        }));
      }
    }

    // 2. Check for Deleted files (in DB but not on disk)
    for (const [dbPath, dbRec] of dbPathMap.entries()) {
      if (!diskPathMap.has(dbPath)) {
        detectedChanges.push(createChangeEvent({
          type: ChangeType.DELETE,
          path: dbPath,
          source: EventSource.RECONCILIATION,
          extra: { fileId: dbRec.file_id },
        }));
      }
    }

    // Process detected changes through ChangeCoordinator
    for (const change of detectedChanges) {
      await this.coordinator.processChangeEvent(change);
    }

    return {
      success: true,
      scannedDisk: diskFiles.length,
      knownDb: relevantDbFiles.length,
      changesDetected: detectedChanges.length,
    };
  }
}

module.exports = {
  ReconciliationManager,
};
