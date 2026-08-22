"use strict";

/**
 * Creates a normalized OCRResult object
 */
function createOCRResult(options = {}) {
  let confidence = typeof options.confidence === "number" ? options.confidence : 1.0;
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    success: options.success !== undefined ? Boolean(options.success) : true,
    text: options.text || "",
    language: options.language || "en",
    confidence,
    blocks: Array.isArray(options.blocks) ? options.blocks : [],
    lines: Array.isArray(options.lines) ? options.lines : (options.text ? options.text.split("\n").filter(Boolean) : []),
    words: Array.isArray(options.words) ? options.words : null,
    sourceHash: options.sourceHash || "",
    engineId: options.engineId || "local_ocr",
    engineVersion: options.engineVersion || "1.0.0",
    createdAt: options.createdAt || new Date().toISOString(),
    errorCode: options.errorCode || null,
    errorMessage: options.errorMessage || null,
  };
}

module.exports = {
  createOCRResult,
};
