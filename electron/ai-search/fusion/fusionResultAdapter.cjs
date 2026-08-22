"use strict";

const { createSearchResult } = require("../search/searchResult.cjs");

class FusionResultAdapter {
  /**
   * Adapts Part 17 ranked candidate into standard SearchResult schema with multimodal provenance
   */
  static adapt(rankedCandidate, evidence = null) {
    if (!rankedCandidate) return null;

    const fileRec = rankedCandidate.fileRecord || {};
    const matchedBy = Array.isArray(rankedCandidate.matchedBy) && rankedCandidate.matchedBy.length > 0
      ? rankedCandidate.matchedBy
      : (evidence?.sources?.length > 0 ? Array.from(evidence.sources) : ["keyword"]);

    return createSearchResult({
      fileId: rankedCandidate.fileId || fileRec.file_id,
      name: fileRec.name || "",
      path: fileRec.path || "",
      extension: fileRec.extension || "",
      mimeType: fileRec.mime_type || "application/octet-stream",
      size: fileRec.size || 0,
      modifiedAt: fileRec.modified_at || null,
      score: rankedCandidate.score || 0,
      matchedBy,
      scoreBreakdown: {
        ...(rankedCandidate.scoreBreakdown || {}),
        bestMatchTimestamp: evidence?.bestMatchTimestamp || rankedCandidate.scoreBreakdown?.bestMatchTimestamp || null,
        modality: rankedCandidate.modality || "document",
      },
    });
  }
}

module.exports = {
  FusionResultAdapter,
};
