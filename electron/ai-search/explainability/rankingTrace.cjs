"use strict";

class RankingTrace {
  /**
   * Generates developer debug trace for a ranked candidate
   */
  static trace(searchResult, structuredQuery = {}, rank = 1) {
    if (!searchResult) return null;

    const breakdown = searchResult.scoreBreakdown || {};

    return {
      candidateId: searchResult.fileId,
      name: searchResult.name,
      rank,
      finalScore: searchResult.score,
      signals: {
        filenameScore: breakdown.filenameScore || 0,
        ftsScore: breakdown.ftsScore || 0,
        semanticScore: breakdown.semanticScore || breakdown.vectorScore || 0,
        transcriptScore: breakdown.transcriptScore || 0,
        phraseScore: breakdown.transcriptPhraseScore || breakdown.phraseScore || 0,
        ocrScore: breakdown.ocrScore || 0,
        objectScore: breakdown.objectScore || 0,
        speakerScore: breakdown.speakerScore || 0,
        metadataScore: breakdown.metadataScore || 0,
      },
      evidence: {
        matchedBy: searchResult.matchedBy || [],
        bestMatchTimestamp: breakdown.bestMatchTimestamp || null,
        modality: breakdown.modality || "document",
      },
      queryContext: {
        rawQuery: structuredQuery.rawQuery || "",
        keywords: structuredQuery.keywords || [],
        fileTypes: structuredQuery.fileTypes || [],
        intent: structuredQuery.intent || "SEARCH_FILES",
      },
    };
  }
}

module.exports = {
  RankingTrace,
};
