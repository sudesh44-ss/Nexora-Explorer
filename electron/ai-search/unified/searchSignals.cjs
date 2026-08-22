"use strict";

const SignalSource = Object.freeze({
  FILENAME: "filename",
  METADATA: "metadata",
  FTS: "fts",
  OCR: "ocr",
  VISION: "vision",
  VECTOR: "semantic",
  TAGS: "tags",
  TRANSCRIPT: "transcript",
});

function createSearchSignal(options = {}) {
  return {
    fileId: options.fileId || "",
    source: options.source || SignalSource.FTS,
    matchType: options.matchType || "keyword",
    score: typeof options.score === "number" ? options.score : 1.0,
    matchedFields: Array.isArray(options.matchedFields) ? options.matchedFields : [],
  };
}

module.exports = {
  SignalSource,
  createSearchSignal,
};
