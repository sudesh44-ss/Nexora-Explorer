"use strict";

const { FilterTypes } = require("../filters/filterTypes.cjs");

class ImageValidator {
  /**
   * Checks if candidate is an image
   */
  static isImage(fileRecord) {
    if (!fileRecord) return false;
    return FilterTypes.matchesType(fileRecord, "image");
  }
}

module.exports = {
  ImageValidator,
};
