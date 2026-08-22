"use strict";

const EventEmitter = require("events");
const { BackgroundWorker } = require("./backgroundWorker.cjs");

class WorkerPool extends EventEmitter {
  constructor(services = {}, config = {}) {
    super();
    this.services = services;
    this.config = config;
    this.maxWorkers = config.maxWorkers || 2;
    this.workers = [];

    for (let i = 0; i < this.maxWorkers; i++) {
      const w = new BackgroundWorker(`worker_${i + 1}`, this.services, this.config);
      w.on("task_started", (e) => this.emit("task_started", e));
      w.on("task_completed", (e) => this.emit("task_completed", e));
      w.on("task_failed", (e) => this.emit("task_failed", e));
      w.on("task_retry", (e) => this.emit("task_retry", e));
      this.workers.push(w);
    }
  }

  getIdleWorker() {
    return this.workers.find((w) => !w.isBusy) || null;
  }

  getActiveWorkerCount() {
    return this.workers.filter((w) => w.isBusy).length;
  }

  getActiveHeavyCount() {
    return this.workers.filter((w) => w.isBusy && w.isHeavy()).length;
  }

  async stopAll() {
    // Wait for currently running tasks to finish
    const busy = this.workers.filter((w) => w.isBusy);
    if (busy.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

module.exports = {
  WorkerPool,
};
