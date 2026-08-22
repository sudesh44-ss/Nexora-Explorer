"use strict";

/**
 * Returns default search and ranking engine configuration
 */
function getSearchConfig(customOptions = {}) {
  const customWeights = customOptions.rankingWeights || {};

  return {
    candidateLimits: {
      fts: 50,
      vector: 50,
      metadata: 50,
      ...(customOptions.candidateLimits || {}),
    },
    defaultFinalLimit: Math.min(customOptions.defaultFinalLimit || 20, 100),
    maxFinalLimit: 100,
    minFinalScore: customOptions.minFinalScore !== undefined ? customOptions.minFinalScore : 0.10,
    verifyFilesystem: customOptions.verifyFilesystem !== undefined ? customOptions.verifyFilesystem : true,

    // Ranking signal weights (Documented safe defaults, fully configurable)
    rankingWeights: {
      semantic: customWeights.semantic !== undefined ? customWeights.semantic : 0.35,
      keyword: customWeights.keyword !== undefined ? customWeights.keyword : 0.35,
      fileType: customWeights.fileType !== undefined ? customWeights.fileType : 0.15,
      folder: customWeights.folder !== undefined ? customWeights.folder : 0.10,
      metadata: customWeights.metadata !== undefined ? customWeights.metadata : 0.05,
    },
    ...customOptions,
  };
}

module.exports = {
  getSearchConfig,
};
