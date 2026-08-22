"use strict";

const { TaskType, TaskPriority, TaskState } = require("./taskState.cjs");
const { IndexQueueErrorCode, IndexQueueError } = require("./indexErrors.cjs");

/**
 * Creates a standardized IndexTask object
 */
function createIndexTask(options = {}) {
  if (!options.fileId) {
    throw new IndexQueueError(IndexQueueErrorCode.TASK_INVALID, "Task requires a valid fileId");
  }

  const type = options.taskType || TaskType.METADATA_INDEX;
  const prio = typeof options.priority === "number" ? options.priority : TaskPriority.NORMAL;

  const taskId = options.taskId || `task_${options.fileId}_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    taskId,
    fileId: options.fileId,
    taskType: type,
    priority: prio,
    status: options.status || TaskState.QUEUED,
    sourceHash: options.sourceHash || "",
    dependencies: Array.isArray(options.dependencies) ? options.dependencies : [],
    attempts: options.attempts || 0,
    maxAttempts: options.maxAttempts || 3,
    payload: options.payload || {},
    createdAt: options.createdAt || new Date().toISOString(),
    startedAt: options.startedAt || null,
    completedAt: options.completedAt || null,
    nextRetryAt: options.nextRetryAt || null,
    errorCode: options.errorCode || null,
    errorMessage: options.errorMessage || null,
  };
}

module.exports = {
  createIndexTask,
};
