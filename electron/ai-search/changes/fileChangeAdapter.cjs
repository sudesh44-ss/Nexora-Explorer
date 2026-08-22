"use strict";

const { createChangeEvent, ChangeType, EventSource } = require("./changeEvents.cjs");

class FileChangeAdapter {
  /**
   * Adapts raw filesystem watcher event into normalized ChangeEvent
   */
  static adapt(eventType, filePath, oldPath = null, source = EventSource.WATCHER) {
    let type = ChangeType.UNKNOWN;
    const ev = (eventType || "").toLowerCase();

    if (ev === "add" || ev === "create" || ev === "created") {
      type = ChangeType.CREATE;
    } else if (ev === "change" || ev === "modify" || ev === "modified") {
      type = ChangeType.CONTENT_MODIFIED;
    } else if (ev === "unlink" || ev === "delete" || ev === "deleted") {
      type = ChangeType.DELETE;
    } else if (ev === "rename" || ev === "move") {
      type = ChangeType.PATH_CHANGED;
    }

    return createChangeEvent({
      type,
      path: filePath,
      oldPath,
      source,
    });
  }
}

module.exports = {
  FileChangeAdapter,
};
