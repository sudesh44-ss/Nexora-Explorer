"use strict";

/**
 * Factory for creating standardized search result objects
 */
function createSearchResult(options = {}) {
  return {
    fileId: options.fileId || "",
    name: options.name || "",
    path: options.path || "",
    extension: options.extension || "",
    mimeType: options.mimeType || "application/octet-stream",
    size: Number(options.size) || 0,
    modifiedAt: options.modifiedAt || null,
    score: Number(options.score) || 0,
    matchedBy: Array.isArray(options.matchedBy) ? options.matchedBy : ["keyword"],
    scoreBreakdown: options.scoreBreakdown || null,
  };
}

module.exports = {
  createSearchResult,
};
