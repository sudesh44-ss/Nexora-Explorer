"use strict";

const EventEmitter = require("events");

/**
 * Background Media Processing Queue with resource-aware concurrency management
 */
class MediaQueue extends EventEmitter {
  constructor(mediaIndexer, options = {}) {
    super();
    this.indexer = mediaIndexer;
    this.resourceManager = options.resourceManager || null;
    this.concurrency = options.concurrency || 1;
    this.queue = [];
    this.activeCount = 0;
    this.isProcessing = false;
  }

  /**
   * Enqueues a media file for background analysis
   */
  enqueue(fileRecord, options = {}) {
    this.queue.push({ fileRecord, options });
    this.processNext();
  }

  async processNext() {
    if (this.isProcessing || this.activeCount >= this.concurrency) return;
    if (this.queue.length === 0) return;

    // Check if Resource Manager has paused heavy workloads
    if (this.resourceManager && typeof this.resourceManager.isPaused === "function") {
      if (this.resourceManager.isPaused()) {
        this.emit("queue_paused_by_resource_manager");
        return;
      }
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;
    try {
      const res = await this.indexer.indexMediaFile(item.fileRecord, item.options);
      this.emit("item_processed", { fileRecord: item.fileRecord, result: res });
    } catch (err) {
      this.emit("item_failed", { fileRecord: item.fileRecord, error: err.message });
    } finally {
      this.activeCount--;
      setImmediate(() => this.processNext());
    }
  }

  getPendingCount() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
  }
}

module.exports = {
  MediaQueue,
};
