"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { AITaskType, AIModality, ModelStatus, QualityMode, createModelProfile } = require("./modelProfile.cjs");
const { AIErrorCode, AIError } = require("./aiErrors.cjs");

/**
 * Standard Built-in Official Model Profiles with exact Hugging Face repositories and manifests
 */
const DEFAULT_MODEL_PROFILES = [
  createModelProfile({
    id: "bge-small-en-v1.5",
    name: "BGE Small English v1.5",
    provider: "BAAI",
    version: "1.5.0",
    task: AITaskType.TEXT_EMBEDDING,
    modality: AIModality.TEXT,
    qualityTier: QualityMode.FAST,
    sizeBytes: 67 * 1024 * 1024, // ~67 MB
    ramRequirementBytes: 256 * 1024 * 1024,
    gpuRequirement: false,
    quantization: "q8_0",
    dimensions: 384,
    runtime: "local-runtime",
    source: "huggingface",
    hfRepo: "Xenova/bge-small-en-v1.5",
    downloadUrl: "https://huggingface.co/Xenova/bge-small-en-v1.5",
    license: "MIT",
    commercialUse: true,
    isOfficial: true,
    requiredFiles: [
      "config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "onnx/model_quantized.onnx",
    ],
    capabilities: { maxTokens: 512, multilingual: false, textSearch: true },
  }),

  createModelProfile({
    id: "all-minilm-l6-v2",
    name: "All-MiniLM-L6-v2",
    provider: "sentence-transformers",
    version: "2.0.0",
    task: AITaskType.TEXT_EMBEDDING,
    modality: AIModality.TEXT,
    qualityTier: QualityMode.FAST,
    sizeBytes: 90 * 1024 * 1024, // ~90 MB
    ramRequirementBytes: 256 * 1024 * 1024,
    gpuRequirement: false,
    quantization: "fp32",
    dimensions: 384,
    runtime: "local-runtime",
    source: "huggingface",
    hfRepo: "Xenova/all-MiniLM-L6-v2",
    downloadUrl: "https://huggingface.co/Xenova/all-MiniLM-L6-v2",
    license: "Apache-2.0",
    commercialUse: true,
    isOfficial: true,
    requiredFiles: [
      "config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "onnx/model_quantized.onnx",
    ],
    capabilities: { maxTokens: 256, multilingual: false, textSearch: true },
  }),

  createModelProfile({
    id: "nomic-embed-text-v1.5",
    name: "Nomic Embed Text v1.5",
    provider: "nomic-ai",
    version: "1.5.0",
    task: AITaskType.TEXT_EMBEDDING,
    modality: AIModality.TEXT,
    qualityTier: QualityMode.BALANCED,
    sizeBytes: 280 * 1024 * 1024, // ~280 MB
    ramRequirementBytes: 512 * 1024 * 1024,
    gpuRequirement: false,
    quantization: "q4_k_m",
    dimensions: 768,
    runtime: "local-runtime",
    source: "huggingface",
    hfRepo: "nomic-ai/nomic-embed-text-v1.5",
    downloadUrl: "https://huggingface.co/nomic-ai/nomic-embed-text-v1.5",
    license: "Apache-2.0",
    commercialUse: true,
    isOfficial: true,
    requiredFiles: [
      "config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "onnx/model_quantized.onnx",
    ],
    capabilities: { maxTokens: 8192, multilingual: true, textSearch: true },
  }),

  // CLIP Vision Model Profile
  createModelProfile({
    id: "clip-vit-base-patch32",
    name: "CLIP ViT-Base Patch32 Vision",
    provider: "openai",
    version: "1.0.0",
    task: AITaskType.IMAGE_UNDERSTANDING,
    modality: AIModality.IMAGE,
    qualityTier: QualityMode.BALANCED,
    sizeBytes: 150 * 1024 * 1024, // ~150 MB
    ramRequirementBytes: 512 * 1024 * 1024,
    gpuRequirement: false,
    quantization: "q8_0",
    dimensions: 512,
    runtime: "vision-runtime",
    source: "huggingface",
    hfRepo: "Xenova/clip-vit-base-patch32",
    downloadUrl: "https://huggingface.co/Xenova/clip-vit-base-patch32",
    license: "MIT",
    commercialUse: true,
    isOfficial: true,
    requiredFiles: [
      "config.json",
      "preprocessor_config.json",
      "tokenizer.json",
      "onnx/model_quantized.onnx",
    ],
    capabilities: { zeroShot: true, imageEmbedding: true, imageSearch: true },
  }),

  // OCR Model Profile (TrOCR)
  createModelProfile({
    id: "trocr-small-printed",
    name: "TrOCR Small Printed Text Recognition",
    provider: "microsoft",
    version: "1.0.0",
    task: AITaskType.OCR,
    modality: AIModality.DOCUMENT,
    qualityTier: QualityMode.BALANCED,
    sizeBytes: 130 * 1024 * 1024, // ~130 MB
    ramRequirementBytes: 512 * 1024 * 1024,
    gpuRequirement: false,
    quantization: "q8_0",
    runtime: "local_ocr",
    source: "huggingface",
    hfRepo: "Xenova/trocr-small-printed",
    downloadUrl: "https://huggingface.co/Xenova/trocr-small-printed",
    license: "MIT",
    commercialUse: true,
    isOfficial: true,
    requiredFiles: [
      "config.json",
      "generation_config.json",
      "preprocessor_config.json",
      "tokenizer.json",
      "onnx/decoder_model_merged_quantized.onnx",
      "onnx/encoder_model_quantized.onnx",
    ],
    capabilities: { textRecognition: true, offline: true, ocrSearch: true },
  }),

  // Speech Whisper Model Profile
  createModelProfile({
    id: "whisper-tiny",
    name: "Whisper Tiny Audio Transcriber",
    provider: "openai",
    version: "1.0.0",
    task: AITaskType.AUDIO_TRANSCRIPTION,
    modality: AIModality.AUDIO,
    qualityTier: QualityMode.FAST,
    sizeBytes: 75 * 1024 * 1024, // ~75 MB
    ramRequirementBytes: 512 * 1024 * 1024,
    gpuRequirement: false,
    runtime: "whisper-runtime",
    source: "huggingface",
    hfRepo: "Xenova/whisper-tiny.en",
    downloadUrl: "https://huggingface.co/Xenova/whisper-tiny.en",
    license: "MIT",
    commercialUse: true,
    isOfficial: true,
    requiredFiles: [
      "config.json",
      "generation_config.json",
      "preprocessor_config.json",
      "tokenizer.json",
      "onnx/decoder_model_merged_quantized.onnx",
      "onnx/encoder_model_quantized.onnx",
    ],
    capabilities: { timestamps: true, speechToText: true, offline: true, audioSearch: true },
  }),
];

