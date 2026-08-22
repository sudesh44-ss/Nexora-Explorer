"use strict";

class SuggestionRanker {
  /**
   * Scores and sorts suggestions deterministically
   */
  static rank(suggestions = [], input = "", options = {}) {
    const trimmed = (input || "").trim().toLowerCase();
    const limit = options.limit || 8;

    const scored = suggestions.map((s) => {
      let finalScore = s.score || 0.5;
      const textLower = s.text.toLowerCase();

      // Exact prefix match boost
      if (trimmed && textLower.startsWith(trimmed)) {
        finalScore += 0.2;
      }

      // Exact match gets highest priority
      if (trimmed && textLower === trimmed) {
        finalScore += 0.3;
      }

      return {
        ...s,
        score: Math.min(1.0, finalScore),
      };
    });

    // Sort descending by score, then alphabetically
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.text.localeCompare(b.text);
    });

    return scored.slice(0, limit);
  }
}

module.exports = {
  SuggestionRanker,
};
