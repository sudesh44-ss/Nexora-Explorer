"use strict";

/**
 * Normalizes document text (removes control characters, trims whitespace without destroying paragraphs)
 */
function normalizeDocumentText(text) {
  if (!text || typeof text !== "string") return "";
  
  // Replace null bytes, form feeds, and non-printable control chars (except \n, \r, \t)
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
  
  // Normalize Windows/Mac line endings to \n
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  
  // Collapse 3+ consecutive newlines to 2
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  
  // Collapse multiple spaces/tabs into a single space on the same line
  cleaned = cleaned.replace(/[^\S\r\n]+/g, " ");
  
  return cleaned.trim();
}

/**
 * Normalizes code text (preserves line structures and indentation)
 */
function normalizeCodeText(text) {
  if (!text || typeof text !== "string") return "";
  
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return cleaned.trim();
}

/**
 * Counts words in text accurately
 */
function countWords(text) {
  if (!text || typeof text !== "string") return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Factory for unified Extraction Result
 */
function createExtractionResult(options = {}) {
  const success = options.success !== undefined ? options.success : true;
  const rawText = options.text || "";
  const charCount = options.characterCount !== undefined ? options.characterCount : rawText.length;
  const words = options.wordCount !== undefined ? options.wordCount : countWords(rawText);

  return {
    success,
    fileId: options.fileId || null,
    extractor: options.extractor || "unknown",
    contentType: options.contentType || "text/plain",
    text: rawText,
    characterCount: charCount,
    wordCount: words,
    truncated: Boolean(options.truncated),
    warnings: Array.isArray(options.warnings) ? options.warnings : [],
    errorCode: options.errorCode || null,
    message: options.message || null,
    retryable: Boolean(options.retryable),
  };
}

module.exports = {
  normalizeDocumentText,
  normalizeCodeText,
  countWords,
  createExtractionResult,
};
