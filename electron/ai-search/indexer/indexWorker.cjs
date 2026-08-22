"use strict";

const EventEmitter = require("events");
const { IndexErrorCode, IndexerError } = require("./indexErrors.cjs");

/**
 * Worker that pulls batches from IndexQueue and writes them to SQLite FileRepository
 */
class IndexWorker extends EventEmitter {
  constructor(queue, fileRepository, options = {}) {
    super();
    this.queue = queue;
    this.repo = fileRepository;
    this.batchSize = options.batchSize || 100;
    this.resourceManager = options.resourceManager || null;
    this.extractionManager = options.extractionManager || null;
    this.db = options.db || null;
    this.enableExtraction = options.enableExtraction !== undefined ? options.enableExtraction : true;
  }

  /**
   * Starts worker processing loop
   * @param {import("./indexSession.cjs").IndexSession} session
   * @returns {Promise<{processed: number, errors: number}>}
   */
  async processAll(session = null) {
    this.isRunning = true;
    this._stopRequested = false;

    let totalProcessed = 0;
    let totalErrors = 0;

    try {
      while (!this._stopRequested && !this.queue.isEmpty()) {
        if (this.queue.isPaused) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          continue;
        }

        // Check dynamic resource decision
        const decision = this.resourceManager ? this.resourceManager.getDecision() : null;
        if (decision && decision.action === "PAUSE") {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        const effectiveBatchSize = decision?.recommendedBatchSize || this.batchSize;
        const batch = this.queue.popBatch(effectiveBatchSize);
        if (batch.length === 0) {
          break;
        }

        const result = await this.processBatch(batch, session);
        totalProcessed += result.processed;
        totalErrors += result.errors;

        // Cooperative yield / throttling delay
        const yieldDelay = decision?.yieldDelayMs || 0;
        await new Promise((resolve) => setTimeout(resolve, yieldDelay));
      }
    } finally {
      this.isRunning = false;
    }

    return { processed: totalProcessed, errors: totalErrors };
  }

  /**
   * Processes a single batch of tasks atomically
   */
  async processBatch(tasks, session = null) {
    if (!tasks || tasks.length === 0) {
      return { processed: 0, errors: 0 };
    }

    const recordsToUpsert = [];
    for (const t of tasks) {
      const rec = {
        ...t.fileRecord,
        status: "indexed",
        indexed_at: new Date().toISOString(),
      };
      recordsToUpsert.push(rec);
    }

    try {
      // 1. Attempt fast bulk upsert in single atomic transaction
      this.repo.upsertBatch(recordsToUpsert);

      // 2. Perform Content Extraction if enabled
      if (this.enableExtraction && this.extractionManager && this.db) {
        for (const rec of recordsToUpsert) {
          if (this.extractionManager.canExtract(rec)) {
            try {
              await this.extractionManager.extractAndPersist(rec, this.db);
            } catch (extErr) {
              // Non-fatal: Content extraction failure for one file does not halt the queue
              this.emit("extraction_warning", { path: rec.path, error: extErr.message });
            }
          }
        }
      }

      if (session) {
        session.recordProcessed(recordsToUpsert.length);
        if (recordsToUpsert.length > 0) {
          session.setCurrentPath(recordsToUpsert[recordsToUpsert.length - 1].path);
        }
      }
      this.emit("batch_processed", recordsToUpsert.length);
      return { processed: recordsToUpsert.length, errors: 0 };
    } catch (batchErr) {
      // 2. Fallback: If bulk transaction fails, isolate and process individually
      let processed = 0;
      let errors = 0;

      for (const rec of recordsToUpsert) {
        try {
          this.repo.upsert(rec);
          processed++;
          if (session) session.recordProcessed(1);
        } catch (itemErr) {
          errors++;
          if (session) session.recordFailed(itemErr, rec.path);
          try {
            // Attempt to record error state in DB
            this.repo.updateStatus(rec.file_id, "error", itemErr.message);
          } catch {}
          this.emit("error", new IndexerError(IndexErrorCode.INDEX_RECORD_FAILED, itemErr.message, { path: rec.path }));
        }
      }

      return { processed, errors };
    }
  }

  stop() {
    this._stopRequested = true;
    this.isRunning = false;
  }
}

module.exports = {
  IndexWorker,
};
