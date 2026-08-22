"use strict";

const { FilterTypes } = require("../filters/filterTypes.cjs");

class AudioValidator {
  /**
   * Checks if candidate is an audio file
   */
  static isAudio(fileRecord) {
    if (!fileRecord) return false;
    return FilterTypes.matchesType(fileRecord, "audio");
  }
}

module.exports = {
  AudioValidator,
};
