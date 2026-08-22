"use strict";

const EventEmitter = require("events");
const { createEmbeddingResult } = require("./embeddingResult.cjs");
const { validateVector, l2Normalize } = require("./similarity.cjs");
const { VectorErrorCode, VectorError } = require("./vectorErrors.cjs");
const { createAITask } = require("../ai/aiTask.cjs");
const { AITaskType } = require("../ai/modelProfile.cjs");

/**
 * Generates document and query embeddings using Part 7 AI Engine
 */
class EmbeddingGenerator extends EventEmitter {
  constructor(aiEngine, options = {}) {
    super();
    this.aiEngine = aiEngine;
    this.options = {
      normalize: true,
      batchSize: 20,
      ...options,
    };
  }

  /**
   * Generates embedding for an indexable document
   *
   * @param {import("./embeddingDocument.cjs").EmbeddingDocument} doc
   * @param {Object} [options]
   * @returns {Promise<import("./embeddingResult.cjs").EmbeddingResult>}
   */
  async generateDocumentEmbedding(doc, options = {}) {
    if (!doc || !doc.text || doc.text.trim().length === 0) {
      return createEmbeddingResult({
        success: false,
        fileId: doc?.fileId,
        errorCode: VectorErrorCode.EMBEDDING_FAILED,
        message: "Document contains no extractable text for embedding",
      });
    }

    const task = createAITask({
      type: AITaskType.TEXT_EMBEDDING,
      fileId: doc.fileId,
      input: doc.text,
      modelPreference: options.modelId || null,
    });

    const aiRes = await this.aiEngine.runTask(task, options);
    if (!aiRes.success || !aiRes.vector) {
      return createEmbeddingResult({
        success: false,
        fileId: doc.fileId,
        errorCode: aiRes.errorCode || VectorErrorCode.EMBEDDING_FAILED,
        message: aiRes.message || "Failed to generate embedding vector",
      });
    }

    if (!validateVector(aiRes.vector)) {
      return createEmbeddingResult({
        success: false,
        fileId: doc.fileId,
        errorCode: VectorErrorCode.VECTOR_INVALID,
        message: "Generated embedding vector contained invalid or non-finite values",
      });
    }

    const finalVector = this.options.normalize ? l2Normalize(aiRes.vector) : aiRes.vector;

    return createEmbeddingResult({
      success: true,
      fileId: doc.fileId,
      vector: finalVector,
      dimensions: finalVector.length,
      modelId: aiRes.modelId,
      runtimeId: aiRes.runtimeId,
      metadata: {
        sourceHash: doc.sourceHash,
        contentType: doc.contentType,
        truncated: doc.metadata?.truncated || false,
      },
    });
  }

  /**
   * Generates embedding for a user search query
   *
   * @param {string} queryText
   * @param {Object} [options]
   * @returns {Promise<Array<number>|Float32Array|null>}
   */
  async generateQueryEmbedding(queryText, options = {}) {
    if (!queryText || typeof queryText !== "string" || !queryText.trim()) {
      return null;
    }

    const task = createAITask({
      type: AITaskType.TEXT_EMBEDDING,
      input: queryText.trim(),
      modelPreference: options.modelId || null,
    });

    const aiRes = await this.aiEngine.runTask(task, options);
    if (!aiRes.success || !aiRes.vector) {
      return null;
    }

    if (!validateVector(aiRes.vector)) {
      return null;
    }

    return this.options.normalize ? l2Normalize(aiRes.vector) : aiRes.vector;
  }

  /**
   * Generates embeddings for a batch of documents
   */
  async generateBatch(docs = [], options = {}) {
    const results = [];
    for (const doc of docs) {
      const res = await this.generateDocumentEmbedding(doc, options);
      results.push(res);
    }
    return results;
  }
}

module.exports = {
  EmbeddingGenerator,
};
