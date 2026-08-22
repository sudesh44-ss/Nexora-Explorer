"use strict";

class IndexInvalidator {
  /**
   * Invalidates derived content, vectors, and AI metadata when file content changes
   */
  static invalidateDerivedData(fileId, db, vectors) {
    if (!fileId || !db || !db.isOpen) return;

    if (db.tx) {
      db.tx.run(() => {
        // Invalidate FTS content
        if (db.fts) {
          db.fts.updateSearchableContent(fileId, { text: "", description: "", tags: "[]", keywords: "" });
        }
        // Delete or clear file_content
        if (db.content) {
          db.content.deleteByFileId(fileId);
        }
        // Delete file_ai
        if (db.ai) {
          db.ai.deleteByFileId(fileId);
        }
      });
    }

    // Invalidate vector store
    if (vectors && vectors.store) {
      vectors.store.delete(fileId);
    }
  }

  /**
   * Completely purges a deleted file across all database and vector tables
   */
  static purgeDeletedFile(fileId, db, vectors) {
    if (!fileId || !db || !db.isOpen) return;

    if (db.tx) {
      db.tx.run(() => {
        if (db.content) db.content.deleteByFileId(fileId);
        if (db.ai) db.ai.deleteByFileId(fileId);
        if (db.files) db.files.deleteByFileId(fileId);
      });
    }

    if (vectors && vectors.store) {
      vectors.store.delete(fileId);
    }
  }
}

module.exports = {
  IndexInvalidator,
};
