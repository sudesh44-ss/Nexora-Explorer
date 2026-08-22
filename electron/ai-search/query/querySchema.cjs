"use strict";

const QueryIntent = Object.freeze({
  SEARCH_FILES: "SEARCH_FILES",
  SEARCH_FOLDERS: "SEARCH_FOLDERS",
  SEARCH_IMAGES: "SEARCH_IMAGES",
  SEARCH_VIDEOS: "SEARCH_VIDEOS",
  SEARCH_AUDIO: "SEARCH_AUDIO",
  SEARCH_DOCUMENTS: "SEARCH_DOCUMENTS",
  SEARCH_CODE: "SEARCH_CODE",
  FILTERED_SEARCH: "FILTERED_SEARCH",
  SEMANTIC_SEARCH: "SEMANTIC_SEARCH",
  CONTENT_SEARCH: "CONTENT_SEARCH",
  EXACT_SEARCH: "EXACT_SEARCH",
  RECENT_FILES: "RECENT_FILES",
  LARGE_FILES: "LARGE_FILES",
  TYPE_SEARCH: "TYPE_SEARCH",
});

/**
 * Factory for creating standardized StructuredQuery objects
 */
function createStructuredQuery(options = {}) {
  return {
    rawQuery: options.rawQuery || "",
    normalizedQuery: options.normalizedQuery || "",
    language: options.language || "ENGLISH",
    intent: options.intent || QueryIntent.SEARCH_FILES,
    concepts: Array.isArray(options.concepts) ? options.concepts : [],
    keywords: Array.isArray(options.keywords) ? options.keywords : [],
    phrases: Array.isArray(options.phrases) ? options.phrases : [],
    fileTypes: Array.isArray(options.fileTypes) ? options.fileTypes : [],
    folderHints: Array.isArray(options.folderHints) ? options.folderHints : [],
    dateFilter: options.dateFilter || null,
    sizeFilter: options.sizeFilter || null,
    metadataFilters: options.metadataFilters || {},
    semanticQuery: options.semanticQuery || "",

    // Multimodal signals
    objects: Array.isArray(options.objects) ? options.objects : [],
    scenes: Array.isArray(options.scenes) ? options.scenes : [],
    entities: options.entities || null,
    containsPeople: Boolean(options.containsPeople),

    // Boolean tree
    boolean: options.boolean || {
      must: [],
      should: [],
      mustNot: [],
    },

    confidence: {
      intent: options.confidence?.intent !== undefined ? options.confidence.intent : 1.0,
      fileTypes: options.confidence?.fileTypes !== undefined ? options.confidence.fileTypes : 1.0,
      date: options.confidence?.date !== undefined ? options.confidence.date : 1.0,
      overall: options.confidence?.overall !== undefined ? options.confidence.overall : 1.0,
    },
    diagnostics: {
      parseMode: options.diagnostics?.parseMode || "local",
      tookMs: options.diagnostics?.tookMs || 0,
    },
  };
}

module.exports = {
  QueryIntent,
  createStructuredQuery,
};
