"use strict";

const { VideoTranscript } = require("./videoTranscript.cjs");

class VideoOcr {
  /**
   * Evaluates OCR text detected in sampled video frames
   *
   * @param {Array<string>} keywords
   * @param {Array<string>} phrases
   * @param {Object} aiRecord
   * @returns {{score: number, matchedOcrTerms: Array<string>, bestOcrTimestamp: string|null}}
   */
  static match(keywords = [], phrases = [], aiRecord = null) {
    if (!aiRecord) {
      return { score: 0.0, matchedOcrTerms: [], bestOcrTimestamp: null };
    }

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

    const ocrFrames = Array.isArray(aiMeta.ocrFrames) ? aiMeta.ocrFrames : [];
    const matchedTerms = [];
    let bestTimestampSec = null;

    const allFrameText = ocrFrames.map((f) => (f.text || "").toLowerCase()).join(" ");

    if (Array.isArray(phrases)) {
      for (const p of phrases) {
        const pLower = p.toLowerCase().trim();
        if (allFrameText.includes(pLower)) {
          matchedTerms.push(p);
          for (const f of ocrFrames) {
            if ((f.text || "").toLowerCase().includes(pLower) && typeof f.timestamp === "number" && bestTimestampSec === null) {
              bestTimestampSec = f.timestamp;
            }
          }
        }
      }
    }

    if (Array.isArray(keywords)) {
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase().trim();
        if (allFrameText.includes(kwLower) && !matchedTerms.includes(kw)) {
          matchedTerms.push(kw);
          for (const f of ocrFrames) {
            if ((f.text || "").toLowerCase().includes(kwLower) && typeof f.timestamp === "number" && bestTimestampSec === null) {
              bestTimestampSec = f.timestamp;
            }
          }
        }
      }
    }

    const totalExpected = (phrases.length + keywords.length) || 1;
    const score = matchedTerms.length > 0 ? (matchedTerms.length / totalExpected) : 0.0;

    return {
      score: Math.min(1.0, score),
      matchedOcrTerms: matchedTerms,
      bestOcrTimestamp: VideoTranscript.formatTimestamp(bestTimestampSec),
    };
  }
}

module.exports = {
  VideoOcr,
};
