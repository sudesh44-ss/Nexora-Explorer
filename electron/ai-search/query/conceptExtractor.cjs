"use strict";

const { FILE_TYPE_MAP } = require("./fileTypeDetector.cjs");

// Comprehensive multilingual / conversational stop words list
const QUERY_STOP_WORDS = new Set([
  "mere", "meri", "mera", "ke", "ki", "ka", "ko", "se", "mein", "par",
  "wali", "wale", "wala", "do", "dikhaye", "dikhao", "karo", "hai", "hain", "aur",
  "mujhe", "wo", "jo", "tha", "the", "thi", "li", "le", "lo", "bhi",
  "की", "का", "के", "को", "से", "में", "पर", "वाली", "वाले", "वाला", "दो", "दिखाओ", "दिखाइए", "है", "हैं", "और",
  "find", "show", "get", "please", "search", "give", "me", "all", "my",
  "files", "file", "folder", "folders", "the", "a", "an", "and", "or", "in", "of", "to", "for", "with", "from",
  "today", "yesterday", "last", "previous", "month", "year", "aaj", "kal", "pichle", "saal", "mahine"
]);

class ConceptExtractor {
  /**
   * Extracts search concepts and keywords from normalized query
   *
   * @param {string} normalizedQuery
   * @returns {{concepts: Array<string>, keywords: Array<string>}}
   */
  static extract(normalizedQuery) {
    if (!normalizedQuery) {
      return { concepts: [], keywords: [] };
    }

    const tokens = normalizedQuery.replace(/[^\w\s\u0900-\u097F]/g, " ").split(/\s+/).filter(Boolean);
    const concepts = [];

    for (const t of tokens) {
      // Exclude pure file-type keywords and conversational stop-words
      if (!FILE_TYPE_MAP[t] && !QUERY_STOP_WORDS.has(t)) {
        if (!concepts.includes(t)) {
          concepts.push(t);
        }
      }
    }

    // Fallback: If everything was filtered, preserve non-stopword tokens
    const finalConcepts = concepts.length > 0
      ? concepts
      : tokens.filter((t) => !QUERY_STOP_WORDS.has(t));

    return {
      concepts: finalConcepts,
      keywords: finalConcepts,
    };
  }
}

module.exports = {
  ConceptExtractor,
  QUERY_STOP_WORDS,
};
