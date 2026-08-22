"use strict";

const { DatabaseError, DatabaseErrorCode } = require("../databaseErrors.cjs");

/**
 * Transaction Manager for atomic SQLite operations
 */
class TransactionManager {
  constructor(db) {
    this.db = db;
    this._inTransaction = false;
  }

  /**
   * Executes synchronous callback within an atomic transaction
   * @template T
   * @param {() => T} fn - Function to execute inside transaction
   * @returns {T} Result of function
   */
  run(fn) {
    if (this._inTransaction) {
      // Already inside a transaction, simply execute
      return fn();
    }

    try {
      this._inTransaction = true;
      this.db.exec("BEGIN IMMEDIATE;");
      const result = fn();
      this.db.exec("COMMIT;");
      return result;
    } catch (err) {
      try {
        this.db.exec("ROLLBACK;");
      } catch {}
      throw new DatabaseError(
        DatabaseErrorCode.DB_TRANSACTION_FAILED,
        `Transaction failed and was rolled back: ${err.message}`,
        err
      );
    } finally {
      this._inTransaction = false;
    }
  }

  isInTransaction() {
    return this._inTransaction;
  }
}

module.exports = {
  TransactionManager,
};
