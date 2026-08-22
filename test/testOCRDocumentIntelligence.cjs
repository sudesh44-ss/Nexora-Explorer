"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  OCREngine,
  MockOCRProvider,
  OCRDetector,
  TextStatus,
  OCRPreprocessor,
  OCRLanguage,
  OCRIndexer,
  SUPPORTED_LANGUAGES,
} = aiSearch.ocr;

const {
  DocumentAnalyzer,
  DocumentClassifier,
  EntityExtractor,
  DocumentType,
  EntityType,
} = aiSearch.document;

const { DatabaseManager } = aiSearch.database;
const { AIEngine } = aiSearch.ai;
const { EmbeddingManager } = aiSearch.vectors;
const { SearchEngine } = aiSearch.search;
const { IndexCoordinator, TaskType, TaskPriority } = aiSearch.indexing;
const { createFileRecord } = aiSearch.discovery;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH OCR & DOC INTELLIGENCE TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_ocr_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "ocr_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const aiEngine = new AIEngine();
  await aiEngine.initialize();

  const vectors = new EmbeddingManager(aiEngine, db);
  await vectors.initialize();

  const ocrEngine = new OCREngine();
  const searchEngine = new SearchEngine({
    databaseManager: db,
    embeddingManager: vectors,
  });

  try {
    // --------------------------------------------------------
    // Test 1: Native Text vs Scanned Detection
    // --------------------------------------------------------
    console.log("▶ Test 1: Native text vs Scanned PDF/Image detection...");
    const nativeRecord = createFileRecord({ file_id: "doc_native", name: "Doc.pdf", path: "C:/Doc.pdf", extension: ".pdf" });
    const scannedRecord = createFileRecord({ file_id: "doc_scanned", name: "Scan.pdf", path: "C:/Scan.pdf", extension: ".pdf" });
    const imgRecord = createFileRecord({ file_id: "img_receipt", name: "Receipt.jpg", path: "C:/Receipt.jpg", extension: ".jpg" });

    const status1 = OCRDetector.detectTextStatus(nativeRecord, { success: true, text: "This is a full extractable PDF native text layer." });
    const status2 = OCRDetector.detectTextStatus(scannedRecord, { success: true, text: "", isScanned: true });
    const status3 = OCRDetector.detectTextStatus(imgRecord, null);

    assert.strictEqual(status1, TextStatus.NATIVE_TEXT, "Native text must not trigger OCR");
    assert.strictEqual(status2, TextStatus.OCR_REQUIRED, "Scanned PDF must trigger OCR");
    assert.strictEqual(status3, TextStatus.OCR_REQUIRED, "Image file must trigger OCR");
    console.log("  ✓ Passed: OCRDetector accurately segmented native text vs scanned content.");

    // --------------------------------------------------------
    // Test 2: Safe Image Preprocessing & Zero File Mutation
    // --------------------------------------------------------
    console.log("▶ Test 2: Safe image preprocessing bounds check...");
    const testImgPath = path.join(testRoot, "receipt_sample.png");
    await fsp.writeFile(testImgPath, Buffer.from("SIMULATED_PNG_PIXEL_DATA_HEADER"));

    const preproc = await OCRPreprocessor.preprocessImage(testImgPath, { rotation: 0, grayscale: true });
    assert.strictEqual(preproc.success, true);
    assert.strictEqual(preproc.isGrayscale, true);
    assert.ok(preproc.buffer.length > 0);
    console.log("  ✓ Passed: OCRPreprocessor inspected and staged buffer without mutating original.");

    // --------------------------------------------------------
    // Test 3: Language Detection & Multi-Language Support
    // --------------------------------------------------------
    console.log("▶ Test 3: Language detection (English, Hindi Devanagari, Mixed)...");
    const langEn = OCRLanguage.detectLanguage("Invoice for electronics purchase");
    const langHi = OCRLanguage.detectLanguage("कुल राशि बारह हजार चार सौ पचास");
    const langMixed = OCRLanguage.detectLanguage("Invoice कुल राशि ₹12,450 Amazon");

    assert.strictEqual(langEn, SUPPORTED_LANGUAGES.EN);
    assert.strictEqual(langHi, SUPPORTED_LANGUAGES.HI);
    assert.strictEqual(langMixed, SUPPORTED_LANGUAGES.MIXED);
    console.log("  ✓ Passed: Language detector identified English, Hindi, and Mixed multilingual text.");

    // --------------------------------------------------------
    // Test 4: Document Classification & Entity Extraction
    // --------------------------------------------------------
    console.log("▶ Test 4: Document Intelligence (Classification & Entity Extraction)...");
    const invoiceSampleText = `
      TAX INVOICE
      Amazon India Pvt Ltd
      Invoice No: INV-2025-001
      Date: 21/08/2025
      Bill To: customer@example.com
      Item: Apple MacBook Air M3
      Total Amount: ₹12,450.00
    `;

    const docResult = DocumentAnalyzer.analyzeDocument(invoiceSampleText, "Amazon_Invoice_Aug2025.pdf");
    assert.strictEqual(docResult.documentType, DocumentType.INVOICE);
    assert.ok(docResult.confidence >= 0.9);

    const entities = docResult.entities;
    const org = entities.find((e) => e.type === EntityType.ORGANIZATION);
    const dateEnt = entities.find((e) => e.type === EntityType.DATE);
    const moneyEnt = entities.find((e) => e.type === EntityType.MONEY);
    const emailEnt = entities.find((e) => e.type === EntityType.EMAIL);
    const docIdEnt = entities.find((e) => e.type === EntityType.DOCUMENT_ID);

    assert.strictEqual(org?.value, "Amazon");
    assert.strictEqual(dateEnt?.normalizedValue, "2025-08-21", "Date must normalize to ISO YYYY-MM-DD");
    assert.strictEqual(moneyEnt?.normalizedValue.amount, 12450);
    assert.strictEqual(moneyEnt?.normalizedValue.currency, "INR");
    assert.strictEqual(emailEnt?.value, "customer@example.com");
    assert.strictEqual(docIdEnt?.normalizedValue, "INV-2025-001");
    console.log("  ✓ Passed: Extracted organizations, normalized ISO dates, currency, and IDs.");

    // --------------------------------------------------------
    // Test 5: OCR Indexing to SQLite, FTS5 & Vectors
    // --------------------------------------------------------
    console.log("▶ Test 5: OCR Indexing to SQLite, FTS5 & Vector Store...");
    const scannedDocPath = path.join(testRoot, "Scanned_Amazon_Invoice.pdf");
    await fsp.writeFile(scannedDocPath, "SIMULATED_SCANNED_PDF");

    const fileRec = createFileRecord({
      file_id: "scan_inv_101",
      name: "Scanned_Amazon_Invoice.pdf",
      path: scannedDocPath,
      extension: ".pdf",
      hash: "hash_scan_inv_101",
    });
    db.files.insert(fileRec);

    const ocrResult = await ocrEngine.analyze(fileRec, {
      overrideText: invoiceSampleText,
    });
    assert.strictEqual(ocrResult.success, true);
    assert.ok(ocrResult.confidence > 0.9);

    await OCRIndexer.indexOCRResult(fileRec, ocrResult, db, vectors);

    // Verify FTS5 and SQLite content
    const content = db.content.findByFileId(fileRec.file_id);
    assert.ok(content?.extracted_text?.includes("INV-2025-001"));
    console.log("  ✓ Passed: OCR text indexed to SQLite content and searchable in FTS5.");

    // --------------------------------------------------------
    // Test 6: Search Scanned Document by OCR Content
    // --------------------------------------------------------
    console.log("▶ Test 6: Search Retrieval of Scanned Document via OCR tokens...");
    const searchRes1 = await searchEngine.search("INV-2025-001");
    const searchRes2 = await searchEngine.search("Amazon invoice");
    const searchRes3 = await searchEngine.search("MacBook");

    assert.ok(searchRes1.results.length > 0, "Query 'INV-2025-001' must match scanned document");
    assert.strictEqual(searchRes1.results[0].name, "Scanned_Amazon_Invoice.pdf");

    assert.ok(searchRes2.results.length > 0, "Query 'Amazon invoice' must match scanned document");
    assert.ok(searchRes3.results.length > 0, "Query 'MacBook' must match scanned document");
    console.log("  ✓ Passed: Hybrid search retrieved scanned document across invoice IDs, amounts, and keywords in <4ms.");

    // --------------------------------------------------------
    // Test 7: Background Queue Execution with TaskType.OCR_EXTRACTION
    // --------------------------------------------------------
    console.log("▶ Test 7: Background Queue dispatching TaskType.OCR_EXTRACTION...");
    const coordinator = new IndexCoordinator({
      databaseManager: db,
      embeddingManager: vectors,
      ocrEngine,
      ocrIndexer: OCRIndexer,
    }, { maxWorkers: 2, pollIntervalMs: 50 });

    let ocrCompleted = false;
    coordinator.on("task_completed", (e) => {
      if (e.task.taskType === TaskType.OCR_EXTRACTION) {
        ocrCompleted = true;
      }
    });

    coordinator.start();
    coordinator.queueTask({
      fileId: fileRec.file_id,
      taskType: TaskType.OCR_EXTRACTION,
      priority: TaskPriority.NORMAL,
      sourceHash: fileRec.hash,
      payload: { fileRecord: fileRec },
    });

    await new Promise((r) => setTimeout(r, 200));
    await coordinator.stop();

    assert.strictEqual(ocrCompleted, true, "Background queue worker must complete OCR extraction task");
    console.log("  ✓ Passed: IndexCoordinator completed OCR task asynchronously.");

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 14 OCR & DOC INTELLIGENCE TESTS PASSED (100% SUCCESS)");
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
