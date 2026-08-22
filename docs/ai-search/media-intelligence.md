# Nexora AI Search — Content-Aware Media Intelligence Foundation

> **Phase**: Part 11 — Content-Aware Media Intelligence Foundation  
> **Status**: Completed & Verified  

---

## 1. Core Architecture

The **Media Intelligence Subsystem** enables Nexora to extract structured, semantic AI metadata (descriptions, tags, objects, and concepts) from multimedia files during **Background Indexing**, completely decoupled from the query-time search pipeline.

```text
                                  Multimedia File
                               (e.g. IMG_123.jpg)
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           ContentAnalyzer                              │
  │  Routes by extension to ImageAnalyzer, AudioAnalyzer, VideoAnalyzer    │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           ImageAnalyzer                                │
  │  - ImagePreprocessor: Enforces dimension and memory bounds             │
  │  - AIEngine / Vision Runtime: Extracts description, tags, objects      │
  │  - Bounded objects: [{ label: "person", confidence: 0.96 }, ...]       │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                            MediaIndexer                                │
  │  1. Persists to SQLite `file_ai` table                                 │
  │  2. Synchronizes tags & objects to SQLite FTS5                         │
  │  3. Generates dense vector embedding via Part 8 EmbeddingManager       │
  │  4. Reuses hash cache on unchanged files                               │
  └────────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                      Fast Local Query-Time Search                      │
  │   Query: "jisme cake hai" ➔ Matches indexed object 'cake' in <5ms      │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Media Contracts & Guarantees

1. **Zero Search-Time Image Processing**: AI inference runs solely in background indexing queues (`MediaQueue`); search queries exclusively hit pre-indexed FTS5, SQLite, and vector tables.
2. **Standardized MediaResult**:
   ```javascript
   {
     fileId: "img_123",
     mediaType: "image",
     description: "People celebrating a birthday party around a cake",
     tags: ["birthday", "party", "cake"],
     objects: [{ label: "person", confidence: 0.96 }, { label: "cake", confidence: 0.92 }],
     concepts: ["celebration", "festivity"],
     confidence: 0.95,
     modelId: "nomic_embed_vision_v1",
     modelVersion: "1.0.0"
   }
   ```
3. **No Face Identity Recognition**: Generic object detection is supported (e.g. `person`), but facial recognition or named identity profiling is strictly prohibited.
4. **Local-First & Privacy**: Images are never automatically uploaded to cloud servers; temporary preprocessing buffers are immediately released.
5. **Partial Index Resilience**: Files without vision metadata remain fully searchable via filename, folder path, extension, and full-text metadata.
