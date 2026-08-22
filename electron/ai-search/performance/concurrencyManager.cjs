"use strict";

class ConcurrencyManager {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 4;
    this.activeCount = 0;
    this.inFlightSearches = new Map(); // cacheKey -> Promise
  }

  /**
   * Executes a search function with concurrency throttling and in-flight deduplication
   */
  async runSearch(cacheKey, searchFn) {
    // 1. In-flight request deduplication
    if (cacheKey && this.inFlightSearches.has(cacheKey)) {
      return this.inFlightSearches.get(cacheKey);
    }

    const promise = (async () => {
      // 2. Concurrency throttling
      while (this.activeCount >= this.maxConcurrent) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      this.activeCount++;
      try {
        return await searchFn();
      } finally {
        this.activeCount--;
        if (cacheKey) {
          this.inFlightSearches.delete(cacheKey);
        }
      }
    })();

    if (cacheKey) {
      this.inFlightSearches.set(cacheKey, promise);
    }

    return promise;
  }
}

module.exports = {
  ConcurrencyManager,
};
