"use strict";

const { createOCRResult } = require("./ocrResult.cjs");
const { OCRLanguage } = require("./ocrLanguage.cjs");

class BaseOCRProvider {
  constructor(id, name, version = "1.0.0") {
    this.id = id;
    this.name = name;
    this.version = version;
  }

  canProcess(fileRecord) {
    return false;
  }

  async analyze(filePath, options = {}) {
    throw new Error("analyze() must be implemented by subclass");
  }

  getLanguages() {
    return ["en"];
  }
}

/**
 * Deterministic Mock & Local Heuristic OCR Provider for testing and local fallback
 */
class MockOCRProvider extends BaseOCRProvider {
  constructor() {
    super("mock_ocr", "Mock Local OCR Provider", "1.0.0");
  }

  canProcess(fileRecord) {
    return Boolean(fileRecord && fileRecord.path);
  }

  async analyze(filePath, options = {}) {
    const text = options.overrideText || "Invoice Amazon Laptop ₹45,000 Date: 21/08/2025 INV-2025-001";
    const language = OCRLanguage.detectLanguage(text);

    return createOCRResult({
      success: true,
      text,
      language,
      confidence: 0.95,
      blocks: [
        {
          text: "Invoice Amazon",
          confidence: 0.98,
          boundingBox: { x: 10, y: 10, width: 200, height: 40 },
        },
        {
          text: "Laptop ₹45,000",
          confidence: 0.95,
          boundingBox: { x: 10, y: 60, width: 250, height: 40 },
        },
        {
          text: "Date: 21/08/2025 INV-2025-001",
          confidence: 0.92,
          boundingBox: { x: 10, y: 110, width: 300, height: 40 },
        },
      ],
      lines: text.split("\n"),
      engineId: this.id,
      engineVersion: this.version,
    });
  }

  getLanguages() {
    return ["en", "hi", "mr"];
  }
}

module.exports = {
  BaseOCRProvider,
  MockOCRProvider,
};
