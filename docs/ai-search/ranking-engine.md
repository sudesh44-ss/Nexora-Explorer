# Nexora AI Search — Advanced Search Ranking Engine

> **Phase**: Part 17 — Advanced Search Ranking Engine  
> **Status**: Completed & Verified  

---

## 1. Multi-Signal Ranking Architecture

The **Advanced Search Ranking Engine** scores and sorts candidate files returned by Part 15 Unified Candidate Retrieval using the structured query produced by Part 16 Query Understanding.

```text
                                  PART 16
                             Structured Query
                                     │
                                     ▼
                                  PART 15
                            Candidate Retrieval
                    (FTS5, Metadata, OCR, Vision, Vector)
                                     │
                                     ▼
                                  PART 17
                           Advanced Ranking Engine
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
               Hard Filters                    Soft Signals
         (Strict Type & Sizing)           (Concepts, Themes)
                     │                               │
                     └───────────────┬───────────────┘
                                     ▼
                            Signal Normalization
                                  (0 to 1)
                                     │
                                     ▼
                        Query-Aware Dynamic Weights
                (EXACT_SEARCH, CONTENT_SEARCH, SEMANTIC_SEARCH)
                                     │
                                     ▼
                       Signal Correlation Damping
                    (Prevent vision/tag double count)
                                     │
                                     ▼
                           Composite Scoring &
                           Exact Match Boosts
                                     │
                                     ▼
                        Deterministic Tie-Breaking
                       (Score ➔ Exact ➔ Coverage ➔ ID)
                                     │
                                     ▼
                             Top-K Result Set
                               (Explorer UI)
```

---

## 2. Key Architecture & Scoring Highlights

1. **Part 17 Ranking Rule**:
   - Ranking does **not** search, scan files, perform OCR, run Vision, or generate embeddings at query time. It calculates multi-signal relevance over indexed metadata and candidate matches in **<2ms**.
2. **Hard Constraints vs Soft Signals**:
   - Hard constraints (`type:image`, `ext:pdf`, `size:>100MB`, `folder:Downloads`) strictly exclude non-matching candidates.
   - Soft concepts (`"birthday"`, `"cake"`, `"cybersecurity"`) contribute weighted scores to rank matching items at the top.
3. **Query-Aware Weight Profiles (`RankingWeights`)**:
   - `EXACT_SEARCH`: Heavy filenameExact (0.50) and phrase (0.35) weights.
   - `CONTENT_SEARCH`: Heavy OCR (0.30), nativeText/FTS (0.25), and Vision (0.25) weights.
   - `SEMANTIC_SEARCH`: Heavy vector similarity (0.45) and multimodal concepts.
4. **Signal Correlation Damping (`RankingScore`)**:
   - Prevents artificial score inflation when vision and tag evidence originate from the same underlying vision model analysis.
5. **Deterministic Stability & Tie-Breaking**:
   - Stable sort order across repeated executions: `finalScore DESC ➔ exactness DESC ➔ coverage DESC ➔ semantic DESC ➔ fileId ASC`.
6. **Graceful Degradation**:
   - If AI providers or specific modality indexes (e.g. Vision or OCR) are missing, scoring seamlessly proceeds with available signals without penalty.
