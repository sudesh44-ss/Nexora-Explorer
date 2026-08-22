"use strict";

class FusionValidator {
  /**
   * Validates merged candidate structure
   */
  static validate(candidate) {
    if (!candidate || typeof candidate.fileId !== "string" || !candidate.fileId.trim()) {
      return false;
    }
    return true;
  }
}

module.exports = {
  FusionValidator,
};
