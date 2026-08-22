"use strict";

class SuggestionValidator {
  /**
   * Validates a single suggestion object
   */
  static validate(s) {
    if (!s || typeof s !== "object") return false;
    if (typeof s.text !== "string" || !s.text.trim()) return false;
    return true;
  }

  /**
   * Sanitizes a suggestion item
   */
  static sanitize(s, fallbackId = "") {
    if (!this.validate(s)) return null;

    return {
      id: s.id || fallbackId || `sug_${Math.random().toString(36).substring(2, 9)}`,
      type: typeof s.type === "string" ? s.type : "query",
      text: s.text.trim(),
      source: typeof s.source === "string" ? s.source : "index",
      score: typeof s.score === "number" && !isNaN(s.score) ? Math.max(0, Math.min(1, s.score)) : 0.5,
      category: typeof s.category === "string" ? s.category : "suggestion",
    };
  }
}

module.exports = {
  SuggestionValidator,
};
