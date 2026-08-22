"use strict";

const EventEmitter = require("events");
const { ChangeType } = require("./changeEvents.cjs");

class ChangeCoalescer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.debounceWindowMs = options.debounceWindowMs || 100;
    this.pendingEvents = new Map(); // path -> { event, timer }
  }

  /**
   * Pushes a raw change event for debounced coalescing
   */
  push(event) {
    if (!event || !event.path) return;

    const path = event.path;
    const existing = this.pendingEvents.get(path);

    if (existing) {
      clearTimeout(existing.timer);
      const coalescedType = this._coalesceTypes(existing.event.type, event.type);

      if (!coalescedType) {
        // Discard (e.g. CREATE + DELETE)
        this.pendingEvents.delete(path);
        return;
      }

      existing.event.type = coalescedType;
      existing.event.detectedAt = event.detectedAt;
      existing.timer = setTimeout(() => this._flushPath(path), this.debounceWindowMs);
    } else {
      const entry = {
        event,
        timer: setTimeout(() => this._flushPath(path), this.debounceWindowMs),
      };
      this.pendingEvents.set(path, entry);
    }
  }

  _coalesceTypes(oldType, newType) {
    if (oldType === ChangeType.CREATE && newType === ChangeType.DELETE) {
      return null; // Cancelled
    }
    if (oldType === ChangeType.CREATE) {
      return ChangeType.CREATE;
    }
    if (newType === ChangeType.DELETE) {
      return ChangeType.DELETE;
    }
    return newType;
  }

  _flushPath(path) {
    const entry = this.pendingEvents.get(path);
    if (!entry) return;

    this.pendingEvents.delete(path);
    this.emit("change_ready", entry.event);
  }

  flushAll() {
    for (const [path, entry] of this.pendingEvents.entries()) {
      clearTimeout(entry.timer);
      this.emit("change_ready", entry.event);
    }
    this.pendingEvents.clear();
  }

  clear() {
    for (const entry of this.pendingEvents.values()) {
      clearTimeout(entry.timer);
    }
    this.pendingEvents.clear();
  }
}

module.exports = {
  ChangeCoalescer,
};
