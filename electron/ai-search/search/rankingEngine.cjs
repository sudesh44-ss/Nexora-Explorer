"use strict";

const { RankingSignals } = require("./rankingSignals.cjs");
const { ScoreNormalizer } = require("./scoreNormalizer.cjs");
const { getSearchConfig } = require("./searchConfig.cjs");

/**
 * Hybrid Ranking Engine combining semantic, keyword, type, folder, and metadata signals
 */
class RankingEngine {
  /**
   * Ranks candidates based on weighted multi-signal scoring
   *
   * @param {Array<Object>} candidates - Merged candidate list
   * @param {Object} searchQuery - SearchQuery object
   * @param {Map<string, Object>} fileRecordsMap - Map of fileId -> FileRecord
   * @param {Object} [options]
   * @returns {Array<Object>} Ranked candidates
   */
  static rank(candidates = [], searchQuery = {}, fileRecordsMap = new Map(), options = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    const config = getSearchConfig(options);
    const weights = config.rankingWeights;
    const requestedTypes = searchQuery.filters?.fileTypes || [];
    const queryKeywords = searchQuery.keywords || [];

    // 1. Normalize batch scores
    const normalizedCandidates = ScoreNormalizer.normalizeBatch(candidates);

    const scored = [];

    // 2. Score each candidate
    for (const c of normalizedCandidates) {
      const fileRecord = fileRecordsMap.get(c.fileId) || c.extra?.fileRecord || null;

      // File Type Score & Hard Filter check
      const typeScore = RankingSignals.computeFileTypeScore(fileRecord, requestedTypes);
      if (requestedTypes.length > 0 && typeScore === 0.0) {
        // Explicit type filter requested, but file does not match -> exclude
        continue;
      }

      // Folder Score
      const folderScore = RankingSignals.computeFolderScore(fileRecord, queryKeywords);

      // Signal scores
      const semScore = c.normalizedScores?.semantic || 0;
      const kwScore = c.normalizedScores?.keyword || 0;
      const metaScore = c.normalizedScores?.metadata || 0;

      // Weighted combination
      const finalScore = Number((
        (weights.semantic * semScore) +
        (weights.keyword * kwScore) +
        (weights.fileType * typeScore) +
        (weights.folder * folderScore) +
        (weights.metadata * metaScore)
      ).toFixed(6));

      if (finalScore >= config.minFinalScore) {
        // Compile matchedBy signals
        const matchedBy = [];
        if (semScore > 0.1) matchedBy.push("semantic");
        if (kwScore > 0.1 || c.sources.includes("fts")) matchedBy.push("keyword");
        if (typeScore > 0.5 && requestedTypes.length > 0) matchedBy.push("fileType");
        if (folderScore > 0.3) matchedBy.push("folder");
        if (metaScore > 0.5) matchedBy.push("metadata");

        scored.push({
          fileId: c.fileId,
          score: finalScore,
          matchedBy: matchedBy.length > 0 ? matchedBy : ["keyword"],
          scoreBreakdown: {
            semantic: semScore,
            keyword: kwScore,
            fileType: typeScore,
            folder: folderScore,
            metadata: metaScore,
            finalScore,
          },
          sources: c.sources,
          fileRecord,
        });
      }
    }

    // 3. Deterministic Sort: finalScore DESC -> keyword DESC -> semantic DESC -> fileId ASC
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.scoreBreakdown.keyword !== a.scoreBreakdown.keyword) {
        return b.scoreBreakdown.keyword - a.scoreBreakdown.keyword;
      }
      if (b.scoreBreakdown.semantic !== a.scoreBreakdown.semantic) {
        return b.scoreBreakdown.semantic - a.scoreBreakdown.semantic;
      }
      return String(a.fileId).localeCompare(String(b.fileId));
    });

    return scored;
  }
}

module.exports = {
  RankingEngine,
};
