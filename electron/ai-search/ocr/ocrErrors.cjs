"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const OCRErrorCode = Object.freeze({
  OCR_ENGINE_UNAVAILABLE: "AI_SEARCH_OCR_ENGINE_UNAVAILABLE",
  OCR_DECODE_FAILED: "AI_SEARCH_OCR_DECODE_FAILED",
  OCR_TIMEOUT: "AI_SEARCH_OCR_TIMEOUT",
  OCR_LANGUAGE_UNSUPPORTED: "AI_SEARCH_OCR_LANGUAGE_UNSUPPORTED",
  OCR_MEMORY_LIMIT: "AI_SEARCH_OCR_MEMORY_LIMIT",
  OCR_INVALID_INPUT: "AI_SEARCH_OCR_INVALID_INPUT",
});

class OCRError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_EXTRACTION_FAILED, message, details);
    this.name = "OCRError";
  }
}

module.exports = {
  OCRErrorCode,
  OCRError,
};
