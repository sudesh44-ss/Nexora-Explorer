"use strict";

class QueryState {
  /**
   * Creates a standardized query state object
   */
  static create(options = {}) {
    return {
      rawQuery: options.rawQuery || "",
      normalizedQuery: options.normalizedQuery || "",
      keywords: Array.isArray(options.keywords) ? options.keywords : [],
      phrases: Array.isArray(options.phrases) ? options.phrases : [],
      fileTypes: Array.isArray(options.fileTypes) ? options.fileTypes : [],
      extensions: Array.isArray(options.extensions) ? options.extensions : [],
      folderScope: options.folderScope || null,
      sizeFilter: options.sizeFilter || null,
      dateFilter: options.dateFilter || null,
      durationFilter: options.durationFilter || null,
      sort: options.sort || null,
      exclusions: Array.isArray(options.exclusions) ? options.exclusions : [],
      intent: options.intent || "SEARCH_FILES",
      contradiction: options.contradiction || false,
      contradictionReason: options.contradictionReason || null,
    };
  }
}

module.exports = {
  QueryState,
};
