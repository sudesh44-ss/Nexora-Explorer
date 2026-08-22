"use strict";

const fs = require("fs");
const fsp = fs.promises;
const { BaseExtractor } = require("../extractors/baseExtractor.cjs");
const { createExtractionResult, normalizeDocumentText } = require("../extractionResult.cjs");
const { ExtractionErrorCode } = require("../extractionErrors.cjs");

let PDFParseClass = null;
try {
  const pdfModule = require("pdf-parse");
  PDFParseClass = pdfModule.PDFParse || (typeof pdfModule === "function" ? pdfModule : null);
} catch {
  PDFParseClass = null;
}

class PdfExtractor extends BaseExtractor {
  constructor() {
    super("pdf", [".pdf"]);
  }

  async extract(fileRecord, options = {}) {
    const maxChars = options.maxExtractedCharacters || 1000000;
    const maxFileSizeBytes = options.maxFileSizeBytes || (100 * 1024 * 1024);

    try {
      if (!fs.existsSync(fileRecord.path)) {
        return createExtractionResult({
          success: false,
          fileId: fileRecord.file_id,
          extractor: this.name,
          errorCode: ExtractionErrorCode.FILE_NOT_FOUND,
          message: `PDF file not found: ${fileRecord.path}`,
        });
      }

      const stat = await fsp.stat(fileRecord.path);
      if (stat.size > maxFileSizeBytes) {
        return createExtractionResult({
          success: false,
          fileId: fileRecord.file_id,
          extractor: this.name,
          errorCode: ExtractionErrorCode.CONTENT_TOO_LARGE,
          message: `PDF size (${stat.size} bytes) exceeds limit (${maxFileSizeBytes} bytes)`,
        });
      }

      const buffer = await fsp.readFile(fileRecord.path);
      let extractedText = "";

      if (PDFParseClass) {
        let parserInstance = null;
        try {
          if (typeof PDFParseClass === "function" && PDFParseClass.prototype && typeof PDFParseClass.prototype.getText === "function") {
            // pdf-parse v2+ Class API
            parserInstance = new PDFParseClass({ data: buffer });
            if (typeof parserInstance.load === "function") {
              await parserInstance.load();
            }
            const res = await parserInstance.getText();
            if (Array.isArray(res?.pages) && res.pages.length > 0) {
              extractedText = res.pages.map((p) => (p && typeof p.text === "string" ? p.text : "")).filter(Boolean).join("\n\n");
            } else if (typeof res === "string") {
              extractedText = res;
            } else if (res?.text) {
              extractedText = res.text;
            }
          } else if (typeof PDFParseClass === "function") {
            // pdf-parse v1 Function API
            const res = await PDFParseClass(buffer);
            extractedText = res?.text || "";
          }
        } catch {
          // Fallback to stream parsing if pdf-parse encounters syntax anomaly
          extractedText = this._extractRawPdfText(buffer);
        } finally {
          if (parserInstance && typeof parserInstance.destroy === "function") {
            try {
              await parserInstance.destroy();
            } catch {}
          }
        }
      } else {
        extractedText = this._extractRawPdfText(buffer);
      }

      // Strip synthetic page markers inserted by pdf parsers (e.g. '-- 1 of 5 --')
      const cleanedPdfText = (extractedText || "").replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim();
      const normalized = normalizeDocumentText(cleanedPdfText);

      // Scanned PDF detection (no extractable text layer)
      if (!normalized || normalized.length === 0) {
        return createExtractionResult({
          success: true,
          fileId: fileRecord.file_id,
          extractor: this.name,
          contentType: "application/pdf",
          text: "",
          characterCount: 0,
          wordCount: 0,
          warnings: ["TEXT_NOT_AVAILABLE: Scanned PDF without text layer (OCR required in future phase)"],
        });
      }

      let truncated = false;
      let finalDocText = normalized;

      if (finalDocText.length > maxChars) {
        finalDocText = finalDocText.slice(0, maxChars);
        truncated = true;
      }

      return createExtractionResult({
        success: true,
        fileId: fileRecord.file_id,
        extractor: this.name,
        contentType: "application/pdf",
        text: finalDocText,
        truncated,
        warnings: truncated ? ["PDF extracted text was truncated to configured limit"] : [],
      });
    } catch (err) {
      return createExtractionResult({
        success: false,
        fileId: fileRecord.file_id,
        extractor: this.name,
        errorCode: ExtractionErrorCode.INVALID_PDF,
        message: `Failed to parse PDF document: ${err.message}`,
      });
    }
  }

  /**
   * Robust fallback raw stream parser for PDF text extraction
   */
  _extractRawPdfText(buffer) {
    try {
      const raw = buffer.toString("latin1");
      const tokens = [];

      // Match Tj text operators: (some text) Tj
      const tjMatches = raw.matchAll(/\(([^()]*)\)\s*Tj/g);
      for (const m of tjMatches) {
        if (m[1]) tokens.push(m[1]);
      }

      // Match TJ text array operators: [(text1) 20 (text2)] TJ
      const tjArrayMatches = raw.matchAll(/\[(.*?)\]\s*TJ/g);
      for (const arrMatch of tjArrayMatches) {
        const innerTextMatches = arrMatch[1].matchAll(/\(([^()]*)\)/g);
        for (const tm of innerTextMatches) {
          if (tm[1]) tokens.push(tm[1]);
        }
      }

      // Clean escape sequences
      return tokens
        .map((t) =>
          t
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\")
        )
        .join(" ");
    } catch {
      return "";
    }
  }
}

module.exports = {
  PdfExtractor,
};
