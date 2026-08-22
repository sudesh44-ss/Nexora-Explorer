"use strict";

class RankingExplanation {
  /**
   * Constructs structured explanation and matchedBy tags
   */
  static buildExplanation(signals = {}, scoreBreakdown = {}) {
    const matchedBy = [];
    const reasons = [];

    if (signals.filenameExact > 0.8) {
      matchedBy.push("exact_filename");
      matchedBy.push("filename");
      reasons.push("Exact filename match");
    } else if (signals.filenamePartial > 0.3) {
      matchedBy.push("filename");
      reasons.push("Filename keyword match");
    }

    if (signals.phrase > 0.5) {
      matchedBy.push("exact_phrase");
      reasons.push("Quoted phrase match");
    }

    if (signals.fts > 0.2) {
      matchedBy.push("fts");
      reasons.push("Full-text content match");
    }

    if (signals.ocr > 0.2) {
      matchedBy.push("ocr");
      reasons.push("Scanned document OCR match");
    }

    if (signals.vision > 0.2) {
      matchedBy.push("vision");
      reasons.push("Visual content / object detection match");
    }

    if (signals.semantic > 0.3) {
      matchedBy.push("semantic");
      reasons.push("Semantic similarity match");
    }

    if (signals.folder > 0.5) {
      matchedBy.push("folder");
      reasons.push("Folder directory match");
    }

    if (matchedBy.length === 0) {
      matchedBy.push("keyword");
      reasons.push("General relevance match");
    }

    return {
      matchedBy: Array.from(new Set(matchedBy)),
      reasons,
      scoreBreakdown,
    };
  }
}

module.exports = {
  RankingExplanation,
};
