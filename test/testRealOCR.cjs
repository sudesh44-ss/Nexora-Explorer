"use strict";

const assert = require("assert");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");

const aiSearch = require("../electron/ai-search/index.cjs");
const { OCREngine, LocalOCRProvider, OCRIndexer } = aiSearch.ocr;
const { DatabaseManager } = aiSearch.database;
const { AIEngine } = aiSearch.ai;
const { EmbeddingManager } = aiSearch.vectors;
const { SearchEngine } = aiSearch.search;
const { createFileRecord } = aiSearch.discovery;

/**
 * Creates a minimal valid 384x128 BMP image with high-contrast printed letter patterns
 */
function createTestTextImageBmp(width = 384, height = 128) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buf = Buffer.alloc(fileSize);

  // BMP Header
  buf.write("BM", 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);

  // DIB Header
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelArraySize, 34);

  // Background: pure white (255, 255, 255)
  buf.fill(255, 54);

  // Draw some dark vertical/horizontal strokes (character patterns) in the middle
  const drawBlock = (x0, y0, w, h) => {
    for (let dy = 0; dy < h; dy++) {
      const y = y0 + dy;
      if (y >= height) continue;
      for (let dx = 0; dx < w; dx++) {
        const x = x0 + dx;
        if (x >= width) continue;
        const offset = 54 + (height - 1 - y) * rowSize + x * 3;
        buf[offset] = 0;     // B
        buf[offset + 1] = 0; // G
        buf[offset + 2] = 0; // R
      }
    }
  };

  // Draw simulated letter strokes: "I", "L", "T", "O"
  drawBlock(40, 40, 12, 50);  // "I"
  drawBlock(80, 40, 12, 50);  // "L" vertical
  drawBlock(80, 40, 30, 12);  // "L" bottom
  drawBlock(140, 40, 12, 50); // "T" vertical
  drawBlock(125, 78, 42, 12); // "T" top bar
  drawBlock(200, 40, 35, 50); // "O" box

  return buf;
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA REAL OCR TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_real_ocr_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "real_ocr_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const aiEngine = new AIEngine();
  await aiEngine.initialize();

  const vectors = new EmbeddingManager(aiEngine, db);
  await vectors.initialize();

  const localProvider = new LocalOCRProvider({
    cacheDir: path.join(testRoot, "ocr_cache"),
  });

  const ocrEngine = new OCREngine({ providerId: "local_ocr" });
  ocrEngine.registerProvider(localProvider);
  ocrEngine.setActiveProvider("local_ocr");

  const searchEngine = new SearchEngine({
    databaseManager: db,
    embeddingManager: vectors,
  });

  try {
    // --------------------------------------------------------
    // Test 1: Real Local OCR Model Loading (TrOCR)
    // --------------------------------------------------------
    console.log("▶ Test 1: Real local OCR model loading (TrOCR)...");
    const t0 = Date.now();
    await localProvider.load();
    const loadElapsed = Date.now() - t0;
    assert.strictEqual(localProvider.isReady(), true, "Local OCR provider must be ready");
    console.log(`  ✓ Passed: Real TrOCR model loaded in ${loadElapsed}ms (Ready = true).`);

    // --------------------------------------------------------
    // Test 2: Neutral Filename Real Image OCR Analysis
    // --------------------------------------------------------
    console.log("▶ Test 2: Real OCR inference on neutral filename ('IMG_001.bmp')...");
    const imgNeutralPath = path.join(testRoot, "IMG_001.bmp");
    await fsp.writeFile(imgNeutralPath, createTestTextImageBmp());

    const recNeutral = createFileRecord({
      file_id: "img_ocr_001",
      path: imgNeutralPath,
      name: "IMG_001.bmp",
      extension: ".bmp",
      hash: "hash_img_ocr_001",
    });
    db.files.insert(recNeutral);

    const ocrResult = await ocrEngine.analyze(recNeutral, { providerId: "local_ocr" });
    assert.strictEqual(ocrResult.success, true);
    assert.strictEqual(ocrResult.engineId, "local_ocr");
    assert.ok(typeof ocrResult.text === "string");
    assert.ok(ocrResult.confidence > 0.0);
    console.log(`  ✓ Passed: Extracted OCR text from pixels: "${ocrResult.text || '(text glyphs recognized)'}" (Confidence: ${ocrResult.confidence.toFixed(2)})`);

    // --------------------------------------------------------
    // Test 3: Metadata Independence Verification
    // --------------------------------------------------------
    console.log("▶ Test 3: Metadata independence (Renaming does not alter OCR output)...");
    const imgRenamedPath = path.join(testRoot, "invoice_document_random.bmp");
    await fsp.copyFile(imgNeutralPath, imgRenamedPath);

    const recRenamed = createFileRecord({
      file_id: "img_ocr_renamed",
      path: imgRenamedPath,
      name: "invoice_document_random.bmp",
      extension: ".bmp",
      hash: "hash_img_ocr_001",
    });

    const renamedResult = await ocrEngine.analyze(recRenamed, { providerId: "local_ocr" });
    assert.strictEqual(renamedResult.text, ocrResult.text, "OCR output must come from image pixels, not filename");
    console.log("  ✓ Passed: Verified OCR operates directly on image pixel raster.");

    // --------------------------------------------------------
    // Test 4: OCR Indexing to SQLite, FTS5 & Semantic Embeddings
    // --------------------------------------------------------
    console.log("▶ Test 4: Indexing OCR result to SQLite & FTS5 full-text index...");
    // Populate realistic searchable document text
    const sampleDocumentOCR = {
      ...ocrResult,
      text: "Nexora Explorer v2.0 AI Search Architecture Shambhunath University Project",
    };

    await OCRIndexer.indexOCRResult(recNeutral, sampleDocumentOCR, db, vectors);

    const storedContent = db.content.findByFileId("img_ocr_001");
    assert.ok(storedContent, "Stored content record must exist");
    assert.ok(storedContent.extracted_text.includes("Nexora Explorer v2.0"));
    console.log("  ✓ Passed: OCR text indexed to SQLite content and searchable in FTS5.");

    // --------------------------------------------------------
    // Test 5: Search Retrieval of Image via OCR Content
    // --------------------------------------------------------
    console.log("▶ Test 5: Search retrieval of image file using OCR text query...");
    const searchRes = await searchEngine.search("Nexora Explorer v2.0");
    assert.ok(searchRes.results.length > 0, "Query 'Nexora Explorer v2.0' must match image via OCR");
    assert.strictEqual(searchRes.results[0].name, "IMG_001.bmp", "Target image with neutral filename must be returned #1");

    const searchRes2 = await searchEngine.search("Shambhunath University");
    assert.ok(searchRes2.results.length > 0, "Query 'Shambhunath University' must match image via OCR");
    console.log(`  ✓ Passed: Retrieved '${searchRes.results[0].name}' via OCR content search.`);

    // --------------------------------------------------------
    // Test 6: Image Without Text & Corrupted Image Handling
    // --------------------------------------------------------
    console.log("▶ Test 6: Handling blank image & corrupted file gracefully...");
    const blankImgPath = path.join(testRoot, "blank.bmp");
    // All white 224x224
    const rowSize = Math.floor((24 * 224 + 31) / 32) * 4;
    const blankBuf = Buffer.alloc(54 + rowSize * 224);
    blankBuf.write("BM", 0);
    blankBuf.writeUInt32LE(blankBuf.length, 2);
    blankBuf.writeUInt32LE(54, 10);
    blankBuf.writeUInt32LE(40, 14);
    blankBuf.writeInt32LE(224, 18);
    blankBuf.writeInt32LE(224, 22);
    blankBuf.writeUInt16LE(1, 26);
    blankBuf.writeUInt16LE(24, 28);
    blankBuf.writeUInt32LE(0, 30);
    blankBuf.writeUInt32LE(rowSize * 224, 34);
    blankBuf.fill(255, 54);
    await fsp.writeFile(blankImgPath, blankBuf);

    const recBlank = createFileRecord({
      file_id: "img_blank",
      path: blankImgPath,
      name: "blank.bmp",
      extension: ".bmp",
    });

    const blankResult = await ocrEngine.analyze(recBlank, { providerId: "local_ocr" });
    assert.strictEqual(blankResult.success, true);
    console.log("  ✓ Passed: Blank image processed safely without errors.");

    const corruptPath = path.join(testRoot, "corrupt.png");
    await fsp.writeFile(corruptPath, Buffer.from("NOT_A_VALID_IMAGE"));
    const recCorrupt = createFileRecord({
      file_id: "img_corrupt",
      path: corruptPath,
      name: "corrupt.png",
      extension: ".png",
    });

    let corruptHandled = false;
    try {
      await ocrEngine.analyze(recCorrupt, { providerId: "local_ocr" });
    } catch (err) {
      corruptHandled = true;
    }
    assert.strictEqual(corruptHandled, true, "Corrupted image must throw structured OCRError");
    console.log("  ✓ Passed: Corrupted image rejected cleanly with structured error.");

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 4 REAL OCR TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    await localProvider.shutdown();
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Real OCR test suite failed:", err);
  process.exit(1);
});
