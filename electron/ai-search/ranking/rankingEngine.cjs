"use strict";

const { getRankingConfig } = require("./rankingConfig.cjs");
const { RankingWeights } = require("./rankingWeights.cjs");
const { RankingSignals } = require("./rankingSignals.cjs");
const { RankingNormalizer } = require("./rankingNormalizer.cjs");
const { RankingScore } = require("./rankingScore.cjs");
const { RankingExplanation } = require("./rankingExplanation.cjs");
const { RankingValidator } = require("./rankingValidator.cjs");

class RankingEngine {
  /**
   * Evaluates, scores, and ranks candidates against structured query requirements
   *
   * @param {Array<Object>|Map<string, Array<Object>>} rawCandidates - Candidate list or map from CandidateRetriever
   * @param {Object} structuredQuery - Structured query produced by QueryUnderstanding
   * @param {Object} db - DatabaseManager instance
   * @param {Object} [options]
   * @returns {Array<Object>} Deterministically ranked result list
   */
  static rank(rawCandidates, structuredQuery = {}, db = null, options = {}) {
    if (!rawCandidates) return [];

    const config = getRankingConfig(options);
    const weights = RankingWeights.getWeights(structuredQuery.intent || "SEARCH_FILES");

    // Convert candidates Map to array if needed
    let candidatesList = [];
    if (rawCandidates instanceof Map) {
      for (const [fileId, signals] of rawCandidates.entries()) {
        candidatesList.push({ fileId, signals });
      }
    } else if (Array.isArray(rawCandidates)) {
      candidatesList = rawCandidates;
    }

    const queryKeywords = structuredQuery.keywords || [];
    const requestedTypes = structuredQuery.fileTypes || [];
    const phrases = structuredQuery.phrases || [];
    const rawQuery = structuredQuery.rawQuery || structuredQuery.normalizedQuery || "";

    const scored = [];
    const fileRecCache = new Map();
    const contentRecCache = new Map();
    const aiRecCache = new Map();

    for (const c of candidatesList) {
      if (!RankingValidator.validateCandidate(c)) continue;

      let fileRec = c.fileRecord || fileRecCache.get(c.fileId);
      if (!fileRec && db?.files) {
        fileRec = db.files.findByFileId(c.fileId);
        if (fileRec) fileRecCache.set(c.fileId, fileRec);
      }
      if (!fileRec) continue;

      // 1. Hard Filter: File Types
      if (requestedTypes.length > 0) {
        const typeMatch = RankingSignals.computeFileTypeScore(fileRec, requestedTypes);
        if (typeMatch === 0.0) {
          continue; // Hard constraint failed -> exclude completely
        }
      }

      // 2. Hard Filter: Size Filter
      if (structuredQuery.sizeFilter && fileRec.size !== undefined) {
        const sf = structuredQuery.sizeFilter;
        if (sf.operator === ">" && !(fileRec.size > sf.bytes)) continue;
        if (sf.operator === "<" && !(fileRec.size < sf.bytes)) continue;
        if (sf.operator === ">=" && !(fileRec.size >= sf.bytes)) continue;
        if (sf.operator === "<=" && !(fileRec.size <= sf.bytes)) continue;
      }

      // Extract candidate signal sources
      const signalsArray = Array.isArray(c.signals) ? c.signals : [];
      let rawFts = 0.0;
      let rawSemantic = 0.0;
      let rawOcr = 0.0;

      for (const sig of signalsArray) {
        if (sig.source === "fts") rawFts = Math.max(rawFts, sig.score || 1.0);
        if (sig.source === "semantic" || sig.source === "vector") rawSemantic = Math.max(rawSemantic, sig.score || 0.5);
        if (sig.source === "ocr") rawOcr = Math.max(rawOcr, sig.score || 1.0);
      }

      // Fetch AI and Content records if available (memoized)
      let contentRec = c.contentRecord;
      if (contentRec === undefined && db?.content) {
        if (!contentRecCache.has(c.fileId)) {
          contentRecCache.set(c.fileId, db.content.findByFileId(c.fileId));
        }
        contentRec = contentRecCache.get(c.fileId);
      }

      let aiRec = c.aiRecord;
      if (aiRec === undefined && db?.ai) {
        if (!aiRecCache.has(c.fileId)) {
          aiRecCache.set(c.fileId, db.ai.findByFileId(c.fileId));
        }
        aiRec = aiRecCache.get(c.fileId);
      }

      const searchableText = `${fileRec.name} ${contentRec?.extracted_text || ""} ${aiRec?.description || ""} ${(aiRec?.tags || []).toString()}`;

      // 3. Compute Signals
      const fnScores = RankingSignals.computeFilenameScores(fileRec, rawQuery, queryKeywords);
      const phraseScore = RankingSignals.computePhraseScore(searchableText, phrases);
      const coverage = RankingSignals.computeCoverage(searchableText, queryKeywords);
      const folderScore = RankingSignals.computeFolderScore(fileRec, structuredQuery.folderHints || []);

      // Vision score
      let visionScore = 0.0;
      if (aiRec?.description || (Array.isArray(aiRec?.tags) && aiRec.tags.length > 0)) {
        if (structuredQuery.objects && structuredQuery.objects.length > 0) {
          const textLower = searchableText.toLowerCase();
          const hasObj = structuredQuery.objects.some((obj) => textLower.includes(obj.toLowerCase()));
          if (hasObj) visionScore = 1.0;
        } else {
          visionScore = 0.7;
        }
      }

      // OCR score
      let ocrScore = rawOcr > 0 ? RankingNormalizer.normalizeScore(rawOcr) : 0.0;
      if (contentRec?.extracted_text && queryKeywords.some((kw) => contentRec.extracted_text.toLowerCase().includes(kw.toLowerCase()))) {
        ocrScore = Math.max(ocrScore, 0.85);
      }

      const normalizedSignals = {
        filenameExact: RankingNormalizer.normalizeScore(fnScores.exact),
        filenamePartial: RankingNormalizer.normalizeScore(fnScores.partial),
        phrase: RankingNormalizer.normalizeScore(phraseScore),
        folder: RankingNormalizer.normalizeScore(folderScore),
        fts: RankingNormalizer.normalizeFtsRank(rawFts),
        ocr: RankingNormalizer.normalizeScore(ocrScore),
        vision: RankingNormalizer.normalizeScore(visionScore),
        tags: (Array.isArray(aiRec?.tags) && aiRec.tags.length > 0) ? 0.8 : 0.0,
        semantic: RankingNormalizer.normalizeScore(rawSemantic),
        coverage: RankingNormalizer.normalizeScore(coverage),
        metadata: 0.5,
      };

      // 4. Compute Final Composite Score
      const finalScore = RankingScore.computeCompositeScore(normalizedSignals, weights, config.boosts);

      if (finalScore >= config.minFinalScore) {
        const explanation = RankingExplanation.buildExplanation(normalizedSignals, {
          ...normalizedSignals,
          finalScore,
        });

        scored.push({
          fileId: c.fileId,
          score: finalScore,
          matchedBy: explanation.matchedBy,
          scoreBreakdown: explanation.scoreBreakdown,
          explanation: explanation.reasons,
          fileRecord: fileRec,
        });
      }
    }

    // 5. Deterministic Tie-Breaking Sort:
    // finalScore DESC -> exactness DESC -> coverage DESC -> semantic DESC -> fileId ASC
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.scoreBreakdown.filenameExact !== a.scoreBreakdown.filenameExact) {
        return b.scoreBreakdown.filenameExact - a.scoreBreakdown.filenameExact;
      }
      if (b.scoreBreakdown.coverage !== a.scoreBreakdown.coverage) {
        return b.scoreBreakdown.coverage - a.scoreBreakdown.coverage;
      }
      if (b.scoreBreakdown.semantic !== a.scoreBreakdown.semantic) {
        return b.scoreBreakdown.semantic - a.scoreBreakdown.semantic;
      }
      return a.fileId.localeCompare(b.fileId);
    });

    const resultLimit = options.limit || config.resultLimit || 50;
    return scored.slice(0, resultLimit);
  }
}

module.exports = {
  RankingEngine,
};
