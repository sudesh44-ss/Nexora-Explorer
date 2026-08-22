"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

const DatabaseErrorCode = Object.freeze({
  DB_OPEN_FAILED: "AI_SEARCH_DB_OPEN_FAILED",
  DB_MIGRATION_FAILED: "AI_SEARCH_DB_MIGRATION_FAILED",
  DB_SCHEMA_FAILED: "AI_SEARCH_DB_SCHEMA_FAILED",
  DB_WRITE_FAILED: "AI_SEARCH_DB_WRITE_FAILED",
  DB_READ_FAILED: "AI_SEARCH_DB_READ_FAILED",
  DB_TRANSACTION_FAILED: "AI_SEARCH_DB_TRANSACTION_FAILED",
  DB_FTS_FAILED: "AI_SEARCH_DB_FTS_FAILED",
  DB_INTEGRITY_FAILED: "AI_SEARCH_DB_INTEGRITY_FAILED",
  DB_CLOSED: "AI_SEARCH_DB_CLOSED",
  DB_INVALID_ARGUMENT: "AI_SEARCH_DB_INVALID_ARGUMENT",
});

class DatabaseError extends AISearchError {
  constructor(code, message, details = null) {
    super(code || AISearchErrorCodes.AI_SEARCH_DB_FAILED, message, details);
    this.name = "DatabaseError";
  }
}

module.exports = {
  DatabaseErrorCode,
  DatabaseError,
};
