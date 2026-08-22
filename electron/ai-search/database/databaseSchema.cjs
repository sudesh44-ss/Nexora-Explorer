"use strict";

const { DatabaseError, DatabaseErrorCode } = require("./databaseErrors.cjs");
const migration001 = require("./migrations/001_initial_schema.cjs");

const MIGRATIONS = [
  migration001,
];

/**
 * Migration & Schema Manager for SQLite
 */
class DatabaseSchema {
  constructor(db) {
    this.db = db;
  }

  initMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);
  }

  getCurrentVersion() {
    this.initMigrationsTable();
    try {
      const row = this.db.prepare("SELECT MAX(version) as max_version FROM schema_migrations").get();
      return row?.max_version || 0;
    } catch {
      return 0;
    }
  }

  migrate() {
    this.initMigrationsTable();
    const currentVersion = this.getCurrentVersion();
    const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);

    if (pending.length === 0) {
      return { currentVersion, appliedCount: 0 };
    }

    let appliedCount = 0;

    for (const migration of pending) {
      try {
        this.db.exec("BEGIN IMMEDIATE;");
        migration.up(this.db);
        
        const stmt = this.db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)");
        stmt.run(migration.version, migration.name, new Date().toISOString());

        this.db.exec("COMMIT;");
        appliedCount++;
      } catch (err) {
        try {
          this.db.exec("ROLLBACK;");
        } catch {}
        throw new DatabaseError(
          DatabaseErrorCode.DB_MIGRATION_FAILED,
          `Failed to execute migration ${migration.name} (v${migration.version}): ${err.message}`,
          err
        );
      }
    }

    return {
      currentVersion: this.getCurrentVersion(),
      appliedCount,
    };
  }
}

module.exports = {
  DatabaseSchema,
  MIGRATIONS,
};
