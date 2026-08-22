"use strict";

class CacheKey {
  /**
   * Generates a deterministic cache key from structured search parameters
   *
   * @param {Object} structuredQuery - Structured query from Part 16/23
   * @param {Object} options - Search options (mode, scope, sort, indexVersion)
   * @returns {string} Unique cache key string
   */
  static generate(structuredQuery = {}, options = {}) {
    const raw = (structuredQuery.rawQuery || structuredQuery.normalizedQuery || "").trim().toLowerCase();
    const fileTypes = (structuredQuery.fileTypes || []).slice().sort().join(",");
    const extensions = (structuredQuery.extensions || []).slice().sort().join(",");
    const folderScope = options.folderScope || structuredQuery.folderScope || "global";
    const mode = options.mode || "BALANCED";
    const sort = options.sort || structuredQuery.sort || "relevance";
    const indexVersion = options.indexVersion || 1;

    // Filters signature
    const sizeSig = structuredQuery.sizeFilter ? `${structuredQuery.sizeFilter.operator}${structuredQuery.sizeFilter.bytes}` : "";
    const dateSig = structuredQuery.dateFilter ? `${structuredQuery.dateFilter.operator}${structuredQuery.dateFilter.start || ""}_${structuredQuery.dateFilter.end || ""}` : "";
    const durSig = structuredQuery.durationFilter ? `${structuredQuery.durationFilter.operator}${structuredQuery.durationFilter.seconds}` : "";

    return `v${indexVersion}::m:${mode}::s:${sort}::f:${folderScope}::t:[${fileTypes}]::e:[${extensions}]::sz:${sizeSig}::dt:${dateSig}::dur:${durSig}::q:${raw}`;
  }
}

module.exports = {
  CacheKey,
};
