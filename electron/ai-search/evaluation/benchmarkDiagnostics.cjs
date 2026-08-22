"use strict";

class BenchmarkDiagnostics {
  /**
   * Compares current benchmark summary against baseline to detect regressions
   */
  static compareWithBaseline(currentSummary = {}, baselineSummary = {}) {
    const regressions = [];
    const improvements = [];

    // 1. Latency check (P95)
    const currP95 = currentSummary.latency?.cold?.p95 || 0;
    const baseP95 = baselineSummary.latency?.cold?.p95 || 0;
    if (baseP95 > 0 && currP95 > baseP95 * 1.25) {
      regressions.push(`P95 cold latency degraded from ${baseP95}ms to ${currP95}ms (+${Math.round(((currP95 - baseP95) / baseP95) * 100)}%)`);
    } else if (baseP95 > 0 && currP95 < baseP95 * 0.8) {
      improvements.push(`P95 cold latency improved from ${baseP95}ms to ${currP95}ms`);
    }

    // 2. Ranking Quality check (Mean NDCG)
    const currNdcg = currentSummary.ranking?.meanNDCG || 0;
    const baseNdcg = baselineSummary.ranking?.meanNDCG || 0;
    if (baseNdcg > 0 && currNdcg < baseNdcg - 0.05) {
      regressions.push(`Mean NDCG dropped from ${baseNdcg} to ${currNdcg}`);
    } else if (baseNdcg > 0 && currNdcg > baseNdcg + 0.05) {
      improvements.push(`Mean NDCG improved from ${baseNdcg} to ${currNdcg}`);
    }

    // 3. Error rate check
    const currErrors = currentSummary.errorRate || 0;
    if (currErrors > 0) {
      regressions.push(`Search errors detected (${currErrors}% failure rate)`);
    }

    return {
      hasRegressions: regressions.length > 0,
      regressions,
      improvements,
      status: regressions.length > 0 ? "REGRESSION_DETECTED" : "PASS",
    };
  }
}

module.exports = {
  BenchmarkDiagnostics,
};
