"use strict";

const path = require("path");
const { createUnifiedContent } = require("./unifiedContent.cjs");
const { ContentNormalizer } = require("./contentNormalizer.cjs");
const { ProcessingStatus } = require("./contentSources.cjs");

class ContentBuilder {
  /**
   * Assembles a UnifiedContent representation from disparate analysis outputs
   */
  static build(fileRecord, extractionResult = null, ocrResult = null, mediaResult = null, docResult = null, hasEmbedding = false) {
    if (!fileRecord) return null;

    const nativeText = extractionResult?.text || "";
    const ocrText = ocrResult?.text || "";
    const visionDescription = mediaResult?.description || "";
    const tags = Array.isArray(mediaResult?.tags) ? mediaResult.tags : [];
    const detectedObjects = Array.isArray(mediaResult?.objects) ? mediaResult.objects : [];
    const concepts = Array.isArray(mediaResult?.concepts) ? mediaResult.concepts : [];
    const entities = Array.isArray(docResult?.entities) ? docResult.entities : [];
    const transcript = mediaResult?.transcript || "";

    const folder = fileRecord.path ? path.dirname(fileRecord.path) : "";

    // Determine processing status
    let processingStatus = ProcessingStatus.METADATA_READY;
    if (hasEmbedding && (nativeText || ocrText || visionDescription)) {
      processingStatus = ProcessingStatus.COMPLETE;
    } else if (nativeText) {
      processingStatus = ProcessingStatus.TEXT_READY;
    } else if (ocrText) {
      processingStatus = ProcessingStatus.OCR_READY;
    } else if (visionDescription || tags.length > 0) {
      processingStatus = ProcessingStatus.MEDIA_ANALYZED;
    }

    const contentObj = createUnifiedContent({
      fileId: fileRecord.file_id,
      sourceHash: fileRecord.hash || "",
      filename: fileRecord.name,
      path: fileRecord.path,
      folder,
      fileType: fileRecord.extension ? fileRecord.extension.replace(/^\./, "").toLowerCase() : "unknown",
      mimeType: fileRecord.mime_type || "application/octet-stream",
      size: fileRecord.size || 0,
      modifiedAt: fileRecord.modified_at || null,

      nativeText,
      ocrText,
      visionDescription,
      tags,
      detectedObjects,
      concepts,
      entities,
      transcript,

      hasEmbedding,
      processingStatus,
    });

    contentObj.searchableText = ContentNormalizer.buildSearchableText(contentObj);
    return contentObj;
  }
}

module.exports = {
  ContentBuilder,
};
