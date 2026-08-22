"use strict";

const { createSearchResult } = require("../search/searchResult.cjs");

class AudioResultAdapter {
  /**
   * Adapts audio candidate signals into standard SearchResult format
   */
  static adapt(fileRecord, audioSignals, finalScore = 0.0) {
    if (!fileRecord) return null;

    const matchedBy = [];
    if (audioSignals?.scores?.transcriptScore > 0.3) matchedBy.push("audio_transcript");
    if (audioSignals?.scores?.speakerScore > 0.3) matchedBy.push("audio_speaker");
    if (audioSignals?.scores?.tagScore > 0.3) matchedBy.push("audio_tag");
    if (audioSignals?.scores?.conceptScore > 0.3) matchedBy.push("audio_concept");
    if (audioSignals?.scores?.metadataScore > 0.3) matchedBy.push("music_metadata");
    if (audioSignals?.scores?.semanticScore > 0.3) matchedBy.push("semantic");
    if (matchedBy.length === 0) matchedBy.push("audio_metadata");

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
        ...(audioSignals?.scores || {}),
        bestMatchTimestamp: audioSignals?.evidence?.bestMatchTimestamp || null,
        finalScore,
      },
    });
  }
}

module.exports = {
  AudioResultAdapter,
};
