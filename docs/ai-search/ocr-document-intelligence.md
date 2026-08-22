# Nexora AI Search — OCR & Document Intelligence Foundation

> **Phase**: Part 14 — OCR + Document Intelligence + Scanned Content  
> **Status**: Completed & Verified  

---

## 1. OCR & Document Intelligence Architecture

The **OCR & Document Intelligence Subsystem** enables Nexora to extract and index searchable text from visual files (scanned PDFs, receipts, invoices, screenshots, photos) without locking the UI or slowing down search.

```text
                                     File Record
                                          │
                                          ▼
                                   OCRDetector
                       ┌──────────────────┴──────────────────┐
                       ▼                                     ▼
                Native Text Layer                      Scanned / Image
                       │                                     │
                       ▼                                     ▼
                Native Extractor                       OCRPreprocessor
                       │                                     │
                       │                                     ▼
                       │                                 OCREngine
                       │                       ┌─────────────┴─────────────┐
                       │                       ▼                           ▼
                       │               Local OCR Provider          Mock/Cloud Provider
                       │                       │                           │
                       └───────────────────────┼───────────────────────────┘
                                               ▼
                                      Normalized Text
                                               │
                       ┌───────────────────────┼───────────────────────┐
                       ▼                       ▼                       ▼
               DocumentAnalyzer               FTS5             Embedding Generator
          - DocumentClassifier            (file_search)          (file_vectors)
          - EntityExtractor
          (Org, Date, Money, ID)
```

---

## 2. Key Capabilities & Guarantees

1. **Native Text vs Scanned Distinction (`OCRDetector`)**:
   - Files with extractable text layers skip OCR completely, conserving CPU and memory resources. Only true image files or PDFs without native text layers trigger OCR tasks.
2. **Document Classification & Entity Extraction (`DocumentAnalyzer`)**:
   - Classifies document types (`INVOICE`, `RECEIPT`, `RESUME`, `REPORT`, `NOTES`, `UNKNOWN`).
   - Normalizes extracted entities: dates to ISO `YYYY-MM-DD`, currency/amounts (e.g. `₹12,450` ➔ `{amount: 12450, currency: "INR"}`), emails, and invoice IDs.
3. **Multi-Language Detection (`OCRLanguage`)**:
   - Supports English, Hindi (Devanagari script), and mixed-language multilingual documents.
4. **Zero Search-Time OCR Blocking**:
   - OCR runs exclusively in Part 12 Background Queue (`TaskType.OCR_EXTRACTION`) with resource-aware concurrency.
5. **Full Text & Spatial Layout Support**:
   - Extracts bounding boxes (`{ x, y, width, height }`), confidence scores (0..1), lines, and word blocks for future UI hit highlighting.
