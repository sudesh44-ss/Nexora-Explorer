"use strict";

const { SuggestionSources } = require("./suggestionSources.cjs");
const { SuggestionNormalizer } = require("./suggestionNormalizer.cjs");
const { SuggestionRanker } = require("./suggestionRanker.cjs");
const { SuggestionResultAdapter } = require("./suggestionResultAdapter.cjs");

class SuggestionResolver {
  /**
   * Aggregates and ranks suggestion candidates
   */
  static resolve(input = "", contextState = null, db = null, options = {}) {
    const rawCandidates = [];
    const searchHistory = options.searchHistory || [];
    const vocabulary = options.vocabulary || ["cybersecurity", "networking", "firewall", "python", "javascript", "machine learning"];

    // 1. Operator suggestions
    rawCandidates.push(...SuggestionSources.getOperatorSuggestions(input));

    // 2. Context refinement suggestions
    if (contextState) {
      rawCandidates.push(...SuggestionSources.getContextSuggestions(input, contextState));
    }

    // 3. Search history suggestions
    rawCandidates.push(...SuggestionSources.getHistorySuggestions(input, searchHistory));

    // 4. Indexed database file suggestions
    if (db) {
      rawCandidates.push(...SuggestionSources.getIndexSuggestions(input, db, options.limit || 8));
    }

    // 5. Typo correction suggestions
    rawCandidates.push(...SuggestionSources.getTypoCorrections(input, vocabulary));

    // Deduplicate
    const deduped = SuggestionNormalizer.deduplicate(rawCandidates);

    // Rank & sort
    const ranked = SuggestionRanker.rank(deduped, input, options);

    return SuggestionResultAdapter.format(ranked);
  }
}

module.exports = {
  SuggestionResolver,
};
