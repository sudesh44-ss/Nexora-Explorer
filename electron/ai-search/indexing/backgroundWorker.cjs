"use strict";

const EventEmitter = require("events");
const { TaskType, TaskState } = require("./taskState.cjs");
const { RetryManager } = require("./retryManager.cjs");
const { WorkloadEstimator } = require("./workloadEstimator.cjs");

class BackgroundWorker extends EventEmitter {
  constructor(workerId, services = {}, options = {}) {
    super();
    this.workerId = workerId;
    this.db = services.databaseManager || null;
    this.extractionManager = services.extractionManager || null;
    this.embeddingManager = services.embeddingManager || null;
    this.mediaIndexer = services.mediaIndexer || null;
    this.ocrEngine = services.ocrEngine || null;
    this.ocrIndexer = services.ocrIndexer || null;
    this.queuePersistence = services.queuePersistence || null;
    this.options = options;

    this.currentTask = null;
    this.isBusy = false;
  }

  isHeavy() {
    return this.currentTask ? WorkloadEstimator.isHeavyTask(this.currentTask.taskType) : false;
  }

  /**
   * Executes an assigned index task
   */
  async execute(task) {
    this.currentTask = task;
    this.isBusy = true;
    const startTime = Date.now();

    try {
      this.emit("task_started", { workerId: this.workerId, task });

      // Fetch fresh FileRecord
      let fileRecord = null;
      if (this.db && this.db.files) {
        fileRecord = this.db.files.findByFileId(task.fileId);
      }

      if (!fileRecord && task.payload?.fileRecord) {
        fileRecord = task.payload.fileRecord;
      }

      if (!fileRecord) {
        throw new Error(`File ${task.fileId} not found in database`);
      }

      // Check if file content hash has changed -> if stale, throw or skip
      if (task.sourceHash && fileRecord.hash && task.sourceHash !== fileRecord.hash) {
        // Mark STALE
        if (this.queuePersistence) {
          this.queuePersistence.updateTaskStatus(task.taskId, TaskState.STALE);
        }
        this.emit("task_completed", { workerId: this.workerId, task, result: { status: "stale" } });
        return { success: true, stale: true };
      }

      let result = null;

      // Route by task type
      switch (task.taskType) {
        case TaskType.METADATA_INDEX:
          if (this.db && this.db.files) {
            this.db.files.upsert(fileRecord);
            result = { indexed: true };
          }
          break;

        case TaskType.TEXT_EXTRACTION:
          if (this.extractionManager) {
            const extRes = await this.extractionManager.extract(fileRecord);
            if (extRes.success && this.db) {
              if (this.db.content) {
                this.db.content.upsert(fileRecord.file_id, {
                  extracted_text: extRes.text,
                  word_count: extRes.wordCount,
                });
              }
              if (this.db.fts) {
                this.db.fts.updateSearchableContent(fileRecord.file_id, {
                  text: extRes.text,
                });
              }
            }
            result = extRes;
          }
          break;

        case TaskType.OCR_EXTRACTION:
          if (this.ocrEngine) {
            const ocrRes = await this.ocrEngine.analyze(fileRecord, task.payload || {});
            if (ocrRes.success && this.ocrIndexer) {
              await this.ocrIndexer.indexOCRResult(fileRecord, ocrRes, this.db, this.embeddingManager);
            }
            result = ocrRes;
          }
          break;

        case TaskType.EMBEDDING_GENERATION:
          if (this.embeddingManager) {
            let textToEmbed = fileRecord.name;
            if (this.db && this.db.content) {
              const c = this.db.content.findByFileId(fileRecord.file_id);
              if (c?.extracted_text) textToEmbed = `${fileRecord.name}. ${c.extracted_text}`;
            }
            result = await this.embeddingManager.embedFile(fileRecord, { text: textToEmbed });
          }
          break;

        case TaskType.IMAGE_ANALYSIS:
        case TaskType.AUDIO_ANALYSIS:
        case TaskType.VIDEO_ANALYSIS:
          if (this.mediaIndexer) {
            result = await this.mediaIndexer.indexMediaFile(fileRecord, task.payload);
          }
          break;

        default:
          result = { success: true };
          break;
      }

      // Mark COMPLETED atomically
      if (this.queuePersistence) {
        this.queuePersistence.updateTaskStatus(task.taskId, TaskState.COMPLETED, {
          completedAt: new Date().toISOString(),
        });
      }

      const tookMs = Date.now() - startTime;
      this.emit("task_completed", { workerId: this.workerId, task, result, tookMs });
      return { success: true, result, tookMs };
    } catch (err) {
      const attempts = (task.attempts || 0) + 1;
      const shouldRetry = RetryManager.shouldRetry(task, err, task.maxAttempts || 3);

      if (shouldRetry) {
        const delayMs = RetryManager.computeBackoffDelay(attempts, this.options.retryBackoffMs);
        const nextRetry = new Date(Date.now() + delayMs).toISOString();

        if (this.queuePersistence) {
          this.queuePersistence.updateTaskStatus(task.taskId, TaskState.RETRY_WAIT, {
            attempts,
            nextRetryAt: nextRetry,
            errorCode: err.code || "TASK_ERROR",
            errorMessage: err.message,
          });
        }
        this.emit("task_retry", { workerId: this.workerId, task, attempts, nextRetry, error: err.message });
      } else {
        if (this.queuePersistence) {
          this.queuePersistence.updateTaskStatus(task.taskId, TaskState.FAILED, {
            attempts,
            errorCode: err.code || "TASK_ERROR",
            errorMessage: err.message,
          });
        }
        this.emit("task_failed", { workerId: this.workerId, task, error: err.message });
      }
      return { success: false, error: err.message };
    } finally {
      this.currentTask = null;
      this.isBusy = false;
    }
  }
}

module.exports = {
  BackgroundWorker,
};
