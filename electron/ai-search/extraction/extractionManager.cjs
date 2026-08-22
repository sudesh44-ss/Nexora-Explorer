"use strict";

const EventEmitter = require("events");
const { ExtractionRegistry } = require("./extractionRegistry.cjs");
const { createExtractionResult } = require("./extractionResult.cjs");
const { ExtractionErrorCode, ExtractionError } = require("./extractionErrors.cjs");

/**
 * Central Extraction Manager orchestrating registry, cache checking, and database persistence
 */
class ExtractionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.registry = options.registry || new ExtractionRegistry();
    this.options = {
      maxExtractedCharacters: 500000,
      maxFileSizeBytes: 50 * 1024 * 1024,
      ...options,
    };
  }

  canExtract(fileRecord) {
    return this.registry.canExtract(fileRecord);
  }

  getExtractor(fileRecord) {
    return this.registry.getExtractor(fileRecord);
  }

  /**
   * Executes text extraction on a single file record
   *
   * @param {Object} fileRecord
   * @param {Object} [options]
   * @returns {Promise<import("./extractionResult.cjs").ExtractionResult>}
   */
  async extract(fileRecord, options = {}) {
    const extractor = this.registry.getExtractor(fileRecord);
    if (!extractor) {
      return createExtractionResult({
        success: false,
        fileId: fileRecord?.file_id,
        extractor: "none",
        errorCode: ExtractionErrorCode.UNSUPPORTED_TYPE,
        message: `No extractor registered for extension '${fileRecord?.extension}'`,
      });
    }

    const mergedOptions = { ...this.options, ...options };
    return extractor.extract(fileRecord, mergedOptions);
  }

  /**
   * Extracts content and persists it to SQLite and FTS5 with hash-based caching
   *
   * @param {Object} fileRecord
   * @param {import("../database/databaseManager.cjs").DatabaseManager} db
   * @param {Object} [options]
   * @returns {Promise<{success: boolean, cached: boolean, result: Object}>}
   */
  async extractAndPersist(fileRecord, db, options = {}) {
    if (!fileRecord || !db || !db.isOpen) {
      return { success: false, cached: false, error: "Database not initialized" };
    }

    // 1. Hash-based Cache Check: Check if content already exists for this exact hash
    if (fileRecord.hash && !options.forceReextract) {
      const existingContent = db.content.findByFileId(fileRecord.file_id);
      if (existingContent && existingContent.extracted_text !== null) {
        return {
          success: true,
          cached: true,
          result: createExtractionResult({
            success: true,
            fileId: fileRecord.file_id,
            text: existingContent.extracted_text,
            wordCount: existingContent.word_count,
            contentType: "cached",
          }),
        };
      }
    }

    // 2. Perform Extraction
    const extractResult = await this.extract(fileRecord, options);
    if (!extractResult.success) {
      return { success: false, cached: false, result: extractResult };
    }

    // 3. Persist to SQLite file_content and synchronize FTS5 in atomic transaction
    try {
      db.tx.run(() => {
        // Save extracted text
        db.content.upsert(fileRecord.file_id, {
          extracted_text: extractResult.text,
          word_count: extractResult.wordCount,
          summary: "",
          extracted_at: new Date().toISOString(),
        });

        // Update FTS5 virtual table searchable content
        db.fts.updateSearchableContent(fileRecord.file_id, {
          text: extractResult.text,
        });
      });

      this.emit("extracted", { fileId: fileRecord.file_id, charCount: extractResult.characterCount });
      return { success: true, cached: false, result: extractResult };
    } catch (dbErr) {
      return {
        success: false,
        cached: false,
        result: extractResult,
        error: `Database persistence failed: ${dbErr.message}`,
      };
    }
  }
}

module.exports = {
  ExtractionManager,
};
