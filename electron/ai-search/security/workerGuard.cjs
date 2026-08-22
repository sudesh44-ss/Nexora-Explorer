"use strict";

class WorkerGuard {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.taskFailures = new Map(); // taskId -> count
  }

  /**
   * Checks if task has exceeded maximum failure threshold
   */
  canRetry(taskId) {
    const fails = this.taskFailures.get(taskId) || 0;
    return fails < this.maxRetries;
  }

  /**
   * Records a task failure
   */
  recordFailure(taskId) {
    const fails = (this.taskFailures.get(taskId) || 0) + 1;
    this.taskFailures.set(taskId, fails);
    return fails;
  }

  /**
   * Clears failure record upon task completion
   */
  clearTask(taskId) {
    this.taskFailures.delete(taskId);
  }
}

module.exports = {
  WorkerGuard,
};
