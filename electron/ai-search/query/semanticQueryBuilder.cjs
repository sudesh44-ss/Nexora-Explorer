"use strict";

class SemanticQueryBuilder {
  /**
   * Builds concise, focused semantic query text for vector embedding
   *
   * @param {Array<string>} concepts
   * @param {Array<string>} fileTypes
   * @param {string} rawQuery
   * @returns {string} Cleaned semantic text
   */
  static build(concepts = [], fileTypes = [], rawQuery = "") {
    if (!concepts || concepts.length === 0) {
      // Fallback to cleaned raw query
      return (rawQuery || "").trim();
    }

    const baseConcepts = concepts.join(" ");

    // If a document or image type was explicitly requested, append contextual term
    if (fileTypes.includes("pdf") || fileTypes.includes("document")) {
      if (!baseConcepts.includes("document") && !baseConcepts.includes("pdf")) {
        return `${baseConcepts} documents`;
      }
    }

    if (fileTypes.includes("image")) {
      if (!baseConcepts.includes("photo") && !baseConcepts.includes("image")) {
        return `${baseConcepts} photos`;
      }
    }

    if (fileTypes.includes("video")) {
      if (!baseConcepts.includes("video")) {
        return `${baseConcepts} videos`;
      }
    }

    return baseConcepts;
  }
}

module.exports = {
  SemanticQueryBuilder,
};
