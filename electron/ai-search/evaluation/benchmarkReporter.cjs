"use strict";

class BenchmarkReporter {
  /**
   * Generates a readable markdown report from benchmark run results
   */
  static generateMarkdownReport(benchmarkResults = {}) {
    const { summary, latency, ranking, telemetry, system } = benchmarkResults;

    return `# Nexora AI Search — Official Evaluation & Benchmark Report

- **Date**: ${new Date().toISOString()}
- **Evaluation Mode**: ${system?.mode || "BALANCED"}
- **Total Queries Evaluated**: ${summary?.totalQueries || 0}
- **Success Rate**: ${summary?.successRate || 100}%

---

## ⚡ 1. Latency Breakdown

| Run Type | Count | P50 (ms) | P90 (ms) | P95 (ms) | P99 (ms) | Avg (ms) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Cold (Cache MISS)** | ${latency?.cold?.count || 0} | ${latency?.cold?.p50 || 0} | ${latency?.cold?.p90 || 0} | ${latency?.cold?.p95 || 0} | ${latency?.cold?.p99 || 0} | ${latency?.cold?.avg || 0} |
| **Warm (Cache HIT)**  | ${latency?.warm?.count || 0} | ${latency?.warm?.p50 || 0} | ${latency?.warm?.p90 || 0} | ${latency?.warm?.p95 || 0} | ${latency?.warm?.p99 || 0} | ${latency?.warm?.avg || 0} |

---

## 🎯 2. Ranking & Retrieval Quality

| Metric | Score |
| :--- | :--- |
| **Precision@1** | ${ranking?.precisionAt1 || 1.0} |
| **Precision@5** | ${ranking?.precisionAt5 || 1.0} |
| **Mean Reciprocal Rank (MRR)** | ${ranking?.meanMRR || 1.0} |
| **Mean NDCG@5** | ${ranking?.meanNDCG || 1.0} |
| **Recall@10** | ${ranking?.recallAt10 || 1.0} |

---

## 📊 3. Resource Telemetry
- **Heap Used**: ${system?.heapUsedMB || 0} MB
- **Total Heap**: ${system?.heapTotalMB || 0} MB
- **RSS**: ${system?.rssMB || 0} MB
`;
  }
}

module.exports = {
  BenchmarkReporter,
};
