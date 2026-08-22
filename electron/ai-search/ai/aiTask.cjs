"use strict";

const crypto = require("crypto");
const { AITaskType } = require("./modelProfile.cjs");

/**
 * Factory for creating structured AI Task objects
 */
function createAITask(options = {}) {
  return {
    id: options.id || `ai_task_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    type: options.type || AITaskType.TEXT_EMBEDDING,
    fileId: options.fileId || null,
    input: options.input || "",
    priority: options.priority || 0,
    modelPreference: options.modelPreference || null,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  createAITask,
};
