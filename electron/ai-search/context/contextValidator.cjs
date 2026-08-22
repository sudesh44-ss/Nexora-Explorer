"use strict";

const { QueryState } = require("./queryState.cjs");

class ContextValidator {
  /**
   * Validates and sanitizes a query state object
   */
  static sanitize(state) {
    if (!state || typeof state !== "object") {
      return QueryState.create();
    }

    return QueryState.create({
      rawQuery: typeof state.rawQuery === "string" ? state.rawQuery : "",
      normalizedQuery: typeof state.normalizedQuery === "string" ? state.normalizedQuery : "",
      keywords: Array.isArray(state.keywords) ? state.keywords.filter((k) => typeof k === "string") : [],
      phrases: Array.isArray(state.phrases) ? state.phrases.filter((p) => typeof p === "string") : [],
      fileTypes: Array.isArray(state.fileTypes) ? state.fileTypes.filter((t) => typeof t === "string") : [],
      extensions: Array.isArray(state.extensions) ? state.extensions.filter((e) => typeof e === "string") : [],
      folderScope: typeof state.folderScope === "string" ? state.folderScope : null,
      sizeFilter: state.sizeFilter && typeof state.sizeFilter === "object" ? state.sizeFilter : null,
      dateFilter: state.dateFilter && typeof state.dateFilter === "object" ? state.dateFilter : null,
      durationFilter: state.durationFilter && typeof state.durationFilter === "object" ? state.durationFilter : null,
      sort: typeof state.sort === "string" ? state.sort : null,
      exclusions: Array.isArray(state.exclusions) ? state.exclusions.filter((x) => typeof x === "string") : [],
      intent: typeof state.intent === "string" ? state.intent : "SEARCH_FILES",
      contradiction: Boolean(state.contradiction),
      contradictionReason: typeof state.contradictionReason === "string" ? state.contradictionReason : null,
    });
  }
}

module.exports = {
  ContextValidator,
};
