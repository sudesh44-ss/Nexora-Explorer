"use strict";

class ContentNormalizer {
  /**
   * Cleans and sanitizes textual signals while strictly preserving numbers, dates, currency, and IDs
   */
  static cleanText(text) {
    if (!text || typeof text !== "string") return "";
    return text
      .replace(/[\r\n\t]+/g, " ")
      .replace(/[^\S\r\n]+/g, " ")
      .trim();
  }

  /**
   * Constructs the authoritative searchable string representation for FTS5 and Embedding
   */
  static buildSearchableText(content) {
    if (!content) return "";

    const parts = [];

    // 1. Filename & Folder
    if (content.filename) parts.push(content.filename);
    if (content.folder) parts.push(content.folder);

    // 2. Native & OCR Text
    if (content.nativeText) parts.push(this.cleanText(content.nativeText));
    if (content.ocrText) parts.push(this.cleanText(content.ocrText));

    // 3. Vision Description & Tags
    if (content.visionDescription) parts.push(this.cleanText(content.visionDescription));
    if (Array.isArray(content.tags) && content.tags.length > 0) {
      parts.push(content.tags.join(" "));
    }
    if (Array.isArray(content.detectedObjects) && content.detectedObjects.length > 0) {
      parts.push(content.detectedObjects.join(" "));
    }
    if (Array.isArray(content.concepts) && content.concepts.length > 0) {
      parts.push(content.concepts.join(" "));
    }

    // 4. Transcription
    if (content.transcript) parts.push(this.cleanText(content.transcript));

    // 5. Entities
    if (Array.isArray(content.entities) && content.entities.length > 0) {
      const entityVals = content.entities.map((e) => e.value || "").filter(Boolean);
      if (entityVals.length > 0) parts.push(entityVals.join(" "));
    }

    return parts.filter(Boolean).join(" ");
  }
}

module.exports = {
  ContentNormalizer,
};
