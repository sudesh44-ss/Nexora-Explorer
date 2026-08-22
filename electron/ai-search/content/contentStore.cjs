"use strict";

const { ContentBuilder } = require("./contentBuilder.cjs");

class ContentStore {
  constructor(db, vectors = null) {
    this.db = db;
    this.vectors = vectors;
  }

  /**
   * Retrieves unified content for a file by aggregating across SQLite repositories
   */
  getUnifiedContent(fileId) {
    if (!this.db || !this.db.files) return null;

    const fileRec = this.db.files.findByFileId(fileId);
    if (!fileRec) return null;

    let contentRec = null;
    if (this.db.content) {
      contentRec = this.db.content.findByFileId(fileId);
    }

    let aiRec = null;
    if (this.db.ai) {
      aiRec = this.db.ai.findByFileId(fileId);
    }

    let hasEmbedding = false;
    if (this.vectors && this.vectors.store) {
      hasEmbedding = Boolean(this.vectors.store.get(fileId));
    }

    const extractionResult = contentRec ? { text: contentRec.extracted_text } : null;
    const mediaResult = aiRec ? {
      description: aiRec.description || "",
      tags: Array.isArray(aiRec.tags) ? aiRec.tags : (typeof aiRec.tags === "string" ? (aiRec.tags.startsWith("[") ? JSON.parse(aiRec.tags) : aiRec.tags.split(",")) : []),
      objects: Array.isArray(aiRec.objects) ? aiRec.objects : (typeof aiRec.objects === "string" ? (aiRec.objects.startsWith("[") ? JSON.parse(aiRec.objects) : aiRec.objects.split(",")) : []),
      concepts: Array.isArray(aiRec.concepts) ? aiRec.concepts : (typeof aiRec.concepts === "string" ? (aiRec.concepts.startsWith("[") ? JSON.parse(aiRec.concepts) : aiRec.concepts.split(",")) : []),
    } : null;

    return ContentBuilder.build(
      fileRec,
      extractionResult,
      null,
      mediaResult,
      null,
      hasEmbedding
    );
  }
}

module.exports = {
  ContentStore,
};
