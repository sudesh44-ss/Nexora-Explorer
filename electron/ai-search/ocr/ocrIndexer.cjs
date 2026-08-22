"use strict";

class OCRIndexer {
  /**
   * Persists OCR result to SQLite, updates FTS5 index, and creates vector embeddings
   */
  static async indexOCRResult(fileRecord, ocrResult, db, vectors = null) {
    if (!fileRecord || !ocrResult || !ocrResult.success || !db || !db.isOpen) {
      return { success: false };
    }

    // 1. Update Content Repository & FTS5
    if (db.tx) {
      db.tx.run(() => {
        if (db.content) {
          db.content.upsert(fileRecord.file_id, {
            extracted_text: ocrResult.text,
            word_count: (ocrResult.text.match(/\S+/g) || []).length,
          });
        }

        if (db.fts) {
          db.fts.updateSearchableContent(fileRecord.file_id, {
            text: ocrResult.text,
          });
        }
      });
    }

    // 2. Generate Vector Embedding for OCR text
    if (vectors && ocrResult.text) {
      try {
        await vectors.embedFile(fileRecord, {
          text: `${fileRecord.name}. ${ocrResult.text}`,
        });
      } catch {}
    }

    return { success: true };
  }
}

module.exports = {
  OCRIndexer,
};
