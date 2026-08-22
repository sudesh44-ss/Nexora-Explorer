"use strict";

/**
 * Returns default configuration for vector embedding and storage
 */
function getVectorConfig(customOptions = {}) {
  return {
    defaultDimensions: customOptions.defaultDimensions || 768,
    defaultTopK: Math.min(customOptions.defaultTopK || 20, 100),
    maxTopK: 100,
    minimumScore: customOptions.minimumScore !== undefined ? customOptions.minimumScore : 0.15,
    similarityMetric: customOptions.similarityMetric || "COSINE",
    batchSize: customOptions.batchSize || 50,
    normalizeVectors: customOptions.normalizeVectors !== undefined ? customOptions.normalizeVectors : true,
    ...customOptions,
  };
}

module.exports = {
  getVectorConfig,
};
