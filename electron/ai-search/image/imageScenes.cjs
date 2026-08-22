"use strict";

class ImageScenes {
  /**
   * Evaluates scene detection matches
   */
  static match(queryScenes = [], aiRecord = null) {
    if (!Array.isArray(queryScenes) || queryScenes.length === 0 || !aiRecord) {
      return { score: 0.0, matchedScenes: [] };
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

    let tags = [];
    if (typeof aiRecord?.tags === "string") {
      try {
        tags = JSON.parse(aiRecord.tags);
      } catch {}
    } else if (Array.isArray(aiRecord?.tags)) {
      tags = aiRecord.tags;
    }

    const indexedScenes = [];
    if (Array.isArray(aiMeta.scenes)) {
      for (const sc of aiMeta.scenes) {
        if (typeof sc === "string") indexedScenes.push(sc.toLowerCase());
        else if (sc && typeof sc.label === "string") indexedScenes.push(sc.label.toLowerCase());
      }
    }

    for (const tag of tags) {
      if (typeof tag === "string") indexedScenes.push(tag.toLowerCase());
    }

    const matched = [];
    for (const qs of queryScenes) {
      const qLower = qs.toLowerCase().trim();
      if (indexedScenes.some((is) => is === qLower || is.includes(qLower))) {
        matched.push(qs);
      }
    }

    const score = queryScenes.length > 0 ? (matched.length / queryScenes.length) : 0.0;
    return {
      score: Math.min(1.0, score),
      matchedScenes: matched,
    };
  }
}

module.exports = {
  ImageScenes,
};
