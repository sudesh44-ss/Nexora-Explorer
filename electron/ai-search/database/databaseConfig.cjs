"use strict";

const path = require("path");
const os = require("os");
const fs = require("fs");

/**
 * Resolves the OS-appropriate storage directory for Nexora AI Search SQLite DB
 */
function resolveDatabaseDirectory() {
  let baseDir;
  
  try {
    const { app } = require("electron");
    if (app && typeof app.getPath === "function") {
      baseDir = app.getPath("userData");
    }
  } catch {}

  if (!baseDir) {
    baseDir = path.join(os.homedir(), ".nexora");
  }

  const dbDir = path.join(baseDir, "ai-search");
  return dbDir;
}

/**
 * Returns default database configuration
 */
function getDatabaseConfig(customOptions = {}) {
  const dbDir = customOptions.databaseDir || resolveDatabaseDirectory();
  const dbFilename = customOptions.databaseFilename || "nexora_ai_search.db";
  const dbPath = customOptions.databasePath || path.join(dbDir, dbFilename);

  return {
    databaseDir: dbDir,
    databaseFilename: dbFilename,
    databasePath: dbPath,
    pragmas: {
      journal_mode: "WAL",          // Write-Ahead Logging for high concurrency
      synchronous: "NORMAL",        // Fast, reliable safety in WAL mode
      busy_timeout: 5000,           // 5s timeout on write lock
      foreign_keys: "ON",           // Foreign key enforcement
      cache_size: -4000,            // 4MB page cache
    },
    batchSize: 200,                 // Default batch transaction chunk size
    ...customOptions,
  };
}

module.exports = {
  resolveDatabaseDirectory,
  getDatabaseConfig,
};
