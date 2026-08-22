"use strict";

const fs = require("fs");
const fsp = fs.promises;
const { BaseExtractor } = require("../extractors/baseExtractor.cjs");
const { createExtractionResult, normalizeDocumentText } = require("../extractionResult.cjs");
const { ExtractionErrorCode } = require("../extractionErrors.cjs");

const TEXT_EXTENSIONS = [
  ".txt", ".md", ".log", ".ini", ".env", ".cfg", ".conf",
  ".yaml", ".yml", ".properties", ".rst", ".tex", ".rtf",
];

class PlainTextExtractor extends BaseExtractor {
  constructor() {
    super("plain-text", TEXT_EXTENSIONS);
  }

  async extract(fileRecord, options = {}) {
    const maxChars = options.maxExtractedCharacters || 500000;
    const maxFileSizeBytes = options.maxFileSizeBytes || (50 * 1024 * 1024);

    try {
      if (!fs.existsSync(fileRecord.path)) {
        return createExtractionResult({
          success: false,
          fileId: fileRecord.file_id,
          extractor: this.name,
          errorCode: ExtractionErrorCode.FILE_NOT_FOUND,
          message: `File not found on disk: ${fileRecord.path}`,
        });
      }

      const stat = await fsp.stat(fileRecord.path);
      if (stat.size > maxFileSizeBytes) {
        return createExtractionResult({
          success: false,
          fileId: fileRecord.file_id,
          extractor: this.name,
          errorCode: ExtractionErrorCode.CONTENT_TOO_LARGE,
          message: `File size (${stat.size} bytes) exceeds limit (${maxFileSizeBytes} bytes)`,
        });
      }

      // Read with bounded buffer if file is large
      const bytesToRead = Math.min(stat.size, maxChars * 4);
      const fd = await fsp.open(fileRecord.path, "r");
      const buffer = Buffer.alloc(bytesToRead);
      await fd.read(buffer, 0, bytesToRead, 0);
      await fd.close();

      let rawText = buffer.toString("utf8");
      let truncated = false;

      if (rawText.length > maxChars) {
        rawText = rawText.slice(0, maxChars);
        truncated = true;
      }

      const normalized = normalizeDocumentText(rawText);

      return createExtractionResult({
        success: true,
        fileId: fileRecord.file_id,
        extractor: this.name,
        contentType: "text/plain",
        text: normalized,
        truncated: truncated || stat.size > bytesToRead,
        warnings: truncated ? ["Content was truncated due to configured size limit"] : [],
      });
    } catch (err) {
      const code = err.code === "EACCES" ? ExtractionErrorCode.ACCESS_DENIED : ExtractionErrorCode.EXTRACTION_FAILED;
      return createExtractionResult({
        success: false,
        fileId: fileRecord.file_id,
        extractor: this.name,
        errorCode: code,
        message: err.message,
      });
    }
  }
}

module.exports = {
  PlainTextExtractor,
  TEXT_EXTENSIONS,
};
