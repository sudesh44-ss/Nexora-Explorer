"use strict";

const { BENCHMARK_DATASET } = require("./benchmarkDataset.cjs");
const { BenchmarkMetrics } = require("./benchmarkMetrics.cjs");
const { BenchmarkLatency } = require("./benchmarkLatency.cjs");
const { BenchmarkTelemetry } = require("./benchmarkTelemetry.cjs");
const { BenchmarkResourceUsage } = require("./benchmarkResourceUsage.cjs");
const { BenchmarkReporter } = require("./benchmarkReporter.cjs");

class BenchmarkRunner {
  constructor(options = {}) {
    this.dataset = options.dataset || BENCHMARK_DATASET;
    this.latency = new BenchmarkLatency();
    this.telemetry = new BenchmarkTelemetry(options);
    this.mode = options.mode || "BALANCED";
  }

  /**
   * Executes the full evaluation suite against a search pipeline function
   *
   * @param {Function} searchPipelineFn - Async function (query, context, options) returning search results
   * @returns {Promise<Object>} Full evaluation results
   */
  async runEvaluation(searchPipelineFn) {
    this.latency.reset();
    this.telemetry.clear();

    const rankingScores = {
      precision1: [],
      precision5: [],
      mrr: [],
      ndcg5: [],
      recall10: [],
    };

    let totalQueries = 0;
    let successfulQueries = 0;

    for (const item of this.dataset) {
      totalQueries++;
      const expectedMap = new Map();
      for (const exp of item.expected) {
        expectedMap.set(String(exp.fileId), exp.relevance);
      }

      try {
        // 1. Cold search run (Cache MISS)
        const t0Cold = Date.now();
        const coldResults = await searchPipelineFn(item.query, item.context, {
          mode: this.mode,
          useCache: false,
          requestId: `bench_cold_${item.id}`,
        });
        const coldElapsed = Date.now() - t0Cold;
        this.latency.record(coldElapsed, false);

        this.telemetry.logSearchEvent({
          requestId: `bench_cold_${item.id}`,
          category: item.category,
          mode: this.mode,
          cacheStatus: "MISS",
          latencyMs: coldElapsed,
          resultCount: Array.isArray(coldResults) ? coldResults.length : 0,
        });

        // 2. Warm search run (Cache HIT)
        const t0Warm = Date.now();
        const warmResults = await searchPipelineFn(item.query, item.context, {
          mode: this.mode,
          useCache: true,
          requestId: `bench_warm_${item.id}`,
        });
        const warmElapsed = Date.now() - t0Warm;
        this.latency.record(warmElapsed, true);

        this.telemetry.logSearchEvent({
          requestId: `bench_warm_${item.id}`,
          category: item.category,
          mode: this.mode,
          cacheStatus: "HIT",
          latencyMs: warmElapsed,
          resultCount: Array.isArray(warmResults) ? warmResults.length : 0,
        });

        // 3. Compute Ranking Metrics on cold results
        const retrievedIds = (Array.isArray(coldResults) ? coldResults : []).map((r) => String(r.fileId || r.id));

        if (item.expected.length > 0) {
          rankingScores.precision1.push(BenchmarkMetrics.precisionAtK(retrievedIds, expectedMap, 1));
          rankingScores.precision5.push(BenchmarkMetrics.precisionAtK(retrievedIds, expectedMap, 5));
          rankingScores.mrr.push(BenchmarkMetrics.reciprocalRank(retrievedIds, expectedMap));
          rankingScores.ndcg5.push(BenchmarkMetrics.ndcgAtK(retrievedIds, expectedMap, 5));
          rankingScores.recall10.push(BenchmarkMetrics.recallAtK(retrievedIds, expectedMap, 10));
        }

        successfulQueries++;
      } catch (err) {
        this.telemetry.logSearchEvent({
          requestId: `bench_${item.id}`,
          category: item.category,
          mode: this.mode,
          success: false,
          error: err.message,
        });
      }
    }

    const avg = (arr) => (arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)) : 1.0);

    const results = {
      summary: {
        totalQueries,
        successfulQueries,
        successRate: Number(((successfulQueries / totalQueries) * 100).toFixed(1)),
      },
      latency: this.latency.getSummary(),
      ranking: {
        precisionAt1: avg(rankingScores.precision1),
        precisionAt5: avg(rankingScores.precision5),
        meanMRR: avg(rankingScores.mrr),
        meanNDCG: avg(rankingScores.ndcg5),
        recallAt10: avg(rankingScores.recall10),
      },
      telemetry: this.telemetry.getEvents(),
      system: {
        ...BenchmarkResourceUsage.snapshot(),
        mode: this.mode,
      },
    };

    results.markdownReport = BenchmarkReporter.generateMarkdownReport(results);
    return results;
  }
}

module.exports = {
  BenchmarkRunner,
};
