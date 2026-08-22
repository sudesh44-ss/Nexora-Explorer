"use strict";

const { ContextNormalizer } = require("./contextNormalizer.cjs");
const { QueryRefiner } = require("./queryRefiner.cjs");
const { QueryUnderstanding } = require("../query/queryUnderstanding.cjs");
const { ContextDiagnostics } = require("./contextDiagnostics.cjs");
const { VideoDuration } = require("../video/videoDuration.cjs");

class ContextResolver {
  constructor(queryUnderstanding = null) {
    this.qu = queryUnderstanding || new QueryUnderstanding();
  }

  /**
   * Resolves a raw query against an active context
   *
   * @param {string} rawQuery - Incoming user query
   * @param {Object} activeContextState - Current QueryState
   * @param {Object} [options]
   * @returns {{resolvedState: Object, diagnostics: Object}}
   */
  resolve(rawQuery = "", activeContextState = null, options = {}) {
    const analysis = ContextNormalizer.analyze(rawQuery);

    if (analysis.action === "CLEAR") {
      const empty = QueryRefiner.refine(activeContextState, {}, analysis);
      return {
        resolvedState: empty,
        diagnostics: ContextDiagnostics.generateReport(activeContextState, rawQuery, "CLEAR", empty),
      };
    }

    // Process structured query from current turn
    const parsePayload = analysis.payload || rawQuery;
    const currentStructured = this.qu.understand(parsePayload, options);

    // Extract duration token if present in query
    const durMatch = parsePayload.match(/duration:([><=0-9a-zA-Z]+)/i);
    if (durMatch && durMatch[1]) {
      const parsedDur = VideoDuration.parse(durMatch[1]);
      if (parsedDur) {
        currentStructured.durationFilter = parsedDur;
      }
    }

    // If query is an entirely new topic without modifier/refinement cues, check if it's unrelated
    let effectiveAnalysis = analysis;
    if (
      activeContextState &&
      activeContextState.rawQuery &&
      analysis.action === "ADDITIVE" &&
      !options.forceRefinement
    ) {
      if (rawQuery.toLowerCase().startsWith("search ")) {
        effectiveAnalysis = { action: "NEW", payload: rawQuery };
      }
    }

    const resolvedState = QueryRefiner.refine(activeContextState, currentStructured, effectiveAnalysis);
    const diagnostics = ContextDiagnostics.generateReport(activeContextState, rawQuery, effectiveAnalysis.action, resolvedState);

    return {
      resolvedState,
      diagnostics,
    };
  }
}

module.exports = {
  ContextResolver,
};
