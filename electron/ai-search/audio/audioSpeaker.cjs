"use strict";

class AudioSpeaker {
  /**
   * Evaluates speaker identity or query against indexed transcript segments
   *
   * @param {string|Array<string>} targetSpeakers
   * @param {Object} aiRecord
   * @returns {{score: number, matchedSpeakers: Array<string>}}
   */
  static match(targetSpeakers = [], aiRecord = null) {
    if (!aiRecord) {
      return { score: 0.0, matchedSpeakers: [] };
    }

    const speakerList = Array.isArray(targetSpeakers) ? targetSpeakers : [targetSpeakers].filter(Boolean);
    if (speakerList.length === 0) {
      return { score: 0.0, matchedSpeakers: [] };
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

    const segments = Array.isArray(aiMeta.transcriptSegments) ? aiMeta.transcriptSegments : [];
    const indexedSpeakers = new Set();
    for (const seg of segments) {
      if (typeof seg.speaker === "string") {
        indexedSpeakers.add(seg.speaker.toLowerCase());
      }
    }

    const matched = [];
    for (const spk of speakerList) {
      const spkLower = spk.toLowerCase().trim();
      if (indexedSpeakers.has(spkLower)) {
        matched.push(spk);
      }
    }

    const score = speakerList.length > 0 ? (matched.length / speakerList.length) : 0.0;
    return {
      score: Math.min(1.0, score),
      matchedSpeakers: matched,
    };
  }
}

module.exports = {
  AudioSpeaker,
};
