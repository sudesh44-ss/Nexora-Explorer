"use strict";

const { isImageFile } = require("../media/mediaCapabilities.cjs");

const TextStatus = Object.freeze({
  NATIVE_TEXT: "native_text",
  OCR_REQUIRED: "ocr_required",
  NO_TEXT: "no_text",
  UNKNOWN: "unknown",
});

class OCRDetector {
  /**
   * Detects whether native text extraction suffices or OCR is required
   */
  static detectTextStatus(fileRecord, extractionResult = null) {
    if (!fileRecord) return TextStatus.UNKNOWN;

    const ext = (fileRecord.extension || "").toLowerCase();

    // 1. Text extraction was attempted
    if (extractionResult) {
      if (extractionResult.success && extractionResult.text && extractionResult.text.trim().length > 20) {
        return TextStatus.NATIVE_TEXT;
      }
      if (extractionResult.isScanned || (ext === ".pdf" && (!extractionResult.text || extractionResult.text.trim().length === 0))) {
        return TextStatus.OCR_REQUIRED;
      }
    }

    // 2. Image formats require OCR
    if (isImageFile(ext)) {
      return TextStatus.OCR_REQUIRED;
    }

    if (ext === ".pdf") {
      return TextStatus.OCR_REQUIRED;
    }

    return TextStatus.NO_TEXT;
  }
}

module.exports = {
  TextStatus,
  OCRDetector,
};
