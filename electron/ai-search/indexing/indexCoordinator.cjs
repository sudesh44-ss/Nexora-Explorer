"use strict";

const EventEmitter = require("events");
const { getIndexConfig } = require("./indexConfig.cjs");
const { QueuePersistence } = require("./queuePersistence.cjs");
const { IndexQueue } = require("./indexQueue.cjs");
const { PriorityScheduler } = require("./priorityScheduler.cjs");
const { WorkerPool } = require("./workerPool.cjs");
const { TaskState } = require("./taskState.cjs");

/**
 * Central Background AI Indexing Coordinator orchestrating Persistent Queue,
 * Priority Scheduling, Worker Pool, and Resource Constraints
 */
class IndexCoordinator extends EventEmitter {
  constructor(services = {}, options = {}) {
    super();
    this.db = services.databaseManager || null;
    this.resourceManager = services.resourceManager || null;
    this.config = getIndexConfig(options);

    this.persistence = new QueuePersistence(this.db);
    this.queue = new IndexQueue(this.persistence);
    this.scheduler = new PriorityScheduler(this.config);
    this.workerPool = new WorkerPool(
      {
        databaseManager: this.db,
        extractionManager: services.extractionManager,
        embeddingManager: services.embeddingManager,
        mediaIndexer: services.mediaIndexer,
        queuePersistence: this.persistence,
      },
      this.config
    );

    this.isRunning = false;
    this.isPaused = false;
    this._pollTimer = null;
    this._bindEvents();
  }

  _bindEvents() {
    this.workerPool.on("task_started", (e) => this.emit("task_started", e));
    this.workerPool.on("task_completed", (e) => {
      this.emit("task_completed", e);
      this._scheduleTick();
    });
    this.workerPool.on("task_failed", (e) => {
      this.emit("task_failed", e);
      this._scheduleTick();
    });
    this.workerPool.on("task_retry", (e) => {
      this.emit("task_retry", e);
      this._scheduleTick();
    });
  }

  /**
   * Starts background indexing coordinator & recovers interrupted tasks
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;

    // 1. Recover interrupted processing tasks
    const recovered = this.persistence.recoverInterruptedTasks();
    if (recovered > 0) {
      this.emit("tasks_recovered", { count: recovered });
    }

    // 2. Start polling loop
    this._pollTimer = setInterval(() => this._scheduleTick(), this.config.pollIntervalMs);
    this._scheduleTick();
  }

  /**
   * Pauses background task scheduling
   */
  pause() {
    this.isPaused = true;
    this.emit("queue_paused");
  }

  /**
   * Resumes background task scheduling
   */
  resume() {
    this.isPaused = false;
    this.emit("queue_resumed");
    this._scheduleTick();
  }

  /**
   * Stops background indexing cleanly
   */
  async stop() {
    this.isRunning = false;
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    await this.workerPool.stopAll();
  }

  /**
   * Enqueues an index task
   */
  queueTask(taskOptions) {
    return this.queue.enqueue(taskOptions);
  }

  /**
   * Main scheduling tick
   */
  async _scheduleTick() {
    if (!this.isRunning || this.isPaused) return;

    // Check system resource state
    let resourceState = "NORMAL";
    if (this.resourceManager && typeof this.resourceManager.isPaused === "function") {
      if (this.resourceManager.isPaused()) {
        resourceState = "PAUSED";
      } else if (typeof this.resourceManager.isThrottled === "function" && this.resourceManager.isThrottled()) {
        resourceState = "THROTTLED";
      }
    }

    if (resourceState === "PAUSED") return;

    const idleWorker = this.workerPool.getIdleWorker();
    if (!idleWorker) return;

    const candidates = this.queue.fetchCandidates(this.config.batchSize);
    if (candidates.length === 0) return;

    const activeWorkers = this.workerPool.getActiveWorkerCount();
    const activeHeavy = this.workerPool.getActiveHeavyCount();

    const tasksToRun = this.scheduler.selectTasksToDispatch(
      candidates,
      activeWorkers,
      activeHeavy,
      resourceState
    );

    for (const task of tasksToRun) {
      const worker = this.workerPool.getIdleWorker();
      if (!worker) break;

      // Mark processing in SQLite
      this.persistence.updateTaskStatus(task.taskId, TaskState.PROCESSING, {
        startedAt: new Date().toISOString(),
      });

      // Fire asynchronously
      worker.execute(task);
    }
  }

  getStats() {
    const queueStats = this.queue.getStats();
    return {
      ...queueStats,
      activeWorkers: this.workerPool.getActiveWorkerCount(),
      activeHeavyWorkers: this.workerPool.getActiveHeavyCount(),
      maxWorkers: this.config.maxWorkers,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
    };
  }
}

module.exports = {
  IndexCoordinator,
};
