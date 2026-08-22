"use strict";

const { ImageMetadata } = require("./imageMetadata.cjs");
const { ImageObjects } = require("./imageObjects.cjs");
const { ImageScenes } = require("./imageScenes.cjs");
const { ImageConcepts } = require("./imageConcepts.cjs");
const { ImageOcr } = require("./imageOcr.cjs");

class ImageSignals {
  /**
   * Extracts multi-signal image intelligence
   */
  static extract(fileRecord, aiRecord, contentRecord, structuredQuery = {}, vectorScore = 0.0) {
    const meta = ImageMetadata.extract(fileRecord, aiRecord);
    const objMatch = ImageObjects.match(structuredQuery.objects || [], aiRecord);
    const sceneMatch = ImageScenes.match(structuredQuery.scenes || [], aiRecord);
    const conceptMatch = ImageConcepts.match(structuredQuery.concepts || structuredQuery.keywords || [], aiRecord);
    const ocrMatch = ImageOcr.match(structuredQuery.keywords || [], structuredQuery.phrases || [], contentRecord);

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

    // People evaluation
    let peopleScore = 0.0;
    if (structuredQuery.containsPeople && aiRecord) {
      if (aiMeta.containsPeople || tags.some((t) => ["people", "person", "friends", "family"].includes(t.toLowerCase()))) {
        peopleScore = 1.0;
      }
    }

    return {
      fileId: fileRecord?.file_id,
      metadata: meta,
      scores: {
        objectScore: objMatch.score,
        sceneScore: sceneMatch.score,
        conceptScore: conceptMatch.score,
        ocrScore: ocrMatch.score,
        peopleScore,
        semanticScore: vectorScore || 0.0,
      },
      evidence: {
        matchedObjects: objMatch.matchedObjects,
        matchedScenes: sceneMatch.matchedScenes,
        matchedConcepts: conceptMatch.matchedConcepts,
        matchedOcrTerms: ocrMatch.matchedOcrTerms,
      },
      isScreenshot: meta?.isScreenshot || false,
    };
  }
}

module.exports = {
  ImageSignals,
};
