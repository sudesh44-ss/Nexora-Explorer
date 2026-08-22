"use strict";

/**
 * Structured Error Codes for Nexora AI Search Subsystem
 */
const AISearchErrorCodes = Object.freeze({
  AI_SEARCH_NOT_INITIALIZED: "AI_SEARCH_NOT_INITIALIZED",
  AI_SEARCH_ALREADY_INITIALIZED: "AI_SEARCH_ALREADY_INITIALIZED",
  AI_SEARCH_INIT_FAILED: "AI_SEARCH_INIT_FAILED",
  AI_SEARCH_SHUTDOWN_FAILED: "AI_SEARCH_SHUTDOWN_FAILED",
  AI_SEARCH_DB_FAILED: "AI_SEARCH_DB_FAILED",
  AI_SEARCH_INDEX_FAILED: "AI_SEARCH_INDEX_FAILED",
  AI_SEARCH_MODEL_FAILED: "AI_SEARCH_MODEL_FAILED",
  AI_SEARCH_PROVIDER_FAILED: "AI_SEARCH_PROVIDER_FAILED",
  AI_SEARCH_WATCHER_FAILED: "AI_SEARCH_WATCHER_FAILED",
  AI_SEARCH_QUEUE_FAILED: "AI_SEARCH_QUEUE_FAILED",
  AI_SEARCH_SEARCH_FAILED: "AI_SEARCH_SEARCH_FAILED",
  AI_SEARCH_CONFIG_INVALID: "AI_SEARCH_CONFIG_INVALID",
  AI_SEARCH_HARDWARE_UNSUPPORTED: "AI_SEARCH_HARDWARE_UNSUPPORTED",
});

/**
 * Custom Error Class for AI Search Subsystem
 */
class AISearchError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "AISearchError";
    this.code = code || AISearchErrorCodes.AI_SEARCH_INIT_FAILED;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

module.exports = {
  AISearchErrorCodes,
  AISearchError,
};
