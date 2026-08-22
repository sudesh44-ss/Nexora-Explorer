# Nexora AI Search — Background AI Index Queue & Priority Scheduler

> **Phase**: Part 12 — Background AI Index Queue & Priority Scheduler  
> **Status**: Completed & Verified  

---

## 1. Background Indexing Architecture

The **Background AI Indexing Subsystem** processes computationally intensive AI tasks (text extraction, vector embedding generation, image vision analysis, and future audio/video indexing) asynchronously in a prioritized, resource-throttled worker pool, ensuring the Explorer UI and Search Engine remain completely unblocked.

```text
                                  File Discovery / Watcher
                                             │
                                             ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           IndexCoordinator                             │
  │  - Manages Persistent Task Queue, Scheduler, and Worker Pool           │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                            IndexQueue                                  │
  │  - Deduplicates tasks by `fileId + taskType + hash`                    │
  │  - Persists tasks to SQLite `ai_index_tasks` table                     │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                        PriorityScheduler & Aging                       │
  │  - Starvation Prevention: Effective Priority = Base + (AgeMin * Rate)  │
  │  - Resource Gating: Gated by Part 5 ResourceManager (NORMAL/THROTTLE)  │
  │  - Concurrency Budget: Respects maxWorkers & heavyWorker limits        │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           WorkerPool                                   │
  │  - Worker 1 (IDLE ➔ PROCESSING ➔ COMPLETED)                            │
  │  - Worker 2 (IDLE ➔ PROCESSING ➔ COMPLETED)                            │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                     Atomic Commit to SQLite Index                      │
  │  - FTS5, Vectors, & AI Metadata updated atomically before task DONE    │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Scheduling Guarantees

1. **Priority Hierarchy & Aging**:
   - `CRITICAL` (100) ➔ User-requested / active search target.
   - `HIGH` (80) ➔ Fast metadata / recently modified files.
   - `NORMAL` (60) ➔ Text extraction & vector embeddings.
   - `LOW` (40) ➔ Image vision analysis.
   - `BACKGROUND` (20) ➔ Heavy media & video analysis.
   - **Aging Bonus**: Older queued tasks accumulate priority over time ($+5\text{ pts/min}$) to eliminate starvation.
2. **Persistent Crash Recovery**:
   - Tasks interrupted mid-processing are safely restored to `QUEUED` state upon application reboot, preventing lost or half-indexed files.
3. **Resource-Aware Concurrency**:
   - Asks Part 5 `ResourceManager` on every scheduling tick: `NORMAL` (full concurrency), `THROTTLED` (reduced workers, 0 heavy media), `PAUSED` (0 new tasks).
4. **Idempotency & Deduplication**:
   - Duplicate tasks for identical files and operations are rejected, preventing redundant AI inference and database thrashing.
5. **Bounded Memory & Backpressure**:
   - Tested up to 10,000 tasks with less than 3.0MB memory footprint using native SQLite pagination.
