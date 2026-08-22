"use strict";

const ContentSources = Object.freeze({
  FILENAME: "filename",
  FOLDER: "folder",
  METADATA: "metadata",
  NATIVE_TEXT: "native_text",
  OCR: "ocr",
  VISION: "vision",
  TRANSCRIPT: "transcript",
  TAGS: "tags",
  ENTITIES: "entities",
  EMBEDDING: "embedding",
});

const ProcessingStatus = Object.freeze({
  NOT_PROCESSED: "not_processed",
  METADATA_READY: "metadata_ready",
  TEXT_READY: "text_ready",
  MEDIA_ANALYZED: "media_analyzed",
  OCR_READY: "ocr_ready",
  EMBEDDING_READY: "embedding_ready",
  COMPLETE: "complete",
  PARTIAL: "partial",
  STALE: "stale",
  FAILED: "failed",
});

module.exports = {
  ContentSources,
  ProcessingStatus,
};
