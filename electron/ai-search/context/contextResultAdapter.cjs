"use strict";

const { createStructuredQuery } = require("../query/querySchema.cjs");

class ContextResultAdapter {
  /**
   * Adapts resolved QueryState into standard StructuredQuery format
   */
  static toStructuredQuery(queryState) {
    if (!queryState) return createStructuredQuery();

    return createStructuredQuery({
      rawQuery: queryState.rawQuery || "",
      normalizedQuery: queryState.normalizedQuery || "",
      intent: queryState.intent || "SEARCH_FILES",
      keywords: queryState.keywords || [],
      phrases: queryState.phrases || [],
      fileTypes: queryState.fileTypes || [],
      extensions: queryState.extensions || [],
      folderScope: queryState.folderScope || null,
      sizeFilter: queryState.sizeFilter || null,
      dateFilter: queryState.dateFilter || null,
      durationFilter: queryState.durationFilter || null,
      exclusions: queryState.exclusions || [],
      sort: queryState.sort || null,
    });
  }
}

module.exports = {
  ContextResultAdapter,
};
