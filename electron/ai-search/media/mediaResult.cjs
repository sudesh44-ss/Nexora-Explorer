"use strict";

/**
 * Standardized Media Analysis Result Contract
 */
function createMediaResult(options = {}) {
  // Validate and sanitize confidence
  let conf = typeof options.confidence === "number" && !Number.isNaN(options.confidence)
    ? Math.max(0, Math.min(1, options.confidence))
    : 1.0;

  // Sanitize tags
  const tags = Array.isArray(options.tags)
    ? Array.from(new Set(options.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)))
    : [];

  // Sanitize objects
  const objects = Array.isArray(options.objects)
    ? options.objects
        .map((obj) => {
          if (typeof obj === "string") return { label: obj.trim().toLowerCase(), confidence: 1.0 };
          if (obj && typeof obj.label === "string") {
            const c = typeof obj.confidence === "number" && !Number.isNaN(obj.confidence)
              ? Math.max(0, Math.min(1, obj.confidence))
              : 1.0;
            return { label: obj.label.trim().toLowerCase(), confidence: c };
          }
          return null;
        })
        .filter(Boolean)
    : [];

  // Sanitize concepts
  const concepts = Array.isArray(options.concepts)
    ? Array.from(new Set(options.concepts.map((c) => String(c).trim().toLowerCase()).filter(Boolean)))
    : [];

  return {
    fileId: options.fileId || "",
    mediaType: options.mediaType || "image",
    success: options.success !== false,
    description: typeof options.description === "string" ? options.description.trim() : "",
    tags,
    objects,
    concepts,
    confidence: conf,
    modelId: options.modelId || "mock_vision_model",
    modelVersion: options.modelVersion || "1.0.0",
    runtimeId: options.runtimeId || "mock_runtime",
    sourceHash: options.sourceHash || "",
    dimensions: options.dimensions || null,
    duration: typeof options.duration === "number" ? options.duration : (options.entities?.duration || null),
    entities: options.entities || null,
    createdAt: options.createdAt || new Date().toISOString(),
    error: options.error || null,
  };
}

module.exports = {
  createMediaResult,
};
