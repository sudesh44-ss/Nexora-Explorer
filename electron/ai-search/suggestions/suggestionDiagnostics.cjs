"use strict";

class SuggestionDiagnostics {
  /**
   * Builds diagnostic metrics for a suggestion query
   */
  static generateReport(input, suggestions, elapsedMs) {
    const sourceBreakdown = {};
    for (const s of suggestions) {
      const src = s.source || "unknown";
      sourceBreakdown[src] = (sourceBreakdown[src] || 0) + 1;
    }

    return {
      input,
      totalCount: suggestions.length,
      sourceBreakdown,
      elapsedMs,
    };
  }
}

module.exports = {
  SuggestionDiagnostics,
};
