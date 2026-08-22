"use strict";

class ExplanationValidator {
  /**
   * Validates and sanitizes evidence item
   */
  static validateEvidence(evidence) {
    if (!evidence || typeof evidence !== "object") return false;
    if (typeof evidence.source !== "string" || !evidence.source.trim()) return false;
    return true;
  }

  /**
   * Validates user explanation object
   */
  static sanitize(explanation) {
    if (!explanation || typeof explanation !== "object") {
      return {
        summary: "Matched relevant keywords",
        bullets: [],
        bestMatchTimestamp: null,
        modality: "document",
      };
    }

    return {
      summary: typeof explanation.summary === "string" ? explanation.summary : "Matched relevant keywords",
      bullets: Array.isArray(explanation.bullets) ? explanation.bullets.filter((b) => typeof b === "string") : [],
      bestMatchTimestamp: typeof explanation.bestMatchTimestamp === "string" ? explanation.bestMatchTimestamp : null,
      modality: typeof explanation.modality === "string" ? explanation.modality : "document",
    };
  }
}

module.exports = {
  ExplanationValidator,
};
