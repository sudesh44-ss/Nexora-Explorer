"use strict";

const EventEmitter = require("events");
const { TaskState } = require("./taskState.cjs");
const { createIndexTask } = require("./taskRegistry.cjs");

class IndexQueue extends EventEmitter {
  constructor(persistence) {
    super();
    this.persistence = persistence;
  }

  /**
   * Enqueues a new index task with deduplication
   */
  enqueue(taskOptions) {
    const task = createIndexTask(taskOptions);

    // Deduplication check: Is there already an active task for this file + taskType?
    if (this.persistence) {
      const active = this.persistence.findActiveTask(task.fileId, task.taskType);
      if (active) {
        return { enqueued: false, duplicate: true, taskId: active.taskId };
      }

      this.persistence.upsertTask(task);
    }

    this.emit("task_queued", { task });
    return { enqueued: true, duplicate: false, taskId: task.taskId, task };
  }

  /**
   * Batch enqueues tasks
   */
  enqueueBatch(tasksOptions = []) {
    const results = [];
    for (const opt of tasksOptions) {
      results.push(this.enqueue(opt));
    }
    return results;
  }

  cancelTask(taskId) {
    if (this.persistence) {
      this.persistence.updateTaskStatus(taskId, TaskState.CANCELLED);
      this.emit("task_cancelled", { taskId });
      return true;
    }
    return false;
  }

  fetchCandidates(limit = 50) {
    if (!this.persistence) return [];
    return this.persistence.fetchQueuedTasks(limit);
  }

  getStats() {
    if (!this.persistence) {
      return { total: 0, pending: 0, queued: 0, processing: 0, completed: 0, failed: 0 };
    }
    return this.persistence.getStats();
  }
}

module.exports = {
  IndexQueue,
};
