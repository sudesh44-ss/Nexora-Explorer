"use strict";

const { SearchCache } = require("./searchCache.cjs");
const { CacheKey } = require("./cacheKey.cjs");

class CacheManager {
  constructor(options = {}) {
    this.cache = new SearchCache(options);
    this.indexVersion = 1;
  }

  getIndexVersion() {
    return this.indexVersion;
  }

  incrementIndexVersion() {
    this.indexVersion++;
    this.cache.clear(); // Safely invalidate all cached queries on index updates
  }

  get(structuredQuery, options = {}) {
    const key = CacheKey.generate(structuredQuery, { ...options, indexVersion: this.indexVersion });
    return this.cache.get(key);
  }

  set(structuredQuery, results, options = {}) {
    const key = CacheKey.generate(structuredQuery, { ...options, indexVersion: this.indexVersion });
    this.cache.set(key, results);
  }

  invalidate() {
    this.cache.clear();
  }

  getStats() {
    return {
      ...this.cache.getStats(),
      indexVersion: this.indexVersion,
    };
  }
}

module.exports = {
  CacheManager,
};
