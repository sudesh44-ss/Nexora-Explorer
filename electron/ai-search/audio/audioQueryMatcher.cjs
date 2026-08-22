"use strict";

const { AudioSignals } = require("./audioSignals.cjs");
const { AudioValidator } = require("./audioValidator.cjs");
const { AudioDuration } = require("./audioDuration.cjs");
const { AudioMetadata } = require("./audioMetadata.cjs");

class AudioQueryMatcher {
  /**
   * Matches candidate against audio intelligence signals and duration filters
   */
  static match(fileRecord, aiRecord, contentRecord, structuredQuery = {}, vectorScore = 0.0) {
    if (!AudioValidator.isAudio(fileRecord)) {
      return null;
    }

    // Evaluate duration filter if specified in query
    if (structuredQuery.durationFilter) {
      const meta = AudioMetadata.extract(fileRecord, aiRecord);
      const durSec = typeof meta?.duration === "number" ? meta.duration : 0;
      if (!AudioDuration.evaluate(durSec, structuredQuery.durationFilter)) {
        return null;
      }
    }

    return AudioSignals.extract(fileRecord, aiRecord, contentRecord, structuredQuery, vectorScore);
  }
}

module.exports = {
  AudioQueryMatcher,
};
