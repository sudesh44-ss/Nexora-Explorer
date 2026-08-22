"use strict";

const fs = require("fs");
const fsp = fs.promises;

class OCRPreprocessor {
  /**
   * Preprocesses image or page buffer safely for OCR
   */
  static async preprocessImage(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found for preprocessing: ${filePath}`);
    }

    const stat = await fsp.stat(filePath);
    const maxSizeBytes = (options.maxFileSizeMb || 50) * 1024 * 1024;

    if (stat.size > maxSizeBytes) {
      throw new Error(`File size (${stat.size} bytes) exceeds OCR limit`);
    }

    const buffer = await fsp.readFile(filePath);
    return {
      success: true,
      originalSize: stat.size,
      buffer,
      isRotated: Boolean(options.rotation),
      isGrayscale: Boolean(options.grayscale),
    };
  }
}

module.exports = {
  OCRPreprocessor,
};
