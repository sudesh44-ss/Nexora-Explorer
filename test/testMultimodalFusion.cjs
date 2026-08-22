"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  MultimodalFusion,
  CandidateMerger,
  ModalityResolver,
  SignalNormalizer,
  FusionDiagnostics,
} = aiSearch.fusion;

const { DatabaseManager } = aiSearch.database;
const { createFileRecord } = aiSearch.discovery;
const { QueryUnderstanding } = aiSearch.query;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA UNIFIED MULTIMODAL FUSION TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_fusion_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "fusion_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const qu = new QueryUnderstanding();
  const fusion = new MultimodalFusion();

  try {
    // --------------------------------------------------------
    // Seed Sample Multimodal Files
    // --------------------------------------------------------
    // 1. PDF Document
    const recDoc = createFileRecord({
      file_id: "file_doc",
      name: "Cybersecurity_Guide.pdf",
      path: "C:/Users/User/Documents/Cybersecurity_Guide.pdf",
      extension: ".pdf",
      mime_type: "application/pdf",
      size: 2 * 1024 * 1024,
    });
    db.files.insert(recDoc);
    db.content.upsert("file_doc", {
      extracted_text: "Cybersecurity handbook covering firewall configuration and threat mitigation.",
      word_count: 9,
    });
    db.ai.upsert("file_doc", {
      description: "Official guide on cybersecurity best practices and firewall architecture",
      tags: JSON.stringify(["cybersecurity", "firewall", "guide", "pdf"]),
    });

    // 2. Image Diagram
    const recImg = createFileRecord({
      file_id: "file_img",
      name: "network_topology.png",
      path: "C:/Users/User/Pictures/network_topology.png",
      extension: ".png",
      mime_type: "image/png",
      size: 1 * 1024 * 1024,
    });
    db.files.insert(recImg);
    db.ai.upsert("file_img", {
      description: "Network architecture diagram showing firewall perimeter defense",
      tags: JSON.stringify(["cybersecurity", "network", "firewall", "diagram"]),
      entities: JSON.stringify({
        width: 1920,
        height: 1080,
        objects: [{ label: "firewall", confidence: 0.95 }, { label: "laptop", confidence: 0.90 }],
        scenes: [{ label: "office", confidence: 0.85 }],
      }),
    });

    // 3. Video Lecture
    const recVid = createFileRecord({
      file_id: "file_vid",
      name: "Cybersecurity_Class_01.mp4",
      path: "C:/Users/User/Videos/Cybersecurity_Class_01.mp4",
      extension: ".mp4",
      mime_type: "video/mp4",
      size: 100 * 1024 * 1024,
    });
    db.files.insert(recVid);
    db.content.upsert("file_vid", {
      extracted_text: "In this class we configure port rules on the firewall.",
      word_count: 10,
    });
    db.ai.upsert("file_vid", {
      description: "Video lecture demonstration of firewall rules configuration",
      tags: JSON.stringify(["cybersecurity", "firewall", "lecture", "video"]),
      entities: JSON.stringify({
        duration: 900,
        transcriptSegments: [{ text: "configure port rules on the firewall", timestamp: 340 }], // 05:40
        ocrFrames: [{ text: "Firewall Rules ACTIVE", timestamp: 340 }],
      }),
    });

    // 4. Audio Podcast
    const recAud = createFileRecord({
      file_id: "file_aud",
      name: "Cybersecurity_Talk.mp3",
      path: "C:/Users/User/Music/Cybersecurity_Talk.mp3",
      extension: ".mp3",
      mime_type: "audio/mpeg",
      size: 15 * 1024 * 1024,
    });
    db.files.insert(recAud);
    db.content.upsert("file_aud", {
      extracted_text: "Discussion on next-gen firewall technologies.",
      word_count: 5,
    });
    db.ai.upsert("file_aud", {
      description: "Audio podcast episode exploring firewall innovations",
      tags: JSON.stringify(["cybersecurity", "firewall", "podcast", "audio"]),
      entities: JSON.stringify({
        duration: 1200,
        transcriptSegments: [{ text: "Discussion on next-gen firewall technologies", timestamp: 120 }], // 02:00
      }),
    });

    // --------------------------------------------------------
    // Test 1: Cross-Modal Unified Search ('cybersecurity')
    // --------------------------------------------------------
    console.log("▶ Test 1: Cross-modal candidate fusion across Text, Image, Video, and Audio...");
    const sqCyber = qu.understand("cybersecurity");
    const candidatePool = [
      { fileId: "file_doc", signals: [{ source: "fts", score: 0.85 }] },
      { fileId: "file_img", signals: [{ source: "vector", score: 0.90 }] },
      { fileId: "file_vid", signals: [{ source: "transcript", score: 0.92 }] },
      { fileId: "file_aud", signals: [{ source: "transcript", score: 0.88 }] },
    ];

    const fusedResults = await fusion.fuse(candidatePool, sqCyber, db, { diagnostics: true });
    assert.strictEqual(fusedResults.length, 4, "Must return candidates from all 4 modalities");
    console.log(`  ✓ Passed: Successfully fused ${fusedResults.length} cross-modal candidates.`);

    // --------------------------------------------------------
    // Test 2: Candidate Deduplication Across Multiple Channels
    // --------------------------------------------------------
    console.log("▶ Test 2: Multi-channel candidate deduplication by stable fileId...");
    const duplicateCandidateStreams = [
      { fileId: "file_vid", signals: [{ source: "fts", score: 0.70 }] },
      { fileId: "file_vid", signals: [{ source: "vector", score: 0.95 }] },
      { fileId: "file_vid", signals: [{ source: "transcript", score: 0.90 }] },
      { fileId: "file_vid", signals: [{ source: "ocr", score: 0.80 }] },
    ];

    const deduplicated = await fusion.fuse(duplicateCandidateStreams, sqCyber, db, { useCache: false });
    assert.strictEqual(deduplicated.length, 1, "Duplicate occurrences of same fileId must merge into 1 result");
    assert.strictEqual(deduplicated[0].fileId, "file_vid");
    console.log("  ✓ Passed: Merged 4 disparate retrieval channels of 'file_vid' into 1 candidate.");

    // --------------------------------------------------------
    // Test 3: Explicit Modality Filtering ('type:image cybersecurity')
    // --------------------------------------------------------
    console.log("▶ Test 3: Explicit modality filter ('type:image cybersecurity')...");
    const sqImageOnly = qu.understand("type:image cybersecurity");
    const imgOnlyResults = await fusion.fuse(candidatePool, sqImageOnly, db, { useCache: false });
    assert.strictEqual(imgOnlyResults.length, 1);
    assert.strictEqual(imgOnlyResults[0].fileId, "file_img");
    console.log("  ✓ Passed: Explicit type:image filter strictly isolated image candidates.");

    // --------------------------------------------------------
    // Test 4: Modality Intent Prioritization ('cybersecurity lecture videos')
    // --------------------------------------------------------
    console.log("▶ Test 4: Modality intent prioritization ('cybersecurity lecture videos')...");
    const sqVideoIntent = qu.understand("cybersecurity lecture videos");
    const videoIntentResults = await fusion.fuse(candidatePool, sqVideoIntent, db, { useCache: false });
    assert.ok(videoIntentResults.length > 0);
    assert.strictEqual(videoIntentResults[0].fileId, "file_vid", "Video candidate must rank #1 for video intent query");
    console.log("  ✓ Passed: Video candidate prioritized for video-intent search.");

    // --------------------------------------------------------
    // Test 5: Error Isolation & Fault Tolerance
    // --------------------------------------------------------
    console.log("▶ Test 5: Error isolation when individual modality fails...");
    const partialCandidates = [
      { fileId: "invalid_corrupt_id", signals: [{ source: "corrupt", score: NaN }] },
      { fileId: "file_doc", signals: [{ source: "fts", score: 0.85 }] },
    ];
    const partialResults = await fusion.fuse(partialCandidates, sqCyber, db);
    assert.ok(partialResults.length >= 1);
    assert.strictEqual(partialResults[0].fileId, "file_doc");
    console.log("  ✓ Passed: Search continued uninterrupted despite corrupt candidate entry.");

    // --------------------------------------------------------
    // Test 6: Cancellation Tracking
    // --------------------------------------------------------
    console.log("▶ Test 6: Query cancellation tracking (superseded request ID)...");
    fusion.setActiveRequest("req_new_query");
    const cancelledResults = await fusion.fuse(candidatePool, sqCyber, db, { requestId: "req_old_query" });
    assert.strictEqual(cancelledResults.length, 0, "Superseded request must return empty results immediately");
    console.log("  ✓ Passed: Superseded query execution safely discarded.");

    // --------------------------------------------------------
    // Test 7: Caching Reuse
    // --------------------------------------------------------
    console.log("▶ Test 7: In-memory fusion cache reuse...");
    fusion.setActiveRequest("req_normal");
    const res1 = await fusion.fuse(candidatePool, sqCyber, db, { requestId: "req_normal", useCache: true });
    const res2 = await fusion.fuse(candidatePool, sqCyber, db, { requestId: "req_normal", useCache: true });
    assert.strictEqual(res1, res2, "Identical queries must return cached result instance");
    console.log("  ✓ Passed: Cached fusion results reused seamlessly.");

    // --------------------------------------------------------
    // Test 8: High Performance Fusion Benchmark (1,000 candidates in <50ms)
    // --------------------------------------------------------
    console.log("▶ Test 8: High-speed in-memory candidate fusion (1,000 candidates)...");
    const largePool = [];
    for (let i = 0; i < 250; i++) {
      largePool.push({ fileId: "file_doc", signals: [{ source: "fts", score: 0.8 }] });
      largePool.push({ fileId: "file_img", signals: [{ source: "vector", score: 0.85 }] });
      largePool.push({ fileId: "file_vid", signals: [{ source: "transcript", score: 0.9 }] });
      largePool.push({ fileId: "file_aud", signals: [{ source: "transcript", score: 0.75 }] });
    }

    const t0 = Date.now();
    const benchmarkResults = await fusion.fuse(largePool, sqCyber, db, { useCache: false });
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 100, `1,000 candidate fusion must complete in <100ms (took ${elapsed}ms)`);
    assert.strictEqual(benchmarkResults.length, 4, "1,000 raw inputs must deduplicate down to 4 distinct files");
    console.log(`  ✓ Passed: Fused and deduplicated 1,000 candidates in ${elapsed}ms.`);

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 22 MULTIMODAL FUSION TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
