"use strict";

const { ErrorClassification } = require("./taskState.cjs");

class RetryManager {
  /**
   * Classifies error type into transient vs permanent
   */
  static classifyError(error) {
    if (!error) return ErrorClassification.PERMANENT;
    const msg = (error.message || String(error)).toLowerCase();

    if (msg.includes("busy") || msg.includes("locked") || msg.includes("timeout") || msg.includes("econnreset")) {
      return ErrorClassification.TRANSIENT;
    }
    if (msg.includes("memory") || msg.includes("throttled") || msg.includes("paused")) {
      return ErrorClassification.RESOURCE;
    }
    if (msg.includes("model") || msg.includes("not ready")) {
      return ErrorClassification.MODEL;
    }
    if (msg.includes("enoent") || msg.includes("not found")) {
      return ErrorClassification.FILE;
    }
    if (msg.includes("corrupt") || msg.includes("invalid") || msg.includes("unsupported")) {
      return ErrorClassification.PERMANENT;
    }
    return ErrorClassification.TRANSIENT;
  }

  /**
   * Computes next retry delay using exponential backoff
   */
  static computeBackoffDelay(attempts, baseDelayMs = 500, maxDelayMs = 30000) {
    const exponent = Math.max(0, attempts - 1);
    const delay = Math.min(baseDelayMs * Math.pow(2, exponent), maxDelayMs);
    // Add 10% jitter
    const jitter = delay * (Math.random() * 0.1);
    return Math.floor(delay + jitter);
  }

  /**
   * Checks if task is eligible for retry
   */
  static shouldRetry(task, error, maxAttempts = 3) {
    if ((task.attempts || 0) >= maxAttempts) return false;
    const classification = this.classifyError(error);
    if (classification === ErrorClassification.PERMANENT) return false;
    return true;
  }
}

module.exports = {
  RetryManager,
};
