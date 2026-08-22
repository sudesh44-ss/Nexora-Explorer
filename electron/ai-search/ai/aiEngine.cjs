"use strict";

const EventEmitter = require("events");
const { ModelRegistry } = require("./modelRegistry.cjs");
const { ModelSelector } = require("./modelSelector.cjs");
const { ModelManager } = require("./modelManager.cjs");
const { RuntimeRegistry } = require("./runtimeRegistry.cjs");
const { createAIResult } = require("./aiResult.cjs");
const { AIErrorCode, AIError } = require("./aiErrors.cjs");
const { ResourceAction } = require("../resources/resourceState.cjs");

/**
 * Central AI Engine coordinating model selection, lifecycle, and runtime execution
 */
class AIEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.registry = options.modelRegistry || new ModelRegistry();
    this.selector = options.modelSelector || new ModelSelector(this.registry);
    this.manager = options.modelManager || new ModelManager(this.registry, options);
    this.runtimes = options.runtimeRegistry || new RuntimeRegistry();
    this.resourceManager = options.resourceManager || null;
    this.isInitialized = false;
  }

  async initialize() {
    await this.manager.initialize();
    this.isInitialized = true;
    return { success: true };
  }

  /**
   * Selects best model for a given task and hardware profile
   */
  selectModel(taskType, queryOptions = {}) {
    return this.selector.selectModel({
      task: taskType,
      ...queryOptions,
    });
  }

  /**
   * Loads a model into the specified runtime
   */
  async loadModel(modelId, runtimeId = null) {
    const model = this.registry.getById(modelId);
    if (!model) {
      throw new AIError(AIErrorCode.MODEL_NOT_FOUND, `Model ${modelId} does not exist in registry`);
    }

    const targetRuntimeId = runtimeId || model.runtime || "local-runtime";
    const runtime = this.runtimes.get(targetRuntimeId) || this.runtimes.get("local-runtime");
    if (!runtime) {
      throw new AIError(AIErrorCode.RUNTIME_NOT_FOUND, `Runtime ${targetRuntimeId} not found`);
    }

    return runtime.loadModel(model);
  }

  /**
   * Unloads a model from runtime memory
   */
  async unloadModel(modelId, runtimeId = null) {
    if (runtimeId) {
      const runtime = this.runtimes.get(runtimeId);
      if (!runtime) return false;
      return runtime.unloadModel(modelId);
    }

    for (const r of this.runtimes.list()) {
      await r.unloadModel(modelId);
    }
    return true;
  }

  /**
   * Runs an AI task end-to-end with verified local runtime execution
   *
   * @param {Object} task - AITask
   * @param {Object} [options]
   * @returns {Promise<Object>} AIResult
   */
  async runTask(task, options = {}) {
    if (!task || !task.type) {
      throw new AIError(AIErrorCode.TASK_UNSUPPORTED, "Invalid AI Task");
    }

    // 1. Check Resource Manager state
    if (this.resourceManager) {
      const decision = this.resourceManager.getDecision();
      if (decision.action === ResourceAction.PAUSE) {
        throw new AIError(
          AIErrorCode.RESOURCE_BUSY,
          "System resource load is critical (PAUSED), AI inference deferred"
        );
      }
    }

    // 2. Select compatible model
    let model = null;
    if (task.modelPreference) {
      model = this.registry.getById(task.modelPreference);
    }
    if (!model) {
      model = this.selectModel(task.type, options);
    }

    if (!model) {
      return createAIResult({
        success: false,
        taskType: task.type,
        errorCode: AIErrorCode.MODEL_INCOMPATIBLE,
        message: `No compatible model profile found for task ${task.type}`,
      });
    }

    // 3. Resolve Runtime (prefer model.runtime -> local-runtime)
    const preferredRuntimeId = options.runtimeId || model.runtime || "local-runtime";
    let runtime = this.runtimes.get(preferredRuntimeId);
    if (!runtime) {
      runtime = this.runtimes.get("local-runtime");
    }

    // If still not found and test mode requested mock runtime
    if (!runtime && options.allowMockFallback) {
      runtime = this.runtimes.get("mock-runtime");
    }

    if (!runtime) {
      return createAIResult({
        success: false,
        taskType: task.type,
        errorCode: AIErrorCode.RUNTIME_NOT_FOUND,
        message: `AI runtime '${preferredRuntimeId}' is not registered or available`,
      });
    }

    // 4. Ensure model is loaded in runtime
    if (!runtime.isReady(model.id)) {
      try {
        await runtime.loadModel(model);
      } catch (loadErr) {
        // Only allow mock fallback if explicitly enabled for unit tests
        if (options.allowMockFallback) {
          const fallback = this.runtimes.get("mock-runtime");
          if (fallback && runtime.id !== "mock-runtime") {
            runtime = fallback;
            await runtime.loadModel(model);
          } else {
            return createAIResult({
              success: false,
              taskType: task.type,
              modelId: model.id,
              errorCode: AIErrorCode.MODEL_LOAD_FAILED,
              message: `AI model could not be loaded: ${loadErr.message}`,
            });
          }
        } else {
          return createAIResult({
            success: false,
            taskType: task.type,
            modelId: model.id,
            errorCode: AIErrorCode.MODEL_LOAD_FAILED,
            message: `AI model could not be loaded: ${loadErr.message}`,
          });
        }
      }
    }

    // 5. Execute inference
    try {
      const result = await runtime.run(task, model);
      this.emit("task_completed", { taskId: task.id, modelId: model.id });
      return result;
    } catch (err) {
      return createAIResult({
        success: false,
        taskType: task.type,
        modelId: model.id,
        runtimeId: runtime.id,
        errorCode: AIErrorCode.INFERENCE_FAILED,
        message: `Inference failed: ${err.message}`,
      });
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      models: this.manager.getStatus(),
      runtimes: this.runtimes.list().map((r) => r.getCapabilities()),
    };
  }

  async shutdown() {
    for (const runtime of this.runtimes.list()) {
      await runtime.shutdown();
    }
    this.isInitialized = false;
  }
}

module.exports = {
  AIEngine,
};
