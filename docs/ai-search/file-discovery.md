# Nexora AI Search — File Discovery & Scanner Subsystem

> **Phase**: Part 2 — File Discovery & Scanner  
> **Status**: Completed & Verified  

---

## 1. Scanner Purpose & Overview

The **File Discovery & Scanner** is the first operational stage of the Nexora AI Search engine. Its primary responsibility is to recursively discover files and folders within designated filesystem locations, extract standardized basic metadata, and emit structured file records without modifying, moving, or loading entire files into memory.

```text
Selected Locations (Folders / Drives)
              │
              ▼
    ┌───────────────────┐
    │    FileScanner    │
    └─────────┬─────────┘
              │
        ┌─────┴─────┐
        ▼           ▼
     Folder        File
        │           │
     Traverse   Metadata Extraction
                    │
            ┌───────┼───────┐
            ▼       ▼       ▼
         File ID  Hash    MIME
            │       │       │
            └───────┬───────┘
                    ▼
               FileRecord
                    │
                    ▼
          (Future Part 3/4 Ingestion)
```

---

## 2. Input Contract

The scanner accepts one or more target root paths along with traversal configuration:

```javascript
const scanner = new FileScanner({
  locations: ["C:\\Users\\User\\Documents", "D:\\Projects"],
  recursive: true,
  maxDepth: Infinity,
  includeHidden: false,
  includeSystem: false,
  followSymlinks: false,
  maxConcurrency: 16,
  hashStrategy: HashStrategy.FULL_STREAM, // "none" | "fast_sample" | "full_stream"
  maxHashFileSizeMb: 100,
  excludedPatterns: [
    "**/node_modules/**",
    "**/.git/**",
    "**/AppData/**",
    "**/Temp/**",
    "**/$Recycle.Bin/**",
  ],
});
```

---

## 3. Output Schema (`FileRecord`)

For every discovered file, the scanner produces a structured, standardized record:

| Field | Type | Description |
| :--- | :--- | :--- |
| `file_id` | `string` (32 hex) | Deterministic composite hash of device, inode, size, birthtime, and normalized path. |
| `name` | `string` | Base filename (e.g. `Cybersecurity_Basics.pdf`). |
| `path` | `string` | Absolute normalized filesystem path. |
| `extension` | `string` | Lowercase file extension with leading dot (e.g. `.pdf`). |
| `size` | `number` | File size in bytes. |
| `created_at` | `string` (ISO 8601) | File creation/birth timestamp. |
| `modified_at` | `string` (ISO 8601) | Last modification timestamp. |
| `hash` | `string` (64 hex) / `null` | SHA-256 content hash (streaming or fast sample). |
| `mime_type` | `string` / `null` | Explicit MIME type (e.g. `application/pdf`, `image/jpeg`). |
| `is_hidden` | `boolean` | Flag indicating hidden attribute status. |
| `is_system` | `boolean` | Flag indicating system file status. |
| `is_symlink` | `boolean` | Flag indicating whether the entry is a symbolic link or reparse point. |

---

## 4. Key Engineering Strategies

### I. Streaming & Sample Hashing
- **Standard Files (< 100MB)**: Full streaming SHA-256 hashing via `fs.createReadStream` with bounded buffer chunks (`64KB`). The file is never buffered entirely into memory.
- **Huge Files (> 100MB / Video)**: Fast multi-point sampling (Header 64KB + Middle 64KB + Tail 64KB + File Size) to create an instant content fingerprint without disk I/O bottlenecks.

### II. Stable File Identifier (`file_id`)
- Generates a unique 32-character hexadecimal key independent of path-only strings, allowing future reconciliation if files are renamed or moved across folders.

### III. Bounded Concurrency & Semaphore
- Uses `ConcurrencyLimiter` with a default of 16 concurrent file I/O operations, ensuring the Electron renderer process and operating system never experience thread starvation or file descriptor exhaustion.

### IV. Loop & Junction Protection
- Tracks resolved `realpath` strings in an in-memory set to detect and skip circular symbolic links or Windows NTFS directory junctions.

### V. Error Classification & Graceful Degradation
- Inaccessible directories (`EACCES`, `EPERM`) and deleted files (`ENOENT`) are caught and logged as structured scan errors (`ScanErrorCode.ACCESS_DENIED`, `ScanErrorCode.FILE_NOT_FOUND`) without interrupting or crashing the remaining traversal.

### VI. Event-Driven & Cancellation-Ready
- Emits real-time events: `'progress'`, `'file'`, `'folder'`, `'error'`, `'done'`.
- Supports instant, clean cancellation via `scanner.cancel()` or standard `AbortSignal`.

---

## 5. Architectural Boundaries Maintained

- **NO Direct Database Coupling**: Part 2 emits in-memory records and events only. SQLite integration is reserved for Part 3.
- **NO AI Models / Embeddings**: Heavy AI processing is isolated from fast initial discovery.
- **NO Continuous File Watcher**: Watcher queues are decoupled and planned for Part 11.
- **ZERO Modification of Existing Explorer Code**: Core file explorer operations remain completely unaffected.
