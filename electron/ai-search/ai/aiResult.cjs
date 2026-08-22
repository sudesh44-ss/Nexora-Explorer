"use strict";

const { AITaskType } = require("./modelProfile.cjs");

/**
 * Factory for unified AI Result contract
 */
function createAIResult(options = {}) {
  const success = options.success !== undefined ? options.success : true;

  return {
    success,
    taskType: options.taskType || AITaskType.TEXT_EMBEDDING,
    modelId: options.modelId || null,
    runtimeId: options.runtimeId || null,
    dimensions: options.dimensions || (options.vector ? options.vector.length : 0),
    vector: options.vector || null,
    metadata: options.metadata || {},
    createdAt: new Date().toISOString(),
    errorCode: options.errorCode || null,
    message: options.message || null,
    retryable: Boolean(options.retryable),
  };
}

module.exports = {
  createAIResult,
};
