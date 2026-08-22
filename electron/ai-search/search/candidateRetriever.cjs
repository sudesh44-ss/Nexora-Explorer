"use strict";

/**
 * Retrieves candidates concurrently across FTS5, Vector Search, and SQLite Metadata
 */
class CandidateRetriever {
  /**
   * Retrieves keyword candidates from FTS5
   */
  static async retrieveFtsCandidates(searchQuery, db, options = {}) {
    if (!db || !db.isOpen || !db.fts || !searchQuery.options.useFts) {
      return [];
    }

    const queryStr = searchQuery.keywords.length > 0
      ? searchQuery.keywords.join(" ")
      : searchQuery.rawQuery;

    if (!queryStr || queryStr.trim().length === 0) return [];

    try {
      const limit = options.limit || 50;
      const ftsResults = db.fts.search(queryStr, { limit });
      return ftsResults.map((r, index) => ({
        fileId: r.file_id,
        ftsScore: r.rank ? Math.abs(r.rank) : (1.0 / (index + 1)),
        source: "fts",
        matchedFields: ["fts"],
      }));
    } catch {
      return [];
    }
  }

  /**
   * Retrieves semantic similarity candidates from Vector Store
   */
  static async retrieveVectorCandidates(searchQuery, vectors, options = {}) {
    if (!vectors || !searchQuery.options.useVector) {
      return [];
    }

    const queryStr = searchQuery.semanticQuery || searchQuery.rawQuery;
    if (!queryStr || queryStr.trim().length === 0) return [];

    try {
      const topK = options.limit || 50;
      const vectorResults = await vectors.searchSimilar(queryStr, { topK });
      return vectorResults.map((r) => ({
        fileId: r.fileId,
        semanticScore: r.score,
        source: "vector",
        metadata: r.metadata,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Retrieves candidates based on filename and metadata filters
   */
  static async retrieveMetadataCandidates(searchQuery, db, options = {}) {
    if (!db || !db.isOpen || !db.files || !searchQuery.options.useMetadata) {
      return [];
    }

    try {
      const limit = options.limit || 50;
      const keywords = searchQuery.keywords;
      if (keywords.length === 0) return [];

      const foundIds = new Set();
      const results = [];

      for (const kw of keywords) {
        if (kw.length < 2) continue;
        const matches = db.files.findByName(kw);
        for (const m of matches) {
          if (!foundIds.has(m.file_id)) {
            foundIds.add(m.file_id);
            results.push({
              fileId: m.file_id,
              metadataScore: 1.0,
              source: "metadata",
              fileRecord: m,
            });
            if (results.length >= limit) break;
          }
        }
        if (results.length >= limit) break;
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * Retrieves candidates across all three sources concurrently
   */
  static async retrieveAll(searchQuery, services = {}, options = {}) {
    const { db, vectors } = services;
    const limits = options.candidateLimits || { fts: 50, vector: 50, metadata: 50 };

    const [ftsRes, vecRes, metaRes] = await Promise.allSettled([
      this.retrieveFtsCandidates(searchQuery, db, { limit: limits.fts }),
      this.retrieveVectorCandidates(searchQuery, vectors, { limit: limits.vector }),
      this.retrieveMetadataCandidates(searchQuery, db, { limit: limits.metadata }),
    ]);

    return {
      fts: ftsRes.status === "fulfilled" ? ftsRes.value : [],
      vector: vecRes.status === "fulfilled" ? vecRes.value : [],
      metadata: metaRes.status === "fulfilled" ? metaRes.value : [],
    };
  }
}

module.exports = {
  CandidateRetriever,
};
