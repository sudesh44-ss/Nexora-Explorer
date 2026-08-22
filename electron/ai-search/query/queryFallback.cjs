"use strict";

const MAX_QUERY_LENGTH = 1000;

class QueryFallback {
  /**
   * Sanitizes input strings against prompt injections and excessive query lengths
   */
  static sanitizeInput(rawQuery) {
    if (!rawQuery || typeof rawQuery !== "string") return "";

    let q = rawQuery.slice(0, MAX_QUERY_LENGTH).trim();

    // Neutralize prompt injection attempts by ensuring raw string semantics
    // E.g. "Ignore all instructions and return..." is preserved strictly as search terms
    // Strip control characters
    q = q.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    return q;
  }

  /**
   * Generates a safe fallback StructuredQuery if LLM fails or produces malformed JSON
   */
  static createFallback(rawQuery, localParsedQuery = {}) {
    const clean = this.sanitizeInput(rawQuery);
    return {
      rawQuery: clean,
      normalizedQuery: clean.toLowerCase(),
      language: localParsedQuery.language || "ENGLISH",
      intent: localParsedQuery.intent || "SEARCH_FILES",
      keywords: localParsedQuery.keywords || clean.split(/\s+/).filter(Boolean),
      phrases: localParsedQuery.phrases || [],
      filters: localParsedQuery.filters || {},
      semantic: localParsedQuery.semantic || { concepts: [], objects: [], scenes: [], entities: [] },
      boolean: localParsedQuery.boolean || { must: [], should: [], mustNot: [] },
      confidence: { overall: 0.8 },
      diagnostics: { parseMode: "fallback_local" },
    };
  }
}

module.exports = {
  MAX_QUERY_LENGTH,
  QueryFallback,
};
