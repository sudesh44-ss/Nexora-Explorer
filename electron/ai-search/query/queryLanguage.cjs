"use strict";

const QueryLanguage = Object.freeze({
  ENGLISH: "ENGLISH",
  HINDI: "HINDI",
  HINGLISH: "HINGLISH",
  MIXED: "MIXED",
  UNKNOWN: "UNKNOWN",
});

const HINGLISH_PATTERNS = [
  /\b(wali|wale|wala|ka|ki|ke|ko|mein|se|aur|bhi|nahi|mat|pichle|pichla|agle|agla|saal|mahine|hafte|aaj|kal|badi|choti|dikhao|do)\b/i,
];

class QueryLanguageDetector {
  /**
   * Detects the language family of the user query without making remote AI calls
   */
  static detect(query) {
    if (!query || typeof query !== "string") return QueryLanguage.UNKNOWN;
    const str = query.trim();
    if (!str) return QueryLanguage.UNKNOWN;

    // Check for Devanagari Unicode range: \u0900-\u097F
    const hasDevanagari = /[\u0900-\u097F]/.test(str);
    const hasLatin = /[a-zA-Z]/.test(str);

    if (hasDevanagari && hasLatin) {
      return QueryLanguage.MIXED;
    }

    if (hasDevanagari) {
      return QueryLanguage.HINDI;
    }

    // Check for Hinglish phonetics in Latin script
    const hasHinglish = HINGLISH_PATTERNS.some((pat) => pat.test(str));
    if (hasHinglish) {
      return QueryLanguage.HINGLISH;
    }

    if (hasLatin) {
      return QueryLanguage.ENGLISH;
    }

    return QueryLanguage.UNKNOWN;
  }
}

module.exports = {
  QueryLanguage,
  QueryLanguageDetector,
};
