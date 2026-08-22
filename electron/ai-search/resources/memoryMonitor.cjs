"use strict";

const os = require("os");

/**
 * Monitors system RAM usage and memory pressure
 */
class MemoryMonitor {
  /**
   * Samples current system memory metrics
   * @returns {{totalBytes: number, freeBytes: number, usedBytes: number, usagePercent: number}}
   */
  sample() {
    try {
      const total = os.totalmem() || 0;
      const free = os.freemem() || 0;
      const used = Math.max(0, total - free);
      const usagePercent = total > 0 ? Math.max(0, Math.min(100, Math.round((used / total) * 100))) : 0;

      return {
        totalBytes: total,
        freeBytes: free,
        usedBytes: used,
        usagePercent,
      };
    } catch {
      return {
        totalBytes: 0,
        freeBytes: 0,
        usedBytes: 0,
        usagePercent: 0,
      };
    }
  }
}

module.exports = {
  MemoryMonitor,
};
