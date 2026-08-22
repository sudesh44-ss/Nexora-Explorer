"use strict";

const { QueryParser } = require("./queryParser.cjs");

/**
 * Creates structured SearchQuery objects from raw user queries
 */
class QueryProcessor {
  /**
   * Processes a raw natural query into a SearchQuery object
   *
   * @param {string} rawQuery
   * @param {Object} [options]
   * @returns {Object} SearchQuery
   */
  static process(rawQuery, options = {}) {
    const raw = typeof rawQuery === "string" ? rawQuery.trim() : "";
    const parsed = QueryParser.parse(raw);

    const explicitTypes = Array.isArray(options.fileTypes)
      ? options.fileTypes
      : options.fileType
      ? (Array.isArray(options.fileType) ? options.fileType : [options.fileType])
      : [];
    const mergedTypes = Array.from(new Set([...parsed.fileTypes, ...explicitTypes]));

    return {
      rawQuery: raw,
      keywords: parsed.keywords,
      semanticQuery: parsed.semanticQuery,
      filters: {
        fileTypes: mergedTypes,
        folderHints: options.folderHints || [],
        ...(options.filters || {}),
      },
      limit: Math.min(options.limit || 20, 100),
      options: {
        useFts: options.useFts !== false,
        useVector: options.useVector !== false,
        useMetadata: options.useMetadata !== false,
        ...options,
      },
    };
  }
}

module.exports = {
  QueryProcessor,
};
