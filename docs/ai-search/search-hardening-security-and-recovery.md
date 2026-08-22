# Nexora AI Search — Search Hardening, Security & Sandbox Recovery

> **Phase**: Part 28 — Search Engine Hardening, Security, Sandbox & Failure Recovery  
> **Status**: Completed & Verified  

---

## 1. Hardening & Security Architecture

The **Search Hardening & Security Subsystem** wraps the search pipeline in safety boundaries to protect against malformed inputs, FTS syntax abuse, directory traversal attacks, symlink loops, worker crash cascades, database corruption, and IPC poisoning without degrading legitimate search capabilities.

```text
                               RAW EXTERNAL SEARCH REQUEST
                                           │
                                           ▼
                             ┌───────────────────────────┐
                             │       InputValidator      │
                             │(500-char max, control ch) │
                             └─────────────┬─────────────┘
                                           │
       ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
       ▼                   ▼                               ▼                   ▼
┌──────────────┐   ┌──────────────┐                ┌──────────────┐    ┌──────────────┐
│QuerySanitizer│   │   FtsGuard   │                │  PathGuard   │    │ SymlinkGuard │
│(Quote balance│   │(Boolean clean│                │ (Traversal / │    │(Loop breaker)│
│ & whitespace)│   │ & paren fix) │                │ Root bounds) │    │              │
└──────┬───────┘   └──────┬───────┘                └──────┬───────┘    └──────┬───────┘
       │                  │                               │                   │
       └──────────────────┴───────────────┬───────────────┴───────────────────┘
                                          ▼
                             ┌───────────────────────────┐
                             │       ErrorBoundary       │
                             │ (Structured classification│
                             └─────────────┬─────────────┘
                                           │
                                           ▼
                             PROTECTED SEARCH EXECUTION
                                           │
                                           ▼
                             ┌───────────────────────────┐
                             │    CacheIntegrityGuard    │
                             └─────────────┬─────────────┘
                                           │
                                           ▼
                                 SAFE RESULTS TO UI
```

---

## 2. Hardening Layers & Protections

1. **Input Validation & Query Sanitization (`InputValidator`, `QuerySanitizer`)**:
   - Caps extreme queries to 500 characters, strips control characters, and balances unmatched quotes.
2. **FTS5 Expression Safety (`FtsGuard`)**:
   - Removes dangling `AND`, `OR`, `NOT` keywords and balances parentheses so SQLite FTS5 queries never fail with syntax errors.
3. **Path Traversal & Boundary Protection (`PathGuard`, `SymlinkGuard`)**:
   - Blocks `../`, `..\`, and folder scope escape attempts (e.g. `C:\Allowed` vs `C:\Allowed-Evil`).
   - Tracks canonical paths to prevent infinite loops in symlinks and directory junctions.
4. **IPC Validation (`IpcGuard`)**:
   - Verifies that renderer messages match expected schemas before invoking backend engines.
5. **Worker Isolation & Crash Loop Breakers (`WorkerGuard`)**:
   - Enforces a maximum failure count (default 3) on tasks to prevent infinite crash-restart loops.
6. **Error Classification & Boundaries (`ErrorBoundary`)**:
   - Maps runtime exceptions into standardized `ERROR_CATEGORIES` (`INPUT_ERROR`, `PATH_ERROR`, `DATABASE_ERROR`, `SEARCH_ERROR`, `VECTOR_ERROR`, `WORKER_ERROR`, `CACHE_ERROR`, `IPC_ERROR`).
