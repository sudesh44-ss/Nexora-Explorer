"use strict";

const path = require("path");

class PathGuard {
  /**
   * Checks if a target path safely resides within an allowed root directory
   */
  static isPathInsideRoot(targetPath, rootPath) {
    if (typeof targetPath !== "string" || typeof rootPath !== "string") return false;

    // Normalize paths
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(rootPath);

    // Compute relative path
    const rel = path.relative(resolvedRoot, resolvedTarget);

    // If relative path starts with '..' or is absolute (on windows when crossing drives), it is outside root
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return false;
    }

    return true;
  }

  /**
   * Sanitizes a path string against directory traversal sequences
   */
  static sanitizePath(p = "") {
    if (typeof p !== "string") return "";
    return path.normalize(p).replace(/^(\.\.[\/\\])+/, "");
  }
}

module.exports = {
  PathGuard,
};
