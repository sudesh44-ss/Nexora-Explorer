"use strict";

const { CandidateMerger } = require("./candidateMerger.cjs");
const { FusionResultAdapter } = require("./fusionResultAdapter.cjs");
const { FusionDiagnostics } = require("./fusionDiagnostics.cjs");
const { RankingEngine } = require("../ranking/rankingEngine.cjs");
const { ImageSearch } = require("../image/imageSearch.cjs");
const { VideoSearch } = require("../video/videoSearch.cjs");
const { AudioSearch } = require("../audio/audioSearch.cjs");

class MultimodalFusion {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxCacheSize = options.maxCacheSize || 50;
    this._activeRequestId = null;
  }

  /**
   * Generates a stable cache key
   */
  _buildCacheKey(structuredQuery, options = {}) {
    const raw = structuredQuery.rawQuery || structuredQuery.normalizedQuery || "";
    const types = (structuredQuery.fileTypes || []).join(",");
    const mode = options.mode || "BALANCED";
    return `${raw}::${types}::${mode}`;
  }

  /**
   * Sets active request ID to enforce cancellation tracking
   */
  setActiveRequest(requestId) {
    this._activeRequestId = requestId;
  }

  /**
   * Fuses candidate streams from text, image, video, and audio into unified ranked results
   *
   * @param {Object} candidateStreams - { textCandidates, imageCandidates, videoCandidates, audioCandidates } or raw array/map
   * @param {Object} structuredQuery - Structured query from Part 16
   * @param {Object} db - DatabaseManager
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async fuse(candidateStreams, structuredQuery = {}, db = null, options = {}) {
    const t0 = Date.now();
    const requestId = options.requestId || null;

    // Cancellation check
    if (requestId && this._activeRequestId && this._activeRequestId !== requestId) {
      return [];
    }

    // Check Cache
    const cacheKey = this._buildCacheKey(structuredQuery, options);
    if (options.useCache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < (options.cacheTtlMs || 60000)) {
        return cached.results;
      }
    }

    // 1. Gather all candidate sources with error isolation
    const candidateBatches = [];

    if (Array.isArray(candidateStreams)) {
      candidateBatches.push(candidateStreams);
    } else if (candidateStreams instanceof Map) {
      candidateBatches.push(candidateStreams);
    } else if (candidateStreams && typeof candidateStreams === "object") {
      if (candidateStreams.textCandidates) candidateBatches.push(candidateStreams.textCandidates);
      if (candidateStreams.imageCandidates) candidateBatches.push(candidateStreams.imageCandidates);
      if (candidateStreams.videoCandidates) candidateBatches.push(candidateStreams.videoCandidates);
      if (candidateStreams.audioCandidates) candidateBatches.push(candidateStreams.audioCandidates);
    }

    // 2. Candidate Deduplication & Evidence Merging
    const mergedCandidates = CandidateMerger.merge(candidateBatches, db);

    // 3. Modality-specific signal enrichment with error isolation
    for (const c of mergedCandidates) {
      try {
        if (c.modality === "image") {
          const imgSig = ImageSearch.evaluateImage(c.fileId, structuredQuery, db);
          if (imgSig?.scores?.objectScore > 0) {
            c.signals.push({ source: "vision_object", score: imgSig.scores.objectScore });
          }
          if (imgSig?.scores?.ocrScore > 0) {
            c.signals.push({ source: "ocr", score: imgSig.scores.ocrScore });
          }
        } else if (c.modality === "video") {
          const vidSig = VideoSearch.evaluateVideo(c.fileId, structuredQuery, db);
          if (vidSig?.scores?.transcriptScore > 0) {
            c.signals.push({ source: "transcript", score: vidSig.scores.transcriptScore });
          }
          if (vidSig?.scores?.ocrScore > 0) {
            c.signals.push({ source: "ocr", score: vidSig.scores.ocrScore });
          }
          if (vidSig?.evidence?.bestMatchTimestamp) {
            c.evidence.bestMatchTimestamp = vidSig.evidence.bestMatchTimestamp;
          }
        } else if (c.modality === "audio") {
          const audSig = AudioSearch.evaluateAudio(c.fileId, structuredQuery, db);
          if (audSig?.scores?.transcriptScore > 0) {
            c.signals.push({ source: "transcript", score: audSig.scores.transcriptScore });
          }
          if (audSig?.evidence?.bestMatchTimestamp) {
            c.evidence.bestMatchTimestamp = audSig.evidence.bestMatchTimestamp;
          }
        }
      } catch {
        // Continue seamlessly on individual modality adapter errors
      }
    }

    // Cancellation check before ranking
    if (requestId && this._activeRequestId && this._activeRequestId !== requestId) {
      return [];
    }

    // 4. Rank candidates via Part 17 RankingEngine
    const rankedCandidates = RankingEngine.rank(mergedCandidates, structuredQuery, db, options);

    // Cancellation check after ranking
    if (requestId && this._activeRequestId && this._activeRequestId !== requestId) {
      return [];
    }

    // 5. Convert to standardized SearchResult objects
    const results = rankedCandidates.map((rc) => {
      const mergedEntry = mergedCandidates.find((m) => m.fileId === rc.fileId);
      return FusionResultAdapter.adapt(rc, mergedEntry?.evidence);
    });

    // 6. Diagnostics & Caching
    const elapsed = Date.now() - t0;
    if (options.diagnostics) {
      results._diagnostics = FusionDiagnostics.generateReport(mergedCandidates, results, elapsed);
    }

    if (options.useCache !== false && results.length > 0) {
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, { timestamp: Date.now(), results });
    }

    return results;
  }
}

module.exports = {
  MultimodalFusion,
};
