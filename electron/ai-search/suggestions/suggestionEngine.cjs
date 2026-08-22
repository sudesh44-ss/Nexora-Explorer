"use strict";

const { SuggestionResolver } = require("./suggestionResolver.cjs");
const { SuggestionCache } = require("./suggestionCache.cjs");
const { SuggestionDiagnostics } = require("./suggestionDiagnostics.cjs");

class SuggestionEngine {
  constructor(options = {}) {
    this.cache = new SuggestionCache(options);
    this._activeRequestId = null;
    this.db = options.db || null;
    this.searchHistory = options.searchHistory || [];
    this.vocabulary = options.vocabulary || ["cybersecurity", "networking", "firewall", "python", "javascript", "machine learning"];
  }

  /**
   * Sets active request ID to enforce cancellation tracking
   */
  setActiveRequest(requestId) {
    this._activeRequestId = requestId;
  }

  /**
   * Adds query to local search history
   */
  recordQuery(rawQuery) {
    if (typeof rawQuery === "string" && rawQuery.trim()) {
      const clean = rawQuery.trim();
      this.searchHistory = [clean, ...this.searchHistory.filter((q) => q !== clean)].slice(0, 50);
    }
  }

  /**
   * Clears search history
   */
  clearHistory() {
    this.searchHistory = [];
  }

  /**
   * Fetches suggestions for an input keystroke / context
   *
   * @param {string} input - Raw keystroke text
   * @param {Object} [contextState] - Active QueryState from Part 23
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async getSuggestions(input = "", contextState = null, options = {}) {
    const t0 = Date.now();
    const requestId = options.requestId || null;

    try {
      // Cancellation check
      if (requestId && this._activeRequestId && this._activeRequestId !== requestId) {
        return [];
      }

      // Check Cache
      const contextKey = contextState?.rawQuery || "";
      const indexVersion = options.indexVersion || 1;

      if (options.useCache !== false) {
        const cached = this.cache.get(input, contextKey, indexVersion);
        if (cached) {
          return cached;
        }
      }

      const results = SuggestionResolver.resolve(input, contextState, this.db, {
        ...options,
        searchHistory: this.searchHistory,
        vocabulary: this.vocabulary,
      });

      // Cancellation check post-resolution
      if (requestId && this._activeRequestId && this._activeRequestId !== requestId) {
        return [];
      }

      // Save to cache
      if (options.useCache !== false && results.length > 0) {
        this.cache.set(input, contextKey, indexVersion, results);
      }

      if (options.diagnostics) {
        results._diagnostics = SuggestionDiagnostics.generateReport(input, results, Date.now() - t0);
      }

      return results;
    } catch {
      // Error isolation: return empty array on failure without crashing
      return [];
    }
  }
}

module.exports = {
  SuggestionEngine,
};
