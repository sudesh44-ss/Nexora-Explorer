"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  EmbeddingManager,
  EmbeddingGenerator,
  VectorStore,
  VectorSearch,
  createEmbeddingDocument,
  validateVector,
  l2Normalize,
  cosineSimilarity,
} = aiSearch.vectors;

const { DatabaseManager } = aiSearch.database;
const { AIEngine } = aiSearch.ai;
const { createFileRecord } = aiSearch.discovery;
const { ResourceState, ResourceAction } = aiSearch.resources;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH VECTOR & EMBEDDING TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_vector_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "vectors_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const aiEngine = new AIEngine();
  await aiEngine.initialize();

  try {
    // --------------------------------------------------------
    // Test 1: Vector Validation & Normalization
    // --------------------------------------------------------
    console.log("▶ Test 1: Vector validation and L2 normalization...");
    const validVec = [0.5, 0.5, 0.5, 0.5];
    assert.strictEqual(validateVector(validVec, 4), true);
    assert.strictEqual(validateVector([0.5, NaN, 0.5]), false, "NaN must be rejected");
    assert.strictEqual(validateVector([0.5, Infinity, 0.5]), false, "Infinity must be rejected");
    assert.strictEqual(validateVector([]), false, "Empty vector must be rejected");

    const normalized = l2Normalize(validVec);
    assert.strictEqual(normalized.length, 4);
    // Norm of [0.5, 0.5, 0.5, 0.5] normalized must be 1.0
    const mag = Math.sqrt(normalized.reduce((s, v) => s + v * v, 0));
    assert.ok(Math.abs(mag - 1.0) < 1e-5, "Normalized vector length must equal 1.0");
    console.log("  ✓ Passed: Vector validation & L2 normalization verified.");

    // --------------------------------------------------------
    // Test 2: Cosine Similarity Calculations
    // --------------------------------------------------------
    console.log("▶ Test 2: Cosine similarity accuracy & boundary checks...");
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0]; // Identical
    const vecC = [0, 1, 0]; // Orthogonal
    const vecD = [-1, 0, 0]; // Opposite

    assert.strictEqual(cosineSimilarity(vecA, vecB), 1.0, "Identical vectors score 1.0");
    assert.strictEqual(cosineSimilarity(vecA, vecC), 0.0, "Orthogonal vectors score 0.0");
    assert.strictEqual(cosineSimilarity(vecA, vecD), -1.0, "Opposite vectors score -1.0");
    assert.strictEqual(cosineSimilarity([0, 0, 0], vecA), 0.0, "Zero magnitude safely returns 0.0");
    console.log("  ✓ Passed: Cosine similarity mathematical accuracy confirmed.");

    // --------------------------------------------------------
    // Test 3: VectorStore CRUD & Float32 Blob Persistence
    // --------------------------------------------------------
    console.log("▶ Test 3: VectorStore persistence & Float32Array blob serialization...");
    const store = new VectorStore(db);
    await store.initialize();

    const testVector = new Float32Array([0.123, -0.456, 0.789, 0.012]);
    store.upsert("file_vec_1", testVector, {
      contentHash: "hash_aaa",
      modelId: "nomic-embed-text-v1.5",
      metadata: { fileName: "audit.pdf" },
    });

    assert.strictEqual(store.count(), 1);
    const retrieved = store.get("file_vec_1");
    assert.ok(retrieved, "Retrieved vector record must exist");
    assert.strictEqual(retrieved.dimensions, 4);
    assert.ok(Math.abs(retrieved.vector[0] - 0.123) < 1e-4, "Float precision preserved");
    assert.strictEqual(retrieved.metadata.fileName, "audit.pdf");
    console.log("  ✓ Passed: Vector stored and deserialized accurately from SQLite binary blob.");

    // --------------------------------------------------------
    // Test 4: Embedding Generator
    // --------------------------------------------------------
    console.log("▶ Test 4: Embedding Generator with AI Engine...");
    const generator = new EmbeddingGenerator(aiEngine);

    const doc = createEmbeddingDocument({
      fileId: "doc_net_1",
      sourceHash: "hash_net_1",
      text: "Enterprise network firewalls and threat detection infrastructure",
    });

    const embRes = await generator.generateDocumentEmbedding(doc);
    assert.strictEqual(embRes.success, true);
    assert.ok(embRes.vector.length >= 384, "Embedding vector generated");
    assert.ok(typeof embRes.vector[0] === "number");
    console.log(`  ✓ Passed: Generated ${embRes.dimensions}-dim embedding for document.`);

    // --------------------------------------------------------
    // Test 5: End-to-End Semantic Search
    // --------------------------------------------------------
    console.log("▶ Test 5: End-to-end Semantic Similarity Search...");
    const manager = new EmbeddingManager(aiEngine, db);
    await manager.initialize();

    // Index 3 distinct documents
    const docSecurity = createFileRecord({
      file_id: "sec_doc",
      name: "Cybersecurity_Whitepaper.pdf",
      path: "/docs/Cybersecurity_Whitepaper.pdf",
      hash: "hash_sec_100",
    });
    const docCooking = createFileRecord({
      file_id: "cook_doc",
      name: "Pasta_Recipes.txt",
      path: "/recipes/Pasta_Recipes.txt",
      hash: "hash_cook_200",
    });
    const docSports = createFileRecord({
      file_id: "sport_doc",
      name: "Football_League.txt",
      path: "/sports/Football_League.txt",
      hash: "hash_sport_300",
    });

    await manager.embedFile(docSecurity, { text: "Network security, firewall configuration and intrusion detection systems" });
    await manager.embedFile(docCooking, { text: "Italian cooking recipes, pasta preparation and garlic bread" });
    await manager.embedFile(docSports, { text: "Premier league football match scores, goals and tournament highlights" });

    assert.strictEqual(manager.getStatus().vectorCount, 4); // 1 from test 3 + 3 new

    // Search query related to security
    const results = await manager.searchSimilar("computer security network", { topK: 5, minimumScore: 0.1 });
    assert.ok(results.length > 0, "Semantic search must return matching candidates");
    assert.strictEqual(results[0].fileId, "sec_doc", "Security document must rank #1 for security query");
    console.log(`  ✓ Passed: Semantic query ranked '${results[0].metadata.fileName}' #1 (Score: ${results[0].score.toFixed(4)})`);

    // --------------------------------------------------------
    // Test 6: Hash-Based Cache Reuse & Content Stale Invalidation
    // --------------------------------------------------------
    console.log("▶ Test 6: Hash cache reuse and stale vector update...");
    // Exact same hash -> reuse
    const reuseRes = await manager.embedFile(docSecurity, { text: "Network security, firewall configuration and intrusion detection systems" });
    assert.strictEqual(reuseRes.cached, true, "Same hash should be cached");

    // Modified content -> new hash -> updates vector
    const modifiedDoc = { ...docSecurity, hash: "hash_sec_MODIFIED" };
    const updateRes = await manager.embedFile(modifiedDoc, { text: "Updated cryptography and quantum encryption protocols" });
    assert.strictEqual(updateRes.cached, false, "Modified hash triggers re-embedding");
    assert.strictEqual(manager.store.get("sec_doc").contentHash, "hash_sec_MODIFIED");
    console.log("  ✓ Passed: Hash cache skipped unchanged and updated modified vector.");

    // --------------------------------------------------------
    // Test 7: File Deletion Synchronization
    // --------------------------------------------------------
    console.log("▶ Test 7: Vector removal on file deletion...");
    manager.deleteFileVector("cook_doc");
    assert.strictEqual(manager.store.get("cook_doc"), null, "Deleted vector must not exist");
    const searchAfterDelete = await manager.searchSimilar("pasta cooking");
    const foundCooking = searchAfterDelete.some((r) => r.fileId === "cook_doc");
    assert.strictEqual(foundCooking, false, "Deleted document not in search results");
    console.log("  ✓ Passed: File vector safely removed upon deletion.");

    // --------------------------------------------------------
    // Test 8: Persistence across Database Re-open
    // --------------------------------------------------------
    console.log("▶ Test 8: Vector index survival across database restarts...");
    db.close();

    const reopenedDb = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
    await reopenedDb.initialize();

    const reopenedManager = new EmbeddingManager(aiEngine, reopenedDb);
    await reopenedManager.initialize();

    assert.ok(reopenedManager.getStatus().vectorCount >= 2, "Vectors survive DB reload");
    const persistSearch = await reopenedManager.searchSimilar("cryptography quantum");
    assert.ok(persistSearch.length > 0);
    assert.strictEqual(persistSearch[0].fileId, "sec_doc");
    console.log("  ✓ Passed: Vector index fully restored across restart.");

    reopenedDb.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 8 VECTOR & EMBEDDING TESTS PASSED (100% SUCCESS)");
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
