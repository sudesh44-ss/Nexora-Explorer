"use strict";

const { DatabaseError, DatabaseErrorCode } = require("../databaseErrors.cjs");

/**
 * FTS5 Search and Index Manager
 */
class FTSManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * Verifies if FTS5 module and file_search table are working properly
   * @returns {boolean}
   */
  isAvailable() {
    try {
      const row = this.db.prepare("SELECT count(*) as count FROM file_search").get();
      return row !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Sanitizes natural language query into safe FTS5 query string
   * @param {string} rawQuery
   * @returns {string} Sanitized FTS5 MATCH expression
   */
  sanitizeQuery(rawQuery) {
    if (!rawQuery || typeof rawQuery !== "string") return "";

    // Remove SQLite FTS special control characters: " * ^ : { } ( ) [ ]
    const cleaned = rawQuery.replace(/["*^:{}\(\)\[\]]/g, " ").trim();
    if (!cleaned) return "";

    const terms = cleaned
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    if (terms.length === 0) return "";

    return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(" AND ");
  }

  /**
   * Executes keyword search across FTS5 virtual table
   * @param {string} queryStr - User query
   * @param {Object} [options] - Limit, offset
   * @returns {Array<{file_id: string, filename: string, folder: string, rank: number}>}
   */
  search(queryStr, options = {}) {
    const ftsQuery = this.sanitizeQuery(queryStr);
    if (!ftsQuery) return [];

    const limit = Math.min(options.limit || 100, 500);
    const offset = options.offset || 0;

    try {
      const stmt = this.db.prepare(`
        SELECT
          file_id,
          filename,
          folder,
          rank
        FROM file_search
        WHERE file_search MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `);

      return stmt.all(ftsQuery, limit, offset);
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_FTS_FAILED,
        `FTS5 search execution failed for query '${queryStr}': ${err.message}`,
        err
      );
    }
  }

  /**
   * Updates FTS5 content fields
   */
  updateSearchableContent(fileId, content = {}) {
    try {
      const stmt = this.db.prepare(`
        UPDATE file_search
        SET text = COALESCE(?, text),
            description = COALESCE(?, description),
            tags = COALESCE(?, tags),
            keywords = COALESCE(?, keywords)
        WHERE file_id = ?
      `);

      stmt.run(
        content.text !== undefined ? content.text : null,
        content.description !== undefined ? content.description : null,
        content.tags !== undefined ? content.tags : null,
        content.keywords !== undefined ? content.keywords : null,
        fileId
      );
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_FTS_FAILED,
        `Failed to update FTS content for file ${fileId}: ${err.message}`,
        err
      );
    }
  }

  deleteByFileId(fileId) {
    try {
      const stmt = this.db.prepare("DELETE FROM file_search WHERE file_id = ?");
      return stmt.run(fileId);
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_FTS_FAILED,
        `Failed to delete FTS entry for file ${fileId}: ${err.message}`,
        err
      );
    }
  }
}

module.exports = {
  FTSManager,
};
