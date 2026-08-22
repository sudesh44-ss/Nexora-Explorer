"use strict";

const { ImageAnalyzer } = require("./imageAnalyzer.cjs");
const { AudioAnalyzer } = require("./audioAnalyzer.cjs");
const { VideoAnalyzer } = require("./videoAnalyzer.cjs");
const { getMediaType } = require("./mediaCapabilities.cjs");
const { createMediaResult } = require("./mediaResult.cjs");

/**
 * Central Content Analyzer orchestrator routing files to appropriate domain analyzers
 */
class ContentAnalyzer {
  constructor(services = {}) {
    this.aiEngine = services.aiEngine || null;
    this.extractionManager = services.extractionManager || null;
    this.imageAnalyzer = new ImageAnalyzer(this.aiEngine);
    this.audioAnalyzer = new AudioAnalyzer(this.aiEngine);
    this.videoAnalyzer = new VideoAnalyzer(this.aiEngine);
  }

  /**
   * Checks if a given file is supported by any analyzer
   */
  canAnalyze(fileRecord) {
    if (!fileRecord || !fileRecord.extension) return false;
    const mediaType = getMediaType(fileRecord.extension);
    if (mediaType) return true;

    // Check if supported by text/doc extraction
    if (this.extractionManager && this.extractionManager.isSupported(fileRecord.extension)) {
      return true;
    }
    return false;
  }

  /**
   * Analyzes media or extracts text depending on file category
   *
   * @param {Object} fileRecord
   * @param {Object} [options]
   * @returns {Promise<Object>} MediaAnalysisResult or ExtractionResult
   */
  async analyze(fileRecord, options = {}) {
    if (!fileRecord) {
      return createMediaResult({ success: false, error: "Missing file record" });
    }

    const mediaType = getMediaType(fileRecord.extension);

    if (mediaType === "image") {
      return this.imageAnalyzer.analyze(fileRecord, options);
    }
    if (mediaType === "audio") {
      return this.audioAnalyzer.analyze(fileRecord, options);
    }
    if (mediaType === "video") {
      return this.videoAnalyzer.analyze(fileRecord, options);
    }

    // Text & document files fallback to Part 6 ExtractionManager
    if (this.extractionManager && this.extractionManager.isSupported(fileRecord.extension)) {
      return this.extractionManager.extract(fileRecord, options);
    }

    return createMediaResult({
      fileId: fileRecord.file_id,
      success: false,
      error: `Unsupported file category for extension ${fileRecord.extension}`,
    });
  }
}

module.exports = {
  ContentAnalyzer,
};
