"use strict";

const { VideoSignals } = require("./videoSignals.cjs");
const { VideoValidator } = require("./videoValidator.cjs");
const { VideoDuration } = require("./videoDuration.cjs");
const { VideoMetadata } = require("./videoMetadata.cjs");

class VideoQueryMatcher {
  /**
   * Matches candidate against video intelligence signals and duration filters
   */
  static match(fileRecord, aiRecord, contentRecord, structuredQuery = {}, vectorScore = 0.0) {
    if (!VideoValidator.isVideo(fileRecord)) {
      return null;
    }

    // Evaluate duration filter if specified in query
    if (structuredQuery.durationFilter) {
      const meta = VideoMetadata.extract(fileRecord, aiRecord);
      const durSec = typeof meta?.duration === "number" ? meta.duration : 0;
      if (!VideoDuration.evaluate(durSec, structuredQuery.durationFilter)) {
        return null;
      }
    }

    return VideoSignals.extract(fileRecord, aiRecord, contentRecord, structuredQuery, vectorScore);
  }
}

module.exports = {
  VideoQueryMatcher,
};
