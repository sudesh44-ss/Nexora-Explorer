"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const SearchErrorCode = Object.freeze({
  SEARCH_QUERY_INVALID: "AI_SEARCH_QUERY_INVALID",
  CANDIDATE_RETRIEVAL_FAILED: "AI_SEARCH_CANDIDATE_RETRIEVAL_FAILED",
  RANKING_FAILED: "AI_SEARCH_RANKING_FAILED",
  FILE_RESOLVE_FAILED: "AI_SEARCH_FILE_RESOLVE_FAILED",
  SEARCH_ABORTED: "AI_SEARCH_ABORTED",
  INDEX_STALE: "AI_SEARCH_INDEX_STALE",
});

class SearchError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_QUERY_FAILED, message, details);
    this.name = "SearchError";
  }
}

module.exports = {
  SearchErrorCode,
  SearchError,
};
