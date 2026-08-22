"use strict";

const { DatabaseError, DatabaseErrorCode } = require("../databaseErrors.cjs");

/**
 * Repository for the future file_ai table
 */
class AIRepository {
  constructor(db, transactionManager) {
    this.db = db;
    this.tx = transactionManager;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._upsertStmt = this.db.prepare(`
      INSERT INTO file_ai (file_id, description, tags, entities, concepts, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_id) DO UPDATE SET
        description = excluded.description,
        tags = excluded.tags,
        entities = excluded.entities,
        concepts = excluded.concepts,
        analyzed_at = excluded.analyzed_at
    `);

    this._findByFileIdStmt = this.db.prepare("SELECT * FROM file_ai WHERE file_id = ?");
    this._deleteByFileIdStmt = this.db.prepare("DELETE FROM file_ai WHERE file_id = ?");
  }

  upsert(fileId, aiData = {}) {
    try {
      const tagsJson = typeof aiData.tags === "string" ? aiData.tags : JSON.stringify(aiData.tags || []);
      const entitiesJson = typeof aiData.entities === "string" ? aiData.entities : JSON.stringify(aiData.entities || {});
      const conceptsJson = typeof aiData.concepts === "string" ? aiData.concepts : JSON.stringify(aiData.concepts || []);

      this._upsertStmt.run(
        fileId,
        aiData.description || "",
        tagsJson,
        entitiesJson,
        conceptsJson,
        aiData.analyzed_at || new Date().toISOString()
      );
      return { success: true };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to upsert file_ai for ${fileId}: ${err.message}`,
        err
      );
    }
  }

  findByFileId(fileId) {
    const row = this._findByFileIdStmt.get(fileId);
    if (!row) return null;

    return {
      file_id: row.file_id,
      description: row.description,
      tags: JSON.parse(row.tags || "[]"),
      entities: JSON.parse(row.entities || "[]"),
      concepts: JSON.parse(row.concepts || "[]"),
      analyzed_at: row.analyzed_at,
    };
  }

  deleteByFileId(fileId) {
    try {
      const res = this._deleteByFileIdStmt.run(fileId);
      return { success: true, changes: res.changes };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to delete file_ai for ${fileId}: ${err.message}`,
        err
      );
    }
  }
}

module.exports = {
  AIRepository,
};
