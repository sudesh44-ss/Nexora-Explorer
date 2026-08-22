"use strict";

const { cosineSimilarity, validateVector } = require("./similarity.cjs");
const { VectorErrorCode, VectorError } = require("./vectorErrors.cjs");

/**
 * Executes vector similarity queries against VectorStore
 */
class VectorSearch {
  /**
   * Searches for top-K matching documents by vector cosine similarity
   *
   * @param {Array<number>|Float32Array} queryVector
   * @param {import("./vectorStore.cjs").VectorStore} vectorStore
   * @param {Object} [options]
   * @param {number} [options.topK=20]
   * @param {number} [options.minimumScore=0.15]
   * @param {string} [options.modelId]
   * @returns {Array<{fileId: string, score: number, metadata: Object}>}
   */
  static search(queryVector, vectorStore, options = {}) {
    if (!validateVector(queryVector)) {
      throw new VectorError(VectorErrorCode.VECTOR_INVALID, "Query vector is invalid or empty");
    }

    if (!vectorStore || !vectorStore.isInitialized) {
      throw new VectorError(VectorErrorCode.VECTOR_STORE_CLOSED, "VectorStore is not initialized");
    }

    const topK = Math.min(Math.max(1, options.topK || 20), 100);
    const minScore = options.minimumScore !== undefined ? options.minimumScore : 0.15;
    const modelFilter = options.modelId || null;

    const allVectors = vectorStore.getAll({ modelId: modelFilter });
    if (allVectors.length === 0) {
      return [];
    }

    const scored = [];

    for (const doc of allVectors) {
      if (!doc.vector || doc.vector.length !== queryVector.length) {
        continue;
      }

      try {
        const score = cosineSimilarity(queryVector, doc.vector);
        if (score >= minScore) {
          scored.push({
            fileId: doc.fileId,
            score,
            contentHash: doc.contentHash,
            modelId: doc.modelId,
            metadata: doc.metadata,
          });
        }
      } catch {}
    }

    // Sort descending by similarity score
    scored.sort((a, b) => b.score - a.score);

    // Return Top-K
    return scored.slice(0, topK);
  }
}

module.exports = {
  VectorSearch,
};
