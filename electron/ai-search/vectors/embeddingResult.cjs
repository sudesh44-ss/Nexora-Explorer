"use strict";

/**
 * Standardized embedding result contract
 */
function createEmbeddingResult(options = {}) {
  const success = options.success !== undefined ? options.success : true;

  return {
    success,
    fileId: options.fileId || null,
    vector: options.vector || null,
    dimensions: options.dimensions || (options.vector ? options.vector.length : 0),
    modelId: options.modelId || null,
    modelVersion: options.modelVersion || "1.0.0",
    runtimeId: options.runtimeId || null,
    createdAt: new Date().toISOString(),
    metadata: options.metadata || {},
    errorCode: options.errorCode || null,
    message: options.message || null,
    retryable: Boolean(options.retryable),
  };
}

module.exports = {
  createEmbeddingResult,
};
