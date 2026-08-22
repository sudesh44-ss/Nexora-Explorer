"use strict";

const { VideoMetadata } = require("./videoMetadata.cjs");
const { VideoTranscript } = require("./videoTranscript.cjs");
const { VideoOcr } = require("./videoOcr.cjs");
const { VideoScenes } = require("./videoScenes.cjs");
const { VideoObjects } = require("./videoObjects.cjs");
const { VideoConcepts } = require("./videoConcepts.cjs");

class VideoSignals {
  /**
   * Extracts multi-signal video intelligence
   */
  static extract(fileRecord, aiRecord, contentRecord, structuredQuery = {}, vectorScore = 0.0) {
    const meta = VideoMetadata.extract(fileRecord, aiRecord);
    const transMatch = VideoTranscript.match(structuredQuery.keywords || [], structuredQuery.phrases || [], contentRecord, aiRecord);
    const ocrMatch = VideoOcr.match(structuredQuery.keywords || [], structuredQuery.phrases || [], aiRecord);
    const sceneMatch = VideoScenes.match(structuredQuery.scenes || [], aiRecord);
    const objMatch = VideoObjects.match(structuredQuery.objects || [], aiRecord);
    const conceptMatch = VideoConcepts.match(structuredQuery.concepts || structuredQuery.keywords || [], aiRecord);

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

    // People detection
    let peopleScore = 0.0;
    if (structuredQuery.containsPeople && aiRecord) {
      if (aiMeta.containsPeople || tags.some((t) => ["people", "person", "speaker", "interview"].includes(t.toLowerCase()))) {
        peopleScore = 1.0;
      }
    }

    // Choose best timestamp from transcript or OCR
    const bestMatchTimestamp = transMatch.bestMatchTimestamp || ocrMatch.bestOcrTimestamp || null;

    return {
      fileId: fileRecord?.file_id,
      metadata: meta,
      scores: {
        transcriptScore: transMatch.score,
        transcriptPhraseScore: transMatch.phraseScore,
        ocrScore: ocrMatch.score,
        sceneScore: sceneMatch.score,
        objectScore: objMatch.score,
        conceptScore: conceptMatch.score,
        peopleScore,
        semanticScore: vectorScore || 0.0,
      },
      evidence: {
        matchedTranscriptTerms: transMatch.matchedTerms,
        matchedOcrTerms: ocrMatch.matchedOcrTerms,
        matchedScenes: sceneMatch.matchedScenes,
        matchedObjects: objMatch.matchedObjects,
        matchedConcepts: conceptMatch.matchedConcepts,
        bestMatchTimestamp,
      },
    };
  }
}

module.exports = {
  VideoSignals,
};
