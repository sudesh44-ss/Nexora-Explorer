"use strict";

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const { DatabaseError, DatabaseErrorCode } = require("./databaseErrors.cjs");
const { getDatabaseConfig } = require("./databaseConfig.cjs");
const { DatabaseSchema } = require("./databaseSchema.cjs");
const { TransactionManager } = require("./transactions/transactionManager.cjs");
const { FTSManager } = require("./fts/ftsManager.cjs");
const { FileRepository } = require("./repositories/fileRepository.cjs");
const { ContentRepository } = require("./repositories/contentRepository.cjs");
const { AIRepository } = require("./repositories/aiRepository.cjs");
const { ScannerDatabaseAdapter } = require("./adapters/scannerDatabaseAdapter.cjs");

/**
 * High-Level SQLite Database Manager for Nexora AI Search
 */
class DatabaseManager {
  constructor(options = {}) {
    this.config = getDatabaseConfig(options);
    this.db = null;
    this.isOpen = false;

    // Subsystems & Repositories
    this.schema = null;
    this.tx = null;
    this.fts = null;
    this.files = null;
    this.content = null;
    this.ai = null;
    this.adapter = null;
  }

  /**
   * Initializes and opens the SQLite database, applies migrations, and sets up repositories
   */
  async initialize() {
    if (this.isOpen) {
      return { success: true, alreadyOpen: true, path: this.config.databasePath };
    }

    try {
      // Ensure directory exists
      if (this.config.databaseDir && this.config.databaseDir !== ":memory:") {
        fs.mkdirSync(this.config.databaseDir, { recursive: true });
      }

      // Open SQLite database
      this.db = new DatabaseSync(this.config.databasePath);
      this.isOpen = true;

      // Configure PRAGMAs
      this._applyPragmas();

      // Initialize Migration Manager & Run Migrations
      this.schema = new DatabaseSchema(this.db);
      const migrationResult = this.schema.migrate();

      // Initialize Subsystems & Repositories
      this.tx = new TransactionManager(this.db);
      this.fts = new FTSManager(this.db);
      this.files = new FileRepository(this.db, this.tx);
      this.content = new ContentRepository(this.db, this.tx);
      this.ai = new AIRepository(this.db, this.tx);
      this.adapter = new ScannerDatabaseAdapter(this.files, { batchSize: this.config.batchSize });

      return {
        success: true,
        path: this.config.databasePath,
        schemaVersion: migrationResult.currentVersion,
        migrationsApplied: migrationResult.appliedCount,
        ftsAvailable: this.fts.isAvailable(),
      };
    } catch (err) {
      this.close();
      throw new DatabaseError(
        DatabaseErrorCode.DB_OPEN_FAILED,
        `Failed to initialize AI Search Database: ${err.message}`,
        err
      );
    }
  }

  _applyPragmas() {
    if (!this.db) return;

    try {
      if (this.config.pragmas) {
        if (this.config.pragmas.journal_mode) {
          this.db.exec(`PRAGMA journal_mode = ${this.config.pragmas.journal_mode};`);
        }
        if (this.config.pragmas.synchronous) {
          this.db.exec(`PRAGMA synchronous = ${this.config.pragmas.synchronous};`);
        }
        if (this.config.pragmas.busy_timeout) {
          this.db.exec(`PRAGMA busy_timeout = ${this.config.pragmas.busy_timeout};`);
        }
        if (this.config.pragmas.foreign_keys) {
          this.db.exec(`PRAGMA foreign_keys = ${this.config.pragmas.foreign_keys};`);
        }
        if (this.config.pragmas.cache_size) {
          this.db.exec(`PRAGMA cache_size = ${this.config.pragmas.cache_size};`);
        }
      }
    } catch (err) {
      console.warn("[Nexora AI Search DB] Warning: Could not apply all PRAGMAs:", err.message);
    }
  }

  /**
   * Health Check verifying database connectivity, required tables, and FTS5
   */
  healthCheck() {
    if (!this.isOpen || !this.db) {
      return {
        healthy: false,
        error: "Database is not open.",
      };
    }

    try {
      const version = this.schema.getCurrentVersion();
      const ftsWorks = this.fts.isAvailable();
      const filesCount = this.files.count();

      // Check required tables
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      const tableNames = new Set(tables.map((t) => t.name));

      const required = ["files", "file_content", "file_ai", "file_search", "schema_migrations"];
      const missing = required.filter((tbl) => !tableNames.has(tbl));

      const isHealthy = missing.length === 0 && ftsWorks && version > 0;

      return {
        healthy: isHealthy,
        path: this.config.databasePath,
        schemaVersion: version,
        ftsAvailable: ftsWorks,
        filesCount,
        missingTables: missing,
      };
    } catch (err) {
      return {
        healthy: false,
        error: err.message,
      };
    }
  }

  /**
   * SQLite PRAGMA integrity_check
   */
  integrityCheck() {
    if (!this.isOpen || !this.db) {
      return { ok: false, error: "Database is not open." };
    }

    try {
      const row = this.db.prepare("PRAGMA integrity_check;").get();
      const result = Object.values(row || {})[0];
      return {
        ok: result === "ok",
        result,
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message,
      };
    }
  }

  /**
   * Returns database statistics
   */
  getStats() {
    if (!this.isOpen) {
      return { isOpen: false };
    }

    let dbSizeBytes = 0;
    try {
      if (fs.existsSync(this.config.databasePath)) {
        dbSizeBytes = fs.statSync(this.config.databasePath).size;
      }
    } catch {}

    return {
      isOpen: true,
      path: this.config.databasePath,
      sizeBytes: dbSizeBytes,
      totalFiles: this.files.count(),
      discoveredFiles: this.files.count({ status: "discovered" }),
      indexedFiles: this.files.count({ status: "indexed" }),
      errorFiles: this.files.count({ status: "error" }),
      schemaVersion: this.schema.getCurrentVersion(),
    };
  }

  getDatabasePath() {
    return this.config.databasePath;
  }

  /**
   * Closes SQLite connection safely
   */
  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
    }
    this.isOpen = false;
    this.files = null;
    this.content = null;
    this.ai = null;
    this.fts = null;
    this.schema = null;
    this.tx = null;
    this.adapter = null;
  }
}

module.exports = {
  DatabaseManager,
};
