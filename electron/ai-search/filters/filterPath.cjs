"use strict";

const path = require("path");

class FilterPath {
  /**
   * Cleans and validates path input, preventing path traversal
   */
  static sanitize(rawPath) {
    if (!rawPath || typeof rawPath !== "string") return null;

    let clean = rawPath.trim().replace(/^['"]|['"]$/g, "");

    // 1. Path traversal / protocol checks
    if (clean.includes("..") || clean.startsWith("file:///") || /(?:^|[\\\/])\.\.(?:[\\\/]|$)/.test(clean)) {
      return null; // Path traversal attempt detected
    }

    // 2. Normalize slashes
    clean = clean.replace(/\\/g, "/");

    return clean;
  }

  /**
   * Evaluates if a fileRecord's path belongs inside the specified folder/path filter
   */
  static matches(filePath, folderOrPathFilter) {
    if (!filePath || !folderOrPathFilter) return false;

    const normFile = filePath.replace(/\\/g, "/").toLowerCase();
    const normFilter = folderOrPathFilter.replace(/\\/g, "/").toLowerCase();

    return normFile.includes(normFilter);
  }
}

module.exports = {
  FilterPath,
};
