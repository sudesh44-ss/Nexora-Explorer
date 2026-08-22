"use strict";

const { MockOCRProvider } = require("./ocrProvider.cjs");
const { LocalOCRProvider } = require("./localOCRProvider.cjs");
const { OCRDetector, TextStatus } = require("./ocrDetector.cjs");
const { getOCRConfig } = require("./ocrConfig.cjs");
const { OCRErrorCode, OCRError } = require("./ocrErrors.cjs");

class OCREngine {
  constructor(options = {}) {
    this.config = getOCRConfig(options);
    this.providers = new Map();
    this.activeProviderId = options.providerId || "mock_ocr";

    // Register providers
    this.registerProvider(new LocalOCRProvider(options));
    this.registerProvider(new MockOCRProvider());
  }

  registerProvider(provider) {
    if (!provider || !provider.id) return;
    this.providers.set(provider.id, provider);
  }

  setActiveProvider(providerId) {
    if (this.providers.has(providerId)) {
      this.activeProviderId = providerId;
    }
  }

  getActiveProvider() {
    return this.providers.get(this.activeProviderId) || null;
  }

  /**
   * Runs OCR analysis on a file
   */
  async analyze(fileRecord, options = {}) {
    const targetProviderId = options.providerId || this.activeProviderId;
    let provider = this.providers.get(targetProviderId);
    if (!provider) {
      provider = this.providers.get("local_ocr") || this.providers.get("mock_ocr");
    }
    if (!provider) {
      throw new OCRError(OCRErrorCode.OCR_ENGINE_UNAVAILABLE, "No OCR provider available");
    }

    if (!fileRecord || !fileRecord.path) {
      throw new OCRError(OCRErrorCode.OCR_INVALID_INPUT, "Invalid file record provided for OCR");
    }

    const result = await provider.analyze(fileRecord.path, options);
    return {
      ...result,
      sourceHash: fileRecord.hash || "",
    };
  }
}

module.exports = {
  OCREngine,
};
