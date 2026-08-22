"use strict";

class RankingValidator {
  /**
   * Validates a candidate item before scoring
   */
  static validateCandidate(c) {
    if (!c || typeof c !== "object") return false;
    if (!c.fileId || typeof c.fileId !== "string") return false;
    return true;
  }
}

module.exports = {
  RankingValidator,
};
