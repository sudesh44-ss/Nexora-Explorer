# Nexora AI Search — Incremental Indexing, File Changes & Index Consistency

> **Phase**: Part 13 — Incremental Indexing, File Changes & Index Consistency  
> **Status**: Completed & Verified  

---

## 1. Incremental Indexing Architecture

The **Incremental Indexing & Change Consistency Subsystem** reliably translates raw filesystem mutations (`CREATE`, `MODIFY`, `MOVE`, `RENAME`, `DELETE`) into synchronized updates across SQLite, FTS5, Vector Embeddings, and AI Metadata without locking or blocking search.

```text
                     Filesystem Events (Watch / Reconcile)
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           ChangeCoalescer                              │
  │  - Debounces bursts per path (e.g. 50ms window)                        │
  │  - Coalesces sequences: CREATE+MODIFY➔CREATE, CREATE+DELETE➔DISCARD    │
  └──────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           ChangeClassifier                             │
  │  - Compares disk state vs SQLite record & content hashes               │
  │  - Classifies: CREATE, CONTENT_MODIFIED, PATH_CHANGED, DELETE, UNCHANGED│
  └──────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           ChangeCoordinator                            │
  │  - PATH_CHANGED ➔ Updates path/name in SQLite & FTS5 without re-AI     │
  │  - CONTENT_MODIFIED ➔ Invalidates stale FTS/vectors/AI; queues Part 12 │
  │  - DELETE ➔ Cascades deletion across SQLite, FTS5, Vectors & Cancels   │
  └──────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                     Part 12 Background Queue & Workers                 │
  │  - Background worker checks `sourceHashAtStart === currentHash`        │
  │  - Discards stale results if file changed mid-flight                   │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Consistency Guarantees

1. **Content-Hash Authority & Zero-Redundant AI Inference**:
   - Timestamp touches or superficial metadata changes where `oldHash === newHash` are classified as `UNCHANGED` regarding expensive AI pipelines, preventing pointless model re-runs.
2. **Atomic Cascade Invalidation (`IndexInvalidator`)**:
   - When a file is modified or deleted, all stale derived artifacts (extracted text, vector blobs in `file_vectors`, AI tags/descriptions in `file_ai`) are immediately purged or invalidated inside SQLite transactions.
3. **Mid-Flight Race Condition Protection**:
   - Background tasks capture `sourceHashAtStart`. Before committing any derived AI result, the system verifies that the file still exists and `currentHash === sourceHashAtStart`. If modified or deleted mid-flight, the stale result is rejected.
4. **Debounced Burst Coalescing**:
   - Rapid application save sequences (e.g. 10 saves in 100ms) are debounced into a single authoritative final change event.
5. **Reconciliation & Orphan Detection (`ReconciliationManager`)**:
   - On startup or demand, reconciles filesystem drift against SQLite, identifying missing, new, or unindexed files without full re-scans.
