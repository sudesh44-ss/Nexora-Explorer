"use strict";

const { QueryState } = require("./queryState.cjs");
const { ContextValidator } = require("./contextValidator.cjs");
const { FilterTypes } = require("../filters/filterTypes.cjs");

class QueryRefiner {
  /**
   * Applies refinement transformation to previous state
   *
   * @param {Object} prevState - Sanitized QueryState
   * @param {Object} currentStructuredQuery - StructuredQuery produced from current turn
   * @param {Object} analysis - Analysis from ContextNormalizer
   * @returns {Object} Refined QueryState
   */
  static refine(prevState, currentStructuredQuery, analysis = {}) {
    const prev = ContextValidator.sanitize(prevState);
    const curr = ContextValidator.sanitize(currentStructuredQuery);

    if (analysis.action === "CLEAR") {
      return QueryState.create();
    }

    if (analysis.action === "NEW") {
      return curr;
    }

    if (analysis.action === "REMOVE") {
      const target = (analysis.payload || "").toLowerCase();
      const nextState = { ...prev };

      if (target.includes("video") || target.includes("image") || target.includes("audio") || target.includes("pdf") || target.includes("document") || target.includes("type")) {
        nextState.fileTypes = [];
      }
      if (target.includes("size")) {
        nextState.sizeFilter = null;
      }
      if (target.includes("date") || target.includes("year") || target.includes("month")) {
        nextState.dateFilter = null;
      }
      if (target.includes("duration") || target.includes("time") || target.includes("length")) {
        nextState.durationFilter = null;
      }
      if (target.includes("sort")) {
        nextState.sort = null;
      }

      // If user specified an exact term to remove
      nextState.keywords = nextState.keywords.filter((kw) => !target.includes(kw.toLowerCase()));
      nextState.rawQuery = nextState.keywords.join(" ");
      return QueryState.create(nextState);
    }

    // Merged state
    const nextState = {
      rawQuery: `${prev.rawQuery} ${curr.rawQuery}`.trim(),
      normalizedQuery: `${prev.normalizedQuery} ${curr.normalizedQuery}`.trim(),
      keywords: Array.from(new Set([...prev.keywords, ...curr.keywords])),
      phrases: Array.from(new Set([...prev.phrases, ...curr.phrases])),
      fileTypes: curr.fileTypes.length > 0 ? curr.fileTypes : prev.fileTypes,
      extensions: curr.extensions.length > 0 ? curr.extensions : prev.extensions,
      folderScope: curr.folderScope || prev.folderScope,
      sizeFilter: curr.sizeFilter || prev.sizeFilter,
      dateFilter: curr.dateFilter || prev.dateFilter,
      durationFilter: curr.durationFilter || prev.durationFilter,
      sort: curr.sort || prev.sort,
      exclusions: Array.from(new Set([...prev.exclusions, ...curr.exclusions])),
      intent: curr.intent || prev.intent,
      contradiction: false,
      contradictionReason: null,
    };

    // Check Duration Contradiction
    if (prev.durationFilter && curr.durationFilter) {
      const p = prev.durationFilter;
      const c = curr.durationFilter;
      if (
        (p.operator === ">" || p.operator === ">=") &&
        (c.operator === "<" || c.operator === "<=") &&
        p.seconds >= c.seconds
      ) {
        nextState.contradiction = true;
        nextState.contradictionReason = `Duration filter conflict: ${p.operator}${p.seconds}s and ${c.operator}${c.seconds}s are mutually exclusive.`;
      }
    }

    return QueryState.create(nextState);
  }
}

module.exports = {
  QueryRefiner,
};
