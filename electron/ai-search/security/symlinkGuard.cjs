"use strict";

const fs = require("fs");

class SymlinkGuard {
  constructor() {
    this.visitedCanonicalPaths = new Set();
  }

  /**
   * Checks if a path has already been visited (detects loops)
   *
   * @param {string} rawPath - Directory or file path
   * @returns {boolean} True if loop or already visited
   */
  isLoopOrVisited(rawPath) {
    try {
      if (!fs.existsSync(rawPath)) return false;
      const real = fs.realpathSync(rawPath);
      if (this.visitedCanonicalPaths.has(real)) {
        return true; // Loop detected
      }
      this.visitedCanonicalPaths.add(real);
      return false;
    } catch {
      return false;
    }
  }

  clear() {
    this.visitedCanonicalPaths.clear();
  }
}

module.exports = {
  SymlinkGuard,
};
