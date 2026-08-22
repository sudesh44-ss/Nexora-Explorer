"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const QueryErrorCode = Object.freeze({
  INVALID_QUERY: "AI_SEARCH_INVALID_QUERY",
  INVALID_QUERY_SCHEMA: "AI_SEARCH_INVALID_QUERY_SCHEMA",
  INVALID_DATE_FILTER: "AI_SEARCH_INVALID_DATE_FILTER",
  INVALID_FILE_TYPE: "AI_SEARCH_INVALID_FILE_TYPE",
  LLM_PARSE_FAILED: "AI_SEARCH_LLM_PARSE_FAILED",
  QUERY_TOO_LONG: "AI_SEARCH_QUERY_TOO_LONG",
});

class QueryError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_QUERY_FAILED, message, details);
    this.name = "QueryError";
  }
}

module.exports = {
  QueryErrorCode,
  QueryError,
};
