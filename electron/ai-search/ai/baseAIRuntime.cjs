"use strict";

const { AIErrorCode, AIError } = require("./aiErrors.cjs");

/**
 * Base AI Runtime Contract
 */
class BaseAIRuntime {
  constructor(id = "base-runtime", name = "Base AI Runtime") {
    this.id = id;
    this.name = name;
    this._loadedModels = new Map();
  }

  async initialize() {
    return { success: true };
  }

  async loadModel(modelProfile) {
    if (!modelProfile) throw new AIError(AIErrorCode.MODEL_NOT_FOUND, "Invalid model profile");
    this._loadedModels.set(modelProfile.id, modelProfile);
    return { success: true, modelId: modelProfile.id };
  }

  async unloadModel(modelId) {
    return this._loadedModels.delete(modelId);
  }

  isReady(modelId) {
    return this._loadedModels.has(modelId);
  }

  /**
   * Executes inference on the loaded model
   * @param {Object} task - AITask
   * @param {Object} modelProfile - ModelProfile
   * @returns {Promise<Object>} AIResult
   */
  async run(task, modelProfile) {
    throw new AIError(AIErrorCode.INFERENCE_FAILED, "Runtime must implement run()");
  }

  getCapabilities() {
    return {
      id: this.id,
      name: this.name,
      loadedModels: Array.from(this._loadedModels.keys()),
    };
  }

  async shutdown() {
    this._loadedModels.clear();
  }
}

module.exports = {
  BaseAIRuntime,
};
