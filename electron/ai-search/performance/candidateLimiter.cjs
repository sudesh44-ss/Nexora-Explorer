"use strict";

const QUALITY_MODES = {
  FAST: { retrievalK: 100, rankingK: 50, displayK: 20 },
  BALANCED: { retrievalK: 300, rankingK: 150, displayK: 50 },
  ACCURATE: { retrievalK: 1000, rankingK: 500, displayK: 100 },
};

class CandidateLimiter {
  /**
   * Retrieves candidate limit tiers for a given search mode
   */
  static getLimits(mode = "BALANCED", overrides = {}) {
    const base = QUALITY_MODES[mode.toUpperCase()] || QUALITY_MODES.BALANCED;
    return {
      retrievalK: overrides.retrievalK || base.retrievalK,
      rankingK: overrides.rankingK || base.rankingK,
      displayK: overrides.displayK || base.displayK,
    };
  }

  /**
   * Trims candidate list to ranking limit
   */
  static trimForRanking(candidates = [], limit = 150) {
    if (!Array.isArray(candidates)) return [];
    return candidates.length > limit ? candidates.slice(0, limit) : candidates;
  }

  /**
   * Trims ranked results to final display limit
   */
  static trimForDisplay(results = [], limit = 50) {
    if (!Array.isArray(results)) return [];
    return results.length > limit ? results.slice(0, limit) : results;
  }
}

module.exports = {
  CandidateLimiter,
  QUALITY_MODES,
};
