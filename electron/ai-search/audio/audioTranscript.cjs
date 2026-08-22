"use strict";

const { VideoTranscript } = require("../video/videoTranscript.cjs");

class AudioTranscript {
  /**
   * Matches query keywords and exact phrases against indexed audio transcript
   *
   * @param {Array<string>} keywords
   * @param {Array<string>} phrases
   * @param {Object} contentRecord
   * @param {Object} aiRecord
   * @returns {{score: number, phraseScore: number, matchedTerms: Array<string>, bestMatchTimestamp: string|null, timestampSec: number|null}}
   */
  static match(keywords = [], phrases = [], contentRecord = null, aiRecord = null) {
    return VideoTranscript.match(keywords, phrases, contentRecord, aiRecord);
  }
}

module.exports = {
  AudioTranscript,
};
