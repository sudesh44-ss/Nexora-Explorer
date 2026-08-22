"use strict";

class PerformanceDiagnostics {
  /**
   * Generates a performance diagnostics report
   */
  static generateReport(timings = {}, cacheStats = {}, memoryStats = {}) {
    const totalMs = Object.values(timings).reduce((sum, v) => (typeof v === "number" ? sum + v : sum), 0);

    return {
      totalMs,
      stages: timings,
      cache: cacheStats,
      memory: memoryStats,
    };
  }
}

module.exports = {
  PerformanceDiagnostics,
};
