"use strict";

const assert = require("assert");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");

const { AISearchService } = require("../electron/services/ai/aiSearchService.cjs");

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING REAL AI MODEL SELECTOR & SETTINGS (AUDIT & VERIFICATION)");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_settings_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const service = new AISearchService();
  service.appDataDir = testRoot;
  service.dbDir = path.join(testRoot, "db");
  service.dbPath = path.join(service.dbDir, "nexora_ai_search.db");

  try {
    // --------------------------------------------------------
    // Test 1: Service Initialization & Model Listing
    // --------------------------------------------------------
    console.log("▶ Test 1: Initializing service and fetching real registered models...");
    await service.initialize();

    const allModels = service.getAllModels();
    assert.ok(allModels.length >= 4, "Must return registered models");
    console.log(`  ✓ Passed: Found ${allModels.length} registered models in ModelRegistry.`);
    for (const m of allModels) {
      console.log(`    - [${m.id}] ${m.name} (${m.sizeFormatted}, ${m.type})`);
    }

    // --------------------------------------------------------
    // Test 2: Active Models Query
    // --------------------------------------------------------
    console.log("\n▶ Test 2: Querying active models...");
    const active = service.getActiveModels();
    assert.ok(active.embedding !== null, "Active embedding model must exist");
    assert.ok(active.vision !== null, "Active vision model must exist");
    assert.ok(active.audio !== null, "Active audio model must exist");
    console.log(`  ✓ Passed: Active Embedding: ${active.embedding.name} (${active.embedding.id})`);
    console.log(`  ✓ Passed: Active Vision:    ${active.vision.name} (${active.vision.id})`);
    console.log(`  ✓ Passed: Active Audio:     ${active.audio.name} (${active.audio.id})`);

    // --------------------------------------------------------
    // Test 3: Real Model Switching & Persistence
    // --------------------------------------------------------
    console.log("\n▶ Test 3: Switching active embedding model to 'all-minilm-l6-v2'...");
    const switchRes = service.setActiveModel("embedding", "all-minilm-l6-v2");
    assert.strictEqual(switchRes.success, true);
    assert.strictEqual(switchRes.activeModels.embedding.id, "all-minilm-l6-v2");

    // Verify settings file persistence on disk
    const settingsFile = path.join(testRoot, "ai_settings.json");
    assert.ok(fs.existsSync(settingsFile), "ai_settings.json must be persisted on disk");
    const persisted = JSON.parse(await fsp.readFile(settingsFile, "utf-8"));
    assert.strictEqual(persisted.embeddingModel, "all-minilm-l6-v2");
    console.log("  ✓ Passed: Model switched and persisted to disk config.");

    // --------------------------------------------------------
    // Test 4: Storage Info Metrics
    // --------------------------------------------------------
    console.log("\n▶ Test 4: Querying real storage metrics...");
    const storage = service.getStorageInfo();
    assert.ok(storage.databasePath.includes("nexora_ai_search.db"));
    assert.ok(storage.databaseSizeBytes >= 0);
    assert.ok(storage.cacheSizeBytes >= 0);
    console.log(`  ✓ Passed: DB Size: ${storage.databaseSizeFormatted}, Cache Size: ${storage.cacheSizeFormatted}`);

    // --------------------------------------------------------
    // Test 5: Database Integrity Check & Optimization
    // --------------------------------------------------------
    console.log("\n▶ Test 5: Testing database integrity check & optimization...");
    const integrity = service.checkIntegrity();
    assert.strictEqual(integrity.success, true);
    assert.strictEqual(integrity.healthy, true);
    console.log("  ✓ Passed: Database integrity verified healthy (PRAGMA integrity_check).");

    const optRes = service.optimizeDatabase();
    assert.strictEqual(optRes.success, true);
    console.log("  ✓ Passed: Database VACUUM & optimization executed successfully.");

    // --------------------------------------------------------
    // Test 7: Model Categorization & Real Verification
    // --------------------------------------------------------
    console.log("\n▶ Test 7: Testing model categorization and verification...");
    const categorized = service.getAllModels();
    const categories = new Set(categorized.map((m) => m.category));
    assert.ok(categories.has("text"), "Must contain text category");
    assert.ok(categories.has("vision"), "Must contain vision category");
    assert.ok(categories.has("ocr"), "Must contain ocr category");
    assert.ok(categories.has("audio"), "Must contain audio category");

    for (const m of categorized) {
      assert.ok(m.role, `Model ${m.id} must have a defined role`);
      assert.ok(m.capability, `Model ${m.id} must have a defined capability`);
      assert.ok(Array.isArray(m.usedBy), `Model ${m.id} must define usedBy consumers`);
    }

    const vRes = service.verifyModel("bge-small-en-v1.5");
    assert.strictEqual(vRes.success, true);
    assert.strictEqual(vRes.healthy, true);
    console.log("  ✓ Passed: Categorization, metadata roles, and model verification validated.");

    service.close();

    console.log("\n=================================================");
    console.log("🎉 ALL REAL MODEL SELECTOR & SETTINGS TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Model selector and settings test failed:", err);
  process.exit(1);
});
