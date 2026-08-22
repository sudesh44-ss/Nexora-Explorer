"use strict";

class FolderHintDetector {
  /**
   * Detects explicit folder context hints from natural query
   *
   * @param {string} normalizedQuery
   * @param {Array<string>} concepts
   * @returns {Array<string>} folderHints
   */
  static detect(normalizedQuery, concepts = []) {
    if (!normalizedQuery) return [];

    const hints = new Set();

    // 1. Explicit folder: syntax
    const prefixMatch = normalizedQuery.match(/folder:([a-zA-Z0-9_\-\/\\]+)/i);
    if (prefixMatch && prefixMatch[1]) {
      hints.add(prefixMatch[1]);
    }

    // 2. Pattern: "<name> folder" or "<name> directory"
    const folderPattern = /([a-zA-Z0-9_\-]+)\s+(?:folder|directory)/gi;
    let match;
    while ((match = folderPattern.exec(normalizedQuery)) !== null) {
      if (match[1] && !["the", "a", "in", "my", "this"].includes(match[1].toLowerCase())) {
        hints.add(match[1]);
      }
    }

    // 3. Natural pattern: "<name> mein" or "<name> me" or "in <name>" or "<name> में"
    const inFolderPattern = /\b(?:in\s+([a-zA-Z0-9_\-]+)|([a-zA-Z0-9_\-\u0900-\u097F]+)\s+(?:mein|me|mai|में))\b/gi;
    while ((match = inFolderPattern.exec(normalizedQuery)) !== null) {
      const folderCandidate = match[1] || match[2];
      if (folderCandidate && !["the", "a", "my", "this", "all", "sab", "sabhi"].includes(folderCandidate.toLowerCase())) {
        hints.add(folderCandidate);
      }
    }

    // 4. Path-like hints with slashes: e.g. "College/Cybersecurity"
    const pathPattern = /([a-zA-Z0-9_\-]+[\/\\][a-zA-Z0-9_\-]+)/g;
    while ((match = pathPattern.exec(normalizedQuery)) !== null) {
      if (match[1]) {
        hints.add(match[1]);
      }
    }

    return Array.from(hints);
  }
}

module.exports = {
  FolderHintDetector,
};
