"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const { DatabaseManager } = aiSearch.database;
const { IndexManager, IndexOperation, IndexComparator, SessionStatus } = aiSearch.indexer;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH INDEXING ENGINE TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_indexer_${Date.now()}`);
  const dbPath = path.join(testRoot, "test_indexer.db");
  const dataDir = path.join(testRoot, "files");
  await fsp.mkdir(dataDir, { recursive: true });

  let dbManager = null;
  let indexManager = null;

  try {
    // --------------------------------------------------------
    // Test 1: Initialization of Index Manager
    // --------------------------------------------------------
    console.log("▶ Test 1: Index Manager initialization...");
    dbManager = new DatabaseManager({
      databaseDir: testRoot,
      databasePath: dbPath,
    });

    indexManager = new IndexManager(dbManager, { batchSize: 50 });
    const initRes = await indexManager.initialize();
    assert.strictEqual(initRes.success, true, "IndexManager should initialize successfully");
    console.log("  ✓ Passed: IndexManager initialized with SQLite connection.");

    // --------------------------------------------------------
    // Test 2: Initial Indexing Run (First Scan)
    // --------------------------------------------------------
    console.log("▶ Test 2: Initial Indexing Run across test directory...");
    const sub1 = path.join(dataDir, "sub1");
    await fsp.mkdir(sub1, { recursive: true });
    await fsp.writeFile(path.join(dataDir, "Physics_Notes.pdf"), "%PDF Physics formulas");
    await fsp.writeFile(path.join(dataDir, "Math_Algebra.docx"), "Algebra equations");
    await fsp.writeFile(path.join(sub1, "Chemistry_Lab.txt"), "Titration experiment");

    let progressEvents = 0;
    indexManager.on("progress", () => { progressEvents++; });

    const session1 = await indexManager.start({ locations: [dataDir] });
    assert.strictEqual(session1.status, SessionStatus.COMPLETED, "Session 1 must complete successfully");
    assert.strictEqual(session1.filesDiscovered, 3, "Discovered 3 files");
    assert.strictEqual(session1.filesProcessed, 3, "Processed 3 files into SQLite");
    assert.strictEqual(session1.filesSkipped, 0, "0 files skipped on first scan");

    // Verify in database
    const totalInDb = dbManager.files.count();
    assert.strictEqual(totalInDb, 3, "3 records must exist in SQLite database");
    const ftsResults = dbManager.fts.search("Physics");
    assert.strictEqual(ftsResults.length, 1, "FTS5 search finds Physics_Notes.pdf");
    console.log("  ✓ Passed: First indexing scan persisted 3 records and indexed in FTS5.");

    // --------------------------------------------------------
    // Test 3: Idempotent Second Scan (Unchanged Files Skipped)
    // --------------------------------------------------------
    console.log("▶ Test 3: Idempotent second scan (unchanged files skipped)...");
    const session2 = await indexManager.start({ locations: [dataDir] });
    assert.strictEqual(session2.status, SessionStatus.COMPLETED, "Session 2 must complete");
    assert.strictEqual(session2.filesDiscovered, 3, "Discovered 3 files");
    assert.strictEqual(session2.filesProcessed, 0, "0 files processed (no redundant writes)");
    assert.strictEqual(session2.filesSkipped, 3, "All 3 unchanged files skipped");
    assert.strictEqual(dbManager.files.count(), 3, "Database count remains unchanged at 3");
    console.log("  ✓ Passed: Idempotency verified, skipped 3 unchanged files.");

    // --------------------------------------------------------
    // Test 4: New File Added + Modified File
    // --------------------------------------------------------
    console.log("▶ Test 4: Handling new file addition and modified file update...");
    // 1. Add new file
    await fsp.writeFile(path.join(dataDir, "Biology_Genetics.pdf"), "DNA notes");
    // 2. Modify existing file
    await fsp.writeFile(path.join(dataDir, "Physics_Notes.pdf"), "%PDF Modified Physics formulas with Quantum");

    const session3 = await indexManager.start({ locations: [dataDir] });
    assert.strictEqual(session3.filesDiscovered, 4, "Discovered 4 files");
    assert.strictEqual(session3.filesProcessed, 2, "Processed 2 files (1 new + 1 modified)");
    assert.strictEqual(session3.filesSkipped, 2, "Skipped 2 untouched files");
    assert.strictEqual(dbManager.files.count(), 4, "Database count increased to 4");
    console.log("  ✓ Passed: 1 new + 1 modified file indexed, 2 unchanged skipped.");

    // --------------------------------------------------------
    // Test 5: Missing File Safe Reconciliation
    // --------------------------------------------------------
    console.log("▶ Test 5: Missing file reconciliation (deleted file on disk)...");
    // Delete Chemistry_Lab.txt from disk
    await fsp.unlink(path.join(sub1, "Chemistry_Lab.txt"));

    const session4 = await indexManager.start({ locations: [dataDir] });
    assert.strictEqual(session4.filesDiscovered, 3, "Discovered 3 remaining files");
    
    // Check Chemistry_Lab.txt in DB -> should be marked 'unavailable'
    const deletedDbFile = dbManager.files.findByPath(path.join(sub1, "Chemistry_Lab.txt"));
    assert.ok(deletedDbFile, "Record still exists in DB for history");
    assert.strictEqual(deletedDbFile.status, "unavailable", "Deleted file marked as unavailable");
    console.log("  ✓ Passed: Missing file marked unavailable safely.");

    // --------------------------------------------------------
    // Test 6: Inaccessible / Error Folder Protection (No False Deletions)
    // --------------------------------------------------------
    console.log("▶ Test 6: Partial scan error protection (no false mass-deletions)...");
    const fakeMissingDir = path.join(testRoot, "protected_missing_dir");
    const session5 = await indexManager.start({ locations: [fakeMissingDir, dataDir] });
    assert.ok(session5.errorsCount >= 1, "Recorded error for missing directory");
    
    // Existing files in dataDir must NOT be falsely marked missing
    const bioFile = dbManager.files.findByPath(path.join(dataDir, "Biology_Genetics.pdf"));
    assert.strictEqual(bioFile.status, "indexed", "Existing valid files remain indexed");
    console.log("  ✓ Passed: Partial scan errors did not cause false deletions.");

    // --------------------------------------------------------
    // Test 7: Index Comparator Verification
    // --------------------------------------------------------
    console.log("▶ Test 7: Unit testing IndexComparator logic...");
    const sampleRecord = {
      file_id: "test_comp_1",
      path: "D:\\test.txt",
      size: 100,
      modified_at: "2026-08-21T00:00:00.000Z",
      hash: "hash_abc",
      status: "indexed",
    };

    // Unchanged
    const cmp1 = IndexComparator.compare(sampleRecord, sampleRecord);
    assert.strictEqual(cmp1.operation, IndexOperation.UNCHANGED);

    // Size changed
    const cmp2 = IndexComparator.compare({ ...sampleRecord, size: 200 }, sampleRecord);
    assert.strictEqual(cmp2.operation, IndexOperation.UPDATE);

    // New file (null existing)
    const cmp3 = IndexComparator.compare(sampleRecord, null);
    assert.strictEqual(cmp3.operation, IndexOperation.NEW);
    console.log("  ✓ Passed: IndexComparator logic validated.");

    // --------------------------------------------------------
    // Test 8: End-to-End Batch Benchmark (1,000 Files)
    // --------------------------------------------------------
    console.log("▶ Test 8: End-to-end 1,000 files discovery, queueing & indexing benchmark...");
    const benchDir = path.join(testRoot, "bench_files");
    await fsp.mkdir(benchDir, { recursive: true });

    for (let f = 0; f < 10; f++) {
      const folder = path.join(benchDir, `batch_${f}`);
      await fsp.mkdir(folder, { recursive: true });
      for (let i = 0; i < 100; i++) {
        await fsp.writeFile(path.join(folder, `doc_${i}.txt`), `Sample document text ${i} in batch ${f}`);
      }
    }

    const tStart = Date.now();
    const benchSession = await indexManager.start({ locations: [benchDir] });
    const duration = Date.now() - tStart;

    assert.strictEqual(benchSession.filesDiscovered, 1000, "1,000 files discovered");
    assert.strictEqual(benchSession.filesProcessed, 1000, "1,000 files processed");
    console.log(`  ✓ Passed: 1,000 files discovered, queued, and indexed in ${duration}ms (${Math.round(1000 / (duration / 1000))} files/sec).`);

    // Verify FTS5 in 1,000 items
    const benchFts = dbManager.fts.search("doc_99");
    assert.ok(benchFts.length >= 1, "FTS5 finds item in 1,000 indexed records");

    console.log("\n=================================================");
    console.log("🎉 ALL PART 4 INDEXING ENGINE TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    if (indexManager) await indexManager.shutdown();
    if (dbManager) dbManager.close();
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
