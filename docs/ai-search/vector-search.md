# Nexora AI Search — Embedding Generation & Vector Index Foundation

> **Phase**: Part 8 — Embedding Generation + Vector Index Foundation  
> **Status**: Completed & Verified  

---

## 1. Subsystem Architecture

The **Vector & Embedding Subsystem** transforms extracted textual content into dense numerical vectors and enables fast, offline semantic similarity retrieval using cosine similarity.

```text
               Extracted Text (from Part 6 Extractor)
                               │
                               ▼
  ┌───────────────────────────────────────────────────────────┐
  │                     EmbeddingManager                      │
  │                                                           │
  │  ├── EmbeddingGenerator → Calls AIEngine with AITask      │
  │  ├── Hash Cache Check   → Skips unchanged file hashes     │
  │  ├── VectorStore        → Persists Float32 binary blobs   │
  │  └── VectorSearch       → Computes Cosine Similarity      │
  └────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
  ┌───────────────────────────────────────────────────────────┐
  │                 SQLite file_vectors Table                 │
  │   (file_id, content_hash, model_id, vector_blob, meta)    │
  └────────────────────────────┬──────────────────────────────┘
                               │
                 User Natural Language Query
                               │
                               ▼
  ┌───────────────────────────────────────────────────────────┐
  │              VectorSearch.search(queryVector)             │
  │               → Top-K Semantic Candidates                 │
  └───────────────────────────────────────────────────────────┘
```

---

## 2. Key Components

1. **[`EmbeddingGenerator`](file:///H:/MyFileExplorers/electron/ai-search/vectors/embeddingGenerator.cjs)**: Bridges `AIEngine` (Part 7) and creates normalized `Float32Array` embeddings for both documents and user search queries.
2. **[`VectorStore`](file:///H:/MyFileExplorers/electron/ai-search/vectors/vectorStore.cjs)**: SQLite binary blob vector store utilizing native `Float32Array` buffers with zero external dependencies and atomic cascade deletion.
3. **[`similarity.cjs`](file:///H:/MyFileExplorers/electron/ai-search/vectors/similarity.cjs)**: High-performance cosine similarity with L2 normalization, dimension checks, and boundary protection against `NaN`/`Infinity`.
4. **[`VectorSearch`](file:///H:/MyFileExplorers/electron/ai-search/vectors/vectorSearch.cjs)**: Bounded Top-K candidate search with configurable threshold scores (`minimumScore: 0.15`).

---

## 3. Storage & Persistence Format

```sql
CREATE TABLE IF NOT EXISTS file_vectors (
  file_id TEXT PRIMARY KEY,
  content_hash TEXT,
  model_id TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector_blob BLOB NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 4. Key Guarantees

1. **Hash-Based Cache Reuse**: If a file's content hash matches the vector index, embedding generation is completely skipped during re-indexing.
2. **Stale Vector Invalidation**: When a file's content changes, its old vector is invalidated and updated with a fresh embedding.
3. **Delete Synchronization**: When a file is removed, its vector is deleted from `file_vectors` to prevent orphaned search results.
4. **No Native Rebuild Headaches**: Pure JavaScript and native `node:sqlite` binary buffers — **0 new external npm dependencies**.
