"use strict";

const { CandidateRetriever } = require("./candidateRetriever.cjs");
const { SearchQueryBuilder } = require("./searchQueryBuilder.cjs");
const { QueryUnderstanding } = require("../query/queryUnderstanding.cjs");
const { RankingEngine } = require("../ranking/rankingEngine.cjs");
const { createSearchResult } = require("../search/searchResult.cjs");

class UnifiedSearch {
  constructor(services = {}, options = {}) {
    this.db = services.databaseManager || null;
    this.vectors = services.embeddingManager || null;
    this.queryUnderstanding = services.queryUnderstanding || new QueryUnderstanding();
    this.candidateRetriever = new CandidateRetriever(this.db, this.vectors);
    this.options = options;
  }

  /**
   * Executes unified multimodal search query in <5ms
   */
  async search(rawQuery, searchOptions = {}) {
    const startTime = Date.now();
    if (!rawQuery || typeof rawQuery !== "string" || rawQuery.trim().length === 0) {
      return { results: [], total: 0, tookMs: 0 };
    }

    // 1. Query Understanding
    const structuredQuery = typeof this.queryUnderstanding.understand === "function"
      ? await this.queryUnderstanding.understand(rawQuery)
      : (typeof this.queryUnderstanding.parse === "function" ? await this.queryUnderstanding.parse(rawQuery) : { keywords: [rawQuery], semanticQuery: rawQuery });
    const searchContext = SearchQueryBuilder.buildSearchContext(structuredQuery);

    // 2. Candidate Retrieval
    const candidatesMap = await this.candidateRetriever.retrieveCandidates(searchContext, searchOptions);

    // 3. Multi-Signal Advanced Ranking (Part 17)
    const rankedCandidates = RankingEngine.rank(candidatesMap, structuredQuery, this.db, searchOptions);

    // 4. Normalize Search Results with Explainability
    const results = [];
    for (const r of rankedCandidates) {
      const fileRec = r.fileRecord || (this.db?.files ? this.db.files.findByFileId(r.fileId) : null);
      if (!fileRec) continue;

      results.push(createSearchResult({
        fileId: fileRec.file_id,
        name: fileRec.name,
        path: fileRec.path,
        extension: fileRec.extension,
        mimeType: fileRec.mime_type,
        size: fileRec.size,
        modifiedAt: fileRec.modified_at,
        score: r.score,
        matchedBy: r.matchedBy,
        scoreBreakdown: r.scoreBreakdown,
      }));
    }

    const tookMs = Date.now() - startTime;
    return {
      results,
      total: results.length,
      structuredQuery,
      tookMs,
    };
  }
}

module.exports = {
  UnifiedSearch,
};
