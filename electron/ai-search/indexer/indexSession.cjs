"use strict";

const crypto = require("crypto");
const { SessionStatus } = require("./indexState.cjs");

/**
 * Tracks the state, progress, and telemetry of an indexing session
 */
class IndexSession {
  constructor(locations = [], options = {}) {
    this.sessionId = options.sessionId || `session_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    this.locations = Array.isArray(locations) ? locations : [locations].filter(Boolean);
    this.status = SessionStatus.IDLE;
    this.startedAt = null;
    this.finishedAt = null;
    this.elapsedMs = 0;
    this.currentPath = "";

    this.counters = {
      filesDiscovered: 0,
      filesProcessed: 0,
      filesSkipped: 0,
      filesFailed: 0,
      foldersScanned: 0,
    };

    this.errors = [];
  }

  start() {
    this.status = SessionStatus.RUNNING;
    this.startedAt = new Date().toISOString();
    this.finishedAt = null;
  }

  pause() {
    if (this.status === SessionStatus.RUNNING) {
      this.status = SessionStatus.PAUSED;
    }
  }

  resume() {
    if (this.status === SessionStatus.PAUSED) {
      this.status = SessionStatus.RUNNING;
    }
  }

  cancel() {
    this.status = SessionStatus.CANCELLING;
  }

  complete(finalStatus = SessionStatus.COMPLETED) {
    this.status = finalStatus;
    this.finishedAt = new Date().toISOString();
    if (this.startedAt) {
      this.elapsedMs = Date.now() - new Date(this.startedAt).getTime();
    }
  }

  setCurrentPath(filePath) {
    this.currentPath = filePath || "";
  }

  recordDiscovered() {
    this.counters.filesDiscovered++;
  }

  recordProcessed(count = 1) {
    this.counters.filesProcessed += count;
  }

  recordSkipped(count = 1) {
    this.counters.filesSkipped += count;
  }

  recordFailed(err, targetPath = "") {
    this.counters.filesFailed++;
    this.errors.push({
      path: targetPath,
      message: err?.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }

  getProgress() {
    const elapsed = this.startedAt
      ? (this.finishedAt ? this.elapsedMs : Date.now() - new Date(this.startedAt).getTime())
      : 0;

    const total = this.counters.filesDiscovered;
    const handled = this.counters.filesProcessed + this.counters.filesSkipped + this.counters.filesFailed;
    const percent = total > 0 ? Math.min(100, Math.round((handled / total) * 100)) : 0;

    return {
      sessionId: this.sessionId,
      status: this.status,
      locations: [...this.locations],
      currentPath: this.currentPath,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      elapsedMs: elapsed,
      filesDiscovered: this.counters.filesDiscovered,
      filesProcessed: this.counters.filesProcessed,
      filesSkipped: this.counters.filesSkipped,
      filesFailed: this.counters.filesFailed,
      foldersScanned: this.counters.foldersScanned,
      percent,
      errorsCount: this.errors.length,
      errors: this.errors.slice(-20), // Last 20 errors for diagnostics
    };
  }
}

module.exports = {
  IndexSession,
};
