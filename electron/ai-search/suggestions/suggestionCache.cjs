"use strict";

class SuggestionCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 100;
    this.ttlMs = options.ttlMs || 30000;
  }

  _key(input, contextQuery, indexVersion) {
    return `${input || ""}::${contextQuery || ""}::${indexVersion || 1}`;
  }

  get(input, contextQuery, indexVersion) {
    const k = this._key(input, contextQuery, indexVersion);
    const entry = this.cache.get(k);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(k);
      return null;
    }
    return entry.suggestions;
  }

  set(input, contextQuery, indexVersion, suggestions) {
    if (this.cache.size >= this.maxSize) {
      const first = this.cache.keys().next().value;
      this.cache.delete(first);
    }
    const k = this._key(input, contextQuery, indexVersion);
    this.cache.set(k, { timestamp: Date.now(), suggestions });
  }

  clear() {
    this.cache.clear();
  }
}

module.exports = {
  SuggestionCache,
};
