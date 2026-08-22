"use strict";

const assert = require("assert");
const aiSearch = require("../electron/ai-search/index.cjs");
const {
  BenchmarkRunner,
  BENCHMARK_DATASET,
  BenchmarkMetrics,
  BenchmarkLatency,
  BenchmarkTelemetry,
  BenchmarkResourceUsage,
  BenchmarkSchema,
  BenchmarkDiagnostics,
} = aiSearch.evaluation;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA SEARCH EVALUATION TEST SUITE");
  console.log("=================================================\n");

  // --------------------------------------------------------
  // Test 1: Benchmark Schema Validation
  // --------------------------------------------------------
  console.log("▶ Test 1: Benchmark query schema validation...");
  const validQuery = {
    id: "q_001",
    query: "cybersecurity",
    category: "lexical",
    expected: [{ fileId: "doc_1", relevance: 3 }],
  };
  assert.strictEqual(BenchmarkSchema.validateQuery(validQuery), true);
  assert.strictEqual(BenchmarkSchema.validateQuery({ invalid: true }), false);
  console.log("  ✓ Passed: Validated compliant benchmark query schemas.");

  // --------------------------------------------------------
  // Test 2: Ranking Metrics (Precision, Recall, MRR, NDCG)
  // --------------------------------------------------------
  console.log("▶ Test 2: IR metrics computation (Precision, Recall, MRR, NDCG)...");
  const expectedMap = new Map([
    ["doc_1", 3],
    ["doc_2", 2],
    ["doc_3", 1],
  ]);

  const retrievedIds = ["doc_1", "doc_99", "doc_2", "doc_100", "doc_3"];
  const p1 = BenchmarkMetrics.precisionAtK(retrievedIds, expectedMap, 1);
  const p5 = BenchmarkMetrics.precisionAtK(retrievedIds, expectedMap, 5);
  const mrr = BenchmarkMetrics.reciprocalRank(retrievedIds, expectedMap);
  const ndcg5 = BenchmarkMetrics.ndcgAtK(retrievedIds, expectedMap, 5);
  const recall5 = BenchmarkMetrics.recallAtK(retrievedIds, expectedMap, 5);

  assert.strictEqual(p1, 1.0); // doc_1 is relevant
  assert.strictEqual(p5, 3 / 5); // 3 out of 5 relevant
  assert.strictEqual(mrr, 1.0); // 1st rank is relevant
  assert.ok(ndcg5 > 0.8 && ndcg5 <= 1.0);
  assert.strictEqual(recall5, 1.0); // all 3 found in top 5
  console.log(`  ✓ Passed: Precision@5=${p5}, MRR=${mrr}, NDCG@5=${ndcg5.toFixed(2)}, Recall@5=${recall5}.`);

  // --------------------------------------------------------
  // Test 3: Latency & Percentiles
  // --------------------------------------------------------
  console.log("▶ Test 3: Latency metrics and percentile calculations...");
  const latencyTracker = new BenchmarkLatency();
  for (let i = 1; i <= 100; i++) {
    latencyTracker.record(i, false); // Cold 1-100ms
    latencyTracker.record(Math.floor(i / 10), true); // Warm 0-10ms
  }
  const latSummary = latencyTracker.getSummary();
  assert.strictEqual(latSummary.cold.count, 100);
  assert.strictEqual(latSummary.cold.p50, 50);
  assert.strictEqual(latSummary.cold.p95, 95);
  assert.strictEqual(latSummary.cold.p99, 99);
  assert.strictEqual(latSummary.warm.count, 100);
  console.log(`  ✓ Passed: Cold P50=${latSummary.cold.p50}ms, P95=${latSummary.cold.p95}ms, Warm P95=${latSummary.warm.p95}ms.`);

  // --------------------------------------------------------
  // Test 4: Local Telemetry Logging
  // --------------------------------------------------------
  console.log("▶ Test 4: Privacy-safe local telemetry logging...");
  const telemetry = new BenchmarkTelemetry({ maxEvents: 50 });
  telemetry.logSearchEvent({
    requestId: "req_bench_1",
    category: "lexical",
    mode: "BALANCED",
    latencyMs: 12,
    resultCount: 5,
  });
  const events = telemetry.getEvents();
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].requestId, "req_bench_1");
  console.log("  ✓ Passed: Logged structured search telemetry event.");

  // --------------------------------------------------------
  // Test 5: Resource Usage Snapshot
  // --------------------------------------------------------
  console.log("▶ Test 5: Resource telemetry memory snapshot...");
  const memSnapshot = BenchmarkResourceUsage.snapshot();
  assert.ok(memSnapshot.heapUsedMB > 0);
  assert.ok(memSnapshot.rssMB > 0);
  console.log(`  ✓ Passed: Heap=${memSnapshot.heapUsedMB} MB, RSS=${memSnapshot.rssMB} MB.`);

  // --------------------------------------------------------
  // Test 6: Regression Diagnostics
  // --------------------------------------------------------
  console.log("▶ Test 6: Benchmark regression comparison against baseline...");
  const baseline = {
    latency: { cold: { p95: 20 } },
    ranking: { meanNDCG: 0.95 },
    errorRate: 0,
  };
  const goodRun = {
    latency: { cold: { p95: 18 } },
    ranking: { meanNDCG: 0.96 },
    errorRate: 0,
  };
  const regressedRun = {
    latency: { cold: { p95: 50 } }, // +150% latency
    ranking: { meanNDCG: 0.80 }, // NDCG drop > 0.05
    errorRate: 2,
  };

  const goodCheck = BenchmarkDiagnostics.compareWithBaseline(goodRun, baseline);
  assert.strictEqual(goodCheck.hasRegressions, false);

  const regressedCheck = BenchmarkDiagnostics.compareWithBaseline(regressedRun, baseline);
  assert.strictEqual(regressedCheck.hasRegressions, true);
  assert.ok(regressedCheck.regressions.length >= 2);
  console.log("  ✓ Passed: Detected simulated latency and ranking regressions accurately.");

  // --------------------------------------------------------
  // Test 7: Full Benchmark Runner Execution
  // --------------------------------------------------------
  console.log("▶ Test 7: End-to-end benchmark harness execution across query dataset...");
  const mockSearchEngine = async (query, context, options) => {
    // Return expected mock items
    if (query.includes("cybersecurity") || query.includes("cybersecurty")) {
      return [{ fileId: "doc_cyber_1", score: 0.95 }, { fileId: "doc_cyber_2", score: 0.85 }];
    }
    if (query.includes("network security")) {
      return [{ fileId: "doc_net_sec", score: 0.98 }];
    }
    if (query.includes("firewall")) {
      return [{ fileId: "doc_firewall", score: 0.92 }, { fileId: "vid_firewall_lecture", score: 0.88 }];
    }
    if (query.includes("birthday")) {
      return [{ fileId: "img_birthday_cake", score: 0.91 }];
    }
    if (query.includes("short")) {
      return [{ fileId: "vid_cyber_short", score: 0.89 }];
    }
    if (query.includes("diagram")) {
      return [{ fileId: "img_server_diagram", score: 0.93 }];
    }
    if (query.includes("lecture")) {
      return [{ fileId: "vid_long_lecture", score: 0.90 }];
    }
    return [];
  };

  const runner = new BenchmarkRunner({ dataset: BENCHMARK_DATASET, mode: "BALANCED" });
  const report = await runner.runEvaluation(mockSearchEngine);

  assert.strictEqual(report.summary.totalQueries, BENCHMARK_DATASET.length);
  assert.strictEqual(report.summary.successRate, 100);
  assert.ok(report.ranking.meanNDCG >= 0.9);
  assert.ok(report.markdownReport.length > 100);
  console.log(`  ✓ Passed: Completed benchmark across ${report.summary.totalQueries} queries (Success rate: ${report.summary.successRate}%, Mean NDCG: ${report.ranking.meanNDCG}).`);

  console.log("\n=================================================");
  console.log("🎉 ALL PART 27 SEARCH EVALUATION TESTS PASSED (100% SUCCESS)");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
