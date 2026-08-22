"use strict";

class ExplanationResultAdapter {
  /**
   * Enriches a SearchResult with explanation and optional debug trace
   */
  static attach(searchResult, userExplanation, developerTrace = null) {
    if (!searchResult) return null;

    return {
      ...searchResult,
      explanation: userExplanation || null,
      _trace: developerTrace || null,
    };
  }
}

module.exports = {
  ExplanationResultAdapter,
};
