"use strict";

class AudioConcepts {
  /**
   * Evaluates audio descriptions, captions, and concepts
   *
   * @param {Array<string>} queryConcepts
   * @param {Object} aiRecord
   * @returns {{score: number, matchedConcepts: Array<string>}}
   */
  static match(queryConcepts = [], aiRecord = null) {
    if (!Array.isArray(queryConcepts) || queryConcepts.length === 0 || !aiRecord) {
      return { score: 0.0, matchedConcepts: [] };
    }

    const description = (aiRecord?.description || "").toLowerCase();

    let tags = [];
    if (typeof aiRecord?.tags === "string") {
      try {
        tags = JSON.parse(aiRecord.tags);
      } catch {}
    } else if (Array.isArray(aiRecord?.tags)) {
      tags = aiRecord.tags;
    }
    const lowerTags = tags.map((t) => t.toLowerCase());

    const matched = [];
    for (const qc of queryConcepts) {
      const qLower = qc.toLowerCase().trim();
      if (description.includes(qLower) || lowerTags.includes(qLower)) {
        matched.push(qc);
      }
    }

    const score = queryConcepts.length > 0 ? (matched.length / queryConcepts.length) : 0.0;
    return {
      score: Math.min(1.0, score),
      matchedConcepts: matched,
    };
  }
}

module.exports = {
  AudioConcepts,
};
