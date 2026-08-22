"use strict";

const assert = require("assert");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");

const { AISearchService } = require("../electron/services/ai/aiSearchService.cjs");
const aiSearch = require("../electron/ai-search/index.cjs");
const { createFileRecord } = aiSearch.discovery;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA REAL AI SEARCH UI INTEGRATION TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_ui_search_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const service = new AISearchService();
  service.appDataDir = testRoot;
  service.dbDir = path.join(testRoot, "db");
  service.dbPath = path.join(service.dbDir, "test_ui_search.db");

  try {
    // --------------------------------------------------------
    // Test 1: AISearchService Initialization
    // --------------------------------------------------------
    console.log("▶ Test 1: Initializing AISearchService...");
    const initRes = await service.initialize();
    assert.strictEqual(initRes, true, "AISearchService must initialize successfully");
    assert.strictEqual(service.getStatus().isDbReady, true);
    assert.strictEqual(service.getStatus().isVectorsReady, true);
    console.log("  ✓ Passed: AISearchService backend initialized with SQLite, ONNX runtimes, and VectorStore.");

    // --------------------------------------------------------
    // Seed Sample Real Test Files across Modalities
    // --------------------------------------------------------
    // 1. PDF Document
    const pdfPath = path.join(testRoot, "Cybersecurity_Architecture_Guide.pdf");
    await fsp.writeFile(pdfPath, "PDF sample content");
    const recPdf = createFileRecord({
      file_id: "doc_cyber_01",
      path: pdfPath,
      name: "Cybersecurity_Architecture_Guide.pdf",
      extension: ".pdf",
      size: 2450000,
      hash: "hash_doc_01",
      mime_type: "application/pdf",
    });
    service.db.files.insert(recPdf);
    service.db.content.upsert(recPdf.file_id, {
      extracted_text: "Comprehensive cybersecurity architecture guide explaining zero trust network defense, firewalls, and cryptographic protocols.",
      word_count: 14,
    });
    service.db.fts.updateSearchableContent(recPdf.file_id, {
      text: "Comprehensive cybersecurity architecture guide explaining zero trust network defense, firewalls, and cryptographic protocols.",
      description: "University cybersecurity textbook chapter covering network defenses",
      tags: "cybersecurity security network firewall encryption",
    });
    service.db.ai.upsert(recPdf.file_id, {
      description: "University cybersecurity textbook chapter covering network defenses",
      tags: JSON.stringify(["cybersecurity", "security", "network", "firewall", "encryption"]),
    });
    await service.vectors.embedFile(recPdf, { text: `${recPdf.name}. Cybersecurity architecture and zero trust network defense` });

    // 2. OCR Image (Neutral Filename)
    const ocrImgPath = path.join(testRoot, "IMG_0088.png");
    await fsp.writeFile(ocrImgPath, "PNG raster");
    const recOcrImg = createFileRecord({
      file_id: "img_ocr_02",
      path: ocrImgPath,
      name: "IMG_0088.png",
      extension: ".png",
      size: 4200000,
      hash: "hash_img_02",
      mime_type: "image/png",
    });
    service.db.files.insert(recOcrImg);
    service.db.content.upsert(recOcrImg.file_id, {
      extracted_text: "Shambhunath University Invoice Total Amount Due $1,500 Paid",
      word_count: 8,
    });
    service.db.fts.updateSearchableContent(recOcrImg.file_id, {
      text: "Shambhunath University Invoice Total Amount Due $1,500 Paid",
      description: "Scanned document receipt showing university payment",
      tags: "invoice receipt document university",
    });
    service.db.ai.upsert(recOcrImg.file_id, {
      description: "Scanned document receipt showing university payment",
      tags: JSON.stringify(["invoice", "receipt", "document", "university"]),
      entities: JSON.stringify({
        ocrFrames: [{ text: "Shambhunath University Invoice Paid", timestamp: 0, timestampFormatted: "00:00" }],
      }),
    });
    await service.vectors.embedFile(recOcrImg, { text: `${recOcrImg.name}. Shambhunath University Invoice receipt` });

    // 3. Vision Image (Neutral Filename with Visual Concept)
    const visionImgPath = path.join(testRoot, "DSC_0412.jpg");
    await fsp.writeFile(visionImgPath, "JPG raster");
    const recVisionImg = createFileRecord({
      file_id: "img_vis_03",
      path: visionImgPath,
      name: "DSC_0412.jpg",
      extension: ".jpg",
      size: 5600000,
      hash: "hash_img_03",
      mime_type: "image/jpeg",
    });
    service.db.files.insert(recVisionImg);
    service.db.fts.updateSearchableContent(recVisionImg.file_id, {
      text: "DSC_0412.jpg birthday cake party celebration people",
      description: "Photograph showing birthday cake with candles and family celebration party",
      tags: "birthday cake party people celebration",
    });
    service.db.ai.upsert(recVisionImg.file_id, {
      description: "Photograph showing birthday cake with candles and family celebration party",
      tags: JSON.stringify(["birthday", "cake", "party", "people", "celebration"]),
      entities: JSON.stringify({
        containsPeople: true,
        scenes: [{ label: "party", confidence: 0.96 }],
        objects: [{ label: "cake", confidence: 0.98 }],
      }),
    });
    await service.vectors.embedFile(recVisionImg, { text: `${recVisionImg.name}. Birthday celebration party with cake` });

    // 4. Video Recording with OCR & Timestamp
    const vidPath = path.join(testRoot, "VID_2026_08.mp4");
    await fsp.writeFile(vidPath, "MP4 stream");
    const recVid = createFileRecord({
      file_id: "vid_demo_04",
      path: vidPath,
      name: "VID_2026_08.mp4",
      extension: ".mp4",
      size: 150000000,
      hash: "hash_vid_04",
      mime_type: "video/mp4",
    });
    service.db.files.insert(recVid);
    service.db.content.upsert(recVid.file_id, {
      extracted_text: "Nexora Explorer v2.0 Terminal Demo npm run dev terminal code editor",
      word_count: 11,
    });
    service.db.fts.updateSearchableContent(recVid.file_id, {
      text: "Nexora Explorer v2.0 Terminal Demo npm run dev terminal code editor",
      description: "Video demonstration of terminal code automation",
      tags: "terminal demo code software",
    });
    service.db.ai.upsert(recVid.file_id, {
      description: "Video demonstration of terminal code automation",
      tags: JSON.stringify(["terminal", "demo", "code", "software"]),
      entities: JSON.stringify({
        duration: 360,
        hasAudio: true,
        ocrFrames: [{ text: "Nexora Explorer v2.0 Terminal", timestamp: 45, timestampFormatted: "00:45" }],
        transcriptSegments: [{ text: "In this demo we run npm run dev", timestamp: 45, timestampFormatted: "00:45" }],
      }),
    });
    await service.vectors.embedFile(recVid, { text: `${recVid.name}. Video demonstration of terminal code automation` });

    // 5. Audio Recording with Speech Transcript
    const audPath = path.join(testRoot, "AUDIO_REC_91.wav");
    await fsp.writeFile(audPath, "WAV stream");
    const recAud = createFileRecord({
      file_id: "aud_pod_05",
      path: audPath,
      name: "AUDIO_REC_91.wav",
      extension: ".wav",
      size: 12000000,
      hash: "hash_aud_05",
      mime_type: "audio/wav",
    });
    service.db.files.insert(recAud);
    service.db.content.upsert(recAud.file_id, {
      extracted_text: "Welcome to AI Search podcast. Today we explain neural embeddings and vector similarity retrieval.",
      word_count: 14,
    });
    service.db.fts.updateSearchableContent(recAud.file_id, {
      text: "Welcome to AI Search podcast. Today we explain neural embeddings and vector similarity retrieval.",
      description: "Podcast discussion explaining neural embeddings and vector similarity",
      tags: "podcast ai speech embeddings",
    });
    service.db.ai.upsert(recAud.file_id, {
      description: "Podcast discussion explaining neural embeddings and vector similarity",
      tags: JSON.stringify(["podcast", "ai", "speech", "embeddings"]),
      entities: JSON.stringify({
        duration: 480,
        hasAudio: true,
        transcriptSegments: [
          { text: "neural embeddings and vector similarity retrieval", timestamp: 142, timestampFormatted: "02:22" },
        ],
      }),
    });
    await service.vectors.embedFile(recAud, { text: `${recAud.name}. Podcast explaining neural embeddings and vector similarity` });

    // --------------------------------------------------------
    // Test 2: Search PDF Document via FTS5 & Vector Search
    // --------------------------------------------------------
    console.log("▶ Test 2: Document search ('cybersecurity zero trust')...");
    const resDoc = await service.search("cybersecurity zero trust");
    assert.strictEqual(resDoc.status, "results");
    assert.ok(resDoc.results.length > 0);
    assert.strictEqual(resDoc.results[0].id, "doc_cyber_01");
    assert.strictEqual(resDoc.results[0].type, "documents");
    assert.ok(resDoc.results[0].score.includes("% match"));
    console.log(`  ✓ Passed: Retrieved document '${resDoc.results[0].name}' (${resDoc.results[0].score}).`);

    // --------------------------------------------------------
    // Test 3: Search OCR Text on Neutral Filename
    // --------------------------------------------------------
    console.log("▶ Test 3: OCR text search on neutral filename ('Shambhunath University')...");
    const resOcr = await service.search("Shambhunath University");
    assert.strictEqual(resOcr.status, "results");
    assert.ok(resOcr.results.some((r) => r.id === "img_ocr_02"));
    const ocrMatch = resOcr.results.find((r) => r.id === "img_ocr_02");
    assert.strictEqual(ocrMatch.type, "images");
    console.log(`  ✓ Passed: Retrieved neutral file '${ocrMatch.name}' via indexed OCR text.`);

    // --------------------------------------------------------
    // Test 4: Visual Concept Search on Neutral Image
    // --------------------------------------------------------
    console.log("▶ Test 4: Visual concept search ('birthday cake celebration')...");
    const resVision = await service.search("birthday cake celebration");
    assert.strictEqual(resVision.status, "results");
    assert.ok(resVision.results.some((r) => r.id === "img_vis_03"));
    const visionMatch = resVision.results.find((r) => r.id === "img_vis_03");
    assert.ok(visionMatch.tags.includes("birthday") || visionMatch.tags.includes("cake"));
    console.log(`  ✓ Passed: Retrieved image '${visionMatch.name}' via visual concepts [${visionMatch.tags.join(", ")}].`);

    // --------------------------------------------------------
    // Test 5: Video Search with Timestamp Extraction
    // --------------------------------------------------------
    console.log("▶ Test 5: Video search with timestamp extraction ('Nexora Explorer v2.0')...");
    const resVid = await service.search("Nexora Explorer v2.0");
    assert.strictEqual(resVid.status, "results");
    const vidMatch = resVid.results.find((r) => r.id === "vid_demo_04");
    assert.ok(vidMatch !== undefined);
    assert.strictEqual(vidMatch.type, "videos");
    assert.strictEqual(vidMatch.evidence.timestamp, "00:45");
    console.log(`  ✓ Passed: Retrieved video '${vidMatch.name}' with timestamp ⏱ ${vidMatch.evidence.timestamp}.`);

    // --------------------------------------------------------
    // Test 6: Audio Speech Transcript Search with Spoken Timestamp
    // --------------------------------------------------------
    console.log("▶ Test 6: Audio speech transcript search ('vector similarity retrieval')...");
    const resAud = await service.search("vector similarity retrieval");
    assert.strictEqual(resAud.status, "results");
    const audMatch = resAud.results.find((r) => r.id === "aud_pod_05");
    assert.ok(audMatch !== undefined);
    assert.strictEqual(audMatch.type, "audio");
    assert.strictEqual(audMatch.evidence.timestamp, "02:22");
    console.log(`  ✓ Passed: Retrieved audio '${audMatch.name}' with spoken timestamp ⏱ ${audMatch.evidence.timestamp}.`);

    // --------------------------------------------------------
    // Test 7: UI Filter by Modality ('fileType: images')
    // --------------------------------------------------------
    console.log("▶ Test 7: Filtering results by file type ('images')...");
    const resFiltered = await service.search("cybersecurity", { fileType: "images" });
    assert.ok(resFiltered.results.every((r) => r.type === "images"));
    console.log("  ✓ Passed: Filter strictly restricted candidate results to images.");

    // --------------------------------------------------------
    // Test 8: Empty Query & No Results Handling
    // --------------------------------------------------------
    console.log("▶ Test 8: Empty query and zero-match query handling...");
    const resEmpty = await service.search("");
    assert.strictEqual(resEmpty.status, "empty");

    const resNoMatch = await service.search("xyznonexistentqueryterm12345");
    assert.strictEqual(resNoMatch.status, "no-results");
    console.log("  ✓ Passed: Clean empty and no-results UI state transitions verified.");

    service.db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 7 AI SEARCH UI INTEGRATION TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Real AI Search UI Integration test suite failed:", err);
  process.exit(1);
});
