"use strict";

class BenchmarkResourceUsage {
  /**
   * Captures snapshot of process memory usage
   */
  static snapshot() {
    try {
      const mem = process.memoryUsage();
      return {
        heapUsedMB: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
        heapTotalMB: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
        rssMB: Number((mem.rss / (1024 * 1024)).toFixed(2)),
        timestamp: Date.now(),
      };
    } catch {
      return { heapUsedMB: 0, heapTotalMB: 0, rssMB: 0, timestamp: Date.now() };
    }
  }
}

module.exports = {
  BenchmarkResourceUsage,
};
