"use strict";

/**
 * Deduplicates and merges candidate sets from multiple retrieval sources
 */
class CandidateMerger {
  /**
   * Merges FTS, Vector, and Metadata candidate lists by unique fileId
   *
   * @param {{fts: Array, vector: Array, metadata: Array}} retrieved
   * @returns {Array<Object>} Unique candidate objects
   */
  static merge(retrieved = {}) {
    const fts = Array.isArray(retrieved.fts) ? retrieved.fts : [];
    const vector = Array.isArray(retrieved.vector) ? retrieved.vector : [];
    const metadata = Array.isArray(retrieved.metadata) ? retrieved.metadata : [];

    const candidateMap = new Map();

    function getOrCreate(fileId) {
      if (!candidateMap.has(fileId)) {
        candidateMap.set(fileId, {
          fileId,
          sources: new Set(),
          rawScores: {
            fts: 0,
            semantic: 0,
            metadata: 0,
          },
          extra: {},
        });
      }
      return candidateMap.get(fileId);
    }

    // 1. Process FTS candidates
    for (const c of fts) {
      if (!c.fileId) continue;
      const entry = getOrCreate(c.fileId);
      entry.sources.add("fts");
      entry.rawScores.fts = Math.max(entry.rawScores.fts, Number(c.ftsScore) || 0);
    }

    // 2. Process Vector candidates
    for (const c of vector) {
      if (!c.fileId) continue;
      const entry = getOrCreate(c.fileId);
      entry.sources.add("vector");
      entry.rawScores.semantic = Math.max(entry.rawScores.semantic, Number(c.semanticScore) || 0);
      if (c.metadata) entry.extra = { ...entry.extra, ...c.metadata };
    }

    // 3. Process Metadata candidates
    for (const c of metadata) {
      if (!c.fileId) continue;
      const entry = getOrCreate(c.fileId);
      entry.sources.add("metadata");
      entry.rawScores.metadata = Math.max(entry.rawScores.metadata, Number(c.metadataScore) || 1.0);
      if (c.fileRecord) entry.extra.fileRecord = c.fileRecord;
    }

    // Format output
    return Array.from(candidateMap.values()).map((c) => ({
      fileId: c.fileId,
      sources: Array.from(c.sources),
      rawScores: c.rawScores,
      extra: c.extra,
    }));
  }
}

module.exports = {
  CandidateMerger,
};
