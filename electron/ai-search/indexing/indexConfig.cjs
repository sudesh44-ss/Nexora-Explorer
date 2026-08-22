"use strict";

const { TaskType, TaskPriority } = require("./taskState.cjs");

const DEFAULT_INDEX_CONFIG = Object.freeze({
  maxWorkers: 2,
  maxHeavyWorkers: 1,
  retryLimit: 3,
  retryBackoffMs: 500,
  maxRetryBackoffMs: 30000,
  agingRatePerMinute: 5,
  batchSize: 20,
  pollIntervalMs: 100,
  taskCosts: {
    [TaskType.METADATA_INDEX]: 1,
    [TaskType.TEXT_EXTRACTION]: 2,
    [TaskType.EMBEDDING_GENERATION]: 4,
    [TaskType.IMAGE_ANALYSIS]: 8,
    [TaskType.AUDIO_ANALYSIS]: 8,
    [TaskType.VIDEO_ANALYSIS]: 20,
    [TaskType.VECTOR_INDEX]: 2,
    [TaskType.FTS_INDEX]: 1,
  },
  defaultPriorities: {
    [TaskType.METADATA_INDEX]: TaskPriority.HIGH,
    [TaskType.TEXT_EXTRACTION]: TaskPriority.NORMAL,
    [TaskType.EMBEDDING_GENERATION]: TaskPriority.NORMAL,
    [TaskType.IMAGE_ANALYSIS]: TaskPriority.LOW,
    [TaskType.AUDIO_ANALYSIS]: TaskPriority.BACKGROUND,
    [TaskType.VIDEO_ANALYSIS]: TaskPriority.BACKGROUND,
    [TaskType.VECTOR_INDEX]: TaskPriority.NORMAL,
    [TaskType.FTS_INDEX]: TaskPriority.HIGH,
  },
});

function getIndexConfig(overrides = {}) {
  return {
    ...DEFAULT_INDEX_CONFIG,
    ...overrides,
    taskCosts: {
      ...DEFAULT_INDEX_CONFIG.taskCosts,
      ...(overrides.taskCosts || {}),
    },
    defaultPriorities: {
      ...DEFAULT_INDEX_CONFIG.defaultPriorities,
      ...(overrides.defaultPriorities || {}),
    },
  };
}

module.exports = {
  DEFAULT_INDEX_CONFIG,
  getIndexConfig,
};
