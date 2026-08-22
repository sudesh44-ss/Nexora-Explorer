"use strict";

const { FilterTypes } = require("../filters/filterTypes.cjs");

class ModalityResolver {
  /**
   * Resolves modality from FileRecord or extension
   *
   * @param {Object} fileRecord
   * @returns {"document"|"image"|"video"|"audio"|"code"|"archive"|"unknown"}
   */
  static resolve(fileRecord) {
    if (!fileRecord) return "unknown";

    if (FilterTypes.matchesType(fileRecord, "image")) return "image";
    if (FilterTypes.matchesType(fileRecord, "video")) return "video";
    if (FilterTypes.matchesType(fileRecord, "audio")) return "audio";
    if (FilterTypes.matchesType(fileRecord, "pdf") || FilterTypes.matchesType(fileRecord, "document")) return "document";
    if (FilterTypes.matchesType(fileRecord, "code")) return "code";
    if (FilterTypes.matchesType(fileRecord, "archive")) return "archive";

    return "document";
  }
}

module.exports = {
  ModalityResolver,
};
