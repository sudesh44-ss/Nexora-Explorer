"use strict";

const ERROR_CATEGORIES = {
  INPUT_ERROR: "INPUT_ERROR",
  PATH_ERROR: "PATH_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  INDEX_ERROR: "INDEX_ERROR",
  SEARCH_ERROR: "SEARCH_ERROR",
  VECTOR_ERROR: "VECTOR_ERROR",
  WORKER_ERROR: "WORKER_ERROR",
  RESOURCE_ERROR: "RESOURCE_ERROR",
  CACHE_ERROR: "CACHE_ERROR",
  IPC_ERROR: "IPC_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
};

class ErrorBoundary {
  /**
   * Catches errors in an async function and wraps them into structured error objects
   */
  static async wrapAsync(fn, category = ERROR_CATEGORIES.SEARCH_ERROR, fallbackValue = null) {
    try {
      return await fn();
    } catch (err) {
      return {
        _isError: true,
        category,
        message: err?.message || "An internal search error occurred",
        fallbackValue,
      };
    }
  }
}

module.exports = {
  ErrorBoundary,
  ERROR_CATEGORIES,
};
