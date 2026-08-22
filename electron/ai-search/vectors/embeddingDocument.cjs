"use strict";

/**
 * Standardized input for document embedding generation
 */
function createEmbeddingDocument(options = {}) {
  return {
    fileId: options.fileId || null,
    sourceHash: options.sourceHash || null,
    text: typeof options.text === "string" ? options.text.trim() : "",
    contentType: options.contentType || "text/plain",
    metadata: {
      fileName: options.fileName || "",
      folder: options.folder || "",
      truncated: Boolean(options.truncated),
      ...(options.metadata || {}),
    },
  };
}

module.exports = {
  createEmbeddingDocument,
};
