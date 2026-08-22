"use strict";

const { createSearchSignal, SignalSource } = require("./searchSignals.cjs");

class CandidateRetriever {
  constructor(db, vectors = null) {
    this.db = db;
    this.vectors = vectors;
  }

  /**
   * Retrieves candidate file IDs across FTS5, Metadata, and Vector store
   */
  async retrieveCandidates(searchContext, options = {}) {
    const candidates = new Map(); // fileId -> Array<SearchSignal>
    const maxCandidates = options.maxCandidates || 500;

    // 1. FTS5 Keyword Search
    if (this.db && this.db.isOpen && this.db.fts) {
      try {
        const terms = searchContext.keywords.length > 0
          ? searchContext.keywords
          : (searchContext.rawQuery ? [searchContext.rawQuery] : []);

        for (const term of terms) {
          if (!term || term.trim().length === 0) continue;
          const ftsHits = this.db.fts.search(term.trim(), { limit: maxCandidates });
          for (const hit of ftsHits) {
            const sig = createSearchSignal({
              fileId: hit.file_id,
              source: SignalSource.FTS,
              matchType: "fts_exact",
              score: Math.abs(hit.rank || 1.0),
              matchedFields: ["text", "name"],
            });

            if (!candidates.has(hit.file_id)) candidates.set(hit.file_id, []);
            candidates.get(hit.file_id).push(sig);
          }
        }
      } catch {}
    }

    // 2. Vector Semantic Similarity Search
    if (this.vectors && searchContext.semanticQuery && (this.vectors.isInitialized !== false)) {
      try {
        let vectorHits = [];
        if (typeof this.vectors.searchSimilar === "function") {
          vectorHits = await this.vectors.searchSimilar(searchContext.semanticQuery, {
            topK: Math.min(100, maxCandidates),
          });
        } else if (typeof this.vectors.search === "function") {
          vectorHits = await this.vectors.search(searchContext.semanticQuery, {
            limit: Math.min(100, maxCandidates),
            minScore: options.minSimilarity || 0.25,
          });
        }

        for (const vHit of vectorHits) {
          const sig = createSearchSignal({
            fileId: vHit.fileId,
            source: SignalSource.VECTOR,
            matchType: "semantic_similarity",
            score: vHit.similarity || vHit.score || 0.5,
            matchedFields: ["embedding"],
          });

          if (!candidates.has(vHit.fileId)) candidates.set(vHit.fileId, []);
          candidates.get(vHit.fileId).push(sig);
        }
      } catch {}
    }

    // 3. Filename & Metadata Direct Query
    if (this.db && this.db.files) {
      try {
        const terms = searchContext.keywords.length > 0
          ? searchContext.keywords
          : (searchContext.rawQuery ? [searchContext.rawQuery] : []);

        for (const kw of terms) {
          const raw = this.db.db || this.db;
          if (raw && typeof raw.prepare === "function") {
            const fileRows = raw.prepare("SELECT file_id, name FROM files WHERE name LIKE ? LIMIT 50").all(`%${kw}%`);
            for (const r of fileRows) {
              const sig = createSearchSignal({
                fileId: r.file_id,
                source: SignalSource.FILENAME,
                matchType: "filename_substring",
                score: 1.0,
                matchedFields: ["name"],
              });
              if (!candidates.has(r.file_id)) candidates.set(r.file_id, []);
              candidates.get(r.file_id).push(sig);
            }
          }
        }
      } catch {}
    }

    return candidates;
  }
}

module.exports = {
  CandidateRetriever,
};
