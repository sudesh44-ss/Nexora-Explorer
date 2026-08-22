"use strict";

const { TaskType } = require("./taskState.cjs");

class WorkloadEstimator {
  static getCost(taskType, configCosts = {}) {
    if (configCosts[taskType] !== undefined) {
      return configCosts[taskType];
    }
    switch (taskType) {
      case TaskType.VIDEO_ANALYSIS:
        return 20;
      case TaskType.IMAGE_ANALYSIS:
      case TaskType.AUDIO_ANALYSIS:
        return 8;
      case TaskType.EMBEDDING_GENERATION:
        return 4;
      case TaskType.TEXT_EXTRACTION:
        return 2;
      case TaskType.METADATA_INDEX:
      case TaskType.FTS_INDEX:
      case TaskType.VECTOR_INDEX:
      default:
        return 1;
    }
  }

  static isHeavyTask(taskType) {
    return (
      taskType === TaskType.IMAGE_ANALYSIS ||
      taskType === TaskType.AUDIO_ANALYSIS ||
      taskType === TaskType.VIDEO_ANALYSIS
    );
  }
}

module.exports = {
  WorkloadEstimator,
};
