"use strict";

const { VideoQueryMatcher } = require("./videoQueryMatcher.cjs");
const { VideoResultAdapter } = require("./videoResultAdapter.cjs");
const { VideoValidator } = require("./videoValidator.cjs");
const { RankingEngine } = require("../ranking/rankingEngine.cjs");
const { createStructuredQuery } = require("../query/querySchema.cjs");

class VideoSearch {
  /**
   * Evaluates video candidate and returns video intelligence signals
   */
  static evaluateVideo(fileId, structuredQuery = {}, db = null, vectorScore = 0.0) {
    if (!fileId || !db) return null;

    const fileRecord = db.files ? db.files.findByFileId(fileId) : null;
    if (!fileRecord || !VideoValidator.isVideo(fileRecord)) return null;

    const aiRecord = db.ai ? db.ai.findByFileId(fileId) : null;
    const contentRecord = db.content ? db.content.findByFileId(fileId) : null;

    return VideoQueryMatcher.match(fileRecord, aiRecord, contentRecord, structuredQuery, vectorScore);
  }

  /**
   * Searches visually/semantically similar videos using stored embeddings
   *
   * @param {string} referenceFileId
   * @param {Object} db
   * @param {Object} vectors
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  static async searchSimilarVideos(referenceFileId, db, vectors, options = {}) {
    if (!referenceFileId || !db || !vectors) return [];

    const refFile = db.files ? db.files.findByFileId(referenceFileId) : null;
    if (!refFile || !VideoValidator.isVideo(refFile)) return [];

    const refAi = db.ai ? db.ai.findByFileId(referenceFileId) : null;
    const refContent = db.content ? db.content.findByFileId(referenceFileId) : null;
    const refText = `${refFile.name} ${refAi?.description || ""} ${(refAi?.tags || []).toString()} ${refContent?.extracted_text || ""}`;

    let similarHits = [];
    if (typeof vectors.searchSimilar === "function") {
      similarHits = await vectors.searchSimilar(refText, { topK: options.limit || 20 });
    } else if (typeof vectors.search === "function") {
      similarHits = await vectors.search(refText, { limit: options.limit || 20, minScore: 0.2 });
    }

    const candidates = [];
    for (const hit of similarHits) {
      const hitId = hit.fileId || hit.file_id;
      if (hitId === referenceFileId) continue;

      const hitFile = db.files ? db.files.findByFileId(hitId) : null;
      if (hitFile && VideoValidator.isVideo(hitFile)) {
        candidates.push({
          fileId: hitId,
          signals: [{ source: "vector", score: hit.similarity || hit.score || 0.5 }],
          fileRecord: hitFile,
        });
      }
    }

    const sq = createStructuredQuery({
      rawQuery: refFile.name,
      fileTypes: ["video"],
      intent: "SEMANTIC_SEARCH",
    });

    const ranked = RankingEngine.rank(candidates, sq, db, options);
    return ranked.map((r) => VideoResultAdapter.adapt(r.fileRecord, null, r.score));
  }
}

module.exports = {
  VideoSearch,
};
