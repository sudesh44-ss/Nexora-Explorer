"use strict";

const BENCHMARK_CATEGORIES = {
  LEXICAL: "lexical",
  PHRASE: "phrase",
  SEMANTIC: "semantic",
  NATURAL_LANGUAGE: "natural_language",
  HINGLISH: "hinglish",
  FILTER: "filter",
  MULTIMODAL: "multimodal",
  CONTEXTUAL: "contextual",
  SUGGESTION: "suggestion",
  TYPO: "typo",
  ZERO_RESULT: "zero_result",
  CACHE_HIT: "cache_hit",
  CACHE_MISS: "cache_miss",
};

const RELEVANCE_LEVELS = {
  IRRELEVANT: 0,
  WEAKLY_RELEVANT: 1,
  RELEVANT: 2,
  HIGHLY_RELEVANT: 3,
};

class BenchmarkSchema {
  /**
   * Validates a benchmark query item
   */
  static validateQuery(item) {
    if (!item || typeof item !== "object") return false;
    if (typeof item.id !== "string" || !item.id.trim()) return false;
    if (typeof item.query !== "string") return false;
    if (!item.category || !Object.values(BENCHMARK_CATEGORIES).includes(item.category)) return false;
    if (!Array.isArray(item.expected)) return false;
    return true;
  }

  /**
   * Sanitizes a benchmark query item
   */
  static sanitizeQuery(item) {
    if (!this.validateQuery(item)) return null;
    return {
      id: item.id.trim(),
      query: item.query.trim(),
      category: item.category,
      expected: item.expected.map((e) => ({
        fileId: String(e.fileId),
        relevance: typeof e.relevance === "number" ? Math.max(0, Math.min(3, e.relevance)) : RELEVANCE_LEVELS.RELEVANT,
      })),
      context: item.context || null,
      filters: item.filters || null,
      difficulty: item.difficulty || "medium",
    };
  }
}

module.exports = {
  BenchmarkSchema,
  BENCHMARK_CATEGORIES,
  RELEVANCE_LEVELS,
};
