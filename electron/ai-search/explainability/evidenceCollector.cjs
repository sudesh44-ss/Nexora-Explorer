"use strict";

const { SignalExplanation } = require("./signalExplanation.cjs");

class EvidenceCollector {
  /**
   * Collects structured evidence items for a SearchResult
   *
   * @param {Object} searchResult - Standard SearchResult object
   * @param {Object} structuredQuery - StructuredQuery from Part 16/23
   * @param {Object} [db] - DatabaseManager
   * @returns {Array<Object>} List of evidence records
   */
  static collect(searchResult, structuredQuery = {}, db = null) {
    if (!searchResult) return [];

    const evidenceList = [];
    const breakdown = searchResult.scoreBreakdown || {};
    const matchedBy = Array.isArray(searchResult.matchedBy) ? searchResult.matchedBy : [];
    const keywords = structuredQuery.keywords || [];
    const phrases = structuredQuery.phrases || [];
    const fileName = searchResult.name || "";

    // 1. Filename match
    const lowerName = fileName.toLowerCase();
    for (const kw of keywords) {
      if (lowerName.includes(kw.toLowerCase())) {
        evidenceList.push({
          source: "filename",
          term: kw,
          score: breakdown.filenameScore || 0.8,
          priority: 1,
        });
        break;
      }
    }

    // 2. Exact phrase match
    if (phrases.length > 0 || (breakdown.phraseScore && breakdown.phraseScore > 0.5)) {
      evidenceList.push({
        source: "exact_phrase",
        term: phrases.join(" ") || keywords.join(" "),
        score: breakdown.phraseScore || 0.95,
        priority: 0,
      });
    }

    // 3. Transcript match & timestamp
    if (matchedBy.includes("transcript") || matchedBy.includes("audio_transcript") || breakdown.transcriptScore > 0.3) {
      evidenceList.push({
        source: "transcript",
        term: keywords.slice(0, 2).join(" "),
        score: breakdown.transcriptScore || 0.9,
        timestamp: breakdown.bestMatchTimestamp || null,
        priority: 2,
      });
    }

    // 4. OCR match
    if (matchedBy.includes("ocr") || matchedBy.includes("image_ocr") || breakdown.ocrScore > 0.3) {
      evidenceList.push({
        source: "ocr",
        term: keywords.slice(0, 2).join(" "),
        score: breakdown.ocrScore || 0.85,
        priority: 3,
      });
    }

    // 5. Visual objects & scenes
    if (matchedBy.includes("vision") || matchedBy.includes("vision_object") || breakdown.objectScore > 0.3) {
      evidenceList.push({
        source: "vision_object",
        term: keywords[0] || "visual object",
        score: breakdown.objectScore || 0.85,
        priority: 4,
      });
    }

    // 6. Semantic vector similarity
    if (matchedBy.includes("semantic") || breakdown.semanticScore > 0.4 || breakdown.vectorScore > 0.4) {
      evidenceList.push({
        source: "semantic",
        score: breakdown.semanticScore || breakdown.vectorScore || 0.75,
        priority: 5,
      });
    }

    // 7. Full-text / document text match
    if (matchedBy.includes("fts") || matchedBy.includes("content") || breakdown.ftsScore > 0.3) {
      evidenceList.push({
        source: "fts",
        term: keywords[0] || "",
        score: breakdown.ftsScore || 0.7,
        priority: 6,
      });
    }

    // Sort by priority (exact matches first)
    evidenceList.sort((a, b) => a.priority - b.priority);

    return evidenceList;
  }
}

module.exports = {
  EvidenceCollector,
};
