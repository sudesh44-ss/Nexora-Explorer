"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const DocumentErrorCode = Object.freeze({
  DOCUMENT_CLASSIFICATION_FAILED: "AI_SEARCH_DOCUMENT_CLASSIFICATION_FAILED",
  ENTITY_EXTRACTION_FAILED: "AI_SEARCH_ENTITY_EXTRACTION_FAILED",
  INVALID_DOCUMENT_INPUT: "AI_SEARCH_INVALID_DOCUMENT_INPUT",
});

class DocumentError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_EXTRACTION_FAILED, message, details);
    this.name = "DocumentError";
  }
}

module.exports = {
  DocumentErrorCode,
  DocumentError,
};
