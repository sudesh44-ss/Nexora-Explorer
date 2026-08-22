"use strict";

const { VideoDuration, DURATION_MULTIPLIERS } = require("../video/videoDuration.cjs");

class AudioDuration {
  /**
   * Parses audio duration string e.g. ">30min" to seconds
   */
  static parse(raw) {
    return VideoDuration.parse(raw);
  }

  /**
   * Evaluates if audio duration satisfies condition
   */
  static evaluate(durationSec, condition) {
    return VideoDuration.evaluate(durationSec, condition);
  }
}

module.exports = {
  AudioDuration,
  DURATION_MULTIPLIERS,
};
