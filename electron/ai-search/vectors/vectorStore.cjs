"use strict";

const { validateVector } = require("./similarity.cjs");
const { VectorErrorCode, VectorError } = require("./vectorErrors.cjs");

/**
 * SQLite-backed Local Vector Store with binary float buffer persistence
 */
class VectorStore {
  constructor(databaseManager, options = {}) {
    this.db = databaseManager;
    this.options = options;
    this.isInitialized = false;
  }

  async initialize() {
    if (!this.db.isOpen) {
      await this.db.initialize();
    }

    // Ensure vector tables exist
    this.db.db.exec(`
      CREATE TABLE IF NOT EXISTS file_vectors (
        file_id TEXT PRIMARY KEY,
        content_hash TEXT,
        model_id TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector_blob BLOB NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_vectors_hash ON file_vectors(content_hash);
      CREATE INDEX IF NOT EXISTS idx_vectors_model ON file_vectors(model_id);

      CREATE TABLE IF NOT EXISTS vector_index_meta (
        index_id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        metric TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this._prepareStatements();
    this.isInitialized = true;
    return { success: true };
  }

  _prepareStatements() {
    this._upsertStmt = this.db.db.prepare(`
      INSERT INTO file_vectors (file_id, content_hash, model_id, dimensions, vector_blob, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_id) DO UPDATE SET
        content_hash = excluded.content_hash,
        model_id = excluded.model_id,
        dimensions = excluded.dimensions,
        vector_blob = excluded.vector_blob,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    this._getStmt = this.db.db.prepare("SELECT * FROM file_vectors WHERE file_id = ?");
    this._deleteStmt = this.db.db.prepare("DELETE FROM file_vectors WHERE file_id = ?");
    this._getAllStmt = this.db.db.prepare("SELECT file_id, content_hash, model_id, dimensions, vector_blob, metadata FROM file_vectors");
    this._countStmt = this.db.db.prepare("SELECT count(*) as count FROM file_vectors");
    this._clearStmt = this.db.db.prepare("DELETE FROM file_vectors");
  }

  /**
   * Serializes a vector (Array or Float32Array) to Buffer
   */
  _serializeVector(vector) {
    const f32 = vector instanceof Float32Array ? vector : new Float32Array(vector);
    return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
  }

  /**
   * Deserializes Buffer to Float32Array
   */
  _deserializeVector(buffer) {
    if (!buffer) return null;
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    return new Float32Array(arrayBuffer);
  }

  /**
   * Stores or updates a vector embedding for a file
   */
  upsert(fileId, vector, options = {}) {
    if (!this.isInitialized) throw new VectorError(VectorErrorCode.VECTOR_STORE_CLOSED, "VectorStore not initialized");
    if (!fileId) throw new VectorError(VectorErrorCode.VECTOR_INVALID, "fileId is required");

    if (!validateVector(vector)) {
      throw new VectorError(VectorErrorCode.VECTOR_INVALID, `Invalid vector provided for file ${fileId}`);
    }

    const modelId = options.modelId || "nomic-embed-text-v1.5";
    const contentHash = options.contentHash || null;
    const dimensions = vector.length;
    const blob = this._serializeVector(vector);
    const metaJson = JSON.stringify(options.metadata || {});
    const now = new Date().toISOString();

    try {
      this._upsertStmt.run(fileId, contentHash, modelId, dimensions, blob, metaJson, now, now);
      return { success: true, fileId, dimensions };
    } catch (err) {
      throw new VectorError(VectorErrorCode.VECTOR_INVALID, `Failed to upsert vector for ${fileId}: ${err.message}`, err);
    }
  }

  get(fileId) {
    if (!this.isInitialized) return null;
    const row = this._getStmt.get(fileId);
    if (!row) return null;

    return {
      fileId: row.file_id,
      contentHash: row.content_hash,
      modelId: row.model_id,
      dimensions: row.dimensions,
      vector: this._deserializeVector(row.vector_blob),
      metadata: JSON.parse(row.metadata || "{}"),
    };
  }

  delete(fileId) {
    if (!this.isInitialized) return false;
    const res = this._deleteStmt.run(fileId);
    return res.changes > 0;
  }

  /**
   * Retrieves all vectors in store for similarity scanning
   */
  getAll(filter = {}) {
    if (!this.isInitialized) return [];
    const rows = this._getAllStmt.all();
    const results = [];

    for (const r of rows) {
      if (filter.modelId && r.model_id !== filter.modelId) continue;
      results.push({
        fileId: r.file_id,
        contentHash: r.content_hash,
        modelId: r.model_id,
        dimensions: r.dimensions,
        vector: this._deserializeVector(r.vector_blob),
        metadata: JSON.parse(r.metadata || "{}"),
      });
    }

    return results;
  }

  count() {
    if (!this.isInitialized) return 0;
    try {
      const row = this._countStmt.get();
      return row?.count || 0;
    } catch {
      return 0;
    }
  }

  clear() {
    if (!this.isInitialized) return 0;
    const res = this._clearStmt.run();
    return res.changes;
  }

  close() {
    this.isInitialized = false;
  }
}

module.exports = {
  VectorStore,
};
