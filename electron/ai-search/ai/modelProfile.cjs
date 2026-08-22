"use strict";

/**
 * Supported AI Task Types
 */
const AITaskType = Object.freeze({
  TEXT_EMBEDDING: "TEXT_EMBEDDING",
  IMAGE_EMBEDDING: "IMAGE_EMBEDDING",
  IMAGE_UNDERSTANDING: "IMAGE_UNDERSTANDING",
  OCR: "OCR",
  AUDIO_TRANSCRIPTION: "AUDIO_TRANSCRIPTION",
  VIDEO_ANALYSIS: "VIDEO_ANALYSIS",
  QUERY_UNDERSTANDING: "QUERY_UNDERSTANDING",
});

/**
 * Modality categories
 */
const AIModality = Object.freeze({
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  AUDIO: "AUDIO",
  VIDEO: "VIDEO",
  MULTIMODAL: "MULTIMODAL",
});

/**
 * Model Lifecycle Status
 */
const ModelStatus = Object.freeze({
  NOT_INSTALLED: "NOT_INSTALLED",
  INSTALLED: "INSTALLED",
  VERIFIED: "VERIFIED",
  AVAILABLE: "AVAILABLE",
  LOADED: "LOADED",
  READY: "READY",
  UNLOADED: "UNLOADED",
  ERROR: "ERROR",
});

/**
 * Quality / Performance Profile Modes
 */
const QualityMode = Object.freeze({
  FAST: "FAST",
  BALANCED: "BALANCED",
  ACCURATE: "ACCURATE",
  CLOUD: "CLOUD",
});

/**
 * Factory for creating structured Model Profiles
 */
function createModelProfile(options = {}) {
  return {
    id: options.id || "unnamed-model",
    name: options.name || options.id,
    provider: options.provider || "local",
    version: options.version || "1.0.0",
    task: options.task || AITaskType.TEXT_EMBEDDING,
    modality: options.modality || AIModality.TEXT,
    qualityTier: options.qualityTier || QualityMode.BALANCED,
    
    // Hardware Requirements
    sizeBytes: options.sizeBytes || 0,
    ramRequirementBytes: options.ramRequirementBytes || (512 * 1024 * 1024), // 512 MB default
    gpuRequirement: options.gpuRequirement || false,
    gpuVramRequirementBytes: options.gpuVramRequirementBytes || 0,
    quantization: options.quantization || "q4_k_m",
    dimensions: options.dimensions || 768,

    // Runtime & Storage
    runtime: options.runtime || "local-onnx",
    source: options.source || "huggingface",
    downloadUrl: options.downloadUrl || null,
    checksum: options.checksum || null,
    status: options.status || ModelStatus.NOT_INSTALLED,

    // Licensing & Redistribution metadata
    license: options.license || "Apache-2.0",
    licenseUrl: options.licenseUrl || null,
    commercialUse: options.commercialUse !== undefined ? options.commercialUse : true,
    redistribution: options.redistribution !== undefined ? options.redistribution : false,
    attribution: options.attribution || "Required by model author",

    // Capabilities map
    capabilities: {
      maxTokens: 512,
      multilingual: false,
      ...(options.capabilities || {}),
    },
  };
}

module.exports = {
  AITaskType,
  AIModality,
  ModelStatus,
  QualityMode,
  createModelProfile,
};
