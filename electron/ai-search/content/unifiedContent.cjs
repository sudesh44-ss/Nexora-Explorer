"use strict";

const { CONTENT_SCHEMA_VERSION } = require("./contentVersion.cjs");
const { ProcessingStatus } = require("./contentSources.cjs");

function createUnifiedContent(options = {}) {
  return {
    version: CONTENT_SCHEMA_VERSION,
    fileId: options.fileId || "",
    sourceHash: options.sourceHash || "",
    filename: options.filename || "",
    path: options.path || "",
    folder: options.folder || "",
    fileType: options.fileType || "unknown",
    mimeType: options.mimeType || "application/octet-stream",
    size: options.size || 0,
    modifiedAt: options.modifiedAt || null,

    // Content layers
    nativeText: options.nativeText || "",
    ocrText: options.ocrText || "",
    visionDescription: options.visionDescription || "",
    tags: Array.isArray(options.tags) ? options.tags : [],
    detectedObjects: Array.isArray(options.detectedObjects) ? options.detectedObjects : [],
    concepts: Array.isArray(options.concepts) ? options.concepts : [],
    entities: Array.isArray(options.entities) ? options.entities : [],
    transcript: options.transcript || "",

    // Aggregates
    searchableText: options.searchableText || "",
    hasEmbedding: Boolean(options.hasEmbedding),
    processingStatus: options.processingStatus || ProcessingStatus.NOT_PROCESSED,

    updatedAt: options.updatedAt || new Date().toISOString(),
  };
}

module.exports = {
  createUnifiedContent,
};
