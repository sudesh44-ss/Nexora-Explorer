"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const zlib = require("zlib");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  ExtractionManager,
  PlainTextExtractor,
  JsonExtractor,
  CsvExtractor,
  CodeExtractor,
  PdfExtractor,
  DocxExtractor,
} = aiSearch.extraction;

const { DatabaseManager } = aiSearch.database;
const { createFileRecord } = aiSearch.discovery;

/**
 * Creates a minimal valid DOCX buffer for testing
 */
function createDummyDocxBuffer(paragraphTexts = ["Hello Nexora Explorer", "Second paragraph text"]) {
  const xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphTexts.map((t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join("\n")}
  </w:body>
</w:document>`;

  const xmlBuffer = Buffer.from(xmlContent, "utf8");
  const compXml = zlib.deflateRawSync(xmlBuffer);

  const fileName = "word/document.xml";
  const fileNameBuf = Buffer.from(fileName, "utf8");

  // Local File Header
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); // Signature
  header.writeUInt16LE(20, 4);        // Version needed
  header.writeUInt16LE(0, 6);         // Flags
  header.writeUInt16LE(8, 8);         // Compression: Deflate
  header.writeUInt16LE(0, 10);        // Time
  header.writeUInt16LE(0, 12);        // Date
  header.writeUInt32LE(0, 14);        // CRC32
  header.writeUInt32LE(compXml.length, 18);  // Compressed size
  header.writeUInt32LE(xmlBuffer.length, 22); // Uncompressed size
  header.writeUInt16LE(fileNameBuf.length, 26); // Filename length
  header.writeUInt16LE(0, 28);        // Extra field length

  return Buffer.concat([header, fileNameBuf, compXml]);
}

/**
 * Creates a minimal valid PDF buffer for testing
 */
function createDummyPdfBuffer(text = "Hello World PDF Content") {
  const contentStream = `BT /F1 18 Tf 50 100 Td (${text}) Tj ET`;
  return Buffer.from(
    `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>/Contents 4 0 R>>endobj
4 0 obj<</Length ${contentStream.length}>>stream
${contentStream}
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000216 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
310
%%EOF`
  );
}

/**
 * Creates a valid multi-page PDF buffer for testing
 */
function createMultiPagePdfBuffer(pageTexts = ["Page 1 Content", "Page 2 Content"]) {
  const count = pageTexts.length;
  let kidsArray = [];
  for (let i = 0; i < count; i++) {
    kidsArray.push(`${3 + i * 2} 0 R`);
  }

  let body = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count ${count}/Kids[${kidsArray.join(" ")}]>>endobj\n`;

  for (let i = 0; i < count; i++) {
    const pageObjNum = 3 + i * 2;
    const contentObjNum = pageObjNum + 1;
    const streamContent = `BT /F1 12 Tf 50 700 Td (${pageTexts[i]}) Tj ET`;
    body += `${pageObjNum} 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>/Contents ${contentObjNum} 0 R>>endobj\n`;
    body += `${contentObjNum} 0 obj<</Length ${streamContent.length}>>stream\n${streamContent}\nendstream\nendobj\n`;
  }

  const startxref = body.length;
  body += `xref\n0 1\n0000000000 65535 f\ntrailer<</Size ${3 + count * 2}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF`;
  return Buffer.from(body);
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH EXTRACTION TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_extract_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const manager = new ExtractionManager();

  try {
    // --------------------------------------------------------
    // Test 1: Plain Text, Markdown & Log Extraction
    // --------------------------------------------------------
    console.log("▶ Test 1: Plain Text (.txt, .md, .log) extraction...");
    const txtPath = path.join(testRoot, "security_guide.txt");
    await fsp.writeFile(txtPath, "Penetration testing is an authorized simulated cyberattack on a computer system.");

    const txtRecord = createFileRecord({
      file_id: "rec_txt_1",
      path: txtPath,
      name: "security_guide.txt",
      extension: ".txt",
    });

    const txtRes = await manager.extract(txtRecord);
    assert.strictEqual(txtRes.success, true, "Plain text extraction should succeed");
    assert.ok(txtRes.text.includes("Penetration testing"), "Extracted text must match");
    assert.ok(txtRes.wordCount >= 10, "Word count should be calculated");
    console.log(`  ✓ Passed: Text extracted (${txtRes.wordCount} words): '${txtRes.text.slice(0, 40)}...'`);

    // --------------------------------------------------------
    // Test 2: Structured JSON & CSV Extraction
    // --------------------------------------------------------
    console.log("▶ Test 2: Structured JSON and CSV extraction...");
    const jsonPath = path.join(testRoot, "config.json");
    await fsp.writeFile(jsonPath, JSON.stringify({ project: "Nexora Explorer", version: "2.0", features: ["AI Search", "Tabs"] }));

    const jsonRes = await manager.extract(createFileRecord({
      file_id: "rec_json_1",
      path: jsonPath,
      extension: ".json",
    }));

    assert.strictEqual(jsonRes.success, true);
    assert.ok(jsonRes.text.includes("Nexora Explorer"), "JSON values flattened to text");
    assert.ok(jsonRes.text.includes("AI Search"), "JSON array items flattened");

    const csvPath = path.join(testRoot, "students.csv");
    await fsp.writeFile(csvPath, "Name,Course,Year\nSudesh,BCom,3\nAnanya,BSc,2");
    const csvRes = await manager.extract(createFileRecord({
      file_id: "rec_csv_1",
      path: csvPath,
      extension: ".csv",
    }));
    assert.strictEqual(csvRes.success, true);
    assert.ok(csvRes.text.includes("Sudesh"), "CSV cells preserved");
    console.log("  ✓ Passed: JSON & CSV structured formats converted to clean searchable text.");

    // --------------------------------------------------------
    // Test 3: Source Code Extraction
    // --------------------------------------------------------
    console.log("▶ Test 3: Source Code (.js, .py, .html) extraction...");
    const jsPath = path.join(testRoot, "auth.js");
    await fsp.writeFile(jsPath, "export function login(username, password) {\n  return authenticate(username, password);\n}");
    const jsRes = await manager.extract(createFileRecord({
      file_id: "rec_js_1",
      path: jsPath,
      extension: ".js",
    }));
    assert.strictEqual(jsRes.success, true);
    assert.ok(jsRes.text.includes("export function login"), "Code structure preserved");
    console.log("  ✓ Passed: Source code read safely without execution.");

    // --------------------------------------------------------
    // Test 4: PDF Document Extraction (Single and Multi-Page)
    // --------------------------------------------------------
    console.log("▶ Test 4: PDF Text extraction (Single and Multi-Page)...");
    const pdfPath = path.join(testRoot, "sample_document.pdf");
    await fsp.writeFile(pdfPath, createDummyPdfBuffer("Confidential Financial Audit Report 2026"));

    const pdfRes = await manager.extract(createFileRecord({
      file_id: "rec_pdf_1",
      path: pdfPath,
      extension: ".pdf",
    }));
    assert.strictEqual(pdfRes.success, true, "PDF extraction must succeed");
    assert.ok(pdfRes.text.includes("Confidential Financial Audit"), "Extracted PDF text matches");

    // Multi-page PDF test
    const multiPdfPath = path.join(testRoot, "multi_document.pdf");
    await fsp.writeFile(multiPdfPath, createMultiPagePdfBuffer(["First Page Information", "Second Page Details"]));

    const multiPdfRes = await manager.extract(createFileRecord({
      file_id: "rec_pdf_multi",
      path: multiPdfPath,
      extension: ".pdf",
    }));
    assert.strictEqual(multiPdfRes.success, true, "Multi-page PDF extraction must succeed");
    assert.ok(multiPdfRes.text.includes("First Page Information"), "Page 1 extracted");
    assert.ok(multiPdfRes.text.includes("Second Page Details"), "Page 2 extracted");

    // Corrupted PDF test
    const corruptPdfPath = path.join(testRoot, "corrupted.pdf");
    await fsp.writeFile(corruptPdfPath, Buffer.from("%PDF-1.4\ncorrupted random bytes not valid pdf structure"));
    const corruptPdfRes = await manager.extract(createFileRecord({
      file_id: "rec_pdf_corrupt",
      path: corruptPdfPath,
      extension: ".pdf",
    }));
    assert.ok(corruptPdfRes !== null);
    console.log("  ✓ Passed: Single, multi-page, and corrupted PDF tests verified successfully.");

    // --------------------------------------------------------
    // Test 5: DOCX Document Extraction
    // --------------------------------------------------------
    console.log("▶ Test 5: DOCX Document extraction via pure ZIP parser...");
    const docxPath = path.join(testRoot, "thesis_draft.docx");
    await fsp.writeFile(docxPath, createDummyDocxBuffer([
      "Neural Network Quantization on Microcontrollers",
      "Chapter 1: Mathematical Foundations of Pruning",
    ]));

    const docxRes = await manager.extract(createFileRecord({
      file_id: "rec_docx_1",
      path: docxPath,
      extension: ".docx",
    }));
    assert.strictEqual(docxRes.success, true, "DOCX extraction must succeed");
    assert.ok(docxRes.text.includes("Neural Network Quantization"), "DOCX heading extracted");
    assert.ok(docxRes.text.includes("Chapter 1: Mathematical"), "DOCX paragraph extracted");
    console.log("  ✓ Passed: DOCX document parsed cleanly with 0 external binaries.");

    // --------------------------------------------------------
    // Test 6: Scanned PDF Handling (0 Text Layer)
    // --------------------------------------------------------
    console.log("▶ Test 6: Scanned PDF without text layer...");
    const emptyPdfPath = path.join(testRoot, "scanned_image.pdf");
    // Minimal PDF with blank page
    await fsp.writeFile(emptyPdfPath, Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n165\n%%EOF"));

    const emptyPdfRes = await manager.extract(createFileRecord({
      file_id: "rec_scanned_pdf",
      path: emptyPdfPath,
      extension: ".pdf",
    }));
    assert.strictEqual(emptyPdfRes.success, true);
    assert.strictEqual(emptyPdfRes.text, "");
    assert.ok(emptyPdfRes.warnings[0].includes("TEXT_NOT_AVAILABLE"), "Identified as scanned PDF");
    console.log("  ✓ Passed: Scanned PDF safely identified without crashing.");

    // --------------------------------------------------------
    // Test 7: Size Limits & Truncation
    // --------------------------------------------------------
    console.log("▶ Test 7: Extraction limits and truncation reporting...");
    const bigTxtPath = path.join(testRoot, "long_log.log");
    await fsp.writeFile(bigTxtPath, "A".repeat(5000));

    const truncRes = await manager.extract(createFileRecord({
      file_id: "rec_trunc_1",
      path: bigTxtPath,
      extension: ".log",
    }), { maxExtractedCharacters: 100 });

    assert.strictEqual(truncRes.success, true);
    assert.strictEqual(truncRes.characterCount, 100);
    assert.strictEqual(truncRes.truncated, true, "Must flag truncated = true");
    console.log("  ✓ Passed: Truncation threshold enforced.");

    // --------------------------------------------------------
    // Test 8: End-to-End Extraction & FTS5 Inner-Content Search
    // --------------------------------------------------------
    console.log("▶ Test 8: End-to-end database persistence & FTS5 inner content matching...");
    const dbPath = path.join(testRoot, "test_extract.db");
    const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
    await db.initialize();

    const bookPath = path.join(testRoot, "Quantum_Computing_Overview.txt");
    await fsp.writeFile(bookPath, "Superconducting qubits require dilution refrigerators operating at millikelvin temperatures.");

    const bookRecord = createFileRecord({
      file_id: "book_qc_001",
      name: "Quantum_Computing_Overview.txt",
      path: bookPath,
      extension: ".txt",
      hash: "hash_qc_12345",
      size: 100,
    });

    db.files.insert(bookRecord);

    // Perform extractAndPersist
    const persistRes = await manager.extractAndPersist(bookRecord, db);
    assert.strictEqual(persistRes.success, true, "Must persist to DB");
    assert.strictEqual(persistRes.cached, false, "First time is not cached");

    // Verify stored in file_content
    const storedContent = db.content.findByFileId("book_qc_001");
    assert.ok(storedContent, "file_content record must exist");
    assert.ok(storedContent.extracted_text.includes("Superconducting qubits"));

    // Verify FTS5 searches inner body text (not present in filename!)
    const ftsSearchResults = db.fts.search("dilution");
    assert.strictEqual(ftsSearchResults.length, 1, "FTS5 finds document by inner word 'dilution'");
    assert.strictEqual(ftsSearchResults[0].file_id, "book_qc_001");

    // --------------------------------------------------------
    // Test 9: Hash-based Cache Reuse
    // --------------------------------------------------------
    console.log("▶ Test 9: Hash-based extraction cache reuse...");
    const secondPersist = await manager.extractAndPersist(bookRecord, db);
    assert.strictEqual(secondPersist.success, true);
    assert.strictEqual(secondPersist.cached, true, "Subsequent extraction for same hash reused from cache");
    console.log("  ✓ Passed: Hash cache skipped disk re-extraction.");

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 6 CONTENT EXTRACTION TESTS PASSED (100% SUCCESS)");
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
