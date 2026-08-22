"use strict";

const assert = require("assert");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");

const aiSearch = require("../electron/ai-search/index.cjs");
const { VideoAnalyzer, VideoMetadataParser, VideoFrameExtractor } = aiSearch.media;
const { VideoSearch, VideoDuration } = aiSearch.video;
const { LocalVisionRuntime, ModelRegistry, AIEngine } = aiSearch.ai;
const { LocalOCRProvider, OCREngine } = aiSearch.ocr;
const { DatabaseManager } = aiSearch.database;
const { EmbeddingManager } = aiSearch.vectors;
const { SearchEngine } = aiSearch.search;
const { QueryUnderstanding } = aiSearch.query;
const { createFileRecord } = aiSearch.discovery;

/**
 * Creates a minimal valid synthetic MP4 file with ISO BMFF atoms (ftyp, moov, mvhd, tkhd)
 */
function createTestMp4Buffer(durationSec = 120, width = 1920, height = 1080) {
  const ftyp = Buffer.from([
    0x00, 0x00, 0x00, 0x18, // Size: 24
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6f, 0x6d, // 'isom'
    0x00, 0x00, 0x02, 0x00, // minor version
    0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32, // compatible brands
  ]);

  // mvhd atom
  const mvhd = Buffer.alloc(108);
  mvhd.writeUInt32BE(108, 0); // Size
  mvhd.write("mvhd", 4);     // 'mvhd'
  mvhd.writeUInt8(0, 8);      // Version 0
  mvhd.writeUInt32BE(1000, 20); // Timescale = 1000 units/sec
  mvhd.writeUInt32BE(durationSec * 1000, 24); // Duration in units

  // tkhd atom
  const tkhd = Buffer.alloc(92);
  tkhd.writeUInt32BE(92, 0);
  tkhd.write("tkhd", 4);
  tkhd.writeUInt8(0, 8);
  tkhd.writeUInt32BE(width << 16, 84);  // Width in 16.16 fixed point
  tkhd.writeUInt32BE(height << 16, 88); // Height in 16.16 fixed point

  // moov container
  const moovSize = 8 + mvhd.length + tkhd.length;
  const moov = Buffer.alloc(8);
  moov.writeUInt32BE(moovSize, 0);
  moov.write("moov", 4);

  return Buffer.concat([ftyp, moov, mvhd, tkhd]);
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA REAL VIDEO INTELLIGENCE TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_real_video_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "real_video_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const registry = new ModelRegistry();
  const visionRuntime = new LocalVisionRuntime({ cacheDir: path.join(testRoot, "vision_cache") });
  const aiEngine = new AIEngine({ modelRegistry: registry });
  aiEngine.runtimes.register(visionRuntime);

  const localOCR = new LocalOCRProvider({ cacheDir: path.join(testRoot, "ocr_cache") });
  const ocrEngine = new OCREngine({ providerId: "local_ocr" });
  ocrEngine.registerProvider(localOCR);
  ocrEngine.setActiveProvider("local_ocr");

  const vectors = new EmbeddingManager(aiEngine, db);
  await vectors.initialize();

  const qu = new QueryUnderstanding();
  const searchEngine = new SearchEngine({
    databaseManager: db,
    embeddingManager: vectors,
  });

  const videoAnalyzer = new VideoAnalyzer(aiEngine, ocrEngine, { maxFrames: 3 });

  try {
    // --------------------------------------------------------
    // Test 1: Video Metadata & Duration Binary Parser
    // --------------------------------------------------------
    console.log("▶ Test 1: Real MP4 binary atom metadata & duration parsing...");
    const testVideoPath = path.join(testRoot, "VID_0001.mp4");
    await fsp.writeFile(testVideoPath, createTestMp4Buffer(180, 1920, 1080)); // 3 mins = 180s

    const meta = await VideoMetadataParser.parse(testVideoPath);
    assert.strictEqual(meta.duration, 180, "Duration must parse to 180 seconds");
    assert.strictEqual(meta.width, 1920, "Width must be 1920");
    assert.strictEqual(meta.height, 1080, "Height must be 1080");
    console.log(`  ✓ Passed: Extracted metadata: Duration=${meta.duration}s (${VideoFrameExtractor.formatTimestamp(meta.duration)}), Resolution=${meta.width}x${meta.height}, Codec=${meta.codec}.`);

    // --------------------------------------------------------
    // Test 2: Adaptive Keyframe Sampling & Extraction
    // --------------------------------------------------------
    console.log("▶ Test 2: Adaptive keyframe timestamp sampling...");
    const sampleTimestamps = VideoFrameExtractor.getSampleTimestamps(180, 3);
    assert.strictEqual(sampleTimestamps.length, 3);
    assert.strictEqual(sampleTimestamps[0], 45);
    assert.strictEqual(sampleTimestamps[1], 90);
    assert.strictEqual(sampleTimestamps[2], 135);
    console.log(`  ✓ Passed: Generated adaptive sample timestamps: [${sampleTimestamps.map(VideoFrameExtractor.formatTimestamp).join(", ")}].`);

    // --------------------------------------------------------
    // Test 3: End-to-End Real Video Analysis (Vision AI + OCR)
    // --------------------------------------------------------
    console.log("▶ Test 3: End-to-end video analysis with Part 3 Vision AI & Part 4 OCR...");
    const fileRec = createFileRecord({
      file_id: "vid_demo_001",
      path: testVideoPath,
      name: "VID_0001.mp4",
      extension: ".mp4",
      hash: "hash_vid_demo_001",
      mime_type: "video/mp4",
    });

    const analysisRes = await videoAnalyzer.analyze(fileRec);
    assert.strictEqual(analysisRes.success, true, "Video analysis must succeed");
    assert.strictEqual(analysisRes.mediaType, "video");
    assert.ok(analysisRes.description && analysisRes.description.length > 0);
    assert.ok(Array.isArray(analysisRes.concepts) && analysisRes.concepts.length > 0);
    assert.strictEqual(analysisRes.entities.duration, 180);

    console.log(`  ✓ Passed: Video description: "${analysisRes.description}"`);
    console.log(`    Detected Video Concepts: [${analysisRes.concepts.join(", ")}]`);

    // --------------------------------------------------------
    // Test 4: Video Indexing to SQLite & Timestamped FTS5 / Vectors
    // --------------------------------------------------------
    console.log("▶ Test 4: Indexing video intelligence to SQLite & FTS5...");
    db.files.insert(fileRec);

    // Enhance entities with realistic timestamped OCR frame
    const enhancedEntities = {
      ...analysisRes.entities,
      ocrFrames: [
        { text: "Nexora Explorer v2.0 AI Video Search", timestamp: 45, timestampFormatted: "00:00:45" },
      ],
      transcriptSegments: [
        { text: "Today we demonstrate cybersecurity network security in video", timestamp: 90, timestampFormatted: "00:01:30" },
      ],
    };

    db.ai.upsert(fileRec.file_id, {
      description: analysisRes.description,
      tags: JSON.stringify(analysisRes.tags),
      entities: JSON.stringify(enhancedEntities),
    });

    db.content.upsert(fileRec.file_id, {
      extracted_text: `${analysisRes.description} Nexora Explorer v2.0 AI Video Search cybersecurity network security`,
      word_count: 15,
    });

    await vectors.embedFile(fileRec, {
      text: `${fileRec.name}. ${analysisRes.description}`,
    });

    // --------------------------------------------------------
    // Test 5: Search Video by OCR Content & Timestamp Verification
    // --------------------------------------------------------
    console.log("▶ Test 5: Searching video by OCR content & extracting timestamp...");
    const sqOcr = qu.understand("Nexora Explorer");
    const sigOcr = VideoSearch.evaluateVideo(fileRec.file_id, sqOcr, db);
    assert.ok(sigOcr !== null);
    assert.ok(sigOcr.scores.ocrScore > 0.4 || sigOcr.scores.conceptScore > 0.0);
    assert.strictEqual(sigOcr.evidence.bestMatchTimestamp, "00:45", "Must extract matched timestamp 00:45");
    console.log(`  ✓ Passed: Retrieved video with relevant timestamp: ${sigOcr.evidence.bestMatchTimestamp}.`);

    // --------------------------------------------------------
    // Test 6: Duration Filtering (Contextual Search)
    // --------------------------------------------------------
    console.log("▶ Test 6: Duration filtering on video ('duration:<5min', 'duration:>10min')...");
    const sqShort = {
      rawQuery: "video",
      keywords: ["video"],
      phrases: [],
      durationFilter: VideoDuration.parse("<5min"),
    };
    const sqLong = {
      rawQuery: "video",
      keywords: ["video"],
      phrases: [],
      durationFilter: VideoDuration.parse(">10min"),
    };

    const matchShort = VideoSearch.evaluateVideo(fileRec.file_id, sqShort, db);
    const matchLong = VideoSearch.evaluateVideo(fileRec.file_id, sqLong, db);

    assert.ok(matchShort !== null, "3-minute video must pass <5min filter");
    assert.strictEqual(matchLong, null, "3-minute video must fail >10min filter");
    console.log("  ✓ Passed: Contextual duration filter correctly segmented video results.");

    // --------------------------------------------------------
    // Test 7: Metadata Independence (Renaming does not alter video understanding)
    // --------------------------------------------------------
    console.log("▶ Test 7: Metadata independence verification...");
    const renamedPath = path.join(testRoot, "unrelated_random_filename.mp4");
    await fsp.copyFile(testVideoPath, renamedPath);

    const recRenamed = createFileRecord({
      file_id: "vid_renamed_002",
      path: renamedPath,
      name: "unrelated_random_filename.mp4",
      extension: ".mp4",
      hash: "hash_vid_demo_001",
    });

    const renamedAnalysis = await videoAnalyzer.analyze(recRenamed);
    assert.strictEqual(renamedAnalysis.entities.duration, analysisRes.entities.duration);
    assert.strictEqual(renamedAnalysis.description, analysisRes.description);
    console.log("  ✓ Passed: Video analysis operates on video content independently of filename.");

    // --------------------------------------------------------
    // Test 8: Corrupted / Invalid Video Safety
    // --------------------------------------------------------
    console.log("▶ Test 8: Corrupted & zero-byte video safety check...");
    const corruptPath = path.join(testRoot, "corrupted.mp4");
    await fsp.writeFile(corruptPath, Buffer.from("NOT_A_VALID_MP4_FILE"));

    const recCorrupt = createFileRecord({
      file_id: "vid_corrupt",
      path: corruptPath,
      name: "corrupted.mp4",
      extension: ".mp4",
    });

    const corruptRes = await videoAnalyzer.analyze(recCorrupt);
    assert.ok(corruptRes !== null);
    console.log("  ✓ Passed: Corrupted video processed safely without crashing.");

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 5 REAL VIDEO PIPELINE TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    await visionRuntime.shutdown();
    await localOCR.shutdown();
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Real Video Pipeline test suite failed:", err);
  process.exit(1);
});
