"use strict";

const { ContentAnalyzer } = require("./contentAnalyzer.cjs");
const { getMediaType } = require("./mediaCapabilities.cjs");

/**
 * Media Indexer coordinating Media Analysis, SQLite persistence, FTS5 sync, and Vector Embedding
 */
class MediaIndexer {
  constructor(services = {}) {
    this.db = services.databaseManager || null;
    this.vectors = services.embeddingManager || null;
    this.analyzer = new ContentAnalyzer(services);
  }

  /**
   * Indexes a media file end-to-end
   *
   * @param {Object} fileRecord
   * @param {Object} [options]
   * @returns {Promise<{indexed: boolean, mediaResult: Object, vectorResult?: Object}>}
   */
  async indexMediaFile(fileRecord, options = {}) {
    if (!fileRecord || !fileRecord.file_id) {
      return { indexed: false, error: "Invalid file record" };
    }

    const mediaType = getMediaType(fileRecord.extension);
    if (!mediaType) {
      return { indexed: false, error: "Not a media file" };
    }

    // 1. Check Hash Cache: If already indexed with same content hash and not force reindex
    if (!options.force && this.db && this.db.ai) {
      const existing = this.db.ai.findByFileId(fileRecord.file_id);
      if (existing && existing.description && !options.reindexStale) {
        return { indexed: true, cached: true, mediaResult: existing };
      }
    }

    // 2. Perform Content / Vision Analysis
    const mediaResult = await this.analyzer.analyze(fileRecord, options);
    if (!mediaResult.success) {
      return { indexed: false, mediaResult };
    }

    // 3. Persist to SQLite file_ai repository
    if (this.db && this.db.ai) {
      this.db.ai.upsert(fileRecord.file_id, {
        description: mediaResult.description,
        tags: mediaResult.tags,
        entities: mediaResult.objects,
        concepts: mediaResult.concepts,
        analyzed_at: mediaResult.createdAt,
      });
    }

    // 4. Synchronize searchable fields to FTS5
    if (this.db && this.db.fts) {
      const ftsKeywords = [
        ...mediaResult.tags,
        ...mediaResult.concepts,
        ...mediaResult.objects.map((o) => o.label || o),
      ].join(" ");

      this.db.fts.updateSearchableContent(fileRecord.file_id, {
        description: mediaResult.description,
        tags: JSON.stringify(mediaResult.tags),
        keywords: ftsKeywords,
      });
    }

    // 5. Generate Vector Embedding via Part 8 EmbeddingManager
    let vectorResult = null;
    if (this.vectors && this.vectors.isInitialized) {
      const semanticText = [
        fileRecord.name,
        mediaResult.description,
        mediaResult.tags.join(" "),
        mediaResult.concepts.join(" "),
      ].filter(Boolean).join(". ");

      vectorResult = await this.vectors.embedFile(fileRecord, {
        text: semanticText,
      });
    }

    return {
      indexed: true,
      cached: false,
      mediaResult,
      vectorResult,
    };
  }
}

module.exports = {
  MediaIndexer,
};
