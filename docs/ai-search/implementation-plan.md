# Nexora AI Search — 18-Part Implementation Plan

> **Phase Map**: Comprehensive Roadmap from Foundation to Final Explorer Integration  
> **Status**: Approved Roadmap  

---

| Phase | Title | Scope & Objectives |
| :---: | :--- | :--- |
| **PART 1** | **Foundation, Project Audit & Isolated Architecture** | Complete audit, isolated directory structure, stable lifecycle contracts, configuration schemas, error diagnostics, and hardware/provider boundaries. |
| **PART 2** | **File Discovery & Scanner** | Fast, recursive directory walker, file filtering, mime-type identification, and batch file metadata discovery. |
| **PART 3** | **SQLite + FTS5 Database** | Robust schema design for files, content chunks, full-text indexes (`fts5`), embeddings metadata, and indexing queues. |
| **PART 4** | **Initial Indexing Engine** | Core indexing coordinator, batch processing pipeline, checksum verification, and duplicate avoidance. |
| **PART 5** | **Resource Manager & Intelligent Throttling** | CPU/RAM monitoring, idle-time indexing, battery state detection, and dynamic worker concurrency regulation. |
| **PART 6** | **File-Type Content Extraction** | Safe parsers for documents (PDF, DOCX, TXT, MD, CSV, Code), extracting structured plain-text for indexing. |
| **PART 7** | **AI Metadata & Content Understanding** | Automated tag generation, categorization, entity detection, and summary creation. |
| **PART 8** | **Embedding & Semantic Search** | Local vector embeddings generation, cosine similarity vector search, and hybrid text-vector scoring. |
| **PART 9** | **Vision Search** | Image metadata analysis, OCR text extraction from images, visual description generation, and image similarity. |
| **PART 10** | **Audio & Video Search** | Audio speech-to-text transcript indexing, video keyframe extraction, and media tag indexing. |
| **PART 11** | **File System Watcher** | Real-time event tracking (`add`, `change`, `unlink`) with debounce mechanisms for live index updates. |
| **PART 12** | **Queue, Debounce & Incremental Indexing** | Persistent queue management, priority sorting, retry strategies, and incremental change ingestion. |
| **PART 13** | **Query Understanding & Result Ranking** | Natural language query intent parsing, spell correction, hybrid ranking (FTS5 + Vector + Recency + Proximity). |
| **PART 14** | **Hardware-Adaptive AI & Provider System** | Real-time hardware capability profiling, dynamic model loading based on tier (LOW/MED/HIGH), pluggable provider registry. |
| **PART 15** | **AI Search UI Integration** | Connecting React frontend search input, keyword chips, filters, and result lists to the backend query engine. |
| **PART 16** | **Settings, Privacy & Optional Cloud AI** | Managing index folders, resource limits, model selection, privacy controls, and optional Cloud API keys. |
| **PART 17** | **Testing, Optimization & Reliability** | Stress testing large directories (100k+ files), benchmark search latency (<100ms), memory leak checks. |
| **PART 18** | **Final Integration with Nexora Explorer** | Seamless integration with explorer tabs, quick preview modal, context menus, and global shortcut keys. |
