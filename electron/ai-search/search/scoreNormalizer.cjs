"use strict";

/**
 * Normalizes disparate scoring ranges into a uniform [0, 1] scale
 */
class ScoreNormalizer {
  /**
   * Clamps any number safely between min and max, removing NaN/Infinity
   */
  static clamp(val, min = 0, max = 1) {
    if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
      return min;
    }
    return Math.max(min, Math.min(max, val));
  }

  /**
   * Normalizes a batch of candidates across all signal dimensions
   *
   * @param {Array<Object>} candidates
   * @returns {Array<Object>} Candidates with normalizedScores
   */
  static normalizeBatch(candidates = []) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    // 1. Gather raw ranges
    let maxFts = 0;
    let minFts = Infinity;

    for (const c of candidates) {
      const f = c.rawScores?.fts || 0;
      if (f > maxFts) maxFts = f;
      if (f < minFts) minFts = f;
    }

    const ftsRange = maxFts - minFts;

    // 2. Compute normalized scores per candidate
    return candidates.map((c) => {
      const rawFts = c.rawScores?.fts || 0;
      const rawSemantic = c.rawScores?.semantic || 0;
      const rawMetadata = c.rawScores?.metadata || 0;

      // FTS Normalization (Min-Max or identity if single candidate)
      let normFts = 0;
      if (rawFts > 0) {
        normFts = ftsRange > 0 ? (rawFts - minFts) / ftsRange : 1.0;
      }

      // Semantic Cosine Normalization (Cosine is [-1, 1], map negative to 0)
      const normSemantic = ScoreNormalizer.clamp(rawSemantic, 0, 1);

      // Metadata Normalization
      const normMetadata = ScoreNormalizer.clamp(rawMetadata, 0, 1);

      return {
        ...c,
        normalizedScores: {
          keyword: ScoreNormalizer.clamp(normFts, 0, 1),
          semantic: normSemantic,
          metadata: normMetadata,
        },
      };
    });
  }
}

module.exports = {
  ScoreNormalizer,
};
