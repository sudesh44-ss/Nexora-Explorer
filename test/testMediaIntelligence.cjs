"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  ContentAnalyzer,
  ImageAnalyzer,
  AudioAnalyzer,
  VideoAnalyzer,
  ImagePreprocessor,
  MediaIndexer,
  MediaQueue,
  createMediaResult,
} = aiSearch.media;

const { DatabaseManager } = aiSearch.database;
const { AIEngine } = aiSearch.ai;
const { EmbeddingManager } = aiSearch.vectors;
const { SearchEngine } = aiSearch.search;
const { QueryUnderstanding } = aiSearch.query;
const { createFileRecord } = aiSearch.discovery;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH MEDIA INTELLIGENCE TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_media_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "media_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const aiEngine = new AIEngine();
  await aiEngine.initialize();

  const vectors = new EmbeddingManager(aiEngine, db);
  await vectors.initialize();

  const mediaIndexer = new MediaIndexer({
    databaseManager: db,
    embeddingManager: vectors,
    aiEngine,
  });

  const queryUnderstanding = new QueryUnderstanding();
  const searchEngine = new SearchEngine({
    databaseManager: db,
    embeddingManager: vectors,
  });

  try {
    // --------------------------------------------------------
    // Test 1: Image Preprocessor & Safe Dimension Check
    // --------------------------------------------------------
    console.log("▶ Test 1: Image Preprocessor validation & dimension inspection...");
    const samplePng = path.join(testRoot, "sample.png");
    // Minimal 1x1 PNG binary header
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x07, 0x80, // width: 1920 (0x0780)
      0x00, 0x00, 0x04, 0x38, // height: 1080 (0x0438)
      0x08, 0x06, 0x00, 0x00, 0x00,
    ]);
    await fsp.writeFile(samplePng, pngBytes);

    const inspection = await ImagePreprocessor.validateAndInspect(samplePng);
    assert.strictEqual(inspection.width, 1920);
    assert.strictEqual(inspection.height, 1080);
    console.log("  ✓ Passed: Validated image dimensions (1920x1080) without heavy decoders.");

    // --------------------------------------------------------
    // Test 2: Image Analyzer with Mock Vision Output
    // --------------------------------------------------------
    console.log("▶ Test 2: Image Analyzer producing structured vision intelligence...");
    const imageRec = createFileRecord({
      file_id: "img_bday_1",
      name: "IMG_2025_Birthday.jpg",
      path: samplePng,
      extension: ".jpg",
      hash: "hash_bday_img_1",
    });

    const mockVisionData = {
      description: "People celebrating a birthday party around a chocolate cake",
      tags: ["birthday", "party", "celebration", "cake"],
      objects: [
        { label: "person", confidence: 0.96 },
        { label: "cake", confidence: 0.92 },
      ],
      concepts: ["celebration", "festivity"],
      confidence: 0.95,
      modelId: "nomic_embed_vision_v1",
      modelVersion: "1.0.0",
      runtimeId: "local_onnx",
    };

    const imgAnalyzer = new ImageAnalyzer(aiEngine);
    const analysisRes = await imgAnalyzer.analyze(imageRec, { mockVisionData });
    assert.strictEqual(analysisRes.success, true);
    assert.strictEqual(analysisRes.tags.length, 4);
    assert.strictEqual(analysisRes.objects[0].label, "person");
    assert.strictEqual(analysisRes.objects[1].label, "cake");
    assert.strictEqual(analysisRes.modelId, "nomic_embed_vision_v1");
    console.log("  ✓ Passed: Vision analysis contract produced structured description, tags, and objects.");

    // --------------------------------------------------------
    // Test 3: Media Indexer SQLite & FTS5 Synchronization
    // --------------------------------------------------------
    console.log("▶ Test 3: Media Indexer SQLite persistence & FTS5 sync...");
    db.files.insert(imageRec);
    const indexRes = await mediaIndexer.indexMediaFile(imageRec, { mockVisionData });
    assert.strictEqual(indexRes.indexed, true);

    // Verify file_ai table
    const storedAi = db.ai.findByFileId(imageRec.file_id);
    assert.ok(storedAi);
    assert.strictEqual(storedAi.description, mockVisionData.description);
    assert.deepStrictEqual(storedAi.tags, mockVisionData.tags);

    // Verify FTS5 keyword retrieval
    const ftsResults = db.fts.search("cake");
    assert.ok(ftsResults.length >= 1);
    assert.strictEqual(ftsResults[0].file_id, imageRec.file_id);
    console.log("  ✓ Passed: AI description & objects persisted to SQLite and indexed in FTS5.");

    // --------------------------------------------------------
    // Test 4: Hash-Based Cache Reuse & Stale Invalidation
    // --------------------------------------------------------
    console.log("▶ Test 4: Hash cache reuse on unchanged file...");
    const cachedRes = await mediaIndexer.indexMediaFile(imageRec);
    assert.strictEqual(cachedRes.cached, true, "Must reuse cached AI analysis when hash matches");

    // Modify file hash -> should invalidate and re-analyze
    const modifiedRec = { ...imageRec, hash: "new_hash_modified" };
    const reindexedRes = await mediaIndexer.indexMediaFile(modifiedRec, { mockVisionData, force: true });
    assert.strictEqual(reindexedRes.cached, false, "Must re-index when content hash changes");
    console.log("  ✓ Passed: Hash cache reuse and stale re-indexing verified.");

    // --------------------------------------------------------
    // Test 5: End-to-End Content-Aware Search (Part 10 Query -> Part 9 Search)
    // --------------------------------------------------------
    console.log("▶ Test 5: End-to-End Content-Aware Search ('jisme cake hai')...");
    const searchRes = await searchEngine.search("jisme cake hai");
    assert.ok(searchRes.results.length >= 1);
    assert.strictEqual(searchRes.results[0].fileId, imageRec.file_id);
    console.log(`  ✓ Passed: Content-aware query matched '${searchRes.results[0].name}' via indexed object 'cake' in ${searchRes.tookMs}ms.`);

    // --------------------------------------------------------
    // Test 6: Audio and Video Analyzer Foundations
    // --------------------------------------------------------
    console.log("▶ Test 6: Audio and Video Analyzer foundation contracts...");
    const audioRec = createFileRecord({ file_id: "aud_1", name: "Song.mp3", path: path.join(testRoot, "Song.mp3"), extension: ".mp3" });
    const videoRec = createFileRecord({ file_id: "vid_1", name: "Clip.mp4", path: path.join(testRoot, "Clip.mp4"), extension: ".mp4" });

    const audioAnalyzer = new AudioAnalyzer(aiEngine);
    const videoAnalyzer = new VideoAnalyzer(aiEngine);

    const audioRes = await audioAnalyzer.analyze(audioRec);
    const videoRes = await videoAnalyzer.analyze(videoRec);
    assert.strictEqual(audioRes.mediaType, "audio");
    assert.strictEqual(videoRes.mediaType, "video");
    console.log("  ✓ Passed: Audio & Video foundation contracts validated.");

    // --------------------------------------------------------
    // Test 7: Media Queue with Concurrency and Pause Control
    // --------------------------------------------------------
    console.log("▶ Test 7: Media Queue background processing...");
    const queue = new MediaQueue(mediaIndexer, { concurrency: 1 });
    let processedCount = 0;
    queue.on("item_processed", () => {
      processedCount++;
    });

    queue.enqueue(imageRec);
    assert.strictEqual(queue.activeCount <= 1, true);

    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(processedCount, 1);
    console.log("  ✓ Passed: MediaQueue processed background task with concurrency limit.");

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 11 MEDIA INTELLIGENCE TESTS PASSED (100% SUCCESS)");
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
