"use strict";

const RANKING_WEIGHT_PROFILES = Object.freeze({
  DEFAULT: {
    filenameExact: 0.30,
    filenamePartial: 0.15,
    exactPhrase: 0.20,
    folder: 0.05,
    fts: 0.15,
    ocr: 0.15,
    vision: 0.15,
    tags: 0.10,
    semantic: 0.25,
    coverage: 0.15,
    metadata: 0.05,
  },
  EXACT_SEARCH: {
    filenameExact: 0.50,
    filenamePartial: 0.25,
    exactPhrase: 0.35,
    folder: 0.10,
    fts: 0.15,
    ocr: 0.10,
    vision: 0.05,
    tags: 0.05,
    semantic: 0.10,
    coverage: 0.20,
    metadata: 0.10,
  },
  CONTENT_SEARCH: {
    filenameExact: 0.15,
    filenamePartial: 0.10,
    exactPhrase: 0.25,
    folder: 0.05,
    fts: 0.25,
    ocr: 0.30,
    vision: 0.25,
    tags: 0.15,
    semantic: 0.25,
    coverage: 0.20,
    metadata: 0.05,
  },
  SEMANTIC_SEARCH: {
    filenameExact: 0.15,
    filenamePartial: 0.10,
    exactPhrase: 0.15,
    folder: 0.05,
    fts: 0.10,
    ocr: 0.15,
    vision: 0.25,
    tags: 0.15,
    semantic: 0.45,
    coverage: 0.15,
    metadata: 0.05,
  },
  FILTERED_SEARCH: {
    filenameExact: 0.25,
    filenamePartial: 0.15,
    exactPhrase: 0.15,
    folder: 0.20,
    fts: 0.15,
    ocr: 0.15,
    vision: 0.15,
    tags: 0.10,
    semantic: 0.20,
    coverage: 0.15,
    metadata: 0.20,
  },
});

class RankingWeights {
  /**
   * Resolves ranking weight profile dynamically based on query intent and parameters
   */
  static getWeights(intent = "SEARCH_FILES") {
    switch (intent) {
      case "EXACT_SEARCH":
        return RANKING_WEIGHT_PROFILES.EXACT_SEARCH;
      case "CONTENT_SEARCH":
        return RANKING_WEIGHT_PROFILES.CONTENT_SEARCH;
      case "SEMANTIC_SEARCH":
        return RANKING_WEIGHT_PROFILES.SEMANTIC_SEARCH;
      case "FILTERED_SEARCH":
      case "SEARCH_FOLDERS":
        return RANKING_WEIGHT_PROFILES.FILTERED_SEARCH;
      default:
        return RANKING_WEIGHT_PROFILES.DEFAULT;
    }
  }
}

module.exports = {
  RANKING_WEIGHT_PROFILES,
  RankingWeights,
};
