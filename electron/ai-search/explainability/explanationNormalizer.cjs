"use strict";

class ExplanationNormalizer {
  /**
   * Deduplicates and orders user explanation bullets
   */
  static deduplicateBullets(bullets = [], maxBullets = 5) {
    const seen = new Set();
    const result = [];

    for (const b of bullets) {
      if (!b || typeof b !== "string") continue;
      const clean = b.trim();
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(clean);
        if (result.length >= maxBullets) break;
      }
    }

    return result;
  }
}

module.exports = {
  ExplanationNormalizer,
};
