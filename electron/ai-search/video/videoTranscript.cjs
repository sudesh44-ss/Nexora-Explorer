"use strict";

class VideoTranscript {
  /**
   * Formats seconds into HH:MM:SS or MM:SS
   */
  static formatTimestamp(seconds) {
    if (typeof seconds !== "number" || isNaN(seconds)) return null;
    const totalSec = Math.floor(seconds);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n) => String(n).padStart(2, "0");
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  /**
   * Matches query keywords and phrases against indexed transcript
   *
   * @param {Array<string>} keywords
   * @param {Array<string>} phrases
   * @param {Object} contentRecord
   * @param {Object} aiRecord
   * @returns {{score: number, phraseScore: number, matchedTerms: Array<string>, bestMatchTimestamp: string|null, timestampSec: number|null}}
   */
  static match(keywords = [], phrases = [], contentRecord = null, aiRecord = null) {
    const rawText = (contentRecord?.extracted_text || aiRecord?.description || "").toLowerCase();

    let aiMeta = {};
    if (typeof aiRecord?.entities === "string") {
      try {
        aiMeta = JSON.parse(aiRecord.entities);
      } catch {}
    } else if (typeof aiRecord?.metadata === "string") {
      try {
        aiMeta = JSON.parse(aiRecord.metadata);
      } catch {}
    } else if (aiRecord?.entities && typeof aiRecord.entities === "object") {
      aiMeta = aiRecord.entities;
    } else if (aiRecord?.metadata && typeof aiRecord.metadata === "object") {
      aiMeta = aiRecord.metadata;
    }

    const segments = Array.isArray(aiMeta.transcriptSegments) ? aiMeta.transcriptSegments : [];

    const matchedTerms = [];
    let bestTimestampSec = null;
    let phraseScore = 0.0;

    // 1. Exact phrase evaluation
    if (Array.isArray(phrases) && phrases.length > 0) {
      for (const phrase of phrases) {
        const pLower = phrase.toLowerCase().trim();
        if (rawText.includes(pLower)) {
          matchedTerms.push(phrase);
          phraseScore = 1.0;

          // Check if any segment has timestamp
          for (const seg of segments) {
            if ((seg.text || "").toLowerCase().includes(pLower)) {
              if (typeof seg.timestamp === "number" && bestTimestampSec === null) {
                bestTimestampSec = seg.timestamp;
              }
            }
          }
        }
      }
    }

    // 2. Keyword evaluation
    if (Array.isArray(keywords)) {
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase().trim();
        if (rawText.includes(kwLower)) {
          if (!matchedTerms.includes(kw)) {
            matchedTerms.push(kw);
          }
          // Locate timestamp in segments
          for (const seg of segments) {
            if ((seg.text || "").toLowerCase().includes(kwLower)) {
              if (typeof seg.timestamp === "number" && bestTimestampSec === null) {
                bestTimestampSec = seg.timestamp;
              }
            }
          }
        }
      }
    }

    const totalExpected = (phrases.length + keywords.length) || 1;
    const score = matchedTerms.length > 0 ? (matchedTerms.length / totalExpected) : 0.0;

    return {
      score: Math.min(1.0, score),
      phraseScore,
      matchedTerms,
      bestMatchTimestamp: this.formatTimestamp(bestTimestampSec),
      timestampSec: bestTimestampSec,
    };
  }
}

module.exports = {
  VideoTranscript,
};
