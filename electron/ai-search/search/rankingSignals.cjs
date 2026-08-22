"use strict";

const EXTENSION_CATEGORIES = {
  pdf: [".pdf"],
  image: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".ico"],
  video: [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv"],
  audio: [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a"],
  docx: [".docx", ".doc"],
  document: [".pdf", ".docx", ".doc", ".txt", ".md", ".rtf", ".odt"],
  code: [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".c", ".cpp", ".cs", ".html", ".css", ".json", ".sql"],
  archive: [".zip", ".rar", ".7z", ".tar", ".gz"],
};

class RankingSignals {
  /**
   * Computes file type match score
   *
   * @param {Object} fileRecord
   * @param {Array<string>} requestedTypes
   * @returns {number} 1.0 (match / neutral), 0.0 (mismatch)
   */
  static computeFileTypeScore(fileRecord, requestedTypes = []) {
    if (!requestedTypes || requestedTypes.length === 0) {
      return 1.0; // Neutral: query didn't request a specific type
    }

    if (!fileRecord || !fileRecord.extension) {
      return 0.0;
    }

    const ext = fileRecord.extension.toLowerCase();

    for (const req of requestedTypes) {
      const lower = req.toLowerCase();
      const singular = lower.replace(/s$/, "");
      const allowedExts = EXTENSION_CATEGORIES[lower] || EXTENSION_CATEGORIES[singular];
      if (allowedExts && allowedExts.includes(ext)) {
        return 1.0;
      }
      if (ext === `.${lower}` || ext === `.${singular}`) {
        return 1.0;
      }
    }

    return 0.0;
  }

  /**
   * Computes folder path relevance score
   *
   * @param {Object} fileRecord
   * @param {Array<string>} queryKeywords
   * @returns {number} 0.0 to 1.0
   */
  static computeFolderScore(fileRecord, queryKeywords = []) {
    if (!fileRecord || !fileRecord.path || !queryKeywords || queryKeywords.length === 0) {
      return 0.0;
    }

    const lowerPath = fileRecord.path.toLowerCase();
    let matches = 0;

    for (const kw of queryKeywords) {
      if (kw.length >= 3 && lowerPath.includes(kw.toLowerCase())) {
        matches++;
      }
    }

    return matches > 0 ? Math.min(1.0, 0.5 + (matches * 0.25)) : 0.0;
  }
}

module.exports = {
  RankingSignals,
  EXTENSION_CATEGORIES,
};
