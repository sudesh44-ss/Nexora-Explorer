"use strict";

class VideoObjects {
  /**
   * Evaluates object detection matches across video metadata
   *
   * @param {Array<string>} queryObjects
   * @param {Object} aiRecord
   * @returns {{score: number, matchedObjects: Array<string>}}
   */
  static match(queryObjects = [], aiRecord = null) {
    if (!Array.isArray(queryObjects) || queryObjects.length === 0 || !aiRecord) {
      return { score: 0.0, matchedObjects: [] };
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

    const indexedObjects = [];
    if (Array.isArray(aiMeta.objects)) {
      for (const obj of aiMeta.objects) {
        if (typeof obj === "string") indexedObjects.push(obj.toLowerCase());
        else if (obj && typeof obj.label === "string") indexedObjects.push(obj.label.toLowerCase());
      }
    }

    for (const tag of tags) {
      if (typeof tag === "string") indexedObjects.push(tag.toLowerCase());
    }

    const matched = [];
    for (const qObj of queryObjects) {
      const qLower = qObj.toLowerCase().trim();
      if (indexedObjects.some((io) => io === qLower || io.includes(qLower) || qLower.includes(io))) {
        matched.push(qObj);
      }
    }

    const score = queryObjects.length > 0 ? (matched.length / queryObjects.length) : 0.0;
    return {
      score: Math.min(1.0, score),
      matchedObjects: matched,
    };
  }
}

module.exports = {
  VideoObjects,
};
