"use strict";

const fs = require("fs");
const fsp = fs.promises;
const { BaseExtractor } = require("../extractors/baseExtractor.cjs");
const { createExtractionResult, normalizeDocumentText } = require("../extractionResult.cjs");
const { ExtractionErrorCode } = require("../extractionErrors.cjs");

const CSV_EXTENSIONS = [".csv", ".tsv"];

class CsvExtractor extends BaseExtractor {
  constructor() {
    super("csv", CSV_EXTENSIONS);
  }

  async extract(fileRecord, options = {}) {
    const maxChars = options.maxExtractedCharacters || 500000;
    const isTsv = (fileRecord.extension || "").toLowerCase() === ".tsv";
    const delimiter = isTsv ? "\t" : ",";

    try {
      if (!fs.existsSync(fileRecord.path)) {
        return createExtractionResult({
          success: false,
          fileId: fileRecord.file_id,
          extractor: this.name,
          errorCode: ExtractionErrorCode.FILE_NOT_FOUND,
          message: `File not found: ${fileRecord.path}`,
        });
      }

      const raw = await fsp.readFile(fileRecord.path, "utf8");
      const lines = raw.split(/\r?\n/);
      const outputLines = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Split by delimiter while keeping words clean
        const cells = trimmed.split(delimiter).map((c) => c.replace(/^["']|["']$/g, "").trim()).filter(Boolean);
        if (cells.length > 0) {
          outputLines.push(cells.join(" "));
        }

        if (outputLines.length * 50 > maxChars) break;
      }

      let extractedText = outputLines.join("\n");
      let truncated = false;

      if (extractedText.length > maxChars) {
        extractedText = extractedText.slice(0, maxChars);
        truncated = true;
      }

      const normalized = normalizeDocumentText(extractedText);

      return createExtractionResult({
        success: true,
        fileId: fileRecord.file_id,
        extractor: this.name,
        contentType: "text/csv",
        text: normalized,
        truncated,
      });
    } catch (err) {
      return createExtractionResult({
        success: false,
        fileId: fileRecord.file_id,
        extractor: this.name,
        errorCode: ExtractionErrorCode.EXTRACTION_FAILED,
        message: err.message,
      });
    }
  }
}

module.exports = {
  CsvExtractor,
  CSV_EXTENSIONS,
};
