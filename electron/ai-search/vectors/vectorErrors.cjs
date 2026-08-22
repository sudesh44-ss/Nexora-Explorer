"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const VectorErrorCode = Object.freeze({
  VECTOR_INVALID: "AI_SEARCH_VECTOR_INVALID",
  VECTOR_DIMENSION_MISMATCH: "AI_SEARCH_VECTOR_DIMENSION_MISMATCH",
  VECTOR_NOT_FOUND: "AI_SEARCH_VECTOR_NOT_FOUND",
  VECTOR_INDEX_INCOMPATIBLE: "AI_SEARCH_VECTOR_INDEX_INCOMPATIBLE",
  EMBEDDING_FAILED: "AI_SEARCH_EMBEDDING_FAILED",
  SIMILARITY_CALCULATION_FAILED: "AI_SEARCH_SIMILARITY_CALCULATION_FAILED",
  VECTOR_STORE_CLOSED: "AI_SEARCH_VECTOR_STORE_CLOSED",
  VECTOR_MODEL_MISMATCH: "AI_SEARCH_VECTOR_MODEL_MISMATCH",
});

class VectorError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_MODEL_FAILED, message, details);
    this.name = "VectorError";
  }
}

module.exports = {
  VectorErrorCode,
  VectorError,
};
