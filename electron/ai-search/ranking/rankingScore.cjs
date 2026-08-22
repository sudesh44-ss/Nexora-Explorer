"use strict";

const { RankingNormalizer } = require("./rankingNormalizer.cjs");

class RankingScore {
  /**
   * Computes the weighted composite score and applies boosts and correlation damping
   */
  static computeCompositeScore(signals, weights, boosts = {}) {
    // 1. Signal correlation damping: If vision and tags both fire, avoid double-weighting identical model evidence
    let effectiveTagWeight = weights.tags;
    if (signals.vision > 0.5 && signals.tags > 0.5) {
      effectiveTagWeight = weights.tags * 0.5;
    }

    // 2. Weighted Sum
    let rawScore = (
      (signals.filenameExact * weights.filenameExact) +
      (signals.filenamePartial * weights.filenamePartial) +
      (signals.phrase * weights.exactPhrase) +
      (signals.folder * weights.folder) +
      (signals.fts * weights.fts) +
      (signals.ocr * weights.ocr) +
      (signals.vision * weights.vision) +
      (signals.tags * effectiveTagWeight) +
      (signals.semantic * weights.semantic) +
      (signals.coverage * weights.coverage) +
      (signals.metadata * weights.metadata)
    );

    // 3. Exact Filename Boost
    if (signals.filenameExact >= 0.95 && boosts.exactFilename) {
      rawScore *= boosts.exactFilename;
    }

    // 4. Exact Phrase Boost
    if (signals.phrase >= 0.95 && boosts.exactPhrase) {
      rawScore *= boosts.exactPhrase;
    }

    // 5. Full Query Coverage Boost
    if (signals.coverage >= 1.0 && boosts.allTermsCovered) {
      rawScore *= boosts.allTermsCovered;
    }

    // 6. Normalize to [0, 1]
    return RankingNormalizer.normalizeScore(rawScore);
  }
}

module.exports = {
  RankingScore,
};
