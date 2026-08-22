"use strict";

const fs = require("fs");
const fsp = fs.promises;
const { BaseExtractor } = require("../extractors/baseExtractor.cjs");
const { createExtractionResult, normalizeDocumentText } = require("../extractionResult.cjs");
const { ExtractionErrorCode } = require("../extractionErrors.cjs");

const JSON_EXTENSIONS = [".json", ".jsonl", ".ndjson", ".geojson"];

function flattenJsonToText(obj, depth = 0, maxDepth = 10) {
  if (depth > maxDepth || obj === null || obj === undefined) return "";
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    return String(obj);
  }

  const parts = [];
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const val = flattenJsonToText(item, depth + 1, maxDepth);
      if (val) parts.push(val);
    }
  } else if (typeof obj === "object") {
    for (const [key, val] of Object.entries(obj)) {
      const child = flattenJsonToText(val, depth + 1, maxDepth);
      if (child) {
        parts.push(`${key} ${child}`);
      } else {
        parts.push(key);
      }
    }
  }
  return parts.join(" ");
}

class JsonExtractor extends BaseExtractor {
  constructor() {
    super("json", JSON_EXTENSIONS);
  }

  async extract(fileRecord, options = {}) {
    const maxChars = options.maxExtractedCharacters || 500000;

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
      let extractedText = "";

      try {
        const parsed = JSON.parse(raw);
        extractedText = flattenJsonToText(parsed);
      } catch {
        // Fallback for JSON Lines (jsonl) or non-standard json
        const lines = raw.split(/\r?\n/);
        const lineParts = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const p = JSON.parse(trimmed);
            lineParts.push(flattenJsonToText(p));
          } catch {
            lineParts.push(trimmed);
          }
        }
        extractedText = lineParts.join("\n");
      }

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
        contentType: "application/json",
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
  JsonExtractor,
  JSON_EXTENSIONS,
};
