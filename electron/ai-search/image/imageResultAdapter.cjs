"use strict";

const { createSearchResult } = require("../search/searchResult.cjs");

class ImageResultAdapter {
  /**
   * Adapts image candidate signals into standard SearchResult format
   */
  static adapt(fileRecord, imageSignals, finalScore = 0.0) {
    if (!fileRecord) return null;

    const matchedBy = [];
    if (imageSignals?.scores?.objectScore > 0.3) matchedBy.push("vision_object");
    if (imageSignals?.scores?.sceneScore > 0.3) matchedBy.push("vision_scene");
    if (imageSignals?.scores?.ocrScore > 0.3) matchedBy.push("ocr");
    if (imageSignals?.scores?.conceptScore > 0.3) matchedBy.push("vision_concept");
    if (imageSignals?.scores?.semanticScore > 0.3) matchedBy.push("semantic");
    if (matchedBy.length === 0) matchedBy.push("image_metadata");

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
        ...(imageSignals?.scores || {}),
        finalScore,
      },
    });
  }
}

module.exports = {
  ImageResultAdapter,
};
