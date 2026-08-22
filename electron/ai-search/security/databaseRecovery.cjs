"use strict";

class DatabaseRecovery {
  /**
   * Runs PRAGMA integrity_check on SQLite database connection
   */
  static verifyIntegrity(db) {
    try {
      if (!db || typeof db.rawDb?.prepare !== "function") return { ok: true, status: "NO_RAW_DB" };

      const stmt = db.rawDb.prepare("PRAGMA integrity_check");
      const result = stmt.get();
      const isOk = result && (result.integrity_check === "ok" || Object.values(result)[0] === "ok");

      return {
        ok: Boolean(isOk),
        status: isOk ? "HEALTHY" : "CORRUPTED",
      };
    } catch (err) {
      return {
        ok: false,
        status: "ERROR",
        error: err.message,
      };
    }
  }
}

module.exports = {
  DatabaseRecovery,
};
