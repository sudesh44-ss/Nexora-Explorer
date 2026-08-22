"use strict";

const { CacheManager } = require("./cacheManager.cjs");
const { CacheKey } = require("./cacheKey.cjs");
const { CandidateLimiter } = require("./candidateLimiter.cjs");
const { ConcurrencyManager } = require("./concurrencyManager.cjs");
const { RequestController } = require("./requestController.cjs");
const { MemoryGuard } = require("./memoryGuard.cjs");
const { SearchScheduler } = require("./searchScheduler.cjs");
const { PerformanceDiagnostics } = require("./performanceDiagnostics.cjs");

class PerformanceAdapter {
  constructor(options = {}) {
    this.cacheManager = new CacheManager(options);
    this.concurrencyManager = new ConcurrencyManager(options);
    this.requestController = new RequestController();
    this.memoryGuard = new MemoryGuard(options);
    this.scheduler = new SearchScheduler();
  }

  /**
   * Executes a search pipeline with full performance optimizations
   *
   * @param {Object} structuredQuery - Structured query from Part 16/23
   * @param {Function} executePipelineFn - Async function returning search results
   * @param {Object} options - Search options (mode, scope, requestId, etc.)
   * @returns {Promise<Array<Object>>} Optimized search results
   */
  async executeOptimizedSearch(structuredQuery, executePipelineFn, options = {}) {
    const scope = options.scope || "global";
    const requestId = options.requestId || this.requestController.startRequest(scope);
    const mode = options.mode || "BALANCED";

    const key = CacheKey.generate(structuredQuery, {
      ...options,
      indexVersion: this.cacheManager.getIndexVersion(),
    });

    // 1. Cache hit check
    if (options.useCache !== false) {
      const cached = this.cacheManager.get(structuredQuery, options);
      if (cached) {
        return cached;
      }
    }

    // 2. Concurrency & Deduplication execution
    return this.concurrencyManager.runSearch(key, async () => {
      this.scheduler.startSearch();
      const t0 = Date.now();

      try {
        // Candidate limits with memory guard
        const rawLimits = CandidateLimiter.getLimits(mode, options);
        const effectiveLimits = this.memoryGuard.adjustLimits(rawLimits);

        // Execute underlying pipeline
        const rawResults = await executePipelineFn({
          ...options,
          limits: effectiveLimits,
        });

        // Limit results for display
        const displayResults = CandidateLimiter.trimForDisplay(rawResults, effectiveLimits.displayK);

        // Save to cache
        if (options.useCache !== false && displayResults.length > 0) {
          this.cacheManager.set(structuredQuery, displayResults, options);
        }

        if (options.diagnostics) {
          displayResults._perf = PerformanceDiagnostics.generateReport(
            { totalMs: Date.now() - t0 },
            this.cacheManager.getStats()
          );
        }

        return displayResults;
      } finally {
        this.scheduler.endSearch();
      }
    });
  }

  /**
   * Invalidates search cache on file/index changes
   */
  invalidateCache() {
    this.cacheManager.incrementIndexVersion();
  }
}

module.exports = {
  PerformanceAdapter,
};
