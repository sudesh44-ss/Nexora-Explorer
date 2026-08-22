"use strict";

const EventEmitter = require("events");
const { EmbeddingGenerator } = require("./embeddingGenerator.cjs");
const { VectorStore } = require("./vectorStore.cjs");
const { VectorSearch } = require("./vectorSearch.cjs");
const { createEmbeddingDocument } = require("./embeddingDocument.cjs");
const { getVectorConfig } = require("./vectorConfig.cjs");
const { VectorErrorCode, VectorError } = require("./vectorErrors.cjs");

/**
 * Central Vector Embedding Manager orchestrating document vectorization, storage, and semantic retrieval
 */
class EmbeddingManager extends EventEmitter {
  constructor(aiEngine, databaseManager, options = {}) {
    super();
    this.aiEngine = aiEngine;
    this.db = databaseManager;
    this.config = getVectorConfig(options);

    this.store = new VectorStore(this.db, this.config);
    this.generator = new EmbeddingGenerator(this.aiEngine, this.config);
    this.isInitialized = false;
  }

  async initialize() {
    await this.store.initialize();
    this.isInitialized = true;
    return { success: true, count: this.store.count() };
  }

  /**
   * Embeds a single file and persists its vector into the VectorStore
   *
   * @param {Object} fileRecord - FileRecord from Part 2 Scanner
   * @param {Object} contentResult - ExtractionResult from Part 6 Extractor
   * @param {Object} [options]
   * @returns {Promise<{success: boolean, cached: boolean, fileId: string}>}
   */
  async embedFile(fileRecord, contentResult, options = {}) {
    if (!fileRecord || !fileRecord.file_id) {
      return { success: false, cached: false, error: "Invalid fileRecord" };
    }

    if (!contentResult || !contentResult.text || contentResult.text.trim().length === 0) {
      // Empty content, no embedding required
      return { success: false, cached: false, skipped: true, reason: "EMPTY_TEXT" };
    }

    // 1. Hash & Model Cache Check: Avoid re-embedding unchanged files
    if (fileRecord.hash && !options.forceReembed) {
      const existing = this.store.get(fileRecord.file_id);
      if (existing && existing.contentHash === fileRecord.hash) {
        return { success: true, cached: true, fileId: fileRecord.file_id };
      }
    }

    // 2. Prepare embedding document
    const doc = createEmbeddingDocument({
      fileId: fileRecord.file_id,
      sourceHash: fileRecord.hash,
      text: contentResult.text,
      contentType: contentResult.contentType,
      fileName: fileRecord.name,
      folder: fileRecord.path,
      truncated: contentResult.truncated,
    });

    // 3. Generate embedding vector
    const embResult = await this.generator.generateDocumentEmbedding(doc, options);
    if (!embResult.success || !embResult.vector) {
      return {
        success: false,
        cached: false,
        fileId: fileRecord.file_id,
        error: embResult.message,
      };
    }

    // 4. Persist to VectorStore
    this.store.upsert(fileRecord.file_id, embResult.vector, {
      contentHash: fileRecord.hash,
      modelId: embResult.modelId,
      metadata: {
        fileName: fileRecord.name,
        path: fileRecord.path,
        truncated: contentResult.truncated,
        contentType: contentResult.contentType,
      },
    });

    this.emit("file_embedded", { fileId: fileRecord.file_id, dimensions: embResult.dimensions });
    return { success: true, cached: false, fileId: fileRecord.file_id };
  }

  /**
   * Searches for semantically similar files using a natural language text query
   *
   * @param {string} queryText
   * @param {Object} [options]
   * @returns {Promise<Array<{fileId: string, score: number, metadata: Object}>>}
   */
  async searchSimilar(queryText, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const queryVector = await this.generator.generateQueryEmbedding(queryText, options);
    if (!queryVector) {
      return [];
    }

    const searchOptions = {
      topK: options.topK || this.config.defaultTopK,
      minimumScore: options.minimumScore !== undefined ? options.minimumScore : this.config.minimumScore,
      modelId: options.modelId || null,
    };

    return VectorSearch.search(queryVector, this.store, searchOptions);
  }

  deleteFileVector(fileId) {
    return this.store.delete(fileId);
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      vectorCount: this.store.count(),
      config: this.config,
    };
  }

  close() {
    this.store.close();
    this.isInitialized = false;
  }
}

module.exports = {
  EmbeddingManager,
};
