"use strict";

class SuggestionNormalizer {
  /**
   * Normalizes raw input string and suggestion text
   */
  static normalize(text = "") {
    if (typeof text !== "string") return "";
    return text.trim().toLowerCase();
  }

  /**
   * Deduplicates suggestion list by normalized text
   */
  static deduplicate(suggestions = []) {
    const seen = new Set();
    const result = [];

    for (const s of suggestions) {
      if (!s || typeof s.text !== "string") continue;
      const key = s.text.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(s);
      }
    }

    return result;
  }
}

module.exports = {
  SuggestionNormalizer,
};
