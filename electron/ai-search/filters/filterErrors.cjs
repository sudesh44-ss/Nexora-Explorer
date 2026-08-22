"use strict";

const FilterErrorCode = Object.freeze({
  INVALID_OPERATOR: "INVALID_OPERATOR",
  INVALID_TYPE: "INVALID_TYPE",
  INVALID_SIZE: "INVALID_SIZE",
  INVALID_DATE: "INVALID_DATE",
  PATH_TRAVERSAL_DETECTED: "PATH_TRAVERSAL_DETECTED",
  INVALID_FILTER_VALUE: "INVALID_FILTER_VALUE",
  CONTRADICTORY_FILTER: "CONTRADICTORY_FILTER",
  MAX_DEPTH_EXCEEDED: "MAX_DEPTH_EXCEEDED",
});

class FilterError extends Error {
  constructor(code, message, details = {}) {
    super(`[FilterError:${code}] ${message}`);
    this.name = "FilterError";
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  FilterErrorCode,
  FilterError,
};
