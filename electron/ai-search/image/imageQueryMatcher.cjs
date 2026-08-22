"use strict";

const { ImageSignals } = require("./imageSignals.cjs");
const { ImageValidator } = require("./imageValidator.cjs");

class ImageQueryMatcher {
  /**
   * Matches candidate against image intelligence signals
   */
  static match(fileRecord, aiRecord, contentRecord, structuredQuery = {}, vectorScore = 0.0) {
    if (!ImageValidator.isImage(fileRecord)) {
      return null;
    }

    return ImageSignals.extract(fileRecord, aiRecord, contentRecord, structuredQuery, vectorScore);
  }
}

module.exports = {
  ImageQueryMatcher,
};
