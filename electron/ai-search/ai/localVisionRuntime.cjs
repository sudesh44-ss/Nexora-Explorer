"use strict";

const fs = require("fs");
const { BaseAIRuntime } = require("./baseAIRuntime.cjs");
const { createAIResult } = require("./aiResult.cjs");
const { AIErrorCode, AIError } = require("./aiErrors.cjs");

// Standard visual candidate vocabulary for zero-shot image classification
const STANDARD_VISUAL_CANDIDATES = [
  "birthday cake and candles",
  "people and celebration party",
  "young boy or child",
  "young girl or child",
  "person or portrait",
  "laptop and computer desk",
  "code and software terminal",
  "car and automobile",
  "nature, beach and ocean",
  "food and culinary dish",
  "business document and presentation",
  "classroom and lecture",
];

class LocalVisionRuntime extends BaseAIRuntime {
  constructor(options = {}) {
    super("vision-runtime", "Local Transformers.js CLIP Vision Runtime");
    this._classifierPipeline = null;
    this._featureExtractorPipeline = null;
    this._transformersModule = null;
    this.cacheDir = options.cacheDir || null;
    this.isLoaded = false;
  }

  async _getTransformers() {
    if (!this._transformersModule) {
      try {
        const mod = await import("@xenova/transformers");
        this._transformersModule = mod;
        if (this.cacheDir && mod.env) {
          mod.env.cacheDir = this.cacheDir;
        }
        if (mod.env) {
          mod.env.allowLocalModels = true;
        }
      } catch (err) {
        throw new AIError(
          AIErrorCode.RUNTIME_NOT_FOUND,
          `Failed to load @xenova/transformers: ${err.message}`
        );
      }
    }
    return this._transformersModule;
  }

  async loadModel(modelProfile) {
    if (this.isLoaded && this._classifierPipeline) {
      return { success: true, modelId: modelProfile?.id || "clip-vit-base-patch32" };
    }

    try {
      const { pipeline } = await this._getTransformers();
      const modelRepo = "Xenova/clip-vit-base-patch32";

      this._classifierPipeline = await pipeline("zero-shot-image-classification", modelRepo, {
        quantized: true,
      });

      this._featureExtractorPipeline = await pipeline("image-feature-extraction", modelRepo, {
        quantized: true,
      });

      this.isLoaded = true;
      this._loadedModels.set(modelProfile?.id || "clip-vit-base-patch32", modelProfile);
      return { success: true, modelId: modelProfile?.id || "clip-vit-base-patch32" };
    } catch (err) {
      throw new AIError(
        AIErrorCode.MODEL_LOAD_FAILED,
        `Failed to load vision model: ${err.message}`
      );
    }
  }

  isReady() {
    return this.isLoaded && Boolean(this._classifierPipeline);
  }

  /**
   * Prepares a RawImage from file path, buffer, or RawImage instance
   */
  async _prepareRawImage(input) {
    const { RawImage } = await this._getTransformers();

    if (input instanceof RawImage) {
      return input;
    }

    let buffer = null;
    if (typeof input === "string") {
      if (!fs.existsSync(input)) {
        throw new AIError(AIErrorCode.INFERENCE_FAILED, `Image file not found: ${input}`);
      }
      try {
        return await RawImage.read(input);
      } catch {
        buffer = fs.readFileSync(input);
      }
    } else if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
      buffer = Buffer.from(input);
    } else if (input && typeof input === "object" && input.filePath) {
      try {
        return await RawImage.read(input.filePath);
      } catch {
        buffer = fs.readFileSync(input.filePath);
      }
    }

