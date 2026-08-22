"use strict";

const fs = require("fs");
const fsp = fs.promises;
const zlib = require("zlib");
const { BaseExtractor } = require("../extractors/baseExtractor.cjs");
const { createExtractionResult, normalizeDocumentText } = require("../extractionResult.cjs");
const { ExtractionErrorCode } = require("../extractionErrors.cjs");

/**
 * Lightweight, zero-dependency DOCX (PKZip + word/document.xml) parser
 */
function extractTextFromDocxBuffer(buffer) {
  // Find central directory or local headers for 'word/document.xml'
  let offset = 0;
  let docXmlBuffer = null;

  while (offset < buffer.length - 30) {
    // Check for ZIP local file header signature: 0x04034b50
    if (
      buffer[offset] === 0x50 &&
      buffer[offset + 1] === 0x4b &&
      buffer[offset + 2] === 0x03 &&
      buffer[offset + 3] === 0x04
    ) {
      const compMethod = buffer.readUInt16LE(offset + 8);
      const compSize = buffer.readUInt32LE(offset + 18);
      const uncompSize = buffer.readUInt32LE(offset + 22);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraFieldLen = buffer.readUInt16LE(offset + 28);

      const fileNameStart = offset + 30;
      const fileName = buffer.toString("utf8", fileNameStart, fileNameStart + fileNameLen);
      const dataStart = fileNameStart + fileNameLen + extraFieldLen;

      if (fileName === "word/document.xml") {
        const compData = buffer.subarray(dataStart, dataStart + compSize);
        if (compMethod === 8) {
          // Deflated
          docXmlBuffer = zlib.inflateRawSync(compData);
        } else if (compMethod === 0) {
          // Stored (no compression)
          docXmlBuffer = compData;
        }
        break;
      }

      offset = dataStart + compSize;
    } else {
      offset++;
    }
  }

  if (!docXmlBuffer) {
    return "";
  }

  const xmlStr = docXmlBuffer.toString("utf8");

  // Parse paragraphs <w:p> and text nodes <w:t>
  const paragraphMatches = xmlStr.match(/<w:p[\s>].*?<\/w:p>/gs) || [];
  const paragraphs = [];

  for (const pXml of paragraphMatches) {
    // Extract all <w:t ...>text</w:t> nodes
    const textMatches = pXml.match(/<w:t[^>]*>(.*?)<\/w:t>/gs) || [];
    const pText = textMatches
      .map((t) => t.replace(/<w:t[^>]*>|<\/w:t>/g, ""))
      .join("");

    if (pText.trim()) {
      paragraphs.push(pText.trim());
    }
  }

  return paragraphs.join("\n\n");
}

class DocxExtractor extends BaseExtractor {
  constructor() {
    super("docx", [".docx"]);
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
          message: `DOCX file not found: ${fileRecord.path}`,
        });
      }

      const stat = await fsp.stat(fileRecord.path);
      if (stat.size > maxFileSizeBytes) {
        return createExtractionResult({
          success: false,
          fileId: fileRecord.file_id,
          extractor: this.name,
          errorCode: ExtractionErrorCode.CONTENT_TOO_LARGE,
          message: `DOCX size (${stat.size} bytes) exceeds limit (${maxFileSizeBytes} bytes)`,
        });
      }

      const buffer = await fsp.readFile(fileRecord.path);
      const rawText = extractTextFromDocxBuffer(buffer);
      const normalized = normalizeDocumentText(rawText);

      let truncated = false;
      let finalText = normalized;

      if (finalText.length > maxChars) {
        finalText = finalText.slice(0, maxChars);
        truncated = true;
      }

      return createExtractionResult({
        success: true,
        fileId: fileRecord.file_id,
        extractor: this.name,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        text: finalText,
        truncated,
        warnings: truncated ? ["DOCX extracted text was truncated to limit"] : [],
      });
    } catch (err) {
      return createExtractionResult({
        success: false,
        fileId: fileRecord.file_id,
        extractor: this.name,
        errorCode: ExtractionErrorCode.INVALID_DOCX,
        message: `Failed to extract text from DOCX document: ${err.message}`,
      });
    }
  }
}

module.exports = {
  DocxExtractor,
  extractTextFromDocxBuffer,
};
