"use strict";

const { DatabaseError, DatabaseErrorCode } = require("../databaseErrors.cjs");

/**
 * Repository for the future file_content table
 */
class ContentRepository {
  constructor(db, transactionManager) {
    this.db = db;
    this.tx = transactionManager;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._upsertStmt = this.db.prepare(`
      INSERT INTO file_content (file_id, extracted_text, summary, word_count, extracted_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(file_id) DO UPDATE SET
        extracted_text = excluded.extracted_text,
        summary = excluded.summary,
        word_count = excluded.word_count,
        extracted_at = excluded.extracted_at
    `);

    this._findByFileIdStmt = this.db.prepare("SELECT * FROM file_content WHERE file_id = ?");
    this._deleteByFileIdStmt = this.db.prepare("DELETE FROM file_content WHERE file_id = ?");
  }

  upsert(fileId, content = {}) {
    try {
      this._upsertStmt.run(
        fileId,
        content.extracted_text || "",
        content.summary || "",
        content.word_count || 0,
        content.extracted_at || new Date().toISOString()
      );
      return { success: true };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to upsert file_content for ${fileId}: ${err.message}`,
        err
      );
    }
  }

  findByFileId(fileId) {
    return this._findByFileIdStmt.get(fileId) || null;
  }

  deleteByFileId(fileId) {
    try {
      const res = this._deleteByFileIdStmt.run(fileId);
      return { success: true, changes: res.changes };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to delete file_content for ${fileId}: ${err.message}`,
        err
      );
    }
  }
}

module.exports = {
  ContentRepository,
};
