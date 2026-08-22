"use strict";

class BackpressureController {
  constructor(maxInMemoryTasks = 500) {
    this.maxInMemoryTasks = maxInMemoryTasks;
  }

  shouldThrottleIngestion(currentPendingCount) {
    return currentPendingCount >= this.maxInMemoryTasks;
  }
}

module.exports = {
  BackpressureController,
};
