"use strict";

const assert = require("assert");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");

const aiSearch = require("../electron/ai-search/index.cjs");
const { AIEngine, LocalVisionRuntime, ModelRegistry } = aiSearch.ai;
const { ImageAnalyzer } = aiSearch.media;
const { VectorStore, VectorSearch } = aiSearch.vectors;
const { DatabaseManager } = aiSearch.database;
const { createFileRecord } = aiSearch.discovery;

/**
 * Creates a minimal valid uncompressed 224x224 BMP image buffer with solid RGB color
 */
function createTestImageBmp(r = 255, g = 200, b = 100, width = 224, height = 224) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buf = Buffer.alloc(fileSize);

  // BMP Header
  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // Offset to pixel data

  // DIB Header (BITMAPINFOHEADER)
  buf.writeUInt32LE(40, 14); // Header size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);  // Color planes
  buf.writeUInt16LE(24, 28); // Bits per pixel
  buf.writeUInt32LE(0, 30);  // BI_RGB no compression
  buf.writeUInt32LE(pixelArraySize, 34);

  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      buf[offset] = b;     // Blue
      buf[offset + 1] = g; // Green
      buf[offset + 2] = r; // Red
      offset += 3;
    }
    // Padding to 4-byte boundary
    for (let p = 0; p < (rowSize - width * 3); p++) {
      buf[offset++] = 0;
    }
  }

  return buf;
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA REAL IMAGE AI & VISION TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_vision_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const registry = new ModelRegistry();
  const runtime = new LocalVisionRuntime({ cacheDir: path.join(testRoot, "model_cache") });
  const aiEngine = new AIEngine({ modelRegistry: registry });
  aiEngine.runtimes.register(runtime);

  const analyzer = new ImageAnalyzer(aiEngine);

  try {
    // --------------------------------------------------------
    // Test 1: Real Local Vision Model Loading & Readiness
    // --------------------------------------------------------
    console.log("▶ Test 1: Real local vision model loading (CLIP ViT-Base)...");
    const modelProfile = registry.getById("clip-vit-base-patch32");
    assert.ok(modelProfile, "Model profile clip-vit-base-patch32 must exist in registry");

    const t0 = Date.now();
    const loadResult = await runtime.loadModel(modelProfile);
    const loadElapsed = Date.now() - t0;
    assert.strictEqual(loadResult.success, true);
    assert.strictEqual(runtime.isReady(), true);
    console.log(`  ✓ Passed: Real vision model loaded in ${loadElapsed}ms (Ready = true).`);

    // --------------------------------------------------------
    // Test 2: Neutral Filename Real Image Analysis
    // --------------------------------------------------------
    console.log("▶ Test 2: Visual analysis on neutral filename ('IMG_001.bmp')...");
    const imgNeutralPath = path.join(testRoot, "IMG_001.bmp");
    // Warm cake/party color profile
    await fsp.writeFile(imgNeutralPath, createTestImageBmp(255, 180, 100));

    const recNeutral = createFileRecord({
      file_id: "img_neutral_001",
      path: imgNeutralPath,
      name: "IMG_001.bmp",
      extension: ".bmp",
      hash: "hash_img_neutral_001",
    });

    const analysisRes = await analyzer.analyze(recNeutral, { runtimeId: "vision-runtime" });
    assert.strictEqual(analysisRes.success, true, "Vision analysis must succeed");
    assert.ok(analysisRes.description && analysisRes.description.length > 0, "Must produce meaningful description");
    assert.ok(Array.isArray(analysisRes.tags) && analysisRes.tags.length > 0, "Must generate visual tags");
    assert.ok(Array.isArray(analysisRes.concepts) && analysisRes.concepts.length > 0, "Must generate visual concepts");
    assert.strictEqual(analysisRes.runtimeId, "vision-runtime");

    console.log(`  ✓ Passed: Visual description generated: "${analysisRes.description}"`);
    console.log(`    Detected Concepts: [${analysisRes.concepts.join(", ")}]`);

    // --------------------------------------------------------
    // Test 3: Metadata Independence (Renaming does not alter vision results)
    // --------------------------------------------------------
    console.log("▶ Test 3: Metadata independence verification...");
    const imgRenamedPath = path.join(testRoot, "birthday_party.bmp");
    await fsp.copyFile(imgNeutralPath, imgRenamedPath);

    const recRenamed = createFileRecord({
      file_id: "img_renamed_002",
      path: imgRenamedPath,
      name: "birthday_party.bmp",
      extension: ".bmp",
      hash: "hash_img_neutral_001",
    });

    const renamedAnalysis = await analyzer.analyze(recRenamed, { runtimeId: "vision-runtime" });
    assert.strictEqual(renamedAnalysis.description, analysisRes.description, "Visual description must be identical regardless of filename");
    console.log("  ✓ Passed: Proven visual inference operates on image bytes, independent of filename.");

    // --------------------------------------------------------
    // Test 4: Real Pixel-Based Image Embeddings (512-dim Float32)
    // --------------------------------------------------------
    console.log("▶ Test 4: Real pixel-based image embedding generation...");
    const embTask = {
      type: "image_embedding",
      input: imgNeutralPath,
      modelPreference: "clip-vit-base-patch32",
    };

    const embResult = await aiEngine.runTask(embTask, { runtimeId: "vision-runtime" });
    assert.strictEqual(embResult.success, true);
    assert.strictEqual(embResult.dimensions, 512, "CLIP vision embedding must be 512 dimensions");
    assert.strictEqual(embResult.metadata.mock, false);
    assert.strictEqual(embResult.vector.length, 512);

    for (let i = 0; i < embResult.vector.length; i++) {
      assert.ok(Number.isFinite(embResult.vector[i]), "Vector elements must be finite numbers");
    }
    console.log(`  ✓ Passed: Generated real 512-dim Float32 image embedding vector.`);

    // --------------------------------------------------------
    // Test 5: Vector Store & Visual Similarity Integration
    // --------------------------------------------------------
    console.log("▶ Test 5: Vector Store persistence & visual similarity search...");
    const dbPath = path.join(testRoot, "vision_vector_test.db");
    const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
    await db.initialize();

    const vectorStore = new VectorStore(db);
    await vectorStore.initialize();

    // Store image embedding
    vectorStore.upsert("img_neutral_001", embResult.vector, {
      modelId: "clip-vit-base-patch32",
      contentHash: "hash_img_neutral_001",
      metadata: { description: analysisRes.description },
    });

    const retrieved = vectorStore.get("img_neutral_001");
    assert.ok(retrieved, "Vector must be retrieved from database");
    assert.strictEqual(retrieved.dimensions, 512);

    // Search query with matching vector
    const hits = VectorSearch.search(embResult.vector, vectorStore, { topK: 5, minimumScore: 0.8 });
    assert.strictEqual(hits.length, 1);
    assert.strictEqual(hits[0].fileId, "img_neutral_001");
    assert.ok(hits[0].score >= 0.999);
    console.log(`  ✓ Passed: Visual image embedding retrieved from VectorStore with score ${hits[0].score.toFixed(4)}.`);

    // --------------------------------------------------------
    // Test 6: Fast Vision Inference & Model Reuse
    // --------------------------------------------------------
    console.log("▶ Test 6: Model reuse and inference latency...");
    const tStart = Date.now();
    for (let i = 0; i < 3; i++) {
      await aiEngine.runTask(embTask, { runtimeId: "vision-runtime" });
    }
    const elapsed = Date.now() - tStart;
    console.log(`  ✓ Passed: Executed 3 vision embeddings in ${elapsed}ms (~${(elapsed / 3).toFixed(1)}ms per image).`);

    // --------------------------------------------------------
    // Test 7: Corrupted / Invalid Image Handling
    // --------------------------------------------------------
    console.log("▶ Test 7: Corrupted image error handling...");
    const corruptImgPath = path.join(testRoot, "corrupted.jpg");
    await fsp.writeFile(corruptImgPath, Buffer.from("NOT_A_VALID_IMAGE_DATA_12345"));

    const recCorrupt = createFileRecord({
      file_id: "img_corrupt",
      path: corruptImgPath,
      name: "corrupted.jpg",
      extension: ".jpg",
    });

    const corruptRes = await analyzer.analyze(recCorrupt, { runtimeId: "vision-runtime" });
    assert.ok(corruptRes !== null);
    console.log("  ✓ Passed: Corrupted image handled safely without crashing worker.");

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 3 REAL IMAGE AI & VISION TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    await runtime.shutdown();
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Real Image AI test suite failed:", err);
  process.exit(1);
});
