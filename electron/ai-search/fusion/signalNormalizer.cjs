"use strict";

const { RankingNormalizer } = require("../ranking/rankingNormalizer.cjs");

class SignalNormalizer {
  /**
   * Normalizes raw score to bounded [0.0, 1.0]
   */
  static normalizeScore(rawScore, fallback = 0.0) {
    if (typeof rawScore !== "number" || isNaN(rawScore) || !isFinite(rawScore)) {
      return fallback;
    }
    return RankingNormalizer.normalizeScore(rawScore);
  }

  /**
   * Normalizes a signal list or map
   */
  static normalizeSignals(signals = []) {
    if (!Array.isArray(signals)) return [];

    return signals.map((s) => ({
      source: s.source || "unknown",
      score: this.normalizeScore(s.score),
      metadata: s.metadata || null,
    }));
  }
}

module.exports = {
  SignalNormalizer,
};
