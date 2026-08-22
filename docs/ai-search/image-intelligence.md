# Nexora AI Search — Advanced Image Intelligence

> **Phase**: Part 19 — Advanced Image Intelligence  
> **Status**: Completed & Verified  

---

## 1. Image Search Intelligence Pipeline

The **Advanced Image Intelligence Subsystem** adapts indexed vision data, OCR text in images, object detections, scene context, people flags, and image metadata into the search and ranking pipeline without performing on-demand vision inference at query time.

```text
                                  USER QUERY
                                      │
                                      ▼
                                   PART 16
                             Query Understanding
                                      │
                                      ▼
                                   PART 18
                             Search Filters (type:image)
                                      │
                                      ▼
                                   PART 15
                            Unified Candidate Search
                                      │
                                      ▼
                              IMAGE CANDIDATES
                                      │
                                      ▼
                                   PART 19
                         Image Intelligence Adapter
                                      │
     ┌────────────────┬───────────────┼───────────────┬────────────────┐
     ▼                ▼               ▼               ▼                ▼
ImageObjects     ImageScenes      ImageConcepts    ImageOcr      ImageMetadata
 (cake, car)   (beach, outdoor)  (celebration)  (Amazon invoice) (aspect/dim/orient)
     │                │               │               │                │
     └────────────────┴───────────────┼───────────────┴────────────────┘
                                      ▼
                                 ImageSignals
                                      │
                                      ▼
                                   PART 17
                                Ranking Engine
                                      │
                                      ▼
                              ImageResultAdapter
                                      │
                                      ▼
                                 SearchResult
```

---

## 2. Core Image Intelligence Capabilities

1. **Object Matching (`ImageObjects`)**:
   - Matches query visual objects (`cake`, `car`, `laptop`, `phone`, `person`, `balloons`, `dog`, `chair`) against stored vision records with confidence.
2. **Scene & Context Recognition (`ImageScenes`)**:
   - Evaluates scene labels (`beach`, `mountain`, `office`, `classroom`, `indoor`, `outdoor`, `street`).
3. **People Intent Detection**:
   - Identifies presence of people from `containsPeople: true` in vision metadata.
4. **Image OCR Text Retrieval (`ImageOcr`)**:
   - Searches scanned receipts, invoices, and screenshot text extracted during background indexing.
5. **Image Metadata & Dimensions (`ImageMetadata`)**:
   - Resolves dimensions (`width`, `height`), aspect ratio, orientation (`portrait`, `landscape`, `square`), and screenshot flags (`isScreenshot`).
6. **Visual Semantic Similarity (`searchSimilarImages`)**:
   - Uses stored vector embeddings to retrieve similar images for a reference file without search-time model execution.
7. **Privacy & Local-First Isolation**:
   - Normal image search runs 100% on the local index; image files are never uploaded to the cloud merely for ranking. Raw GPS coordinates are protected.
