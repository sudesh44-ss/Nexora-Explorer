"use strict";

const { createSearchResult } = require("../search/searchResult.cjs");

class VideoResultAdapter {
  /**
   * Adapts video candidate signals into standard SearchResult format
   */
  static adapt(fileRecord, videoSignals, finalScore = 0.0) {
    if (!fileRecord) return null;

    const matchedBy = [];
    if (videoSignals?.scores?.transcriptScore > 0.3) matchedBy.push("video_transcript");
    if (videoSignals?.scores?.ocrScore > 0.3) matchedBy.push("video_ocr");
    if (videoSignals?.scores?.sceneScore > 0.3) matchedBy.push("video_scene");
    if (videoSignals?.scores?.objectScore > 0.3) matchedBy.push("video_object");
    if (videoSignals?.scores?.conceptScore > 0.3) matchedBy.push("video_concept");
    if (videoSignals?.scores?.semanticScore > 0.3) matchedBy.push("semantic");
    if (matchedBy.length === 0) matchedBy.push("video_metadata");

    return createSearchResult({
      fileId: fileRecord.file_id,
      name: fileRecord.name,
      path: fileRecord.path,
      extension: fileRecord.extension,
      mimeType: fileRecord.mime_type,
      size: fileRecord.size,
      modifiedAt: fileRecord.modified_at,
      score: finalScore,
      matchedBy,
      scoreBreakdown: {
        ...(videoSignals?.scores || {}),
        bestMatchTimestamp: videoSignals?.evidence?.bestMatchTimestamp || null,
        finalScore,
      },
    });
  }
}

module.exports = {
  VideoResultAdapter,
};
