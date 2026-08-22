"use strict";

const { QueryIntent } = require("./querySchema.cjs");

/**
 * Detects search intent from query tokens and detected file types
 */
class IntentDetector {
  static detect(normalizedQuery, detectedFileTypes = []) {
    if (!normalizedQuery) {
      return { intent: QueryIntent.SEARCH_FILES, confidence: 1.0 };
    }

    const tokens = normalizedQuery.split(/\s+/);

    // 1. Folder Intent
    const folderTokens = ["folder", "folders", "directory", "directories", "dir"];
    if (tokens.some((t) => folderTokens.includes(t))) {
      return { intent: QueryIntent.SEARCH_FOLDERS, confidence: 0.95 };
    }

    // 2. Specific media category intents
    if (detectedFileTypes.length === 1) {
      const type = detectedFileTypes[0];
      if (type === "image") return { intent: QueryIntent.SEARCH_IMAGES, confidence: 0.95 };
      if (type === "video") return { intent: QueryIntent.SEARCH_VIDEOS, confidence: 0.95 };
      if (type === "audio") return { intent: QueryIntent.SEARCH_AUDIO, confidence: 0.95 };
      if (type === "pdf" || type === "docx" || type === "document") {
        return { intent: QueryIntent.SEARCH_DOCUMENTS, confidence: 0.95 };
      }
      if (type === "code") return { intent: QueryIntent.SEARCH_CODE, confidence: 0.95 };
    }

    // Default least-assumptive general search
    return { intent: QueryIntent.SEARCH_FILES, confidence: 0.90 };
  }
}

module.exports = {
  IntentDetector,
};
