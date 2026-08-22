"use strict";

const MediaAnalysisStatus = Object.freeze({
  NOT_SUPPORTED: "not_supported",
  PENDING: "pending",
  PROCESSING: "processing",
  READY: "ready",
  STALE: "stale",
  ERROR: "error",
  SKIPPED: "skipped",
});

module.exports = {
  MediaAnalysisStatus,
};
