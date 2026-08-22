"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  SearchEngine,
  QueryProcessor,
  QueryParser,
  CandidateRetriever,
  CandidateMerger,
  RankingEngine,
  ScoreNormalizer,
  SearchErrorCode,
} = aiSearch.search;

const { DatabaseManager } = aiSearch.database;
const { AIEngine } = aiSearch.ai;
const { EmbeddingManager } = aiSearch.vectors;
const { createFileRecord } = aiSearch.discovery;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH HYBRID SEARCH TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_search_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "search_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const aiEngine = new AIEngine();
  await aiEngine.initialize();

  const vectors = new EmbeddingManager(aiEngine, db);
  await vectors.initialize();

  const searchEngine = new SearchEngine({
    databaseManager: db,
    embeddingManager: vectors,
  });

  try {
    // --------------------------------------------------------
    // Test 1: Query Processor & File-Type Extraction
    // --------------------------------------------------------
    console.log("▶ Test 1: Query Processor keyword and type extraction...");
    const q1 = QueryProcessor.process("Mere college ki cybersecurity wali PDFs do");
    assert.ok(q1.keywords.includes("college") && q1.keywords.includes("cybersecurity"));
    assert.deepStrictEqual(q1.filters.fileTypes, ["pdf"]);
    assert.ok(q1.semanticQuery.includes("college cybersecurity"));

    const q2 = QueryProcessor.process("birthday photos and videos");
    assert.ok(q2.filters.fileTypes.includes("image") && q2.filters.fileTypes.includes("video"));

    const q3 = QueryProcessor.process("machine learning notes");
    assert.strictEqual(q3.filters.fileTypes.length, 0, "No type filter if unspecified");
    console.log("  ✓ Passed: Query Processor accurately extracted keywords, semantic query, and file-type filters.");

    // --------------------------------------------------------
    // Test 2: Candidate Merging and Source Tracking
    // --------------------------------------------------------
    console.log("▶ Test 2: Candidate merging and source tracking...");
    const retrievedMock = {
      fts: [{ fileId: "doc_1", ftsScore: 10.5 }, { fileId: "doc_2", ftsScore: 5.0 }],
      vector: [{ fileId: "doc_2", semanticScore: 0.92 }, { fileId: "doc_3", semanticScore: 0.85 }],
      metadata: [{ fileId: "doc_1", metadataScore: 1.0 }, { fileId: "doc_4", metadataScore: 1.0 }],
    };

    const merged = CandidateMerger.merge(retrievedMock);
    assert.strictEqual(merged.length, 4, "Must deduplicate to 4 unique files (doc_1, doc_2, doc_3, doc_4)");

    const doc2 = merged.find((m) => m.fileId === "doc_2");
    assert.ok(doc2.sources.includes("fts") && doc2.sources.includes("vector"));
    assert.strictEqual(doc2.rawScores.semantic, 0.92);
    console.log("  ✓ Passed: Multi-index candidate sets merged without duplicates with source tags preserved.");

    // --------------------------------------------------------
    // Test 3: Score Normalization
    // --------------------------------------------------------
    console.log("▶ Test 3: Score Normalization to [0, 1] range...");
    const normalized = ScoreNormalizer.normalizeBatch(merged);
    for (const c of normalized) {
      assert.ok(c.normalizedScores.keyword >= 0 && c.normalizedScores.keyword <= 1.0);
      assert.ok(c.normalizedScores.semantic >= 0 && c.normalizedScores.semantic <= 1.0);
      assert.ok(c.normalizedScores.metadata >= 0 && c.normalizedScores.metadata <= 1.0);
    }
    console.log("  ✓ Passed: Disparate score distributions bounded safely into [0, 1].");

    // --------------------------------------------------------
    // Test 4: End-to-End Hybrid Search (FTS + Vector + Metadata)
    // --------------------------------------------------------
    console.log("▶ Test 4: End-to-End Hybrid Search with test corpus...");

    // Setup physical files
    const file1Path = path.join(testRoot, "Cybersecurity_Guide.pdf");
    const file2Path = path.join(testRoot, "Network_Security.txt");
    const file3Path = path.join(testRoot, "Birthday_Party.jpg");

    await fsp.writeFile(file1Path, "Penetration testing and ethical hacking methodologies.");
    await fsp.writeFile(file2Path, "Firewall rules and packet inspection policies.");
    await fsp.writeFile(file3Path, "binary image data");

    const rec1 = createFileRecord({
      file_id: "rec_cyber_pdf",
      name: "Cybersecurity_Guide.pdf",
      path: file1Path,
      extension: ".pdf",
      hash: "hash_pdf_1",
    });
    const rec2 = createFileRecord({
      file_id: "rec_net_txt",
      name: "Network_Security.txt",
      path: file2Path,
      extension: ".txt",
      hash: "hash_txt_2",
    });
    const rec3 = createFileRecord({
      file_id: "rec_bday_jpg",
      name: "Birthday_Party.jpg",
      path: file3Path,
      extension: ".jpg",
      hash: "hash_jpg_3",
    });

    db.files.insert(rec1);
    db.files.insert(rec2);
    db.files.insert(rec3);

    // Save searchable text and FTS
    db.content.upsert(rec1.file_id, { extracted_text: "Penetration testing ethical hacking", word_count: 4 });
    db.content.upsert(rec2.file_id, { extracted_text: "Firewall rules packet inspection", word_count: 4 });
    db.fts.updateSearchableContent(rec1.file_id, { name: rec1.name, path: rec1.path, text: "Penetration testing ethical hacking" });
    db.fts.updateSearchableContent(rec2.file_id, { name: rec2.name, path: rec2.path, text: "Firewall rules packet inspection" });

    // Save vectors
    await vectors.embedFile(rec1, { text: "Penetration testing ethical hacking cybersecurity" });
    await vectors.embedFile(rec2, { text: "Firewall rules packet inspection network security" });

    // Execute Hybrid Search: "cybersecurity"
    const searchRes = await searchEngine.search("cybersecurity");
    assert.ok(searchRes.results.length >= 1);
    assert.strictEqual(searchRes.results[0].fileId, "rec_cyber_pdf");
    assert.ok(searchRes.results[0].matchedBy.includes("keyword") || searchRes.results[0].matchedBy.includes("semantic"));
    console.log(`  ✓ Passed: Search returned '${searchRes.results[0].name}' (Score: ${searchRes.results[0].score}) in ${searchRes.tookMs}ms.`);

    // --------------------------------------------------------
    // Test 5: Hard File Type Filtering
    // --------------------------------------------------------
    console.log("▶ Test 5: Hard File-Type filtering (PDFs only)...");
    const pdfSearch = await searchEngine.search("cybersecurity pdf");
    assert.strictEqual(pdfSearch.results.length, 1);
    assert.strictEqual(pdfSearch.results[0].extension, ".pdf");
    console.log("  ✓ Passed: Filtered strictly to requested PDF extension, excluding TXT/JPG.");

    // --------------------------------------------------------
    // Test 6: Missing File on Disk Excluded
    // --------------------------------------------------------
    console.log("▶ Test 6: Missing filesystem file exclusion...");
    // Delete file 2 from disk
    await fsp.unlink(file2Path);

    const missingSearch = await searchEngine.search("network security");
    const foundDeleted = missingSearch.results.some((r) => r.fileId === "rec_net_txt");
    assert.strictEqual(foundDeleted, false, "Deleted file on disk must be excluded from search results");
    console.log("  ✓ Passed: FileResolver safely filtered out deleted disk file.");

    // --------------------------------------------------------
    // Test 7: Fallback when AI Model / Vector Search is Disabled
    // --------------------------------------------------------
    console.log("▶ Test 7: Fallback to FTS + Metadata when Vector Search is disabled...");
    const noVecSearchEngine = new SearchEngine({
      databaseManager: db,
      embeddingManager: null, // No vector store
    });

    const fallbackRes = await noVecSearchEngine.search("Cybersecurity", { useVector: false });
    assert.ok(fallbackRes.results.length >= 1);
    assert.strictEqual(fallbackRes.results[0].fileId, "rec_cyber_pdf");
    console.log("  ✓ Passed: FTS & Metadata search functioned seamlessly without vector store.");

    // --------------------------------------------------------
    // Test 8: Search Cancellation (AbortSignal)
    // --------------------------------------------------------
    console.log("▶ Test 8: Search cancellation with AbortSignal...");
    const abortCtrl = new AbortController();
    abortCtrl.abort();

    let abortedCaught = false;
    try {
      await searchEngine.search("cybersecurity", { signal: abortCtrl.signal });
    } catch (err) {
      if (err.code === SearchErrorCode.SEARCH_ABORTED) {
        abortedCaught = true;
      }
    }
    assert.strictEqual(abortedCaught, true, "Must cleanly abort search when signal triggers");
    console.log("  ✓ Passed: AbortSignal cancellation handled cleanly.");

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 9 HYBRID SEARCH TESTS PASSED (100% SUCCESS)");
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
