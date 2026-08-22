"use strict";

class QuerySanitizer {
  /**
   * Sanitizes search query string while preserving operators, quotes, and language semantics
   */
  static sanitize(query = "") {
    if (typeof query !== "string") return "";

    let sanitized = query.trim();

    // 1. Balance unmatched double quotes
    const quoteCount = (sanitized.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      sanitized += '"';
    }

    // 2. Collapse excessive repeating whitespace
    sanitized = sanitized.replace(/\s+/g, " ");

    return sanitized;
  }
}

module.exports = {
  QuerySanitizer,
};
