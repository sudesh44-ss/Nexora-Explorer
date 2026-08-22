"use strict";

const { TaskState } = require("./taskState.cjs");
const { IndexQueueErrorCode, IndexQueueError } = require("./indexErrors.cjs");

/**
 * SQLite Persistence Repository for Background AI Index Tasks
 */
class QueuePersistence {
  constructor(db) {
    this.dbManager = db;
    this.rawDb = db?.db || db;
    if (this._getRawDb() && typeof this._getRawDb().exec === "function") {
      this.initTable();
    }
  }

  _getRawDb() {
    return this.dbManager?.db || this.rawDb || this.dbManager;
  }

  initTable() {
    try {
      const raw = this._getRawDb();
      if (!raw || typeof raw.exec !== "function") return;

      raw.exec(`
        CREATE TABLE IF NOT EXISTS ai_index_tasks (
          task_id TEXT PRIMARY KEY,
          file_id TEXT NOT NULL,
          task_type TEXT NOT NULL,
          priority INTEGER NOT NULL DEFAULT 60,
          status TEXT NOT NULL DEFAULT 'queued',
          source_hash TEXT,
          dependencies TEXT DEFAULT '[]',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          payload TEXT DEFAULT '{}',
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          next_retry_at TEXT,
          error_code TEXT,
          error_message TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON ai_index_tasks(status, priority DESC, created_at ASC);
        CREATE INDEX IF NOT EXISTS idx_tasks_file_type ON ai_index_tasks(file_id, task_type);
      `);
    } catch (err) {
      throw new IndexQueueError(
        IndexQueueErrorCode.QUEUE_PERSISTENCE_FAILED,
        `Failed to initialize ai_index_tasks table: ${err.message}`,
        err
      );
    }
  }

  upsertTask(task) {
    try {
      const raw = this._getRawDb();
      if (!raw) return { success: false };

      const stmt = raw.prepare(`
        INSERT INTO ai_index_tasks (
          task_id, file_id, task_type, priority, status, source_hash,
          dependencies, attempts, max_attempts, payload, created_at,
          started_at, completed_at, next_retry_at, error_code, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          priority = excluded.priority,
          status = excluded.status,
          attempts = excluded.attempts,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          next_retry_at = excluded.next_retry_at,
          error_code = excluded.error_code,
          error_message = excluded.error_message
      `);

      stmt.run(
        task.taskId,
        task.fileId,
        task.taskType,
        task.priority,
        task.status,
        task.sourceHash || null,
        JSON.stringify(task.dependencies || []),
        task.attempts || 0,
        task.maxAttempts || 3,
        JSON.stringify(task.payload || {}),
        task.createdAt,
        task.startedAt || null,
        task.completedAt || null,
        task.nextRetryAt || null,
        task.errorCode || null,
        task.errorMessage || null
      );
      return { success: true };
    } catch (err) {
      throw new IndexQueueError(
        IndexQueueErrorCode.QUEUE_PERSISTENCE_FAILED,
        `Failed to upsert task ${task.taskId}: ${err.message}`,
        err
      );
    }
  }

  updateTaskStatus(taskId, status, extra = {}) {
    try {
      const raw = this._getRawDb();
      if (!raw) return;

      const stmt = raw.prepare(`
        UPDATE ai_index_tasks
        SET status = ?,
            attempts = COALESCE(?, attempts),
            started_at = COALESCE(?, started_at),
            completed_at = COALESCE(?, completed_at),
            next_retry_at = COALESCE(?, next_retry_at),
            error_code = COALESCE(?, error_code),
            error_message = COALESCE(?, error_message)
        WHERE task_id = ?
      `);

      stmt.run(
        status,
        extra.attempts !== undefined ? extra.attempts : null,
        extra.startedAt !== undefined ? extra.startedAt : null,
        extra.completedAt !== undefined ? extra.completedAt : null,
        extra.nextRetryAt !== undefined ? extra.nextRetryAt : null,
        extra.errorCode !== undefined ? extra.errorCode : null,
        extra.errorMessage !== undefined ? extra.errorMessage : null,
        taskId
      );
    } catch (err) {
      throw new IndexQueueError(
        IndexQueueErrorCode.QUEUE_PERSISTENCE_FAILED,
        `Failed to update task ${taskId} status: ${err.message}`,
        err
      );
    }
  }

  findActiveTask(fileId, taskType) {
    try {
      const raw = this._getRawDb();
      if (!raw) return null;

      const stmt = raw.prepare(`
        SELECT * FROM ai_index_tasks
        WHERE file_id = ? AND task_type = ? AND status IN ('pending', 'queued', 'processing', 'retry_wait')
        LIMIT 1
      `);
      const row = stmt.get(fileId, taskType);
      return row ? this._mapRow(row) : null;
    } catch {
      return null;
    }
  }

  fetchQueuedTasks(limit = 50) {
    try {
      const raw = this._getRawDb();
      if (!raw) return [];

      const now = new Date().toISOString();
      const stmt = raw.prepare(`
        SELECT * FROM ai_index_tasks
        WHERE status = 'queued' OR (status = 'retry_wait' AND (next_retry_at IS NULL OR next_retry_at <= ?))
        ORDER BY priority DESC, created_at ASC
        LIMIT ?
      `);
      const rows = stmt.all(now, limit);
      return rows.map((r) => this._mapRow(r));
    } catch {
      return [];
    }
  }

  recoverInterruptedTasks() {
    try {
      const raw = this._getRawDb();
      if (!raw) return 0;

      const stmt = raw.prepare(`
        UPDATE ai_index_tasks
        SET status = 'queued', started_at = NULL
        WHERE status = 'processing'
      `);
      const res = stmt.run();
      return res.changes;
    } catch {
      return 0;
    }
  }

  getStats() {
    try {
      const raw = this._getRawDb();
      if (!raw) return { total: 0, pending: 0, queued: 0, processing: 0, completed: 0, failed: 0 };

      const stmt = raw.prepare(`
        SELECT status, count(*) as count
        FROM ai_index_tasks
        GROUP BY status
      `);
      const rows = stmt.all();
      const stats = {
        total: 0,
        pending: 0,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retryWait: 0,
        cancelled: 0,
        paused: 0,
      };

      for (const r of rows) {
        stats.total += r.count;
        if (r.status === "pending") stats.pending = r.count;
        if (r.status === "queued") stats.queued = r.count;
        if (r.status === "processing") stats.processing = r.count;
        if (r.status === "completed") stats.completed = r.count;
        if (r.status === "failed") stats.failed = r.count;
        if (r.status === "retry_wait") stats.retryWait = r.count;
        if (r.status === "cancelled") stats.cancelled = r.count;
        if (r.status === "paused") stats.paused = r.count;
      }
      return stats;
    } catch {
      return { total: 0, pending: 0, queued: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  _mapRow(r) {
    return {
      taskId: r.task_id,
      fileId: r.file_id,
      taskType: r.task_type,
      priority: r.priority,
      status: r.status,
      sourceHash: r.source_hash,
      dependencies: JSON.parse(r.dependencies || "[]"),
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      payload: JSON.parse(r.payload || "{}"),
      createdAt: r.created_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      nextRetryAt: r.next_retry_at,
      errorCode: r.error_code,
      errorMessage: r.error_message,
    };
  }
}

module.exports = {
  QueuePersistence,
};
