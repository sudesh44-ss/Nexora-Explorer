"use strict";

const { DatabaseError, DatabaseErrorCode } = require("../databaseErrors.cjs");

/**
 * File Repository for CRUD and Upsert operations on the 'files' table
 */
class FileRepository {
  constructor(db, transactionManager) {
    this.db = db;
    this.tx = transactionManager;

    // Prepared statements for high performance
    this._prepareStatements();
  }

  _prepareStatements() {
    this._insertStmt = this.db.prepare(`
      INSERT INTO files (
        file_id, name, path, extension, size, created_at, modified_at,
        hash, mime_type, status, is_hidden, is_system, is_symlink
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this._upsertStmt = this.db.prepare(`
      INSERT INTO files (
        file_id, name, path, extension, size, created_at, modified_at,
        hash, mime_type, status, is_hidden, is_system, is_symlink
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        file_id = excluded.file_id,
        name = excluded.name,
        extension = excluded.extension,
        size = excluded.size,
        modified_at = excluded.modified_at,
        hash = excluded.hash,
        mime_type = excluded.mime_type,
        status = excluded.status,
        is_hidden = excluded.is_hidden,
        is_system = excluded.is_system,
        is_symlink = excluded.is_symlink
    `);

    this._updateStmt = this.db.prepare(`
      UPDATE files SET
        name = ?,
        path = ?,
        extension = ?,
        size = ?,
        modified_at = ?,
        hash = ?,
        mime_type = ?,
        status = ?,
        is_hidden = ?,
        is_system = ?,
        is_symlink = ?
      WHERE file_id = ?
    `);

    this._findByIdStmt = this.db.prepare("SELECT * FROM files WHERE id = ?");
    this._findByFileIdStmt = this.db.prepare("SELECT * FROM files WHERE file_id = ?");
    this._findByPathStmt = this.db.prepare("SELECT * FROM files WHERE path = ?");
    this._findByHashStmt = this.db.prepare("SELECT * FROM files WHERE hash = ?");
    this._deleteByFileIdStmt = this.db.prepare("DELETE FROM files WHERE file_id = ?");
    this._deleteByPathStmt = this.db.prepare("DELETE FROM files WHERE path = ?");
    
    this._updateStatusStmt = this.db.prepare(`
      UPDATE files SET
        status = ?,
        error_message = ?,
        indexed_at = ?
      WHERE file_id = ?
    `);
  }

  /**
   * Inserts a single FileRecord
   */
  insert(record) {
    try {
      const now = new Date().toISOString();
      const result = this._insertStmt.run(
        record.file_id,
        record.name,
        record.path,
        record.extension || null,
        record.size || 0,
        record.created_at || now,
        record.modified_at || now,
        record.hash || null,
        record.mime_type || null,
        record.status || "discovered",
        record.is_hidden ? 1 : 0,
        record.is_system ? 1 : 0,
        record.is_symlink ? 1 : 0
      );
      return { success: true, id: result.lastInsertRowid };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to insert file record for ${record.path}: ${err.message}`,
        err
      );
    }
  }

  /**
   * Upserts a single FileRecord idempotently
   */
  upsert(record) {
    try {
      const now = new Date().toISOString();
      this._upsertStmt.run(
        record.file_id,
        record.name,
        record.path,
        record.extension || null,
        record.size || 0,
        record.created_at || now,
        record.modified_at || now,
        record.hash || null,
        record.mime_type || null,
        record.status || "discovered",
        record.is_hidden ? 1 : 0,
        record.is_system ? 1 : 0,
        record.is_symlink ? 1 : 0
      );
      return { success: true };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to upsert file record for ${record.path}: ${err.message}`,
        err
      );
    }
  }

  /**
   * Upserts a batch of FileRecords in an atomic transaction
   * @param {Array<Object>} records - Array of FileRecord objects
   * @returns {{success: boolean, count: number}}
   */
  upsertBatch(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return { success: true, count: 0 };
    }

    return this.tx.run(() => {
      let count = 0;
      for (const rec of records) {
        this.upsert(rec);
        count++;
      }
      return { success: true, count };
    });
  }

  /**
   * Updates an existing FileRecord by file_id
   */
  update(record) {
    try {
      const result = this._updateStmt.run(
        record.name,
        record.path,
        record.extension || null,
        record.size || 0,
        record.modified_at,
        record.hash || null,
        record.mime_type || null,
        record.status || "discovered",
        record.is_hidden ? 1 : 0,
        record.is_system ? 1 : 0,
        record.is_symlink ? 1 : 0,
        record.file_id
      );
      return { success: true, changes: result.changes };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to update file record ${record.file_id}: ${err.message}`,
        err
      );
    }
  }

  /**
   * Updates indexing status
   */
  updateStatus(fileId, status, errorMessage = null) {
    try {
      const indexedAt = status === "indexed" ? new Date().toISOString() : null;
      const result = this._updateStatusStmt.run(status, errorMessage, indexedAt, fileId);
      return { success: true, changes: result.changes };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to update status for ${fileId}: ${err.message}`,
        err
      );
    }
  }

  findById(id) {
    return this._findByIdStmt.get(id) || null;
  }

  findByFileId(fileId) {
    return this._findByFileIdStmt.get(fileId) || null;
  }

  findByPath(filePath) {
    return this._findByPathStmt.get(filePath) || null;
  }

  findByHash(hash) {
    return this._findByHashStmt.all(hash);
  }

  findByName(kw, limit = 50) {
    try {
      const stmt = this.db.prepare("SELECT * FROM files WHERE name LIKE ? LIMIT ?");
      return stmt.all(`%${kw}%`, limit);
    } catch {
      return [];
    }
  }

  deleteByFileId(fileId) {
    try {
      const result = this._deleteByFileIdStmt.run(fileId);
      return { success: true, changes: result.changes };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to delete file record ${fileId}: ${err.message}`,
        err
      );
    }
  }

  deleteByPath(filePath) {
    try {
      const result = this._deleteByPathStmt.run(filePath);
      return { success: true, changes: result.changes };
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_WRITE_FAILED,
        `Failed to delete file record at path ${filePath}: ${err.message}`,
        err
      );
    }
  }

  count(filter = {}) {
    try {
      if (filter.status) {
        const row = this.db.prepare("SELECT count(*) as count FROM files WHERE status = ?").get(filter.status);
        return row?.count || 0;
      }
      const row = this.db.prepare("SELECT count(*) as count FROM files").get();
      return row?.count || 0;
    } catch {
      return 0;
    }
  }

  list(options = {}) {
    const limit = Math.min(options.limit || 100, 1000);
    const offset = options.offset || 0;
    const status = options.status;

    try {
      if (status) {
        const stmt = this.db.prepare("SELECT * FROM files WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?");
        return stmt.all(status, limit, offset);
      }
      const stmt = this.db.prepare("SELECT * FROM files ORDER BY id DESC LIMIT ? OFFSET ?");
      return stmt.all(limit, offset);
    } catch (err) {
      throw new DatabaseError(
        DatabaseErrorCode.DB_READ_FAILED,
        `Failed to list files: ${err.message}`,
        err
      );
    }
  }
}

module.exports = {
  FileRepository,
};
