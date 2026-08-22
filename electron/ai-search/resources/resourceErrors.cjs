"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const ResourceErrorCode = Object.freeze({
  RESOURCE_INIT_FAILED: "AI_SEARCH_RESOURCE_INIT_FAILED",
  RESOURCE_MONITOR_FAILED: "AI_SEARCH_RESOURCE_MONITOR_FAILED",
  RESOURCE_POLICY_INVALID: "AI_SEARCH_RESOURCE_POLICY_INVALID",
  RESOURCE_UNAVAILABLE: "AI_SEARCH_RESOURCE_UNAVAILABLE",
});

class ResourceError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_HARDWARE_INSUFFICIENT, message, details);
    this.name = "ResourceError";
  }
}

module.exports = {
  ResourceErrorCode,
  ResourceError,
};
