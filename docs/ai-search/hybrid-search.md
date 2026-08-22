# Nexora AI Search — Hybrid Search, Candidate Retrieval & Multi-Signal Ranking

> **Phase**: Part 9 — Hybrid Search Engine + Candidate Retrieval + Ranking Foundation  
> **Status**: Completed & Verified  

---

## 1. Hybrid Search Architecture

The **Hybrid Search Engine** unifies lexical keyword retrieval (SQLite FTS5), metadata filtering, and semantic dense vector retrieval into a weighted multi-signal ranking pipeline.

```text
                               Natural User Query
                  ("Mere college ki cybersecurity wali PDFs")
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                            QueryProcessor                              │
  │  - Keywords: ["college", "cybersecurity"]                              │
  │  - FileType Filter: ["pdf"]                                            │
  │  - Semantic Query: "college cybersecurity"                             │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
  ┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
  │   FTS5 Keyword    │      │  SQLite Metadata  │      │ Vector Semantic   │
  │     Retrieval     │      │     Filtering     │      │    Similarity     │
  └─────────┬─────────┘      └─────────┬─────────┘      └─────────┬─────────┘
            │                          │                          │
            └──────────────────────────┼──────────────────────────┘
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                            CandidateMerger                             │
  │       - Deduplicates unique candidates by fileId                       │
  │       - Tracks retrieval sources (['fts', 'vector', 'metadata'])       │
  │       - Preserves raw scores                                           │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                            ScoreNormalizer                             │
  │       - Maps raw FTS, Cosine, and Metadata scores into [0, 1]          │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                             RankingEngine                              │
  │   Final Score = w_sem·S_sem + w_kw·S_kw + w_type·S_type + w_dir·S_dir  │
  │   - Deterministic sorting & tie-breaking                               │
  │   - Produces explainable scoreBreakdown                                │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                              FileResolver                              │
  │       - Resolves file_id to filesystem path via SQLite                 │
  │       - Validates filesystem existence (excludes deleted files)        │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           Final SearchResult                           │
  │       [{ name, path, score, matchedBy: ['keyword', 'semantic'] }]      │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Configurable Ranking Signals & Weights

The ranking formula combines 5 distinct signals. All weights are fully configurable:

```text
Final Score = 
    0.35 × Semantic Similarity
  + 0.35 × Keyword Match (FTS5)
  + 0.15 × File Type Match
  + 0.10 × Folder Path Match
  + 0.05 × Metadata Match
```

### Signal Responsibilities
1. **Semantic Similarity**: Vector cosine similarity from Part 8.
2. **Keyword Match**: FTS5 ranking for exact and partial keyword hits.
3. **File Type Match**: 1.0 if matching explicitly requested type (e.g. `.pdf`), 0.0 for mismatch (hard-filtered if explicit type is specified).
4. **Folder Match**: Boosts files located within matching folder names (e.g. `/College/`).
5. **Metadata Match**: Direct filename and attribute matches.

---

## 3. Key System Guarantees

1. **Zero Query-Time File I/O**: Normal search operates exclusively on pre-built database and vector indexes; no PDF parsing, code evaluation, or OCR occurs at query time.
2. **Partial Index & Missing Model Resilience**: If vector embeddings are incomplete or an AI model is uninstalled, search automatically falls back to full-text FTS5 and metadata search without crashing.
3. **Search Cancellation**: Supports `AbortSignal` to cancel expensive semantic retrieval when the user rapidly types new characters in the search bar.
4. **Non-Chatbot Output**: Returns actual file records with verified paths, timestamps, sizes, scores, and matched-by tags.
