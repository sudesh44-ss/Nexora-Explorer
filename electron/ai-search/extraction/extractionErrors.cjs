"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const ExtractionErrorCode = Object.freeze({
  FILE_NOT_FOUND: "AI_SEARCH_EXTRACT_FILE_NOT_FOUND",
  ACCESS_DENIED: "AI_SEARCH_EXTRACT_ACCESS_DENIED",
  UNSUPPORTED_TYPE: "AI_SEARCH_EXTRACT_UNSUPPORTED_TYPE",
  INVALID_ENCODING: "AI_SEARCH_EXTRACT_INVALID_ENCODING",
  INVALID_PDF: "AI_SEARCH_EXTRACT_INVALID_PDF",
  INVALID_DOCX: "AI_SEARCH_EXTRACT_INVALID_DOCX",
  TEXT_NOT_AVAILABLE: "AI_SEARCH_EXTRACT_TEXT_NOT_AVAILABLE",
  CONTENT_TOO_LARGE: "AI_SEARCH_EXTRACT_CONTENT_TOO_LARGE",
  EXTRACTION_FAILED: "AI_SEARCH_EXTRACT_FAILED",
  EXTRACTION_TIMEOUT: "AI_SEARCH_EXTRACT_TIMEOUT",
});

class ExtractionError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_PARSE_FAILED, message, details);
    this.name = "ExtractionError";
  }
}

module.exports = {
  ExtractionErrorCode,
  ExtractionError,
};
