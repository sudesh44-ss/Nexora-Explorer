"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const IndexErrorCode = Object.freeze({
  INDEX_INIT_FAILED: "AI_SEARCH_INDEX_INIT_FAILED",
  INDEX_SESSION_FAILED: "AI_SEARCH_INDEX_SESSION_FAILED",
  INDEX_QUEUE_FAILED: "AI_SEARCH_INDEX_QUEUE_FAILED",
  INDEX_WORKER_FAILED: "AI_SEARCH_INDEX_WORKER_FAILED",
  INDEX_ABORTED: "AI_SEARCH_INDEX_ABORTED",
  INDEX_RECORD_FAILED: "AI_SEARCH_INDEX_RECORD_FAILED",
  INDEX_RECONCILIATION_FAILED: "AI_SEARCH_INDEX_RECONCILIATION_FAILED",
  INDEX_STATE_INVALID: "AI_SEARCH_INDEX_STATE_INVALID",
});

class IndexerError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_INDEX_FAILED, message, details);
    this.name = "IndexerError";
  }
}

module.exports = {
  IndexErrorCode,
  IndexerError,
};
