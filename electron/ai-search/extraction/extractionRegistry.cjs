"use strict";

const { PlainTextExtractor } = require("./text/plainTextExtractor.cjs");
const { JsonExtractor } = require("./structured/jsonExtractor.cjs");
const { CsvExtractor } = require("./structured/csvExtractor.cjs");
const { CodeExtractor } = require("./code/codeExtractor.cjs");
const { PdfExtractor } = require("./pdf/pdfExtractor.cjs");
const { DocxExtractor } = require("./office/docxExtractor.cjs");

/**
 * Central registry managing all format-specific extractors
 */
class ExtractionRegistry {
  constructor() {
    this.extractors = [];
    this.extensionMap = new Map();

    this._registerDefaults();
  }

  _registerDefaults() {
    this.register(new PlainTextExtractor());
    this.register(new JsonExtractor());
    this.register(new CsvExtractor());
    this.register(new CodeExtractor());
    this.register(new PdfExtractor());
    this.register(new DocxExtractor());
  }

  /**
   * Registers a new extractor instance
   * @param {import("./extractors/baseExtractor.cjs").BaseExtractor} extractor
   */
  register(extractor) {
    if (!extractor || !extractor.name) return;

    this.extractors.push(extractor);
    if (extractor.supportedExtensions) {
      for (const ext of extractor.supportedExtensions) {
        this.extensionMap.set(ext.toLowerCase(), extractor);
      }
    }
  }

  /**
   * Finds the matching extractor for a FileRecord
   * @param {Object} fileRecord
   * @returns {import("./extractors/baseExtractor.cjs").BaseExtractor|null}
   */
  getExtractor(fileRecord) {
    if (!fileRecord || !fileRecord.extension) return null;

    const ext = fileRecord.extension.toLowerCase();
    return this.extensionMap.get(ext) || null;
  }

  /**
   * Checks if an extractor exists for the given file
   * @param {Object} fileRecord
   * @returns {boolean}
   */
  canExtract(fileRecord) {
    return Boolean(this.getExtractor(fileRecord));
  }

  getSupportedExtensions() {
    return Array.from(this.extensionMap.keys());
  }
}

module.exports = {
  ExtractionRegistry,
};
