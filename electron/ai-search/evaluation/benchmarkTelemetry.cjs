"use strict";

class BenchmarkTelemetry {
  constructor(options = {}) {
    this.events = [];
    this.maxEvents = options.maxEvents || 1000;
  }

  /**
   * Records an anonymized, privacy-safe search evaluation event
   */
  logSearchEvent(event = {}) {
    const record = {
      timestamp: Date.now(),
      requestId: event.requestId || "req_anon",
      category: event.category || "search",
      mode: event.mode || "BALANCED",
      cacheStatus: event.cacheStatus || "MISS",
      latencyMs: event.latencyMs || 0,
      resultCount: event.resultCount || 0,
      success: event.success !== false,
      error: event.error || null,
    };

    if (this.events.length >= this.maxEvents) {
      this.events.shift();
    }
    this.events.push(record);
    return record;
  }

  getEvents() {
    return this.events.slice();
  }

  clear() {
    this.events = [];
  }
}

module.exports = {
  BenchmarkTelemetry,
};
