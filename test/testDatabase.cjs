"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const { DatabaseManager } = aiSearch.database;
const { FileScanner, createFileRecord } = aiSearch.discovery;
const { ScannerDatabaseAdapter } = aiSearch.database;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH SQLITE + FTS5 TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_db_${Date.now()}`);
  const dbPath = path.join(testRoot, "test_nexora_ai_search.db");
  await fsp.mkdir(testRoot, { recursive: true });

  let dbManager = null;

  try {
    // --------------------------------------------------------
    // Test 1: Initialization & Schema Migration
    // --------------------------------------------------------
    console.log("▶ Test 1: Database initialization & migration...");
    dbManager = new DatabaseManager({
      databaseDir: testRoot,
      databasePath: dbPath,
    });

    const initRes = await dbManager.initialize();
    assert.strictEqual(initRes.success, true, "Database should initialize successfully");
    assert.strictEqual(initRes.schemaVersion, 1, "Schema version should be 1");
    assert.strictEqual(initRes.ftsAvailable, true, "FTS5 must be available");
    console.log("  ✓ Passed: Initialized with Schema v1 and FTS5 active.");

    // --------------------------------------------------------
    // Test 2: Health Check & Integrity Check
    // --------------------------------------------------------
    console.log("▶ Test 2: Database health check & PRAGMA integrity_check...");
    const health = dbManager.healthCheck();
    assert.strictEqual(health.healthy, true, "Health check should pass");
    assert.strictEqual(health.missingTables.length, 0, "No required tables should be missing");

    const integrity = dbManager.integrityCheck();
    assert.strictEqual(integrity.ok, true, "Integrity check should return ok");
    console.log("  ✓ Passed: Health and integrity checks passed 100%.");

    // --------------------------------------------------------
    // Test 3: Insert & Query by ID / Path / Hash
    // --------------------------------------------------------
    console.log("▶ Test 3: FileRecord insertion & query lookups...");
    const rec1 = createFileRecord({
      file_id: "file_id_001_abc",
      name: "Cybersecurity_Basics.pdf",
      path: "D:\\Study\\Cybersecurity_Basics.pdf",
      extension: ".pdf",
      size: 1024000,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      hash: "hash_cyber_001",
      mime_type: "application/pdf",
      status: "discovered",
    });

    dbManager.files.insert(rec1);
    const foundById = dbManager.files.findByFileId("file_id_001_abc");
    assert.ok(foundById, "Record must be found by file_id");
    assert.strictEqual(foundById.name, "Cybersecurity_Basics.pdf");
    assert.strictEqual(foundById.extension, ".pdf");

    const foundByPath = dbManager.files.findByPath("D:\\Study\\Cybersecurity_Basics.pdf");
    assert.ok(foundByPath, "Record must be found by path");

    const foundByHash = dbManager.files.findByHash("hash_cyber_001");
    assert.strictEqual(foundByHash.length, 1, "Must find 1 record by hash");
    console.log("  ✓ Passed: Insert and lookup queries verified.");

    // --------------------------------------------------------
    // Test 4: Idempotent Upsert & Duplicate Prevention
    // --------------------------------------------------------
    console.log("▶ Test 4: Upsert idempotency & duplicate prevention...");
    const updatedRec1 = {
      ...rec1,
      size: 2048000, // Modified size
      status: "pending",
    };

    dbManager.files.upsert(updatedRec1);
    const countAfterUpsert = dbManager.files.count();
    assert.strictEqual(countAfterUpsert, 1, "Upserting existing path must NOT create duplicate row");

    const refreshed = dbManager.files.findByFileId("file_id_001_abc");
    assert.strictEqual(refreshed.size, 2048000, "Size should be updated");
    assert.strictEqual(refreshed.status, "pending", "Status should be updated to pending");
    console.log("  ✓ Passed: Upsert updated in-place without duplicate rows.");

    // --------------------------------------------------------
    // Test 5: FTS5 Search & Keyword Matching
    // --------------------------------------------------------
    console.log("▶ Test 5: FTS5 search & query ranking...");
    const rec2 = createFileRecord({
      file_id: "file_id_002_def",
      name: "Network_Security_Notes.docx",
      path: "D:\\Study\\Network_Security_Notes.docx",
      extension: ".docx",
      size: 512000,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      hash: "hash_net_002",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "discovered",
    });

    const rec3 = createFileRecord({
      file_id: "file_id_003_ghi",
      name: "Vacation_Photo.jpg",
      path: "D:\\Photos\\Vacation_Photo.jpg",
      extension: ".jpg",
      size: 3500000,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      hash: "hash_photo_003",
      mime_type: "image/jpeg",
      status: "discovered",
    });

    dbManager.files.insert(rec2);
    dbManager.files.insert(rec3);

    // Search for "Cybersecurity"
    const cyberResults = dbManager.fts.search("Cybersecurity");
    assert.strictEqual(cyberResults.length, 1, "Should find 1 match for Cybersecurity");
    assert.strictEqual(cyberResults[0].file_id, "file_id_001_abc");

    // Search for "Security" (should match both Cybersecurity and Network_Security_Notes)
    const secResults = dbManager.fts.search("Security");
    assert.strictEqual(secResults.length, 2, "Should find 2 matches for Security");

    // Search for "Photo"
    const photoResults = dbManager.fts.search("Photo");
    assert.strictEqual(photoResults.length, 1, "Should find 1 match for Photo");
    assert.strictEqual(photoResults[0].file_id, "file_id_003_ghi");

    // Search for non-existing query
    const noResults = dbManager.fts.search("QuantumComputing");
    assert.strictEqual(noResults.length, 0, "Non-existent term should return 0 results");
    console.log("  ✓ Passed: FTS5 multi-keyword queries and triggers working accurately.");

    // --------------------------------------------------------
    // Test 6: Transaction Atomicity & Rollback
    // --------------------------------------------------------
    console.log("▶ Test 6: Transaction atomicity and rollback verification...");
    const initialCount = dbManager.files.count();

    try {
      dbManager.tx.run(() => {
        dbManager.files.insert(createFileRecord({
          file_id: "tx_file_1",
          name: "Tx1.txt",
          path: "D:\\tx1.txt",
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        }));

        // Trigger deliberate error
        throw new Error("Simulated failure inside transaction");
      });
    } catch (e) {
      // Expected failure
    }

    const countAfterRollback = dbManager.files.count();
    assert.strictEqual(countAfterRollback, initialCount, "Rolled back transaction must not persist inserted file");
    console.log("  ✓ Passed: Atomic rollback verified.");

    // --------------------------------------------------------
    // Test 7: Cascade Deletion & FTS Synchronization
    // --------------------------------------------------------
    console.log("▶ Test 7: Cascade deletion and FTS cleanup...");
    // Add content and AI info
    dbManager.content.upsert("file_id_003_ghi", { extracted_text: "Sample OCR text", summary: "Vacation snapshot" });
    dbManager.ai.upsert("file_id_003_ghi", { description: "Beach photo", tags: ["beach", "vacation"] });

    assert.ok(dbManager.content.findByFileId("file_id_003_ghi"), "Content record should exist");
    assert.ok(dbManager.ai.findByFileId("file_id_003_ghi"), "AI record should exist");

    // Delete file
    dbManager.files.deleteByFileId("file_id_003_ghi");
    assert.strictEqual(dbManager.files.findByFileId("file_id_003_ghi"), null, "File must be deleted");
    assert.strictEqual(dbManager.content.findByFileId("file_id_003_ghi"), null, "Content cascade deleted");
    assert.strictEqual(dbManager.ai.findByFileId("file_id_003_ghi"), null, "AI cascade deleted");

    // Verify FTS table cleaned up
    const ftsDeletedSearch = dbManager.fts.search("Vacation_Photo");
    assert.strictEqual(ftsDeletedSearch.length, 0, "FTS record must be removed via trigger");
    console.log("  ✓ Passed: Deletion and cascade cleanups verified.");

    // --------------------------------------------------------
    // Test 8: Persistence Across Close and Reopen
    // --------------------------------------------------------
    console.log("▶ Test 8: Database persistence across reopen...");
    dbManager.close();

    const reopenedDb = new DatabaseManager({
      databaseDir: testRoot,
      databasePath: dbPath,
    });
    await reopenedDb.initialize();

    const reopenedCount = reopenedDb.files.count();
    assert.strictEqual(reopenedCount, 2, "Database must retain 2 persisted records after reopen");
    const ftsReopenedSearch = reopenedDb.fts.search("Cybersecurity");
    assert.strictEqual(ftsReopenedSearch.length, 1, "FTS5 search works immediately after reopen");
    console.log("  ✓ Passed: Data perfectly preserved across database restarts.");

    // --------------------------------------------------------
    // Test 9: End-to-End Scanner → Database Adapter Pipeline
    // --------------------------------------------------------
    console.log("▶ Test 9: End-to-end Scanner → Database Adapter pipeline...");
    const scanDir = path.join(testRoot, "scan_e2e_source");
    await fsp.mkdir(scanDir, { recursive: true });
    await fsp.writeFile(path.join(scanDir, "Biology_Report.pdf"), "Photosynthesis notes");
    await fsp.writeFile(path.join(scanDir, "Chemistry_Lab.docx"), "Titration formula");
    await fsp.writeFile(path.join(scanDir, "Physics_Exam.txt"), "Thermodynamics laws");

    const e2eScanner = new FileScanner({ locations: [scanDir] });
    const adapter = new ScannerDatabaseAdapter(reopenedDb.files, { batchSize: 50 });
    adapter.attachScanner(e2eScanner);

    const scanResult = await e2eScanner.scan();
    assert.strictEqual(scanResult.files.length, 3, "Scanner discovered 3 files");

    // Verify ingested into SQLite
    const bioFile = reopenedDb.files.findByPath(path.join(scanDir, "Biology_Report.pdf"));
    assert.ok(bioFile, "Biology_Report.pdf must be in SQLite database");
    assert.strictEqual(bioFile.mime_type, "application/pdf");

    // Search via FTS5
    const bioSearch = reopenedDb.fts.search("Biology");
    assert.strictEqual(bioSearch.length, 1, "FTS5 finds newly scanned Biology file");
    console.log("  ✓ Passed: End-to-end Scanner -> Adapter -> SQLite -> FTS5 verified.");

    // --------------------------------------------------------
    // Test 10: Performance Benchmark (1,000 Batch Inserts)
    // --------------------------------------------------------
    console.log("▶ Test 10: Batch ingestion performance benchmark (1,000 records)...");
    const bulkRecords = [];
    for (let i = 0; i < 1000; i++) {
      bulkRecords.push(createFileRecord({
        file_id: `bench_file_${i}`,
        name: `Benchmark_Document_${i}.pdf`,
        path: `D:\\Benchmark\\Folder_${Math.floor(i / 50)}\\Benchmark_Document_${i}.pdf`,
        extension: ".pdf",
        size: 1024 * (i + 1),
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        hash: `bench_hash_${i}`,
        mime_type: "application/pdf",
        status: "discovered",
      }));
    }

    const t0 = Date.now();
    const batchRes = reopenedDb.files.upsertBatch(bulkRecords);
    const duration = Date.now() - t0;

    assert.strictEqual(batchRes.count, 1000, "Should ingest 1,000 records");
    console.log(`  ✓ Passed: 1,000 records batch upserted & FTS indexed in ${duration}ms (${Math.round(1000 / (duration / 1000))} records/sec).`);

    // Verify search in 1000 items
    const benchSearch = reopenedDb.fts.search("Benchmark_Document_777");
    assert.strictEqual(benchSearch.length, 1, "FTS5 instant lookup among 1,000 items");

    reopenedDb.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 3 DATABASE & FTS5 TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
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
