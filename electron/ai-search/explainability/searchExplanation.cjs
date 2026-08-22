"use strict";

const { EvidenceCollector } = require("./evidenceCollector.cjs");
const { ExplanationBuilder } = require("./explanationBuilder.cjs");
const { RankingTrace } = require("./rankingTrace.cjs");
const { ExplanationResultAdapter } = require("./explanationResultAdapter.cjs");
const { ExplanationDiagnostics } = require("./explanationDiagnostics.cjs");

class SearchExplanation {
  /**
   * Explains a list of search results
   *
   * @param {Array<Object>} searchResults - Standard SearchResult list from Part 17/22
   * @param {Object} structuredQuery - StructuredQuery from Part 16/23
   * @param {Object} [db] - DatabaseManager
   * @param {Object} [options]
   * @returns {Array<Object>} Enriched SearchResults with explanations
   */
  static explainResults(searchResults = [], structuredQuery = {}, db = null, options = {}) {
    if (!Array.isArray(searchResults)) return [];

    return searchResults.map((res, index) => {
      try {
        const evidenceList = EvidenceCollector.collect(res, structuredQuery, db);
        const userExplanation = ExplanationBuilder.build(res, evidenceList);
        const developerTrace = options.debug ? RankingTrace.trace(res, structuredQuery, index + 1) : null;

        return ExplanationResultAdapter.attach(res, userExplanation, developerTrace);
      } catch {
        // Error isolation: return original search result unaltered
        return res;
      }
    });
  }

  /**
   * Explains why a search returned zero results
   */
  static explainZeroResults(structuredQuery = {}, filterDiagnostics = {}) {
    return ExplanationDiagnostics.generateZeroResultReport(structuredQuery, filterDiagnostics);
  }
}

module.exports = {
  SearchExplanation,
};
