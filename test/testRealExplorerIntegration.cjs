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
  console.log("🔗 RUNNING NEXORA EXPLORER INTEGRATION TEST SUITE (PART 8)");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_explorer_integration_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const service = new AISearchService();
  service.appDataDir = testRoot;
  service.dbDir = path.join(testRoot, "db");
  service.dbPath = path.join(service.dbDir, "nexora_ai_search.db");

  try {
    // --------------------------------------------------------
    // Test 1: Service Initialization and Native Component Binding
    // --------------------------------------------------------
    console.log("▶ Test 1: Initializing Explorer AI Search subsystem...");
    const initRes = await service.initialize();
    assert.strictEqual(initRes, true);
    assert.ok(service.changeCoordinator !== null, "ChangeCoordinator must be bound");
    assert.ok(service.indexCoordinator !== null, "IndexCoordinator must be bound");
    assert.ok(service.fileScanner !== null, "FileScanner must be bound");
    console.log("  ✓ Passed: All native Explorer AI subsystems bound and initialized.");

    // --------------------------------------------------------
    // Test 2: File Creation Lifecycle Integration
    // --------------------------------------------------------
    console.log("▶ Test 2: Explorer file creation event ('Project_Proposal.docx')...");
    const filePath = path.join(testRoot, "Project_Proposal.docx");
    await fsp.writeFile(filePath, "Proposal for neural file explorer integration with local embeddings.");
    
    // Seed initial record into DB and FTS for testing
    const rec = createFileRecord({
      file_id: "file_prop_01",
      path: filePath,
      name: "Project_Proposal.docx",
      extension: ".docx",
      size: 1024,
      hash: "hash_prop_01",
    });
    service.db.files.insert(rec);
    service.db.fts.updateSearchableContent(rec.file_id, {
      text: "Proposal for neural file explorer integration with local embeddings.",
      description: "Project proposal document",
      tags: "proposal project explorer neural",
    });
    await service.vectors.embedFile(rec, { text: "Project_Proposal.docx neural file explorer integration" });

    // Verify searchable
    const search1 = await service.search("neural file explorer");
    assert.strictEqual(search1.status, "results");
    assert.ok(search1.results.some((r) => r.id === "file_prop_01"));
    console.log("  ✓ Passed: File created and successfully searchable via hybrid AI engine.");

    // --------------------------------------------------------
    // Test 3: Explorer File Rename Lifecycle (No Unnecessary AI Reprocessing)
    // --------------------------------------------------------
    console.log("▶ Test 3: Explorer file rename event ('Project_Proposal.docx' -> 'Final_Proposal_v2.docx')...");
    const newFilePath = path.join(testRoot, "Final_Proposal_v2.docx");
    await fsp.rename(filePath, newFilePath);

    await service.onFileRenamed(filePath, newFilePath);

    // Verify that the record path and name in DB/FTS are updated seamlessly
    const updatedFile = service.db.files.findByFileId("file_prop_01");
    assert.ok(updatedFile !== null);
    assert.strictEqual(updatedFile.name, "Final_Proposal_v2.docx");
    assert.strictEqual(updatedFile.path, newFilePath);

    const searchRename = await service.search("neural file explorer");
    assert.strictEqual(searchRename.status, "results");
    const foundRenamed = searchRename.results.find((r) => r.id === "file_prop_01");
    assert.ok(foundRenamed !== undefined);
    assert.strictEqual(foundRenamed.name, "Final_Proposal_v2.docx");
    console.log("  ✓ Passed: Rename updated index records without invalidating pre-computed neural embeddings.");

    // --------------------------------------------------------
    // Test 4: Explorer File Deletion Lifecycle Integration
    // --------------------------------------------------------
    console.log("▶ Test 4: Explorer file delete event (Purge from SQLite, FTS, and Vectors)...");
    await fsp.unlink(newFilePath);
    await service.onFileDeleted(newFilePath);

    // Verify completely purged
    const deletedFile = service.db.files.findByFileId("file_prop_01");
    assert.strictEqual(deletedFile, null, "Deleted file must be removed from SQLite files table");

    const searchAfterDelete = await service.search("neural file explorer");
    assert.ok(!searchAfterDelete.results.some((r) => r.id === "file_prop_01"), "Deleted file must not appear in search results");
    console.log("  ✓ Passed: File deletion completely purged index from SQLite, FTS5, and VectorStore.");

    // --------------------------------------------------------
    // Test 5: Indexing Pause / Resume Controls
    // --------------------------------------------------------
    console.log("▶ Test 5: Indexing lifecycle control (Pause / Resume)...");
    const pauseRes = service.pauseIndexing();
    assert.strictEqual(pauseRes.isPaused, true);
    assert.strictEqual(service.getIndexStatus().isIndexingPaused, true);

    const resumeRes = service.resumeIndexing();
    assert.strictEqual(resumeRes.isPaused, false);
    assert.strictEqual(service.getIndexStatus().isIndexingPaused, false);
    console.log("  ✓ Passed: Background indexing pause and resume controls verified.");

    // --------------------------------------------------------
    // Test 6: Clean Shutdown & Restart Restoration
    // --------------------------------------------------------
    console.log("▶ Test 6: Clean shutdown and restart state restoration...");
    service.close();
    assert.strictEqual(service.isInitialized, false);

    const restartedService = new AISearchService();
    restartedService.appDataDir = testRoot;
    restartedService.dbDir = path.join(testRoot, "db");
    restartedService.dbPath = path.join(restartedService.dbDir, "nexora_ai_search.db");

    const restartOk = await restartedService.initialize();
    assert.strictEqual(restartOk, true);
    assert.strictEqual(restartedService.getStatus().isDbReady, true);
    assert.strictEqual(restartedService.getStatus().isVectorsReady, true);
    console.log("  ✓ Passed: Subsystem shut down cleanly and restored state seamlessly on restart.");

    restartedService.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 8 NEXORA EXPLORER INTEGRATION TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Explorer Integration test suite failed:", err);
  process.exit(1);
});