/**
 * Model Registry maintaining metadata profiles for all known models & custom imported models
 */
class ModelRegistry {
  constructor(options = {}) {
    this._models = new Map();
    this.metadataDir = options.metadataDir || null;
    this._initDefaults();
  }

  _initDefaults() {
    for (const p of DEFAULT_MODEL_PROFILES) {
      this.register({ ...p });
    }
  }

  setMetadataDir(dir) {
    this.metadataDir = dir;
    this.loadCustomModels();
  }

  loadCustomModels() {
    if (!this.metadataDir) return;
    try {
      const customPath = path.join(this.metadataDir, "custom_models.json");
      if (fs.existsSync(customPath)) {
        const raw = fs.readFileSync(customPath, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const m of list) {
            this.register(createModelProfile(m));
          }
        }
      }
    } catch (err) {
      console.warn("[ModelRegistry] Failed to load custom models:", err.message);
    }
  }

  saveCustomModels() {
    if (!this.metadataDir) return;
    try {
      if (!fs.existsSync(this.metadataDir)) {
        fs.mkdirSync(this.metadataDir, { recursive: true });
      }
      const customPath = path.join(this.metadataDir, "custom_models.json");
      const customs = this.getAll().filter((m) => m.isCustom);
      fs.writeFileSync(customPath, JSON.stringify(customs, null, 2), "utf-8");
    } catch (err) {
      console.warn("[ModelRegistry] Failed to save custom models:", err.message);
    }
  }

  register(modelProfile) {
    if (!modelProfile || !modelProfile.id) {
      throw new AIError(AIErrorCode.MODEL_NOT_FOUND, "Model profile must have a valid 'id'");
    }
    this._models.set(modelProfile.id, modelProfile);
    if (modelProfile.isCustom) {
      this.saveCustomModels();
    }
  }

  unregister(modelId) {
    const existed = this._models.delete(modelId);
    if (existed) {
      this.saveCustomModels();
    }
    return existed;
  }

  getById(modelId) {
    return this._models.get(modelId) || null;
  }

  get(modelId) {
    return this.getById(modelId);
  }

  findByTask(taskType) {
    return Array.from(this._models.values()).filter((m) => m.task === taskType);
  }

  findByCapability(predicate) {
    if (typeof predicate !== "function") return [];
    return Array.from(this._models.values()).filter(predicate);
  }

  listAvailable() {
    return Array.from(this._models.values());
  }

  listInstalled() {
    return Array.from(this._models.values()).filter(
      (m) => m.status === ModelStatus.INSTALLED || m.status === ModelStatus.VERIFIED || m.status === ModelStatus.READY
    );
  }

  getAll() {
    return Array.from(this._models.values());
  }
}

module.exports = {
  DEFAULT_MODEL_PROFILES,
  ModelRegistry,
};
