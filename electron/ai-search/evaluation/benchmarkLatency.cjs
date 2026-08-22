"use strict";

class BenchmarkLatency {
  constructor() {
    this.coldLatencies = [];
    this.warmLatencies = [];
  }

  record(latencyMs, isWarm = false) {
    if (typeof latencyMs !== "number" || isNaN(latencyMs)) return;
    if (isWarm) {
      this.warmLatencies.push(latencyMs);
    } else {
      this.coldLatencies.push(latencyMs);
    }
  }

  static calculateStats(samples = []) {
    if (samples.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = samples.slice().sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);

    const percentile = (p) => {
      const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
      return sorted[Math.max(0, idx)];
    };

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: Number((sum / sorted.length).toFixed(2)),
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  getSummary() {
    return {
      cold: BenchmarkLatency.calculateStats(this.coldLatencies),
      warm: BenchmarkLatency.calculateStats(this.warmLatencies),
      totalSamples: this.coldLatencies.length + this.warmLatencies.length,
    };
  }

  reset() {
    this.coldLatencies = [];
    this.warmLatencies = [];
  }
}

module.exports = {
  BenchmarkLatency,
};
