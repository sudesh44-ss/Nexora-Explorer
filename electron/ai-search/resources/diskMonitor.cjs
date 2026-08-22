"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Monitors disk storage pressure for the indexed root or app data directory
 */
class DiskMonitor {
  constructor(targetDir = null) {
    this.targetDir = targetDir || os.homedir();
  }

  /**
   * Samples disk free space where fs.statfs is supported
   * @param {string} [customPath]
   * @returns {Promise<{freeBytes: number|null, totalBytes: number|null, isLowDisk: boolean}>}
   */
  async sample(customPath = null) {
    const dir = customPath || this.targetDir;
    try {
      if (typeof fs.promises?.statfs === "function") {
        const stats = await fs.promises.statfs(dir);
        const freeBytes = stats.bsize * stats.bavail;
        const totalBytes = stats.bsize * stats.blocks;
        const isLowDisk = freeBytes < (500 * 1024 * 1024); // Less than 500 MB

        return {
          freeBytes,
          totalBytes,
          isLowDisk,
          available: true,
        };
      }
    } catch {}

    // Fallback: Return available=false when not supported by environment
    return {
      freeBytes: null,
      totalBytes: null,
      isLowDisk: false,
      available: false,
    };
  }
}

module.exports = {
  DiskMonitor,
};
