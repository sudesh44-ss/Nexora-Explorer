"use strict";

const { FilterTypes } = require("../filters/filterTypes.cjs");

class VideoValidator {
  /**
   * Checks if candidate is a video
   */
  static isVideo(fileRecord) {
    if (!fileRecord) return false;
    return FilterTypes.matchesType(fileRecord, "video");
  }
}

module.exports = {
  VideoValidator,
};
