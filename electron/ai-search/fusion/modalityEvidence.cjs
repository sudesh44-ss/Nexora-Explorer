"use strict";

class ModalityEvidence {
  /**
   * Constructs an evidence provenance record for a candidate
   */
  static create(options = {}) {
    return {
      modality: options.modality || "document",
      matchedBy: Array.isArray(options.matchedBy) ? options.matchedBy : [],
      matchedTerms: Array.isArray(options.matchedTerms) ? options.matchedTerms : [],
      bestMatchTimestamp: options.bestMatchTimestamp || null,
      signals: Array.isArray(options.signals) ? options.signals : [],
      scoreBreakdown: options.scoreBreakdown || {},
    };
  }
}

module.exports = {
  ModalityEvidence,
};
