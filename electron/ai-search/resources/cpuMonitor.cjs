"use strict";

const os = require("os");

/**
 * Monitors CPU usage percentage across system cores using delta differential
 */
class CpuMonitor {
  constructor() {
    this._prevTimes = this._getSnapshot();
  }

  _getSnapshot() {
    try {
      const cpus = os.cpus();
      if (!cpus || cpus.length === 0) return null;

      let idle = 0;
      let total = 0;

      for (const cpu of cpus) {
        for (const type in cpu.times) {
          total += cpu.times[type];
        }
        idle += cpu.times.idle;
      }

      return { idle, total };
    } catch {
      return null;
    }
  }

  /**
   * Computes CPU utilization percentage since previous sample
   * @returns {number} CPU usage percent (0 - 100) or 0 on error
   */
  sample() {
    const current = this._getSnapshot();
    if (!current || !this._prevTimes) {
      this._prevTimes = current;
      return 0;
    }

    const idleDelta = current.idle - this._prevTimes.idle;
    const totalDelta = current.total - this._prevTimes.total;
    this._prevTimes = current;

    if (totalDelta <= 0) {
      return 0;
    }

    const usageRatio = 1 - (idleDelta / totalDelta);
    const usagePercent = Math.max(0, Math.min(100, Math.round(usageRatio * 100)));
    return usagePercent;
  }
}

module.exports = {
  CpuMonitor,
};
