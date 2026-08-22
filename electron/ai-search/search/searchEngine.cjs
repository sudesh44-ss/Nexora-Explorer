"use strict";

const EventEmitter = require("events");
const { QueryProcessor } = require("./queryProcessor.cjs");
const { CandidateRetriever } = require("./candidateRetriever.cjs");
const { CandidateMerger } = require("./candidateMerger.cjs");
const { RankingEngine } = require("./rankingEngine.cjs");
const { FileResolver } = require("./fileResolver.cjs");
const { getSearchConfig } = require("./searchConfig.cjs");
const { SearchErrorCode, SearchError } = require("./searchErrors.cjs");

/**
 * Unified Hybrid Search Engine orchestrating Query Understanding,
 * Multi-Index Candidate Retrieval, Hybrid Ranking, and File Resolution
 */
class SearchEngine extends EventEmitter {
  constructor(services = {}, options = {}) {
    super();
    this.db = services.databaseManager || null;
    this.vectors = services.embeddingManager || null;
    this.config = getSearchConfig(options);
  }

  /**
   * Executes a hybrid search query end-to-end
   *
   * @param {string} rawQuery - Natural language search query
   * @param {Object} [options]
   * @param {AbortSignal} [options.signal] - Optional cancellation signal
   * @returns {Promise<{query: Object, results: Array, total: number, tookMs: number}>}
   */
  async search(rawQuery, options = {}) {
    const startTime = Date.now();
    const signal = options.signal || null;

    if (signal?.aborted) {
      throw new SearchError(SearchErrorCode.SEARCH_ABORTED, "Search request was aborted");
    }

    if (!rawQuery || typeof rawQuery !== "string" || !rawQuery.trim()) {
      return {
        query: QueryProcessor.process(""),
        results: [],
        total: 0,
        tookMs: 0,
      };
    }

    // 1. Query Understanding & Keyword/Filter extraction
    const searchQuery = QueryProcessor.process(rawQuery, {
      ...this.config,
      ...options,
    });

    if (signal?.aborted) {
      throw new SearchError(SearchErrorCode.SEARCH_ABORTED, "Search request was aborted");
    }

    // 2. Candidate Retrieval across FTS5, Vector Search, and SQLite Metadata
    const retrieved = await CandidateRetriever.retrieveAll(
      searchQuery,
      { db: this.db, vectors: this.vectors },
      { candidateLimits: this.config.candidateLimits, signal }
    );

    if (signal?.aborted) {
      throw new SearchError(SearchErrorCode.SEARCH_ABORTED, "Search request was aborted");
    }

    // 3. Merge and deduplicate candidates
    const mergedCandidates = CandidateMerger.merge(retrieved);
    if (mergedCandidates.length === 0) {
      return {
        query: searchQuery,
        results: [],
        total: 0,
        tookMs: Date.now() - startTime,
      };
    }

    // 4. Batch pre-fetch FileRecords for candidates
    const fileRecordsMap = new Map();
    if (this.db && this.db.isOpen && this.db.files) {
      for (const c of mergedCandidates) {
        if (c.extra?.fileRecord) {
          fileRecordsMap.set(c.fileId, c.extra.fileRecord);
        } else {
          const rec = this.db.files.findByFileId(c.fileId);
          if (rec) fileRecordsMap.set(c.fileId, rec);
        }
      }
    }

    // 5. Multi-Signal Hybrid Ranking
    const rankedCandidates = RankingEngine.rank(
      mergedCandidates,
      searchQuery,
      fileRecordsMap,
      { ...this.config, ...options }
    );

    if (signal?.aborted) {
      throw new SearchError(SearchErrorCode.SEARCH_ABORTED, "Search request was aborted");
    }

    // 6. Path Resolution and Filesystem Validation
    const resolvedResults = FileResolver.resolve(
      rankedCandidates,
      this.db,
      {
        limit: searchQuery.limit,
        verifyFilesystem: this.config.verifyFilesystem,
      }
    );

    const tookMs = Date.now() - startTime;
    this.emit("search_completed", { rawQuery, total: resolvedResults.length, tookMs });

    return {
      query: searchQuery,
      results: resolvedResults,
      total: resolvedResults.length,
      tookMs,
    };
  }

  getStatus() {
    return {
      isDbReady: Boolean(this.db?.isOpen),
      isVectorReady: Boolean(this.vectors?.isInitialized),
      config: this.config,
    };
  }
}

module.exports = {
  SearchEngine,
};
