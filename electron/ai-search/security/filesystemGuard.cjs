"use strict";

const fs = require("fs");

class FilesystemGuard {
  /**
   * Safely reads a file with error protection and size bounding
   */
  static safeReadFile(filePath, maxBytes = 10 * 1024 * 1024) {
    try {
      if (!fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      if (stat.size > maxBytes) {
        // Stream or slice head to protect memory
        const fd = fs.openSync(filePath, "r");
        const buffer = Buffer.alloc(maxBytes);
        fs.readSync(fd, buffer, 0, maxBytes, 0);
        fs.closeSync(fd);
        return buffer.toString("utf8");
      }
      return fs.readFileSync(filePath, "utf8");
    } catch {
      return null;
    }
  }

  /**
   * Safely checks file existence
   */
  static safeExists(filePath) {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

module.exports = {
  FilesystemGuard,
};
