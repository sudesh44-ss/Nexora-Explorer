"use strict";

/**
 * Lifecycle status of an individual file in the index
 */
const FileIndexStatus = Object.freeze({
  DISCOVERED: "discovered",
  PENDING: "pending",
  INDEXING: "indexing",
  INDEXED: "indexed",
  ERROR: "error",
  UNAVAILABLE: "unavailable",
});

/**
 * Operation type determined during file comparison
 */
const IndexOperation = Object.freeze({
  NEW: "NEW",                 // Not in database -> insert
  UPDATE: "UPDATE",           // In database with modified attributes/hash -> update
  UNCHANGED: "UNCHANGED",     // Exactly matches existing database metadata -> skip
  MISSING: "MISSING",         // File previously indexed but removed from disk -> mark unavailable
});

/**
 * Session Lifecycle Status
 */
const SessionStatus = Object.freeze({
  IDLE: "IDLE",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  CANCELLING: "CANCELLING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
});

module.exports = {
  FileIndexStatus,
  IndexOperation,
  SessionStatus,
};
