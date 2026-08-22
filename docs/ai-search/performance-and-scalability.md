# Nexora AI Search — Search Performance, Caching & Scalability

> **Phase**: Part 26 — Search Performance, Caching & Scalability  
> **Status**: Completed & Verified  

---

## 1. Search Performance Architecture

The **Search Performance, Caching & Scalability Subsystem** ensures the search engine runs with minimal CPU/RAM overhead, millisecond query response times, concurrency protection, request deduplication, and graceful degradation during large file library indexing.

```text
                                  USER SEARCH REQUEST
                                           │
                                           ▼
                             ┌───────────────────────────┐
                             │    PerformanceAdapter     │
                             └─────────────┬─────────────┘
                                           │
       ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
       ▼                   ▼                               ▼                   ▼
┌──────────────┐   ┌──────────────┐                ┌──────────────┐    ┌──────────────┐
│  CacheKey    │   │ConcurrencyMgr│                │CandidateLimit│    │ MemoryGuard  │
│  & Manager   │   │(In-flight dedup)              │(retrieval/rank)   │(Pressure mon)│
└──────┬───────┘   └──────┬───────┘                └──────┬───────┘    └──────┬───────┘
       │                  │                               │                   │
       └──────────────────┴───────────────┬───────────────┴───────────────────┘
                                          ▼
                               ┌─────────────────────┐
                               │   SearchScheduler   │
                               │(User Search Priority)│
                               └──────────┬──────────┘
                                          ▼
                               SEARCH PIPELINE EXECUTION
                                          │
                                          ▼
                              PERFORMANCE DIAGNOSTICS
```

---

## 2. Key Scalability Mechanisms

1. **Deterministic Structured Cache Keys (`CacheKey`)**:
   - Keys incorporate query text, active filter constraints, sort mode, folder scope, and index version (`v1::m:BALANCED::s:relevance::f:global::...`).
2. **In-Flight Request Deduplication (`ConcurrencyManager`)**:
   - If multiple identical queries arrive concurrently, a single underlying search pipeline runs and the result is shared across callers.
3. **Multi-Tier Candidate Limits (`CandidateLimiter`)**:
   - `FAST`: `retrievalK: 100`, `rankingK: 50`, `displayK: 20`
   - `BALANCED`: `retrievalK: 300`, `rankingK: 150`, `displayK: 50`
   - `ACCURATE`: `retrievalK: 1000`, `rankingK: 500`, `displayK: 100`
4. **Memory Guard (`MemoryGuard`)**:
   - Dynamically halves candidate batch sizes when process heap exceeds safe thresholds.
5. **Search Prioritization (`SearchScheduler`)**:
   - Signals background indexing workers to pause/yield while active user searches are running.
6. **Graceful Fallback**:
   - Automatically degrades to local FTS5 / metadata search if vector search fails or is disabled.
