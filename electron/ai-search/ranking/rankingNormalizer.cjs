"use strict";

class RankingNormalizer {
  /**
   * Safely bounds a single score to [0, 1] range, handling NaN/Infinity/undefined
   */
  static normalizeScore(score) {
    if (typeof score !== "number" || Number.isNaN(score) || !Number.isFinite(score)) {
      return 0.0;
    }
    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Normalizes raw FTS rank scores to [0, 1] range
   */
  static normalizeFtsRank(rank) {
    if (typeof rank !== "number" || Number.isNaN(rank) || !Number.isFinite(rank)) {
      return 0.5;
    }
    // FTS5 bm25 typically outputs negative numbers where lower is better (e.g. -12.4),
    // or positive scores if transformed.
    const absRank = Math.abs(rank);
    if (absRank <= 1.0) return absRank;
    return 1.0 / (1.0 + Math.exp(-absRank / 10.0));
  }
}

module.exports = {
  RankingNormalizer,
};
