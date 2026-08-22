"use strict";

const { ExtractionErrorCode, ExtractionError } = require("../extractionErrors.cjs");

/**
 * Base Extractor Contract for all file format extractors
 */
class BaseExtractor {
  constructor(name = "base", supportedExtensions = []) {
    this.name = name;
    this.supportedExtensions = new Set(
      supportedExtensions.map((ext) => (ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`))
    );
  }

  /**
   * Checks if this extractor can handle the given file record
   * @param {Object} fileRecord - FileRecord from Part 2 Scanner
   * @returns {boolean}
   */
  canExtract(fileRecord) {
    if (!fileRecord || !fileRecord.extension) return false;
    return this.supportedExtensions.has(fileRecord.extension.toLowerCase());
  }

  /**
   * Extracts text content from the file record
   * @param {Object} fileRecord
   * @param {Object} [options]
   * @returns {Promise<import("../extractionResult.cjs").ExtractionResult>}
   */
  async extract(fileRecord, options = {}) {
    throw new ExtractionError(
      ExtractionErrorCode.UNSUPPORTED_TYPE,
      `Extractor ${this.name} must implement extract()`
    );
  }

  /**
   * Returns capabilities metadata
   */
  getCapabilities() {
    return {
      name: this.name,
      supportedExtensions: Array.from(this.supportedExtensions),
    };
  }

  async shutdown() {}
}

module.exports = {
  BaseExtractor,
};
