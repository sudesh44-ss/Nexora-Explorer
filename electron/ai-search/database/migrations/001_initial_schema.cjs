"use strict";

/**
 * Migration 001: Initial Core Schema & FTS5 Virtual Table
 */
module.exports = {
  version: 1,
  name: "001_initial_schema",

  up(db) {
    // 1. Files Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        extension TEXT,
        size INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        hash TEXT,
        mime_type TEXT,
        status TEXT NOT NULL DEFAULT 'discovered',
        is_hidden INTEGER NOT NULL DEFAULT 0,
        is_system INTEGER NOT NULL DEFAULT 0,
        is_symlink INTEGER NOT NULL DEFAULT 0,
        indexed_at TEXT,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_files_file_id ON files(file_id);
      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
      CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension);
      CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
      CREATE INDEX IF NOT EXISTS idx_files_modified_at ON files(modified_at);
      CREATE INDEX IF NOT EXISTS idx_files_mime_type ON files(mime_type);
    `);

    // 2. Future-ready File Content Table (Storage boundary only)
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_content (
        file_id TEXT PRIMARY KEY REFERENCES files(file_id) ON DELETE CASCADE,
        extracted_text TEXT,
        summary TEXT,
        word_count INTEGER DEFAULT 0,
        extracted_at TEXT
      );
    `);

    // 3. Future-ready File AI Metadata Table (Storage boundary only)
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_ai (
        file_id TEXT PRIMARY KEY REFERENCES files(file_id) ON DELETE CASCADE,
        description TEXT,
        tags TEXT,
        entities TEXT,
        concepts TEXT,
        analyzed_at TEXT
      );
    `);

    // 4. FTS5 Virtual Search Table
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS file_search USING fts5(
        file_id UNINDEXED,
        filename,
        folder,
        text,
        description,
        tags,
        keywords,
        tokenize = 'trigram'
      );
    `);

    // 5. Automatic FTS5 Synchronization Triggers
    // Trigger on INSERT: Populate FTS5 record with filename & folder path
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_files_fts_insert AFTER INSERT ON files
      BEGIN
        INSERT INTO file_search(file_id, filename, folder, text, description, tags, keywords)
        VALUES (
          NEW.file_id,
          NEW.name,
          NEW.path,
          '',
          '',
          '',
          NEW.extension
        );
      END;
    `);

    // Trigger on UPDATE: Synchronize filename/folder/extension in FTS5
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_files_fts_update AFTER UPDATE ON files
      BEGIN
        UPDATE file_search
        SET filename = NEW.name,
            folder = NEW.path,
            keywords = NEW.extension
        WHERE file_id = OLD.file_id;
      END;
    `);

    // Trigger on DELETE: Remove FTS5 record cleanly
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_files_fts_delete AFTER DELETE ON files
      BEGIN
        DELETE FROM file_search WHERE file_id = OLD.file_id;
      END;
    `);
  },

  down(db) {
    db.exec(`
      DROP TRIGGER IF EXISTS trg_files_fts_delete;
      DROP TRIGGER IF EXISTS trg_files_fts_update;
      DROP TRIGGER IF EXISTS trg_files_fts_insert;
      DROP TABLE IF EXISTS file_search;
      DROP TABLE IF EXISTS file_ai;
      DROP TABLE IF EXISTS file_content;
      DROP TABLE IF EXISTS files;
    `);
  },
};
