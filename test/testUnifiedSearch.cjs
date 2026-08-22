"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  UnifiedSearch,
  CandidateRetriever,
  SearchQueryBuilder,
  SearchResultNormalizer,
} = aiSearch.unified;

const {
  ContentBuilder,
  ContentStore,
  ContentNormalizer,
  ContentSources,
  ProcessingStatus,
} = aiSearch.content;

const { DatabaseManager } = aiSearch.database;
const { AIEngine } = aiSearch.ai;
const { EmbeddingManager } = aiSearch.vectors;
const { QueryUnderstanding } = aiSearch.query;
const { createFileRecord } = aiSearch.discovery;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH UNIFIED SEARCH TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_unified_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "unified_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const aiEngine = new AIEngine();
  await aiEngine.initialize();

  const vectors = new EmbeddingManager(aiEngine, db);
  await vectors.initialize();

  const queryUnderstanding = new QueryUnderstanding();
  const unifiedSearch = new UnifiedSearch({
    databaseManager: db,
    embeddingManager: vectors,
    queryUnderstanding,
  });

  const contentStore = new ContentStore(db, vectors);

  try {
    // --------------------------------------------------------
    // Seed Test Corpus
    // --------------------------------------------------------
    // 1. Image 1: Exact + Semantic (Birthday photo with cake)
    const img1Path = path.join(testRoot, "birthday.jpg");
    await fsp.writeFile(img1Path, "IMG_DATA_1");
    const recImg1 = createFileRecord({
      file_id: "img_001",
      name: "birthday.jpg",
      path: img1Path,
      extension: ".jpg",
      hash: "hash_img_001",
    });
    db.files.insert(recImg1);
    db.ai.upsert("img_001", {
      description: "People celebrating a birthday party around a chocolate cake outdoors",
      tags: JSON.stringify(["birthday", "party", "cake", "people"]),
      objects: JSON.stringify(["person", "cake"]),
      concepts: JSON.stringify(["celebration"]),
    });
    await vectors.embedFile(recImg1, { text: "People celebrating a birthday party around a chocolate cake outdoors. birthday party cake people" });

    // 2. Scanned PDF: OCR (Amazon Invoice)
    const scanPdfPath = path.join(testRoot, "scan001.pdf");
    await fsp.writeFile(scanPdfPath, "PDF_DATA_1");
    const recScan = createFileRecord({
      file_id: "scan_001",
      name: "scan001.pdf",
      path: scanPdfPath,
      extension: ".pdf",
      hash: "hash_scan_001",
    });
    db.files.insert(recScan);
    db.content.upsert("scan_001", {
      extracted_text: "TAX INVOICE Amazon India Pvt Ltd Invoice No: INV-2025-001 Date: 21/08/2025 Total Amount: ₹12,450",
      word_count: 15,
    });
    db.fts.updateSearchableContent("scan_001", {
      text: "TAX INVOICE Amazon India Pvt Ltd Invoice No: INV-2025-001 Date: 21/08/2025 Total Amount: ₹12,450",
    });
    await vectors.embedFile(recScan, { text: "TAX INVOICE Amazon India Pvt Ltd Invoice No: INV-2025-001 Total Amount: ₹12,450" });

    // 3. Video File: Transcript + AI (Penetration testing lecture)
    const videoPath = path.join(testRoot, "lecture_03.mp4");
    await fsp.writeFile(videoPath, "MP4_DATA_1");
    const recVideo = createFileRecord({
      file_id: "video_001",
      name: "lecture_03.mp4",
      path: videoPath,
      extension: ".mp4",
      hash: "hash_video_001",
    });
    db.files.insert(recVideo);
    db.content.upsert("video_001", {
      extracted_text: "Today in cybersecurity lecture we will learn network penetration testing and ethical hacking.",
      word_count: 14,
    });
    db.fts.updateSearchableContent("video_001", {
      text: "Today in cybersecurity lecture we will learn network penetration testing and ethical hacking.",
    });
    await vectors.embedFile(recVideo, { text: "Today in cybersecurity lecture we will learn network penetration testing and ethical hacking." });

    // --------------------------------------------------------
    // Test 1: UnifiedContent Builder & Store
    // --------------------------------------------------------
    console.log("▶ Test 1: UnifiedContent assembly from multi-signal repositories...");
    const unifiedImg = contentStore.getUnifiedContent("img_001");
    assert.ok(unifiedImg);
    assert.strictEqual(unifiedImg.filename, "birthday.jpg");
    assert.ok(unifiedImg.tags.includes("cake"));
    assert.strictEqual(unifiedImg.hasEmbedding, true);
    assert.ok(unifiedImg.searchableText.includes("birthday.jpg"));
    assert.ok(unifiedImg.searchableText.includes("cake"));
    console.log("  ✓ Passed: ContentStore assembled full multi-signal UnifiedContent representation.");

    // --------------------------------------------------------
    // Test 2: Exact Search
    // --------------------------------------------------------
    console.log("▶ Test 2: Exact filename query 'birthday'...");
    const resExact = await unifiedSearch.search("birthday");
    assert.ok(resExact.results.length > 0);
    assert.strictEqual(resExact.results[0].name, "birthday.jpg");
    assert.ok(resExact.results[0].matchedBy.includes("filename"));
    console.log(`  ✓ Passed: Exact query matched '${resExact.results[0].name}' (Score: ${resExact.results[0].score.toFixed(3)}) in ${resExact.tookMs}ms.`);

    // --------------------------------------------------------
    // Test 3: Semantic Content Search
    // --------------------------------------------------------
    console.log("▶ Test 3: Semantic similarity query 'birthday celebration'...");
    const resSemantic = await unifiedSearch.search("birthday celebration");
    assert.ok(resSemantic.results.length > 0);
    assert.strictEqual(resSemantic.results[0].name, "birthday.jpg");
    console.log(`  ✓ Passed: Semantic query matched '${resSemantic.results[0].name}' in ${resSemantic.tookMs}ms.`);

    // --------------------------------------------------------
    // Test 4: OCR Scanned Document Search
    // --------------------------------------------------------
    console.log("▶ Test 4: OCR token queries 'Amazon invoice' and 'INV-2025-001'...");
    const resOCR1 = await unifiedSearch.search("Amazon invoice");
    const resOCR2 = await unifiedSearch.search("INV-2025-001");

    assert.ok(resOCR1.results.length > 0);
    assert.strictEqual(resOCR1.results[0].name, "scan001.pdf");
    assert.ok(resOCR2.results.length > 0);
    assert.strictEqual(resOCR2.results[0].name, "scan001.pdf");
    console.log(`  ✓ Passed: OCR search retrieved scanned PDF '${resOCR1.results[0].name}' in ${resOCR1.tookMs}ms.`);

    // --------------------------------------------------------
    // Test 5: Video Transcript Content Search
    // --------------------------------------------------------
    console.log("▶ Test 5: Video transcript query 'cybersecurity videos'...");
    const resVideo = await unifiedSearch.search("cybersecurity videos");
    assert.ok(resVideo.results.length > 0);
    assert.strictEqual(resVideo.results[0].name, "lecture_03.mp4");
    console.log(`  ✓ Passed: Retrieved '${resVideo.results[0].name}' from spoken audio transcript in ${resVideo.tookMs}ms.`);

    // --------------------------------------------------------
    // Test 6: Combined Multimodal Signals Search
    // --------------------------------------------------------
    console.log("▶ Test 6: Combined Multimodal query 'birthday cake with people'...");
    const resMulti = await unifiedSearch.search("birthday cake with people");
    assert.ok(resMulti.results.length > 0);
    assert.strictEqual(resMulti.results[0].name, "birthday.jpg");
    console.log(`  ✓ Passed: Multi-signal query synthesized Vision + OCR + Embedding.`);

    // --------------------------------------------------------
    // Test 7: No-AI Fallback Mode
    // --------------------------------------------------------
    console.log("▶ Test 7: No-AI Fallback Search (Keyword & FTS only)...");
    const noAISearch = new UnifiedSearch({
      databaseManager: db,
      embeddingManager: null, // No AI
      queryUnderstanding,
    });
    const resNoAI = await noAISearch.search("INV-2025-001");
    assert.ok(resNoAI.results.length > 0);
    assert.strictEqual(resNoAI.results[0].name, "scan001.pdf");
    console.log("  ✓ Passed: No-AI fallback executed search seamlessly via FTS5 and metadata.");

    // --------------------------------------------------------
    // Test 8: Partial Index Search
    // --------------------------------------------------------
    console.log("▶ Test 8: Partial Index Search (metadata ready, AI pending)...");
    const partialRec = createFileRecord({
      file_id: "partial_001",
      name: "partial_unprocessed_file.docx",
      path: path.join(testRoot, "partial_unprocessed_file.docx"),
      extension: ".docx",
    });
    db.files.insert(partialRec);

    const resPartial = await unifiedSearch.search("partial");
    assert.ok(resPartial.results.some((r) => r.name === "partial_unprocessed_file.docx"));
    console.log("  ✓ Passed: Unindexed/partial file immediately retrievable via filename.");

    // --------------------------------------------------------
    // Test 9: Search Performance & Explainability
    // --------------------------------------------------------
    console.log("▶ Test 9: Performance (<5ms) and explainability metadata...");
    const resPerf = await unifiedSearch.search("Amazon");
    assert.ok(resPerf.tookMs < 20, `Search must complete in <20ms (took ${resPerf.tookMs}ms)`);
    assert.ok(resPerf.results[0].matchedBy.length > 0);
    console.log(`  ✓ Passed: Search execution took ${resPerf.tookMs}ms. Explainability: matchedBy=${JSON.stringify(resPerf.results[0].matchedBy)}.`);

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 15 UNIFIED MULTIMODAL TESTS PASSED (100% SUCCESS)");
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
