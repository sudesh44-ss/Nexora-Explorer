"use strict";

const { AIErrorCode, AIError } = require("./aiErrors.cjs");
const { createAIResult } = require("./aiResult.cjs");
const { BaseAIRuntime } = require("./baseAIRuntime.cjs");

/**
 * Deterministic Mock AI Runtime for unit testing and offline development
 */
class MockAIRuntime extends BaseAIRuntime {
  constructor() {
    super("mock-runtime", "Mock Deterministic AI Runtime");
  }

  async run(task, modelProfile) {
    const dim = modelProfile?.dimensions || 384;
    const inputText = String(task?.input || "");

    // Deterministic pseudo-vector generation based on word token feature hashing
    const vector = new Array(dim).fill(0);
    const words = inputText.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      vector[0] = 1;
    } else {
      for (const w of words) {
        // Hash word to deterministic integer
        let hash = 5381;
        for (let i = 0; i < w.length; i++) {
          hash = ((hash << 5) + hash) + w.charCodeAt(i);
          hash = hash & hash;
        }

        const bucket = Math.abs(hash) % dim;
        const sign = (Math.abs(hash >> 8) % 2 === 0) ? 1 : -1;
        vector[bucket] += sign * (1.0 + (w.length / 10));

        // Add 2-gram context
        const bucket2 = (bucket + 7) % dim;
        vector[bucket2] += sign * 0.5;
      }
    }

    // Normalize vector (L2 norm)
    const mag = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    const normalizedVector = vector.map((v) => Number((v / mag).toFixed(6)));

    return createAIResult({
      success: true,
      taskType: task.type,
      modelId: modelProfile.id,
      runtimeId: this.id,
      dimensions: dim,
      vector: normalizedVector,
      metadata: {
        tokens: inputText.split(/\s+/).length,
        mock: true,
      },
    });
  }
}

const { LocalEmbeddingRuntime } = require("./localEmbeddingRuntime.cjs");
const { LocalVisionRuntime } = require("./localVisionRuntime.cjs");
const { LocalWhisperRuntime } = require("./localWhisperRuntime.cjs");

/**
 * Central registry managing AI runtimes
 */
class RuntimeRegistry {
  constructor(options = {}) {
    this._runtimes = new Map();
    this.register(new LocalEmbeddingRuntime(options));
    this.register(new LocalVisionRuntime(options));
    this.register(new LocalWhisperRuntime(options));
    this.register(new MockAIRuntime());
  }

  register(runtime) {
    if (!runtime || !runtime.id) return;
    this._runtimes.set(runtime.id, runtime);
  }

  get(runtimeId) {
    return this._runtimes.get(runtimeId) || null;
  }

  list() {
    return Array.from(this._runtimes.values());
  }
}

module.exports = {
  BaseAIRuntime,
  MockAIRuntime,
  LocalEmbeddingRuntime,
  LocalVisionRuntime,
  LocalWhisperRuntime,
  RuntimeRegistry,
};
