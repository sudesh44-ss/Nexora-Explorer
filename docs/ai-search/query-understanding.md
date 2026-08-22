# Nexora AI Search — Advanced Query Understanding

> **Phase**: Part 16 — Advanced Query Understanding  
> **Status**: Completed & Verified  

---

## 1. Query Understanding Pipeline

The **Advanced Query Understanding Subsystem** converts user natural-language queries (English, Hindi Devanagari, Hinglish, Mixed) and explicit operators into a validated `StructuredQuery` schema for candidate retrieval without performing expensive search-time model inference.

```text
                                   USER QUERY
                                       │
                                       ▼
                             QueryFallback (Sanitize)
                                       │
                                       ▼
                                QueryNormalizer
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
          QueryLanguageDetector   QueryParser       QuerySizeParser
            (EN, HI, HINGLISH)   (Boolean/Quotes/   (>100MB, <10MB)
                                  Explicit Ops)
                    │                  │                  │
                    └──────────────────┼──────────────────┘
                                       ▼
                                QueryDateParser
                     (Exact, Relative, Created vs Modified)
                                       │
                                       ▼
                             QueryEntitiesExtractor
                     (Objects, Scenes, People, Org, Money)
                                       │
                                       ▼
                                QueryValidator
                                       │
                                       ▼
                                StructuredQuery
                                       │
                                       ▼
                       Part 15 Unified Candidate Search
```

---

## 2. Supported Query Capabilities

1. **Multilingual Script Support (`QueryLanguageDetector`)**:
   - Classifies query language: `ENGLISH`, `HINDI` (Devanagari Unicode `\u0900-\u097F`), `HINGLISH`, and `MIXED`.
2. **Boolean Expressions & Natural Exclusions (`QueryParser`)**:
   - `AND`, `OR`, `NOT` (`"birthday AND (cake OR party)"`).
   - Natural exclusions (`"without screenshots"`, `"screenshots nahi"`, `"no screenshots"` ➔ `mustNot: ["screenshot"]`).
   - Quoted exact phrases (`"project report"` ➔ `phrases: ["project report"]`).
3. **Natural Language File Types & Sizes (`QuerySizeParser`, `FileTypeDetector`)**:
   - File types: `photos`, `images`, `videos`, `PDFs`, `documents`, `audio`, `code`, `archive`.
   - Sizes: `>100MB`, `<10MB`, `100 MB se badi files`, `under 10 MB`, `over 1 GB` ➔ `{ operator: ">", value: 100, unit: "MB", bytes: 104857600 }`.
4. **Dates & Creation/Modification Distinction (`QueryDateParser`)**:
   - Resolves ISO full dates (`21 August 2025` ➔ `2025-08-21`), years (`2025`), and relative dates (`today`, `yesterday`, `this week`, `last week`, `this month`, `last month`, `this year`, `last year`, `pichle saal`, `पिछले साल`).
   - Identifies whether the user is asking about `createdAt` vs `modifiedAt`.
5. **Multimodal Visual Objects & Entities (`QueryEntitiesExtractor`)**:
   - Objects (`"cake"`, `"car"` from `"photos with cake"`).
   - Scenes (`"outdoor"`, `"beach"`, `"office"`).
   - People presence (`containsPeople: true` from `"photos with people"` or `"doston ke saath"`).
   - Organizations (`"Amazon"`) and document types (`"invoice"`, `"receipt"`, `"resume"`).
   - Money conditions (`"around ₹12,450"` ➔ `{ amount: 12450, currency: "INR" }`).
6. **Security & Prompt Injection Protection (`QueryFallback`)**:
   - Treats all natural language queries strictly as untrusted search strings.
   - Enforces a 1,000-character upper bound (`MAX_QUERY_LENGTH`).
   - Falls back gracefully to plain keyword extraction on malformed inputs without throwing errors or crashing.
