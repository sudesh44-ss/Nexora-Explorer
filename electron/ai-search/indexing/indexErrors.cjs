"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const IndexQueueErrorCode = Object.freeze({
  TASK_INVALID: "AI_SEARCH_TASK_INVALID",
  TASK_DEPENDENCY_FAILED: "AI_SEARCH_TASK_DEPENDENCY_FAILED",
  WORKER_POOL_FULL: "AI_SEARCH_WORKER_POOL_FULL",
  QUEUE_PERSISTENCE_FAILED: "AI_SEARCH_QUEUE_PERSISTENCE_FAILED",
  TASK_TIMEOUT: "AI_SEARCH_TASK_TIMEOUT",
  WORKER_EXECUTION_FAILED: "AI_SEARCH_WORKER_EXECUTION_FAILED",
});

class IndexQueueError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_INDEXER_FAILED, message, details);
    this.name = "IndexQueueError";
  }
}

module.exports = {
  IndexQueueErrorCode,
  IndexQueueError,
};
