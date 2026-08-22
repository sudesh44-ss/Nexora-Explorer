# Nexora AI Search — Advanced Search Operators & Filters

> **Phase**: Part 18 — Advanced Search Operators & Filters  
> **Status**: Completed & Verified  

---

## 1. Search Filter Pipeline

The **Advanced Search Operators & Filters Subsystem** resolves structured and inline operators into strict metadata constraints and SQL pushdown conditions for candidate retrieval and in-memory candidate evaluation.

```text
                                  USER QUERY
                                      │
                                      ▼
                                   PART 16
                             Query Understanding
                                      │
                                      ▼
                              Structured Query
                                      │
                                      ▼
                                   PART 18
                         Filter / Operator Resolution
                                      │
                   ┌──────────────────┼──────────────────┐
                   ▼                  ▼                  ▼
             FilterTypes         FilterSize          FilterDate
          (image, pdf, etc.)   (>100MB, <10MB)    (created/modified)
                   │                  │                  │
                   └──────────────────┼──────────────────┘
                                      ▼
                               FilterValidator
                       (Check Contradictions & Safety)
                                      │
                                      ▼
                            FilterEngine Pushdown
                         (Parameterized SQLite SQL)
                                      │
                                      ▼
                                   PART 15
                             Candidate Retrieval
                                      │
                                      ▼
                                   PART 17
                               Ranking Engine
```

---

## 2. Supported Search Operators

| Operator | Syntax Examples | Description |
| :--- | :--- | :--- |
| `type:` | `type:image`, `type:pdf`, `type:video`, `type:audio`, `type:document` | Filters files by major category (maps to MIME types and extensions). |
| `ext:` | `ext:jpg`, `ext:png`, `ext:pdf`, `ext:docx` | Filters by file extension with normalized leading dots. |
| `name:` | `name:invoice`, `name:"project report.pdf"` | Matches filename without searching OCR/inner content. |
| `content:`| `content:invoice` | Matches indexed text and OCR content. |
| `folder:`| `folder:Downloads`, `folder:"College Notes"` | Matches directory name with spaces and path normalization. |
| `path:` | `path:"D:/Projects"` | Matches folder path prefix with path traversal protection. |
| `size:` | `size:>100MB`, `size:<10MB`, `size:>=1GB`, `size:<=500KB` | Converts sizes to byte values (`B`, `KB`, `MB`, `GB`, `TB`). |
| `date:` | `date:2025`, `date:2025-08-21`, `date:last_year` | General date constraint on file modification timestamp. |
| `created:` | `created:2025`, `created:last_month` | Explicit creation timestamp filter (`created_at`). |
| `modified:` | `modified:today`, `modified:last_week`, `modified:2025` | Explicit modification timestamp filter (`modified_at`). |

---

## 3. Security & SQL Pushdown

1. **Path Traversal Protection**:
   - `FilterPath.sanitize` rejects `../`, `..\`, `System32`, and `file:///` protocols, preventing unauthorized directory escapes.
2. **SQL Injection Neutralization**:
   - `FilterEngine.compileSqlConstraints` produces parameterized queries (`?`) for SQLite indexes.
   - String inputs in `LIKE` queries are escaped (`%` and `_` converted to `\%` and `\_`) with `ESCAPE '\'`.
3. **Contradictory Condition Detection**:
   - Detects mutually exclusive constraints such as `size:>1GB` AND `size:<10MB` or multiple exclusive types under `AND`, returning empty result diagnostics without database lock contention.
