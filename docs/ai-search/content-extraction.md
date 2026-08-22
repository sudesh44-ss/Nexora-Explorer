# Nexora AI Search — File Content Extraction Layer

> **Phase**: Part 6 — File Content Extraction Layer  
> **Status**: Completed & Verified  

---

## 1. Subsystem Architecture

The **Content Extraction Layer** translates raw document files into clean, normalized, searchable textual representations stored in SQLite (`file_content`) and indexed in SQLite FTS5 (`file_search`).

```text
               Discovered File (from Scanner / Queue)
                               │
                               ▼
  ┌───────────────────────────────────────────────────────────┐
  │                    ExtractionManager                      │
  │                                                           │
  │  ├── ExtractionRegistry   → Resolves format extractor     │
  │  ├── Hash Cache Check     → Skips duplicate extractions   │
  │  └── Database Coordinator → Persists text & syncs FTS5   │
  └────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
  │ PlainText   │        │     PDF     │        │    DOCX     │
  │ Extractor   │        │  Extractor  │        │  Extractor  │
  └─────────────┘        └─────────────┘        └─────────────┘
  (.txt, .md,            (.pdf via              (Pure PKZip /
   .log, code)            pdf-parse)             XML parser)
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
  ┌───────────────────────────────────────────────────────────┐
  │                     ExtractionResult                      │
  │        { success, text, wordCount, truncated }            │
  └────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
  ┌───────────────────────────────────────────────────────────┐
  │         SQLite file_content  &  file_search (FTS5)        │
  └───────────────────────────────────────────────────────────┘
```

---

## 2. Common Extractor Contract

Every format extractor inherits from [`BaseExtractor`](file:///H:/MyFileExplorers/electron/ai-search/extraction/extractors/baseExtractor.cjs):
- `canExtract(fileRecord)`: Validates format capability.
- `extract(fileRecord, options)`: Returns standard `ExtractionResult`.
- `getCapabilities()`: Returns supported extensions.

### Unified Extraction Result
```json
{
  "success": true,
  "fileId": "32_hex_id",
  "extractor": "pdf",
  "contentType": "application/pdf",
  "text": "Extracted document body text...",
  "characterCount": 12500,
  "wordCount": 2100,
  "truncated": false,
  "warnings": []
}
```

---

## 3. Supported File Categories

| Category | Extensions | Extractor | Security Guarantee |
| :--- | :--- | :--- | :--- |
| **Plain Text** | `.txt`, `.md`, `.log`, `.ini`, `.env`, `.cfg`, `.conf`, `.yaml`, `.yml`, `.tex` | `PlainTextExtractor` | Bounded memory buffer, UTF-8 normalization. |
| **Structured Data**| `.json`, `.jsonl`, `.ndjson`, `.csv`, `.tsv` | `JsonExtractor`, `CsvExtractor` | Recursive key/value flattening, 0 code evaluation. |
| **Source Code** | `.js`, `.ts`, `.py`, `.java`, `.kt`, `.c`, `.cpp`, `.cs`, `.html`, `.css`, `.sql`, `.sh` | `CodeExtractor` | Read-only text, preserves indentation, **0 execution**. |
| **PDF Documents** | `.pdf` | `PdfExtractor` | Uses existing `pdf-parse` (v2.4.5). Identifies scanned PDFs. |
| **Word Documents**| `.docx` | `DocxExtractor` | Pure PKZip/XML stream parser, **0 macro execution, 0 external binaries**. |

---

## 4. Key Engineering Features

1. **Scanned PDF Identification**: PDFs without a text layer are marked with warning `TEXT_NOT_AVAILABLE` without crashing or blocking the queue, reserving them for future OCR.
2. **Hash-Based Extraction Caching**: If a file's content hash matches the database catalog and `file_content` already has extracted text, disk re-extraction is completely bypassed.
3. **Safety & Truncation Limits**: Configurable character limits (`maxExtractedCharacters: 500,000`) protect memory from multi-gigabyte log files and report `truncated: true`.
4. **FTS5 Inner-Content Search**: Full-text queries immediately search inside document body paragraphs, table cells, JSON keys, and source code functions.
