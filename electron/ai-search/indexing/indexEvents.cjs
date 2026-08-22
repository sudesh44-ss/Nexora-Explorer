"use strict";

const IndexEvents = Object.freeze({
  TASK_QUEUED: "task_queued",
  TASK_STARTED: "task_started",
  TASK_PROGRESS: "task_progress",
  TASK_COMPLETED: "task_completed",
  TASK_FAILED: "task_failed",
  TASK_RETRY: "task_retry",
  TASK_CANCELLED: "task_cancelled",
  QUEUE_PAUSED: "queue_paused",
  QUEUE_RESUMED: "queue_resumed",
  QUEUE_DRAINED: "queue_drained",
});

module.exports = {
  IndexEvents,
};
