# Nexora AI Search — Advanced Video Intelligence

> **Phase**: Part 20 — Advanced Video Intelligence  
> **Status**: Completed & Verified  

---

## 1. Video Search Intelligence Pipeline

The **Advanced Video Intelligence Subsystem** adapts indexed speech-to-text transcripts, frame OCR text, visual object detections, scene contexts, metadata, and duration constraints into the search and ranking pipeline without running on-demand FFmpeg decoding or speech recognition at query time.

```text
                                  USER QUERY
                                      │
                                      ▼
                                   PART 16
                             Query Understanding
                                      │
                                      ▼
                                   PART 18
                             Search Filters (type:video, duration:>10min)
                                      │
                                      ▼
                                   PART 15
                            Unified Candidate Search
                                      │
                                      ▼
                              VIDEO CANDIDATES
                                      │
                                      ▼
                                   PART 20
                         Video Intelligence Adapter
                                      │
     ┌────────────────┬───────────────┼───────────────┬────────────────┐
     ▼                ▼               ▼               ▼                ▼
VideoTranscript   VideoOcr       VideoScenes    VideoObjects     VideoDuration
 ("firewall")   ("npm run dev")  ("classroom")   ("laptop")      (>600 seconds)
     │                │               │               │                │
     └────────────────┴───────────────┼───────────────┴────────────────┘
                                      ▼
                                 VideoSignals
                           (with bestMatchTimestamp)
                                      │
                                      ▼
                                   PART 17
                                Ranking Engine
                                      │
                                      ▼
                              VideoResultAdapter
                                      │
                                      ▼
                                 SearchResult
```

---

## 2. Core Video Intelligence Capabilities

1. **Speech-to-Text Transcript Matching (`VideoTranscript`)**:
   - Matches keywords and exact phrases from stored speech transcripts, extracting the exact match timestamp (e.g. `14:22`) for deep video jumping.
2. **Video Frame OCR (`VideoOcr`)**:
   - Matches keywords and terminal/slide text rendered in sampled video frames with frame timestamps.
3. **Visual Object & Scene Recognition (`VideoObjects`, `VideoScenes`)**:
   - Evaluates object labels (`laptop`, `phone`, `car`, `person`, `monitor`) and scene categories (`classroom`, `lecture`, `office`, `presentation`) with confidence scoring.
4. **Duration Parsing & Filtering (`VideoDuration`)**:
   - Parses duration operators and units (`duration:>10min`, `<5min`, `>=1hour`, `<=30sec`) normalized to seconds, discarding invalid tokens without crashes.
5. **Video Metadata (`VideoMetadata`)**:
   - Formats indexed resolution (`4K`, `1080p`, `720p`, `SD`), FPS, codec, and audio presence.
6. **Similar Video Retrieval (`searchSimilarVideos`)**:
   - Reuses stored multimodal vector embeddings to find similar videos via Part 17 `RankingEngine`.
7. **Local-First Privacy & Zero Search-Time Overhead**:
   - Search operates 100% locally against indexed metadata. No search-time FFmpeg execution, frame decoding, or speech-to-text inference is invoked.
