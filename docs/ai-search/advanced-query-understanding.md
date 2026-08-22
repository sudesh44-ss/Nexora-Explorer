# Nexora AI Search — Advanced Query Understanding

> **Phase**: Part 10 — Advanced Query Understanding  
> **Status**: Completed & Verified  

---

## 1. Query Understanding Pipeline

The **Query Understanding Subsystem** converts raw, multilingual, natural language user input into a validated, structured `SearchQuery` consumable by the Part 9 Hybrid Search Engine without requiring a heavy LLM for standard queries.

```text
               User Natural Language Query
      ("meri pichle saal ki birthday wali photos aur videos do")
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                     QueryUnderstanding                      │
  │                                                             │
  │  ├── QueryNormalizer       → Trims and normalizes casing    │
  │  ├── FileTypeDetector      → Extracts ["image", "video"]    │
  │  ├── IntentDetector        → Classifies SEARCH_FILES        │
  │  ├── ConceptExtractor      → Extracts ["birthday"]          │
  │  ├── DateResolver          → Resolves Jan 1 - Dec 31 (Prev) │
  │  ├── FolderHintDetector    → Extracts explicit folder hints │
  │  ├── SemanticQueryBuilder  → Builds "birthday photos"       │
  │  └── QueryValidator        → Schema compliance check        │
  └────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    Structured SearchQuery                   │
  │ {                                                           │
  │   intent: "SEARCH_FILES",                                   │
  │   concepts: ["birthday"],                                   │
  │   fileTypes: ["image", "video"],                            │
  │   dateFilter: { field: "modifiedAt", operator: "between" }, │
  │   semanticQuery: "birthday photos",                         │
  │   confidence: { overall: 0.95 }                             │
  │ }                                                           │
  └────────────────────────────┬────────────────────────────────┘
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────────┐
  │             Part 9 Hybrid Search Engine Pipeline            │
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. Supported Capabilities

| Capability | Example Query | Structured Extraction |
| :--- | :--- | :--- |
| **Explicit File Type** | `"cybersecurity pdf"` | `concepts: ["cybersecurity"]`, `fileTypes: ["pdf"]` |
| **Multi-Type Query** | `"birthday photos and videos"` | `concepts: ["birthday"]`, `fileTypes: ["image", "video"]` |
| **Folder Search** | `"college folder"` | `intent: "SEARCH_FOLDERS"`, `folderHints: ["college"]` |
| **Relative Date** | `"last year birthday photos"` | `dateFilter: { operator: "between", start, end }` |
| **Ambiguous Query** | `"college"` | `concepts: ["college"]`, `fileTypes: []` (no forced filter) |
| **Conversational** | `"meri pichle saal ki photos"` | Stop words stripped; concept `"photos"` & date range extracted |

---

## 3. Key Design Principles

1. **Lightweight Local-First**: Simple queries run in **<1ms** locally using deterministic tokenization without network latency or external API calls.
2. **Optional LLM Boundary**: Difficult multi-clause queries can optionally route to `LLMQueryAdapter`, with strict JSON schema validation that rejects conversational prose.
3. **Least-Assumptive Ambiguity**: Ambiguous queries (e.g. `"college"`) do not force folder-only or specific file-type constraints, allowing Part 9's hybrid ranker to surface the best candidates.
4. **Security & Parameterization**: Natural language queries are never formatted as raw SQL strings; all database interaction uses parameterized prepared statements.