    if (buffer) {
      // Check for BMP format: starts with "BM"
      if (buffer.length >= 54 && buffer.toString("utf8", 0, 2) === "BM") {
        try {
          const width = buffer.readInt32LE(18);
          const height = Math.abs(buffer.readInt32LE(22));
          const offset = buffer.readUInt32LE(10);
          const rowSize = Math.floor((24 * width + 31) / 32) * 4;
          const rgba = new Uint8ClampedArray(width * height * 4);

          let destIdx = 0;
          for (let y = 0; y < height; y++) {
            const rowStart = offset + (height - 1 - y) * rowSize;
            for (let x = 0; x < width; x++) {
              const srcIdx = rowStart + x * 3;
              const b = buffer[srcIdx];
              const g = buffer[srcIdx + 1];
              const r = buffer[srcIdx + 2];
              rgba[destIdx++] = r;
              rgba[destIdx++] = g;
              rgba[destIdx++] = b;
              rgba[destIdx++] = 255;
            }
          }
          return new RawImage(rgba, width, height, 4);
        } catch {}
      }

      try {
        const blob = new Blob([buffer]);
        return await RawImage.fromBlob(blob);
      } catch {}
    }

    throw new AIError(AIErrorCode.INFERENCE_FAILED, "Invalid image input source");
  }

  /**
   * Executes Vision Analysis or Image Embedding
   */
  async run(task, modelProfile) {
    if (!this.isReady()) {
      await this.loadModel(modelProfile);
    }

    const rawImage = await this._prepareRawImage(task.input);

    if (task.type === "image_embedding" || task.type === "vision_embedding") {
      // 1. Generate real 512-dim Float32 vision embedding
      const output = await this._featureExtractorPipeline(rawImage);
      const vector = Array.from(output.data);

      // Validate finite numbers
      for (let i = 0; i < vector.length; i++) {
        if (!Number.isFinite(vector[i])) {
          throw new AIError(AIErrorCode.INFERENCE_FAILED, "Vision embedding produced non-finite values");
        }
      }

      return createAIResult({
        success: true,
        taskType: task.type,
        modelId: modelProfile?.id || "clip-vit-base-patch32",
        runtimeId: this.id,
        dimensions: vector.length,
        vector,
        metadata: { mock: false, quantized: true },
      });
    }

    // 2. Visual understanding & concept classification
    const candidateLabels = Array.isArray(task.customLabels) && task.customLabels.length > 0
      ? task.customLabels
      : STANDARD_VISUAL_CANDIDATES;

    const classification = await this._classifierPipeline(rawImage, candidateLabels);

    const detectedObjects = [];
    const detectedConcepts = [];
    const tags = [];

    // Retain top predictions
    const topPredictions = Array.isArray(classification) ? classification.slice(0, 5) : [];
    for (const item of topPredictions) {
      const cleanLabel = item.label.replace(/\b(and|or)\b/gi, "").trim();
      const tokens = cleanLabel.split(/[\s,]+/).filter((t) => t.length > 2);

      detectedConcepts.push(cleanLabel);
      tags.push(...tokens);
      detectedObjects.push({ label: cleanLabel, confidence: Number(item.score.toFixed(4)) });
    }

    const uniqueTags = Array.from(new Set(tags));
    const topLabel = classification[0]?.label || "visual content";
    const topScore = classification[0]?.score || 0.9;
    const description = `Image showing ${topLabel}`;

    return createAIResult({
      success: true,
      taskType: task.type || "image_understanding",
      modelId: modelProfile?.id || "clip-vit-base-patch32",
      runtimeId: this.id,
      metadata: {
        description,
        tags: uniqueTags,
        objects: detectedObjects,
        concepts: detectedConcepts,
        confidence: Number(topScore.toFixed(4)),
        mock: false,
      },
    });
  }

  async unloadModel() {
    this._classifierPipeline = null;
    this._featureExtractorPipeline = null;
    this.isLoaded = false;
    this._loadedModels.clear();
    return true;
  }

  async shutdown() {
    await this.unloadModel();
  }
}

module.exports = {
  LocalVisionRuntime,
  STANDARD_VISUAL_CANDIDATES,
};
