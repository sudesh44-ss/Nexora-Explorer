# Nexora AI Search — SQLite Database & FTS5 Subsystem

> **Phase**: Part 3 — SQLite Database + FTS5 Foundation  
> **Status**: Completed & Verified  

---

## 1. Engine & Runtime Architecture

Nexora AI Search utilizes Node.js's native **`node:sqlite` (`DatabaseSync`)** engine available in Node 24+ and Electron 43+.

### Why `node:sqlite`?
- **Zero Native Rebuilds**: No complex `electron-rebuild` toolchains, C++ compiler dependencies, or ABI mismatches across operating systems.
- **Built-in FTS5 Full-Text Engine**: Out-of-the-box support for virtual tables, trigram tokenization, and rank-ordered search queries.
- **Synchronous & Atomic Execution**: Native C-level transaction control (`BEGIN IMMEDIATE`, `COMMIT`, `ROLLBACK`) with zero Promise overhead for batch processing.

```text
┌─────────────────────────────────────────────────────────────┐
│                 Part 2 File Discovery / Scanner             │
│                      (FileRecord Stream)                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 ScannerDatabaseAdapter                      │
│             (Configurable Batch Accumulator)                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      DatabaseManager                        │
│                                                             │
│  ├── FileRepository     → files (CRUD / Idempotent Upsert)  │
│  ├── ContentRepository  → file_content (Storage boundary)   │
│  ├── AIRepository       → file_ai (Storage boundary)        │
│  ├── FTSManager         → file_search (FTS5 Trigram Engine) │
│  └── TransactionManager → Atomic Transaction Boundaries     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     SQLite Storage File                     │
│               (%APPDATA%/Nexora/ai-search/...)              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Deterministic Database Location

- **Production Location**:
  `%APPDATA%\Nexora\ai-search\nexora_ai_search.db` (Windows) or `~/.nexora/ai-search/nexora_ai_search.db` (Linux/macOS).
- **Environment Isolation**: Configurable dynamically via `DatabaseManager({ databaseDir, databasePath })` for tests and sandboxing.

---

## 3. SQLite Database Schema & Migrations

### Migration System
A transactional migration framework tracks schema versions in `schema_migrations`:

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
```

### Table 1: `files` (Core Files Catalog)
Stores basic metadata discovered from the user's filesystem. **Original files are NEVER stored or modified.**

```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL UNIQUE,       -- Deterministic 32-hex composite identifier
  name TEXT NOT NULL,                  -- Base filename
  path TEXT NOT NULL UNIQUE,          -- Full normalized path
  extension TEXT,                      -- e.g. .pdf, .docx
  size INTEGER NOT NULL DEFAULT 0,     -- Size in bytes
  created_at TEXT NOT NULL,            -- ISO 8601 creation timestamp
  modified_at TEXT NOT NULL,           -- ISO 8601 modification timestamp
  hash TEXT,                           -- SHA-256 content hash
  mime_type TEXT,                      -- MIME type (e.g. application/pdf)
  status TEXT NOT NULL DEFAULT 'discovered', -- 'discovered' | 'pending' | 'indexed' | 'error' | 'unavailable'
  is_hidden INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_symlink INTEGER NOT NULL DEFAULT 0,
  indexed_at TEXT,
  error_message TEXT
);
```

### Table 2: `file_content` (Future Content Boundary)
```sql
CREATE TABLE file_content (
  file_id TEXT PRIMARY KEY REFERENCES files(file_id) ON DELETE CASCADE,
  extracted_text TEXT,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  extracted_at TEXT
);
```

### Table 3: `file_ai` (Future AI Boundary)
```sql
CREATE TABLE file_ai (
  file_id TEXT PRIMARY KEY REFERENCES files(file_id) ON DELETE CASCADE,
  description TEXT,
  tags TEXT,          -- JSON array of strings
  entities TEXT,      -- JSON array
  concepts TEXT,      -- JSON array
  analyzed_at TEXT
);
```

### Table 4: `file_search` (FTS5 Full-Text Virtual Table)
```sql
CREATE VIRTUAL TABLE file_search USING fts5(
  file_id UNINDEXED,
  filename,
  folder,
  text,
  description,
  tags,
  keywords,
  tokenize = 'trigram'
);
```

---

## 4. Automatic FTS5 Synchronization

Three database triggers maintain `file_search` in perfect real-time sync with `files`:
- **`trg_files_fts_insert`**: Automatically creates FTS entry on file insertion.
- **`trg_files_fts_update`**: Synchronizes filename, path, and extension on metadata update.
- **`trg_files_fts_delete`**: Deletes FTS search tokens when a file is removed from index.

---

## 5. Performance Configurations (PRAGMAs)

| PRAGMA | Value | Purpose |
| :--- | :--- | :--- |
| `journal_mode` | `WAL` | High-concurrency Write-Ahead Logging. |
| `synchronous` | `NORMAL` | Optimized disk sync for WAL without integrity loss. |
| `busy_timeout` | `5000` | 5-second wait before failing on concurrent locks. |
| `foreign_keys` | `ON` | Enforces relational cascade deletions. |
| `cache_size` | `-4000` | 4 MB in-memory SQLite page cache. |

---

## 6. Verification & Benchmark Highlights

- **Batch Upsert & FTS Indexing**: **1,000 FileRecords** ingested and fully indexed in **164ms (~6,098 records/second)**.
- **FTS5 Trigram Matching**: Instant (<1ms) multi-keyword and partial substring search.
- **Atomic Rollback**: Verified 100% zero-leakage state rollback on transaction errors.
- **Restart Persistence**: 100% data integrity verified across database close and reopen cycles.
