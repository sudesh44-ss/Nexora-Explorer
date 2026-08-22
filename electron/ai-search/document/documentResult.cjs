"use strict";

const { DocumentType } = require("./documentMetadata.cjs");

function createDocumentResult(options = {}) {
  let confidence = typeof options.confidence === "number" ? options.confidence : 1.0;
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    success: options.success !== undefined ? Boolean(options.success) : true,
    documentType: options.documentType || DocumentType.UNKNOWN,
    confidence,
    title: options.title || null,
    date: options.date || null,
    author: options.author || null,
    entities: Array.isArray(options.entities) ? options.entities : [],
    summary: options.summary || null,
    createdAt: options.createdAt || new Date().toISOString(),
  };
}

module.exports = {
  createDocumentResult,
};
