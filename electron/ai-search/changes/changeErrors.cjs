"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const ChangeErrorCode = Object.freeze({
  CHANGE_EVENT_INVALID: "AI_SEARCH_CHANGE_EVENT_INVALID",
  RECONCILIATION_FAILED: "AI_SEARCH_RECONCILIATION_FAILED",
  STALE_EVENT_REJECTED: "AI_SEARCH_STALE_EVENT_REJECTED",
  COALESCING_FAILED: "AI_SEARCH_COALESCING_FAILED",
});

class ChangeError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_INDEXER_FAILED, message, details);
    this.name = "ChangeError";
  }
}

module.exports = {
  ChangeErrorCode,
  ChangeError,
};
