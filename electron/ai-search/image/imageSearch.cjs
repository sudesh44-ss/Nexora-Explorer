"use strict";

const { ImageQueryMatcher } = require("./imageQueryMatcher.cjs");
const { ImageResultAdapter } = require("./imageResultAdapter.cjs");
const { ImageValidator } = require("./imageValidator.cjs");
const { RankingEngine } = require("../ranking/rankingEngine.cjs");
const { createStructuredQuery } = require("../query/querySchema.cjs");

class ImageSearch {
  /**
   * Evaluates image candidate and returns image intelligence signals
   */
  static evaluateImage(fileId, structuredQuery = {}, db = null, vectorScore = 0.0) {
    if (!fileId || !db) return null;

    const fileRecord = db.files ? db.files.findByFileId(fileId) : null;
    if (!fileRecord || !ImageValidator.isImage(fileRecord)) return null;

    const aiRecord = db.ai ? db.ai.findByFileId(fileId) : null;
    const contentRecord = db.content ? db.content.findByFileId(fileId) : null;

    return ImageQueryMatcher.match(fileRecord, aiRecord, contentRecord, structuredQuery, vectorScore);
  }

  /**
   * Searches visually/semantically similar images using stored embeddings
   *
   * @param {string} referenceFileId
   * @param {Object} db
   * @param {Object} vectors
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  static async searchSimilarImages(referenceFileId, db, vectors, options = {}) {
    if (!referenceFileId || !db || !vectors) return [];

    const refFile = db.files ? db.files.findByFileId(referenceFileId) : null;
    if (!refFile || !ImageValidator.isImage(refFile)) return [];

    // 1. Retrieve stored vector for reference image
    const refAi = db.ai ? db.ai.findByFileId(referenceFileId) : null;
    const refText = `${refFile.name} ${refAi?.description || ""} ${(refAi?.tags || []).toString()}`;

    let similarHits = [];
    if (typeof vectors.searchSimilar === "function") {
      similarHits = await vectors.searchSimilar(refText, { topK: options.limit || 20 });
    } else if (typeof vectors.search === "function") {
      similarHits = await vectors.search(refText, { limit: options.limit || 20, minScore: 0.2 });
    }

    // 2. Filter hits to image files only and exclude the reference file itself
    const candidates = [];
    for (const hit of similarHits) {
      const hitId = hit.fileId || hit.file_id;
      if (hitId === referenceFileId) continue;

      const hitFile = db.files ? db.files.findByFileId(hitId) : null;
      if (hitFile && ImageValidator.isImage(hitFile)) {
        candidates.push({
          fileId: hitId,
          signals: [{ source: "vector", score: hit.similarity || hit.score || 0.5 }],
          fileRecord: hitFile,
        });
      }
    }

    // 3. Rank via Part 17 RankingEngine
    const sq = createStructuredQuery({
      rawQuery: refFile.name,
      fileTypes: ["image"],
      intent: "SEMANTIC_SEARCH",
    });

    const ranked = RankingEngine.rank(candidates, sq, db, options);
    return ranked.map((r) => ImageResultAdapter.adapt(r.fileRecord, null, r.score));
  }
}

module.exports = {
  ImageSearch,
};
