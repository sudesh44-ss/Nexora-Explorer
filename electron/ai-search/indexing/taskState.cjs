"use strict";

const TaskType = Object.freeze({
  METADATA_INDEX: "metadata_index",
  TEXT_EXTRACTION: "text_extraction",
  OCR_EXTRACTION: "ocr_extraction",
  EMBEDDING_GENERATION: "embedding_generation",
  IMAGE_ANALYSIS: "image_analysis",
  AUDIO_ANALYSIS: "audio_analysis",
  VIDEO_ANALYSIS: "video_analysis",
  VECTOR_INDEX: "vector_index",
  FTS_INDEX: "fts_index",
});

const TaskPriority = Object.freeze({
  CRITICAL: 100,
  HIGH: 80,
  NORMAL: 60,
  LOW: 40,
  BACKGROUND: 20,
});

const TaskState = Object.freeze({
  PENDING: "pending",
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  RETRY_WAIT: "retry_wait",
  CANCELLED: "cancelled",
  PAUSED: "paused",
  STALE: "stale",
  BLOCKED: "blocked",
});

const ErrorClassification = Object.freeze({
  TRANSIENT: "transient",
  PERMANENT: "permanent",
  RESOURCE: "resource",
  INVALID_INPUT: "invalid_input",
  MODEL: "model",
  FILE: "file",
});

module.exports = {
  TaskType,
  TaskPriority,
  TaskState,
  ErrorClassification,
};
