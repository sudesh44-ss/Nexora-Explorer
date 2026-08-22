"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const MediaErrorCode = Object.freeze({
  MEDIA_NOT_SUPPORTED: "AI_SEARCH_MEDIA_NOT_SUPPORTED",
  MEDIA_DECODE_FAILED: "AI_SEARCH_MEDIA_DECODE_FAILED",
  MEDIA_TOO_LARGE: "AI_SEARCH_MEDIA_TOO_LARGE",
  VISION_INFERENCE_FAILED: "AI_SEARCH_VISION_INFERENCE_FAILED",
  MEDIA_STALE: "AI_SEARCH_MEDIA_STALE",
});

class MediaError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_AI_FAILED, message, details);
    this.name = "MediaError";
  }
}

module.exports = {
  MediaErrorCode,
  MediaError,
};
