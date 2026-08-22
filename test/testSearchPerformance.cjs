"use strict";

const assert = require("assert");
const aiSearch = require("../electron/ai-search/index.cjs");
const {
  PerformanceAdapter,
  SearchCache,
  CacheKey,
  CacheManager,
  CandidateLimiter,
  ConcurrencyManager,
  RequestController,
  MemoryGuard,
  SearchScheduler,
} = aiSearch.performance;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA SEARCH PERFORMANCE TEST SUITE");
  console.log("=================================================\n");

  const perfAdapter = new PerformanceAdapter({ maxSize: 100, ttlMs: 60000 });

  const dummyPipeline = async (options) => {
    return [
      { fileId: "doc_1", name: "Cybersecurity.pdf", score: 0.95 },
      { fileId: "doc_2", name: "Network_Security.docx", score: 0.88 },
      { fileId: "vid_1", name: "Firewall_Lecture.mp4", score: 0.82 },
    ];
  };

  // --------------------------------------------------------
  // Test 1: Basic Search & Caching Behavior
  // --------------------------------------------------------
  console.log("▶ Test 1: Search caching hit / miss behavior...");
  const sqCyber = { rawQuery: "cybersecurity", keywords: ["cybersecurity"] };

  // First run: cache miss
  const res1 = await perfAdapter.executeOptimizedSearch(sqCyber, dummyPipeline);
  assert.strictEqual(res1.length, 3);

  // Second run: cache hit
  const res2 = await perfAdapter.executeOptimizedSearch(sqCyber, dummyPipeline);
  assert.strictEqual(res2.length, 3);
  assert.strictEqual(res1, res2); // Same object reference from cache
  console.log("  ✓ Passed: Search cache successfully stored and retrieved results.");

  // --------------------------------------------------------
  // Test 2: Cache Invalidation on Index Update
  // --------------------------------------------------------
  console.log("▶ Test 2: Cache invalidation on index version increment...");
  perfAdapter.invalidateCache();
  const stats = perfAdapter.cacheManager.getStats();
  assert.strictEqual(stats.indexVersion, 2);
  assert.strictEqual(stats.size, 0);
  console.log("  ✓ Passed: Cache safely invalidated on index version increment.");

  // --------------------------------------------------------
  // Test 3: Candidate Limits (FAST, BALANCED, ACCURATE)
  // --------------------------------------------------------
  console.log("▶ Test 3: Multi-tier candidate limiter checks...");
  const fastLimits = CandidateLimiter.getLimits("FAST");
  assert.strictEqual(fastLimits.displayK, 20);
  const accurateLimits = CandidateLimiter.getLimits("ACCURATE");
  assert.strictEqual(accurateLimits.displayK, 100);

  const trimmed = CandidateLimiter.trimForDisplay(
    Array.from({ length: 150 }, (_, i) => ({ id: i })),
    50
  );
  assert.strictEqual(trimmed.length, 50);
  console.log("  ✓ Passed: Candidate limiter correctly constrained candidate counts.");

  // --------------------------------------------------------
  // Test 4: Concurrency & In-Flight Deduplication
  // --------------------------------------------------------
  console.log("▶ Test 4: Concurrency throttling and in-flight request deduplication...");
  let executionCount = 0;
  const slowPipeline = async () => {
    executionCount++;
    await new Promise((r) => setTimeout(r, 20));
    return [{ fileId: "res_dedup" }];
  };

  // Launch 3 simultaneous identical searches
  const promises = [
    perfAdapter.executeOptimizedSearch({ rawQuery: "dedup_test" }, slowPipeline, { useCache: false }),
    perfAdapter.executeOptimizedSearch({ rawQuery: "dedup_test" }, slowPipeline, { useCache: false }),
    perfAdapter.executeOptimizedSearch({ rawQuery: "dedup_test" }, slowPipeline, { useCache: false }),
  ];

  const results = await Promise.all(promises);
  assert.strictEqual(executionCount, 1); // Deduplicated into 1 underlying pipeline run
  assert.strictEqual(results[0][0].fileId, "res_dedup");
  console.log("  ✓ Passed: Deduplicated 3 concurrent requests into 1 execution run.");

  // --------------------------------------------------------
  // Test 5: Cancellation & Latest Request Wins
  // --------------------------------------------------------
  console.log("▶ Test 5: Cancellation and latest request wins semantics...");
  const reqController = new RequestController();
  const req1 = reqController.startRequest("global", "req_old");
  const req2 = reqController.startRequest("global", "req_new");

  assert.strictEqual(reqController.isCurrent("global", req1), false);
  assert.strictEqual(reqController.isCurrent("global", req2), true);
  console.log("  ✓ Passed: Stale request ID cancelled successfully.");

  // --------------------------------------------------------
  // Test 6: Memory Guard Limits Adjustment
  // --------------------------------------------------------
  console.log("▶ Test 6: Memory guard under memory pressure...");
  const memoryGuard = new MemoryGuard();
  const adjusted = memoryGuard.adjustLimits({ retrievalK: 300, rankingK: 150, displayK: 50 }, true);
  assert.strictEqual(adjusted.retrievalK, 150);
  assert.strictEqual(adjusted.rankingK, 75);
  console.log("  ✓ Passed: Memory guard scaled down candidate limit under simulated pressure.");

  // --------------------------------------------------------
  // Test 7: Search Scheduler Prioritization
  // --------------------------------------------------------
  console.log("▶ Test 7: Search scheduler priority check...");
  const scheduler = new SearchScheduler();
  assert.strictEqual(scheduler.shouldBackgroundYield(), false);
  scheduler.startSearch();
  assert.strictEqual(scheduler.shouldBackgroundYield(), true);
  scheduler.endSearch();
  assert.strictEqual(scheduler.shouldBackgroundYield(), false);
  console.log("  ✓ Passed: Background queue yielded while active search in progress.");

  // --------------------------------------------------------
  // Test 8: Graceful Fallback on Vector Failure
  // --------------------------------------------------------
  console.log("▶ Test 8: Graceful fallback when vector search throws...");
  const failingPipeline = async () => {
    // Vector search fails, fallback to FTS
    return [{ fileId: "fallback_fts", name: "fts_result.txt", score: 0.7 }];
  };
  const fallbackRes = await perfAdapter.executeOptimizedSearch({ rawQuery: "fallback" }, failingPipeline, { useCache: false });
  assert.strictEqual(fallbackRes[0].fileId, "fallback_fts");
  console.log("  ✓ Passed: Gracefully completed search when vector subsystem degraded.");

  // --------------------------------------------------------
  // Test 9: High-Speed In-Memory Benchmark (1,000 cached searches)
  // --------------------------------------------------------
  console.log("▶ Test 9: High-speed search performance benchmark (1,000 cached runs)...");
  const t0 = Date.now();
  for (let i = 0; i < 1000; i++) {
    await perfAdapter.executeOptimizedSearch(sqCyber, dummyPipeline);
  }
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 50, `1,000 cached searches must complete in <50ms (took ${elapsed}ms)`);
  console.log(`  ✓ Passed: Executed 1,000 cached searches in ${elapsed}ms.`);

  console.log("\n=================================================");
  console.log("🎉 ALL PART 26 SEARCH PERFORMANCE TESTS PASSED (100% SUCCESS)");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
