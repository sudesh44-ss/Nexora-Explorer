"use strict";

const path = require("path");
const fs = require("fs");
const { BaseAIRuntime } = require("./baseAIRuntime.cjs");
const { createAIResult } = require("./aiResult.cjs");
const { AIErrorCode, AIError } = require("./aiErrors.cjs");

// Map internal model IDs to Hugging Face ONNX model repositories
const MODEL_HF_REPO_MAP = {
  "bge-small-en-v1.5": "Xenova/bge-small-en-v1.5",
  "all-minilm-l6-v2": "Xenova/all-MiniLM-L6-v2",
  "nomic-embed-text-v1.5": "nomic-ai/nomic-embed-text-v1.5",
};

class LocalEmbeddingRuntime extends BaseAIRuntime {
  constructor(options = {}) {
    super("local-runtime", "Local Transformers.js ONNX Runtime");
    this._pipelines = new Map(); // modelId -> pipeline
    this._loadingPromises = new Map(); // modelId -> Promise
    this._transformersModule = null;
    this.cacheDir = options.cacheDir || null;
    this.modelsDir = options.modelsDir || null;
  }

  /**
   * Dynamically loads @xenova/transformers
   */
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
          `Failed to load @xenova/transformers runtime: ${err.message}`
        );
      }
    }
    return this._transformersModule;
  }

  /**
   * Loads and caches an ONNX embedding pipeline
   */
  async loadModel(modelProfile) {
    if (!modelProfile || !modelProfile.id) {
      throw new AIError(AIErrorCode.MODEL_NOT_FOUND, "Invalid model profile");
    }

    const modelId = modelProfile.id;

    if (this._pipelines.has(modelId)) {
      return { success: true, modelId, cached: true };
    }

    if (this._loadingPromises.has(modelId)) {
      return this._loadingPromises.get(modelId);
    }

    const loadPromise = (async () => {
      try {
        const { pipeline } = await this._getTransformers();

        // Check if installed locally
        let modelSource = MODEL_HF_REPO_MAP[modelId] || modelProfile.hfRepo || `Xenova/${modelId}`;

        if (modelProfile.customPath && fs.existsSync(modelProfile.customPath)) {
          modelSource = modelProfile.customPath;
        } else if (modelProfile.installedPath && fs.existsSync(modelProfile.installedPath)) {
          modelSource = modelProfile.installedPath;
        } else if (this.modelsDir) {
          const installedFolder = path.join(this.modelsDir, "installed", modelId);
          if (fs.existsSync(installedFolder)) {
            modelSource = installedFolder;
          }
        }

        const pipe = await pipeline("feature-extraction", modelSource, {
          quantized: true,
        });

        this._pipelines.set(modelId, pipe);
        this._loadedModels.set(modelId, modelProfile);

        return { success: true, modelId, cached: false, modelSource };
      } catch (err) {
        throw new AIError(
          AIErrorCode.MODEL_LOAD_FAILED,
          `Failed to load embedding model '${modelId}': ${err.message}`
        );
      } finally {
        this._loadingPromises.delete(modelId);
      }
    })();

    this._loadingPromises.set(modelId, loadPromise);
    return loadPromise;
  }

  /**
   * Unloads model pipeline from memory
   */
  async unloadModel(modelId) {
    this._pipelines.delete(modelId);
    this._loadedModels.delete(modelId);
    return true;
  }

  isReady(modelId) {
    return this._pipelines.has(modelId);
  }

  /**
   * Executes inference to generate real Float32 embedding vector
   */
  async run(task, modelProfile) {
    const modelId = modelProfile.id;

    if (!this._pipelines.has(modelId)) {
      await this.loadModel(modelProfile);
    }

    const pipe = this._pipelines.get(modelId);
    if (!pipe) {
      throw new AIError(
        AIErrorCode.INFERENCE_FAILED,
        `Pipeline for model ${modelId} is unavailable`
      );
    }

    const inputText = String(task?.input || "").trim();
    if (!inputText) {
      throw new AIError(AIErrorCode.INFERENCE_FAILED, "Input text cannot be empty");
    }

    try {
      const output = await pipe(inputText, {
        pooling: "mean",
        normalize: true,
      });

      const vector = Array.from(output.data);

      // Validate vector
      if (!vector || vector.length === 0) {
        throw new AIError(AIErrorCode.INFERENCE_FAILED, "Model produced an empty vector");
      }

      // Check finite numbers
      for (let i = 0; i < vector.length; i++) {
        if (!Number.isFinite(vector[i])) {
          throw new AIError(
            AIErrorCode.INFERENCE_FAILED,
            "Model produced non-finite or NaN embedding values"
          );
        }
      }

      return createAIResult({
        success: true,
        taskType: task.type,
        modelId,
        runtimeId: this.id,
        dimensions: vector.length,
        vector,
        metadata: {
          tokens: inputText.split(/\s+/).length,
          mock: false,
          quantized: true,
        },
      });
    } catch (err) {
      throw new AIError(
        AIErrorCode.INFERENCE_FAILED,
        `Inference execution failed: ${err.message}`
      );
    }
  }

  async shutdown() {
    this._pipelines.clear();
    this._loadingPromises.clear();
    this._loadedModels.clear();
  }
}

module.exports = {
  LocalEmbeddingRuntime,
  MODEL_HF_REPO_MAP,
};
