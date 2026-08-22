"use strict";

/**
 * Factory for creating Vector Index Metadata
 */
function createVectorIndexMetadata(options = {}) {
  return {
    indexId: options.indexId || "default-vector-index",
    modelId: options.modelId || "nomic-embed-text-v1.5",
    modelVersion: options.modelVersion || "1.0.0",
    dimensions: options.dimensions || 768,
    metric: options.metric || "COSINE",
    version: options.version || 1,
    createdAt: options.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  createVectorIndexMetadata,
};
