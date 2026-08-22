"use strict";

const { SignalNormalizer } = require("./signalNormalizer.cjs");
const { ModalityResolver } = require("./modalityResolver.cjs");

class CandidateMerger {
  /**
   * Merges multiple candidate lists/maps by unique fileId
   *
   * @param {Array<Object>|Map<string, Array<Object>>} candidateSources
   * @param {Object} [db]
   * @returns {Array<Object>} Deduplicated, merged candidate pool
   */
  static merge(candidateSources = [], db = null) {
    const mergedMap = new Map();

    const addCandidate = (c) => {
      if (!c || !c.fileId) return;
      const fileId = c.fileId;

      if (!mergedMap.has(fileId)) {
        let fileRec = c.fileRecord || null;
        if (!fileRec && db?.files) {
          fileRec = db.files.findByFileId(fileId);
        }

        mergedMap.set(fileId, {
          fileId,
          modality: ModalityResolver.resolve(fileRec),
          signals: [],
          fileRecord: fileRec,
          evidence: {
            sources: new Set(),
            matchedTerms: new Set(),
            bestMatchTimestamp: null,
          },
        });
      }

      const entry = mergedMap.get(fileId);

      // Merge signals
      const incomingSignals = Array.isArray(c.signals) ? c.signals : (c.score ? [{ source: c.source || "retrieval", score: c.score }] : []);
      for (const sig of incomingSignals) {
        if (!sig) continue;
        const sourceName = sig.source || "unknown";
        entry.evidence.sources.add(sourceName);
        entry.signals.push({
          source: sourceName,
          score: SignalNormalizer.normalizeScore(sig.score),
          metadata: sig.metadata || null,
        });
      }

      // Merge evidence terms / timestamps
      if (c.evidence?.matchedTerms) {
        for (const t of c.evidence.matchedTerms) entry.evidence.matchedTerms.add(t);
      }
      if (c.evidence?.bestMatchTimestamp && !entry.evidence.bestMatchTimestamp) {
        entry.evidence.bestMatchTimestamp = c.evidence.bestMatchTimestamp;
      }
    };

    if (candidateSources instanceof Map) {
      for (const [fileId, signals] of candidateSources.entries()) {
        addCandidate({ fileId, signals });
      }
    } else if (Array.isArray(candidateSources)) {
      for (const item of candidateSources) {
        if (Array.isArray(item)) {
          for (const sub of item) addCandidate(sub);
        } else {
          addCandidate(item);
        }
      }
    }

    // Convert sets to arrays in output
    const results = [];
    for (const entry of mergedMap.values()) {
      results.push({
        fileId: entry.fileId,
        modality: entry.modality,
        signals: entry.signals,
        fileRecord: entry.fileRecord,
        evidence: {
          sources: Array.from(entry.evidence.sources),
          matchedTerms: Array.from(entry.evidence.matchedTerms),
          bestMatchTimestamp: entry.evidence.bestMatchTimestamp,
        },
      });
    }

    return results;
  }
}

module.exports = {
  CandidateMerger,
};
