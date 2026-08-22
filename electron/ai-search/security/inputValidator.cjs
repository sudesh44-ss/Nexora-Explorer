"use strict";

const MAX_QUERY_LENGTH = 500;

class InputValidator {
  /**
   * Validates and cleans raw query string input
   */
  static validateQuery(rawInput) {
    if (rawInput === null || rawInput === undefined) {
      return { valid: true, query: "", error: null };
    }

    if (typeof rawInput !== "string") {
      return { valid: false, query: "", error: "Query must be a string" };
    }

    // Strip non-printable control characters except standard whitespace
    const clean = rawInput.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();

    if (clean.length > MAX_QUERY_LENGTH) {
      return {
        valid: true,
        query: clean.substring(0, MAX_QUERY_LENGTH),
        truncated: true,
        error: null,
      };
    }

    return { valid: true, query: clean, truncated: false, error: null };
  }
}

module.exports = {
  InputValidator,
  MAX_QUERY_LENGTH,
};
