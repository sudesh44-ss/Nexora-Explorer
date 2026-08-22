"use strict";

const fs = require("fs");
const fsp = fs.promises;
const { BaseExtractor } = require("../extractors/baseExtractor.cjs");
const { createExtractionResult, normalizeCodeText } = require("../extractionResult.cjs");
const { ExtractionErrorCode } = require("../extractionErrors.cjs");

const CODE_EXTENSIONS = [
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".py", ".java", ".kt", ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp",
  ".cs", ".html", ".htm", ".css", ".scss", ".sass", ".less",
  ".sql", ".sh", ".bash", ".zsh", ".bat", ".cmd", ".ps1",
  ".rb", ".php", ".go", ".rs", ".swift", ".vue", ".svelte",
  ".dart", ".lua", ".r", ".pl", ".scala", ".xml", ".svg",
];

class CodeExtractor extends BaseExtractor {
  constructor() {
    super("code", CODE_EXTENSIONS);
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
          message: `File not found: ${fileRecord.path}`,
        });
      }

      const stat = await fsp.stat(fileRecord.path);
      if (stat.size > maxFileSizeBytes) {
        return createExtractionResult({
          success: false,
          fileId: fileRecord.file_id,
          extractor: this.name,
          errorCode: ExtractionErrorCode.CONTENT_TOO_LARGE,
          message: `Code file size (${stat.size} bytes) exceeds limit (${maxFileSizeBytes} bytes)`,
        });
      }

      const raw = await fsp.readFile(fileRecord.path, "utf8");
      let text = raw;
      let truncated = false;

      if (text.length > maxChars) {
        text = text.slice(0, maxChars);
        truncated = true;
      }

      const normalized = normalizeCodeText(text);

      return createExtractionResult({
        success: true,
        fileId: fileRecord.file_id,
        extractor: this.name,
        contentType: "text/plain",
        text: normalized,
        truncated,
        warnings: truncated ? ["Source code text was truncated to limit"] : [],
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
  CodeExtractor,
  CODE_EXTENSIONS,
};
