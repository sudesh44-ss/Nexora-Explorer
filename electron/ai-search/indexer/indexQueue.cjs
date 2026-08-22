"use strict";

const EventEmitter = require("events");

/**
 * Task in Indexing Queue
 */
function createIndexTask(fileRecord, operation = "NEW", priority = 0) {
  return {
    taskId: `task_${fileRecord.file_id || Date.now()}`,
    fileRecord,
    operation,
    priority, // Higher number = higher priority
    status: "queued",
    enqueuedAt: new Date().toISOString(),
  };
}

/**
 * In-Memory Index Task Queue with Batch extraction and Pause/Resume support
 */
class IndexQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this._queue = [];
    this.isPaused = false;
    this.maxQueueSize = options.maxQueueSize || 100000;
  }

  push(task) {
    if (!task || !task.fileRecord) return false;
    this._queue.push(task);
    this.emit("task_added", task);
    return true;
  }

  pushBatch(tasks = []) {
    if (!Array.isArray(tasks) || tasks.length === 0) return 0;
    let added = 0;
    for (const t of tasks) {
      if (t && t.fileRecord) {
        this._queue.push(t);
        added++;
      }
    }
    this.emit("batch_added", added);
    return added;
  }

  popBatch(batchSize = 100) {
    if (this.isPaused || this._queue.length === 0) {
      return [];
    }

    const count = Math.min(batchSize, this._queue.length);
    const batch = this._queue.splice(0, count);

    if (this._queue.length === 0) {
      this.emit("drained");
    }

    return batch;
  }

  pause() {
    this.isPaused = true;
    this.emit("paused");
  }

  resume() {
    this.isPaused = false;
    this.emit("resumed");
  }

  clear() {
    const previousSize = this._queue.length;
    this._queue = [];
    this.emit("cleared", previousSize);
    return previousSize;
  }

  size() {
    return this._queue.length;
  }

  isEmpty() {
    return this._queue.length === 0;
  }
}

module.exports = {
  createIndexTask,
  IndexQueue,
};
