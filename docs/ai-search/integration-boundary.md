# Nexora AI Search — Integration Boundary & Core Principles

> **Phase**: Part 1 — Foundation & Isolated AI Search Architecture  
> **Status**: Approved Blueprint  

---

## 1. System Integration Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                 Existing Nexora Explorer                    │
│            (React Frontend & Core Shell IPC)                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  Controlled IPC & Bridge
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                AI Search Integration Adapter                │
│         (Lifecycle, Channel Router, Event Dispatcher)       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Nexora AI Search Engine                   │
│                                                             │
│  ├── Core Lifecycle (aiSearchCore.cjs)                      │
│  ├── Hardware Tier Abstraction (hardwareInterface.cjs)      │
│  ├── Model-Agnostic AI Providers (providerInterface.cjs)    │
│  ├── Structured Diagnostics (aiSearchLogger.cjs)            │
│  ├── System Configuration (aiSearchConfig.cjs)              │
│  ├── SQLite + FTS5 & Vector Store (Future Phase 3)          │
│  ├── Incremental Indexer & Queue (Future Phases 4-12)       │
│  └── Real-time FS Watcher (Future Phase 11)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Principles

### I. Search Engine, NOT a Chatbot
- Nexora AI Search is a **high-performance, content-aware file search engine**.
- **Objective**: Translate natural language queries (e.g., *"give me my cybersecurity PDFs"* or *"photos of receipt from last month"*) directly into exact file matches with relevance scoring and snippets.
- Does **not** produce conversational prose or essays. Focuses strictly on identifying, ranking, and locating files.

### II. Data Ownership & Non-Destructive Storage
- **Original User Files Remain in Their Native Location**:
  - The AI Search system **never moves, renames, copies, or modifies** original user files.
  - The SQLite database acts purely as a searchable index storing:
    - File ID & Path
    - Basic File Metadata (size, mtime, hash)
    - Content Tokens & FTS5 index
    - Semantic Vectors / Embeddings
    - Classification Tags & OCR Snippets

### III. Model-Agnostic & Hardware-Adaptive
- Supports pluggable local models (Ollama, local ONNX/Transformers, Nomic, Qwen) and optional Cloud models (Gemini, OpenAI).
- Dynamically assigns hardware capability tiers (**LOW**, **MEDIUM**, **HIGH**) to balance resource utilization without slowing down the user's computer.

### IV. IPC Boundary Design
Future IPC channels will follow strict namespaces:
- `ai-search:initialize`
- `ai-search:shutdown`
- `ai-search:query`
- `ai-search:get-status`
- `ai-search:reindex`
- `ai-search:get-config`
- `ai-search:set-config`
- `ai-search:on-progress` (event stream)
