"use strict";

class ContentValidator {
  /**
   * Validates a unified content object before persistence or indexing
   */
  static validate(content) {
    if (!content || typeof content !== "object") {
      return { valid: false, error: "Content must be a non-null object" };
    }

    if (!content.fileId || typeof content.fileId !== "string") {
      return { valid: false, error: "Content requires a valid fileId string" };
    }

    if (!content.filename || typeof content.filename !== "string") {
      return { valid: false, error: "Content requires a valid filename" };
    }

    return { valid: true };
  }
}

module.exports = {
  ContentValidator,
};
