"use strict";

class CacheIntegrityGuard {
  /**
   * Validates cached search result payload integrity
   */
  static validateCachedResults(results) {
    if (!Array.isArray(results)) return false;

    // Verify first few entries have valid structure
    for (let i = 0; i < Math.min(5, results.length); i++) {
      const item = results[i];
      if (!item || typeof item !== "object") return false;
      if (!item.fileId && !item.id) return false;
    }

    return true;
  }
}

module.exports = {
  CacheIntegrityGuard,
};
