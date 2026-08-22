"use strict";

const { DatabaseError, DatabaseErrorCode } = require("../databaseErrors.cjs");

/**
 * Adapter connecting Part 2 FileScanner to Part 3 Database Repositories
 */
class ScannerDatabaseAdapter {
  constructor(fileRepository, options = {}) {
    this.repo = fileRepository;
    this.batchSize = options.batchSize || 100;
    this._buffer = [];
    this.totalIngested = 0;
  }

  /**
   * Consumes a single FileRecord emitted by scanner
   * @param {Object} fileRecord - FileRecord from Part 2 Scanner
   */
  ingest(fileRecord) {
    if (!fileRecord) return;
    this._buffer.push(fileRecord);

    if (this._buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Ingests an array of FileRecords in bulk
   * @param {Array<Object>} records - Array of FileRecords
   * @returns {{success: boolean, count: number}}
   */
  ingestBatch(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return { success: true, count: 0 };
    }

    const res = this.repo.upsertBatch(records);
    this.totalIngested += res.count;
    return res;
  }

  /**
   * Flushes any buffered records to SQLite in a single transaction
   */
  flush() {
    if (this._buffer.length === 0) {
      return { success: true, count: 0 };
    }

    const batch = this._buffer.splice(0, this._buffer.length);
    const res = this.repo.upsertBatch(batch);
    this.totalIngested += res.count;
    return res;
  }

  /**
   * Attaches scanner event listeners to ingest automatically
   * @param {import("../../discovery/fileScanner.cjs").FileScanner} scanner
   */
  attachScanner(scanner) {
    if (!scanner) return;

    scanner.on("file", (fileRecord) => {
      this.ingest(fileRecord);
    });

    scanner.on("done", () => {
      this.flush();
    });
  }

  getTotalIngested() {
    return this.totalIngested;
  }

  reset() {
    this._buffer = [];
    this.totalIngested = 0;
  }
}

module.exports = {
  ScannerDatabaseAdapter,
};
