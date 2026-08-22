"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");

/**
 * AI Provider Types
 */
const AIProviderType = Object.freeze({
  LOCAL_EMBEDDING: "local_embedding",
  LOCAL_VISION: "local_vision",
  LOCAL_AUDIO: "local_audio",
  OLLAMA: "ollama",
  CLOUD_OPENAI: "cloud_openai",
  CLOUD_GEMINI: "cloud_gemini",
});

/**
 * Base AI Provider Abstract Interface
 * All future concrete providers (Nomic, MiniLM, Ollama, OpenAI, Gemini) will implement this contract.
 */
class BaseAIProvider {
  constructor(name, type, options = {}) {
    this.name = name;
    this.type = type;
    this.options = options;
    this.isReady = false;
  }

  /**
   * Initializes model resources or provider connections
   */
  async initialize() {
    throw new AISearchError(
      AISearchErrorCodes.AI_SEARCH_PROVIDER_FAILED,
      `initialize() must be implemented by provider '${this.name}'`
    );
  }

  /**
   * Releases model resources or active network handles
   */
  async shutdown() {
    this.isReady = false;
  }

  /**
   * Returns metadata and capability flags
   */
  getCapabilities() {
    return {
      name: this.name,
      type: this.type,
      supportsEmbeddings: false,
      supportsVision: false,
      supportsTranscription: false,
      vectorDimension: 0,
      maxBatchSize: 1,
    };
  }

  /**
   * Generates vector embeddings for input text
   * @param {string|string[]} _textOrBatch
   * @returns {Promise<number[]|number[][]>}
   */
  async generateEmbeddings(_textOrBatch) {
    throw new AISearchError(
      AISearchErrorCodes.AI_SEARCH_PROVIDER_FAILED,
      `generateEmbeddings() not supported by provider '${this.name}'`
    );
  }

  /**
   * Generates caption/tags/descriptions for image
   * @param {string} _imagePath
   * @returns {Promise<{description: string, tags: string[], ocrText?: string}>}
   */
  async analyzeImage(_imagePath) {
    throw new AISearchError(
      AISearchErrorCodes.AI_SEARCH_PROVIDER_FAILED,
      `analyzeImage() not supported by provider '${this.name}'`
    );
  }

  /**
   * Transcribes speech from audio/video
   * @param {string} _mediaPath
   * @returns {Promise<{transcript: string, language?: string}>}
   */
  async transcribeAudio(_mediaPath) {
    throw new AISearchError(
      AISearchErrorCodes.AI_SEARCH_PROVIDER_FAILED,
      `transcribeAudio() not supported by provider '${this.name}'`
    );
  }
}

/**
 * Provider Registry to manage active and fallback providers
 */
class AIProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.activeProviderName = null;
  }

  register(provider) {
    if (!(provider instanceof BaseAIProvider)) {
      throw new AISearchError(
        AISearchErrorCodes.AI_SEARCH_PROVIDER_FAILED,
        "Provider must inherit from BaseAIProvider"
      );
    }
    this.providers.set(provider.name, provider);
    if (!this.activeProviderName) {
      this.activeProviderName = provider.name;
    }
  }

  get(name) {
    return this.providers.get(name) || null;
  }

  getActive() {
    return this.providers.get(this.activeProviderName) || null;
  }

  setActive(name) {
    if (!this.providers.has(name)) {
      throw new AISearchError(
        AISearchErrorCodes.AI_SEARCH_PROVIDER_FAILED,
        `Provider '${name}' is not registered`
      );
    }
    this.activeProviderName = name;
  }

  list() {
    return Array.from(this.providers.values()).map((p) => p.getCapabilities());
  }
}

module.exports = {
  AIProviderType,
  BaseAIProvider,
  AIProviderRegistry,
};
