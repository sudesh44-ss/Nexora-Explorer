"use strict";

class AudioTags {
  /**
   * Matches query tags against normalized indexed AI tags & genre
   *
   * @param {Array<string>} queryTags
   * @param {Object} aiRecord
   * @param {Object} fileRecord
   * @returns {{score: number, matchedTags: Array<string>}}
   */
  static match(queryTags = [], aiRecord = null, fileRecord = null) {
    if (!Array.isArray(queryTags) || queryTags.length === 0) {
      return { score: 0.0, matchedTags: [] };
    }

    let tags = [];
    if (typeof aiRecord?.tags === "string") {
      try {
        tags = JSON.parse(aiRecord.tags);
      } catch {}
    } else if (Array.isArray(aiRecord?.tags)) {
      tags = aiRecord.tags;
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

    const music = aiMeta.musicMetadata || aiMeta.music || fileRecord?.music || {};
    const candidateTags = tags.map((t) => t.toLowerCase());
    if (music.genre) candidateTags.push(music.genre.toLowerCase());
    if (music.artist) candidateTags.push(music.artist.toLowerCase());
    if (music.album) candidateTags.push(music.album.toLowerCase());

    const matched = [];
    for (const qt of queryTags) {
      const qLower = qt.toLowerCase().trim();
      if (candidateTags.some((ct) => ct === qLower || ct.includes(qLower))) {
        matched.push(qt);
      }
    }

    const score = queryTags.length > 0 ? (matched.length / queryTags.length) : 0.0;
    return {
      score: Math.min(1.0, score),
      matchedTags: matched,
    };
  }
}

module.exports = {
  AudioTags,
};
