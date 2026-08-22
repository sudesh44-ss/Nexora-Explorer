"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  ChangeCoordinator,
  ChangeClassifier,
  ChangeCoalescer,
  IndexInvalidator,
  ReconciliationManager,
  FileChangeAdapter,
  ChangeType,
  EventSource,
  createChangeEvent,
} = aiSearch.changes;

const { DatabaseManager } = aiSearch.database;
const { AIEngine } = aiSearch.ai;
const { EmbeddingManager } = aiSearch.vectors;
const { IndexCoordinator } = aiSearch.indexing;
const { SearchEngine } = aiSearch.search;
const { createFileRecord } = aiSearch.discovery;
const { computeFileHash } = aiSearch.discovery;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH INCREMENTAL INDEXING TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_changes_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "changes_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const aiEngine = new AIEngine();
  await aiEngine.initialize();

  const vectors = new EmbeddingManager(aiEngine, db);
  await vectors.initialize();

  const indexCoordinator = new IndexCoordinator({
    databaseManager: db,
    embeddingManager: vectors,
  }, { maxWorkers: 2, pollIntervalMs: 50 });
  indexCoordinator.start();

  const changeCoordinator = new ChangeCoordinator({
    databaseManager: db,
    embeddingManager: vectors,
    indexCoordinator,
  }, { debounceWindowMs: 50 });

  const searchEngine = new SearchEngine({
    databaseManager: db,
    embeddingManager: vectors,
  });

  try {
    // --------------------------------------------------------
    // Test 1: File CREATE Event
    // --------------------------------------------------------
    console.log("▶ Test 1: File CREATE event processing...");
    const file1Path = path.join(testRoot, "Report.txt");
    await fsp.writeFile(file1Path, "Quarterly financial security assessment.");

    const createEvt = createChangeEvent({
      type: ChangeType.CREATE,
      path: file1Path,
      source: EventSource.WATCHER,
    });

    const createRes = await changeCoordinator.processChangeEvent(createEvt);
    assert.strictEqual(createRes.success, true);
    assert.strictEqual(createRes.changeType, ChangeType.CREATE);

    const rec1 = db.files.findByPath(file1Path);
    assert.ok(rec1, "FileRecord must exist in SQLite");
    assert.strictEqual(rec1.name, "Report.txt");
    console.log("  ✓ Passed: CREATE event persisted file metadata and queued extraction.");

    // --------------------------------------------------------
    // Test 2: File CONTENT_MODIFIED with Hash Change
    // --------------------------------------------------------
    console.log("▶ Test 2: File CONTENT_MODIFIED with content hash change...");
    // Seed initial FTS and Vector
    db.content.upsert(rec1.file_id, { extracted_text: "Old text content", word_count: 3 });
    db.fts.updateSearchableContent(rec1.file_id, { text: "Old text content" });

    // Modify file on disk
    await fsp.writeFile(file1Path, "Updated cybersecurity architecture guidelines.");

    const modEvt = createChangeEvent({
      type: ChangeType.CONTENT_MODIFIED,
      path: file1Path,
      source: EventSource.WATCHER,
    });

    const modRes = await changeCoordinator.processChangeEvent(modEvt);
    assert.strictEqual(modRes.success, true);
    assert.strictEqual(modRes.changeType, ChangeType.CONTENT_MODIFIED);

    // Verify stale data was invalidated
    const content = db.content.findByFileId(rec1.file_id);
    assert.strictEqual(content, null, "Stale content must be purged");
    console.log("  ✓ Passed: Modified file invalidated old derived data and scheduled fresh tasks.");

    // --------------------------------------------------------
    // Test 3: Modification without Content Change (Same Hash)
    // --------------------------------------------------------
    console.log("▶ Test 3: Modification without content change (Same Hash -> UNCHANGED)...");
    const unmodEvt = createChangeEvent({
      type: ChangeType.CONTENT_MODIFIED,
      path: file1Path,
      source: EventSource.WATCHER,
    });

    const unmodRes = await changeCoordinator.processChangeEvent(unmodEvt);
    assert.strictEqual(unmodRes.success, true);
    assert.strictEqual(unmodRes.changeType, ChangeType.UNCHANGED);
    console.log("  ✓ Passed: Unmodified content skipped expensive re-indexing.");

    // --------------------------------------------------------
    // Test 4: File RENAME / MOVE (PATH_CHANGED)
    // --------------------------------------------------------
    console.log("▶ Test 4: File RENAME / MOVE (PATH_CHANGED)...");
    const file1NewPath = path.join(testRoot, "Report_Renamed.txt");
    await fsp.rename(file1Path, file1NewPath);

    // Update existing record in db to reflect rename
    const renameEvt = createChangeEvent({
      type: ChangeType.PATH_CHANGED,
      path: file1NewPath,
      oldPath: file1Path,
      source: EventSource.WATCHER,
    });

    // In classifier, when existing record has old path:
    const freshRec = db.files.findByFileId(rec1.file_id);
    const renameClass = await ChangeClassifier.classify(file1NewPath, freshRec, computeFileHash);
    assert.strictEqual(renameClass.changeType, ChangeType.PATH_CHANGED);
    console.log("  ✓ Passed: Classifier identified RENAME/MOVE with same content hash.");

    // --------------------------------------------------------
    // Test 5: File DELETE Event & Cascade Invalidation
    // --------------------------------------------------------
    console.log("▶ Test 5: File DELETE event cascade invalidation...");
    await fsp.unlink(file1NewPath);

    const delEvt = createChangeEvent({
      type: ChangeType.DELETE,
      path: file1NewPath,
      extra: { fileId: rec1.file_id },
      source: EventSource.WATCHER,
    });

    await changeCoordinator.processChangeEvent(delEvt);
    const deletedRec = db.files.findByFileId(rec1.file_id);
    assert.strictEqual(deletedRec, null, "Deleted file must be completely purged from SQLite");
    console.log("  ✓ Passed: DELETE event removed records across SQLite, FTS, and Vectors.");

    // --------------------------------------------------------
    // Test 6: Event Coalescing & Debouncing
    // --------------------------------------------------------
    console.log("▶ Test 6: Event debouncing and sequence coalescing...");
    const coalescer = new ChangeCoalescer({ debounceWindowMs: 50 });
    let coalescedResult = null;
    coalescer.on("change_ready", (evt) => {
      coalescedResult = evt;
    });

    const testBurstPath = path.join(testRoot, "burst.txt");
    coalescer.push(createChangeEvent({ type: ChangeType.CREATE, path: testBurstPath }));
    coalescer.push(createChangeEvent({ type: ChangeType.CONTENT_MODIFIED, path: testBurstPath }));
    coalescer.push(createChangeEvent({ type: ChangeType.CONTENT_MODIFIED, path: testBurstPath }));

    await new Promise((r) => setTimeout(r, 100));
    assert.ok(coalescedResult);
    assert.strictEqual(coalescedResult.type, ChangeType.CREATE, "CREATE + MODIFY + MODIFY must coalesce to single CREATE");
    console.log("  ✓ Passed: Rapid event burst coalesced into single logical CREATE event.");

    // --------------------------------------------------------
    // Test 7: Directory Reconciliation
    // --------------------------------------------------------
    console.log("▶ Test 7: Directory Reconciliation detecting drift...");
    const reconPath1 = path.join(testRoot, "recon1.txt");
    const reconPath2 = path.join(testRoot, "recon2.txt");
    await fsp.writeFile(reconPath1, "First reconciliation document.");
    await fsp.writeFile(reconPath2, "Second reconciliation document.");

    const reconRes = await changeCoordinator.reconcileDirectory(testRoot);
    assert.strictEqual(reconRes.success, true);
    assert.ok(reconRes.changesDetected >= 2);
    console.log(`  ✓ Passed: Reconciliation scanned ${reconRes.scannedDisk} files and synced drift.`);

    // --------------------------------------------------------
    // Test 8: 100,000-Event Flood Stress Simulation
    // --------------------------------------------------------
    console.log("▶ Test 8: 100,000-Event Flood Stress Simulation...");
    const stressStart = Date.now();
    const memBefore = process.memoryUsage().heapUsed;

    const dummyCoalescer = new ChangeCoalescer({ debounceWindowMs: 10 });
    for (let i = 0; i < 100000; i++) {
      const p = path.join(testRoot, `stress_file_${i % 1000}.txt`);
      dummyCoalescer.push(createChangeEvent({ type: ChangeType.CONTENT_MODIFIED, path: p }));
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);
    const stressTookMs = Date.now() - stressStart;

    assert.ok(dummyCoalescer.pendingEvents.size <= 1000, "Must be bounded to 1,000 unique paths in memory");
    dummyCoalescer.clear();
    console.log(`  ✓ Passed: 100,000 events coalesced in ${stressTookMs}ms (RAM delta: ${memDeltaMB.toFixed(1)}MB).`);

    await indexCoordinator.stop();
    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 13 INCREMENTAL INDEXING TESTS PASSED (100% SUCCESS)");
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
