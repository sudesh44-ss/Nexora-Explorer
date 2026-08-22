"use strict";

class MemoryGuard {
  constructor(options = {}) {
    this.memoryThresholdMB = options.memoryThresholdMB || 500; // 500 MB heap threshold
  }

  /**
   * Checks if system is under memory pressure
   */
  isUnderPressure() {
    try {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / (1024 * 1024);
      return heapUsedMB > this.memoryThresholdMB;
    } catch {
      return false;
    }
  }

  /**
   * Adjusts candidate limits under memory pressure
   */
  adjustLimits(limits, isPressure = false) {
    if (!isPressure && !this.isUnderPressure()) return limits;

    return {
      retrievalK: Math.max(50, Math.floor(limits.retrievalK * 0.5)),
      rankingK: Math.max(25, Math.floor(limits.rankingK * 0.5)),
      displayK: limits.displayK,
    };
  }
}

module.exports = {
  MemoryGuard,
};
