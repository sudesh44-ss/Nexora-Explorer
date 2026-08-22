"use strict";

const { createSearchResult } = require("../search/searchResult.cjs");

class SearchResultNormalizer {
  /**
   * Normalizes candidate signals and file metadata into final SearchResult objects
   */
  static normalize(rankedCandidates, db) {
    const results = [];

    for (const item of rankedCandidates) {
      const fileRec = db?.files ? db.files.findByFileId(item.fileId) : null;
      if (!fileRec) continue;

      // Deduplicate matchedBy tags
      const matchedBy = Array.from(new Set(item.signals.map((s) => s.source)));

      results.push(createSearchResult({
        fileId: fileRec.file_id,
        name: fileRec.name,
        path: fileRec.path,
        extension: fileRec.extension,
        mimeType: fileRec.mime_type,
        size: fileRec.size,
        modifiedAt: fileRec.modified_at,
        score: item.finalScore,
        matchedBy,
        scoreBreakdown: {
          signalsCount: item.signals.length,
          primarySource: item.signals[0]?.source || "unknown",
        },
      }));
    }

    return results;
  }
}

module.exports = {
  SearchResultNormalizer,
};
