"use strict";

const { AudioMetadata } = require("./audioMetadata.cjs");
const { AudioTranscript } = require("./audioTranscript.cjs");
const { AudioSpeaker } = require("./audioSpeaker.cjs");
const { AudioConcepts } = require("./audioConcepts.cjs");
const { AudioTags } = require("./audioTags.cjs");

class AudioSignals {
  /**
   * Extracts multi-signal audio intelligence
   */
  static extract(fileRecord, aiRecord, contentRecord, structuredQuery = {}, vectorScore = 0.0) {
    const meta = AudioMetadata.extract(fileRecord, aiRecord);
    const transMatch = AudioTranscript.match(structuredQuery.keywords || [], structuredQuery.phrases || [], contentRecord, aiRecord);
    const spkMatch = AudioSpeaker.match(structuredQuery.speakers || [], aiRecord);
    const conceptMatch = AudioConcepts.match(structuredQuery.concepts || structuredQuery.keywords || [], aiRecord);
    const tagMatch = AudioTags.match(structuredQuery.keywords || [], aiRecord, fileRecord);

    // Music metadata matching if artist/album/genre queried
    let metadataScore = 0.0;
    if (structuredQuery.keywords) {
      for (const kw of structuredQuery.keywords) {
        const kwLower = kw.toLowerCase();
        if (
          (meta.artist && meta.artist.toLowerCase().includes(kwLower)) ||
          (meta.album && meta.album.toLowerCase().includes(kwLower)) ||
          (meta.title && meta.title.toLowerCase().includes(kwLower)) ||
          (meta.genre && meta.genre.toLowerCase().includes(kwLower))
        ) {
          metadataScore = 1.0;
          break;
        }
      }
    }

    return {
      fileId: fileRecord?.file_id,
      metadata: meta,
      scores: {
        transcriptScore: transMatch.score,
        transcriptPhraseScore: transMatch.phraseScore,
        speakerScore: spkMatch.score,
        conceptScore: conceptMatch.score,
        tagScore: tagMatch.score,
        metadataScore,
        semanticScore: vectorScore || 0.0,
      },
      evidence: {
        matchedTranscriptTerms: transMatch.matchedTerms,
        matchedSpeakers: spkMatch.matchedSpeakers,
        matchedConcepts: conceptMatch.matchedConcepts,
        matchedTags: tagMatch.matchedTags,
        bestMatchTimestamp: transMatch.bestMatchTimestamp,
      },
    };
  }
}

module.exports = {
  AudioSignals,
};
