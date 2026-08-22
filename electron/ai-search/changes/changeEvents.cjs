"use strict";

const ChangeType = Object.freeze({
  CREATE: "create",
  CONTENT_MODIFIED: "content_modified",
  PATH_CHANGED: "path_changed",
  DELETE: "delete",
  UNCHANGED: "unchanged",
  UNKNOWN: "unknown",
});

const EventSource = Object.freeze({
  WATCHER: "watcher",
  SCANNER: "scanner",
  RECONCILIATION: "reconciliation",
  USER_ACTION: "user_action",
  RECOVERY: "recovery",
});

function createChangeEvent(options = {}) {
  return {
    eventId: options.eventId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: options.type || ChangeType.UNKNOWN,
    path: options.path || "",
    oldPath: options.oldPath || null,
    detectedAt: options.detectedAt || new Date().toISOString(),
    source: options.source || EventSource.WATCHER,
    extra: options.extra || {},
  };
}

module.exports = {
  ChangeType,
  EventSource,
  createChangeEvent,
};
