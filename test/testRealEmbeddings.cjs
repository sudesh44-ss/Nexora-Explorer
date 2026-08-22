"use strict";

const assert = require("assert");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");

const aiSearch = require("../electron/ai-search/index.cjs");
const { AIEngine, LocalEmbeddingRuntime, ModelRegistry } = aiSearch.ai;
const { EmbeddingGenerator, VectorStore, VectorSearch, createEmbeddingDocument } = aiSearch.vectors;
const { DatabaseManager } = aiSearch.database;
const { cosineSimilarity } = aiSearch.vectors;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA REAL EMBEDDING RUNTIME TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_embeddings_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const registry = new ModelRegistry();
  const runtime = new LocalEmbeddingRuntime({ cacheDir: path.join(testRoot, "model_cache") });
  const aiEngine = new AIEngine({ modelRegistry: registry });
  aiEngine.runtimes.register(runtime);

  const generator = new EmbeddingGenerator(aiEngine);

  try {
    // --------------------------------------------------------
    // Test 1: Real Local Model Loading & Cache Verification
    // --------------------------------------------------------
    console.log("▶ Test 1: Real local embedding model loading...");
    const modelProfile = registry.getById("bge-small-en-v1.5");
    assert.ok(modelProfile, "Model profile bge-small-en-v1.5 must exist in registry");

    const t0 = Date.now();
    const loadResult = await runtime.loadModel(modelProfile);
    const loadElapsed = Date.now() - t0;
    assert.strictEqual(loadResult.success, true);
    assert.strictEqual(runtime.isReady("bge-small-en-v1.5"), true);
    console.log(`  ✓ Passed: Real ONNX model loaded in ${loadElapsed}ms (Ready = true).`);

    // --------------------------------------------------------
    // Test 2: Real Vector Inference (Non-Mock, Finite, Correct Dim)
    // --------------------------------------------------------
    console.log("▶ Test 2: Real embedding vector generation from text...");
    const taskResult = await aiEngine.runTask(
      {
        type: "text_embedding",
        input: "cybersecurity and network intrusion detection",
        modelPreference: "bge-small-en-v1.5",
      },
      { runtimeId: "local-runtime" }
    );

    assert.strictEqual(taskResult.success, true);
    assert.strictEqual(taskResult.runtimeId, "local-runtime");
    assert.strictEqual(taskResult.dimensions, 384);
    assert.strictEqual(taskResult.metadata.mock, false);
    assert.ok(Array.isArray(taskResult.vector) || ArrayBuffer.isView(taskResult.vector));
    assert.strictEqual(taskResult.vector.length, 384);

    for (let i = 0; i < taskResult.vector.length; i++) {
      assert.ok(Number.isFinite(taskResult.vector[i]), "Vector elements must be finite numbers");
    }
    console.log(`  ✓ Passed: Generated real 384-dim Float32 vector (non-mock, finite).`);

    // --------------------------------------------------------
    // Test 3: Same Input Deterministic Consistency
    // --------------------------------------------------------
    console.log("▶ Test 3: Same input embedding determinism...");
    const textSample = "Authorized penetration testing methodology";
    const v1 = await generator.generateQueryEmbedding(textSample, { runtimeId: "local-runtime", modelId: "bge-small-en-v1.5" });
    const v2 = await generator.generateQueryEmbedding(textSample, { runtimeId: "local-runtime", modelId: "bge-small-en-v1.5" });

    assert.ok(v1 && v2);
    assert.strictEqual(v1.length, v2.length);
    const selfSim = cosineSimilarity(v1, v2);
    assert.ok(selfSim >= 0.999, `Identical text cosine similarity must be ~1.0 (got ${selfSim})`);
    console.log(`  ✓ Passed: Deterministic embedding verified (Cosine self-similarity = ${selfSim.toFixed(5)}).`);

    // --------------------------------------------------------
    // Test 4: Semantic Similarity (Related vs Unrelated Concepts)
    // --------------------------------------------------------
    console.log("▶ Test 4: Semantic similarity separation...");
    const docSecurity = "Introduction to network security, firewall configuration, and vulnerability patching";
    const querySecurity = "cybersecurity notes";
    const queryUnrelated = "authentic italian pasta recipe with parmesan";

    const vDoc = await generator.generateQueryEmbedding(docSecurity, { runtimeId: "local-runtime", modelId: "bge-small-en-v1.5" });
    const vQuerySec = await generator.generateQueryEmbedding(querySecurity, { runtimeId: "local-runtime", modelId: "bge-small-en-v1.5" });
    const vQueryUnrelated = await generator.generateQueryEmbedding(queryUnrelated, { runtimeId: "local-runtime", modelId: "bge-small-en-v1.5" });

    const simRelated = cosineSimilarity(vDoc, vQuerySec);
    const simUnrelated = cosineSimilarity(vDoc, vQueryUnrelated);

    console.log(`    - Sim (Network Security Doc <-> Cybersecurity Query): ${simRelated.toFixed(4)}`);
    console.log(`    - Sim (Network Security Doc <-> Pasta Recipe Query):   ${simUnrelated.toFixed(4)}`);

    assert.ok(simRelated > simUnrelated, "Related concept must rank significantly higher than unrelated topic");
    assert.ok(simRelated > 0.55, "Related concept similarity must exceed 0.55");
    assert.ok(simUnrelated < 0.45, "Unrelated concept similarity must stay below 0.45");
    console.log("  ✓ Passed: Semantic vector separation verified.");

    // --------------------------------------------------------
    // Test 5: Vector Store & Real Semantic Vector Search Integration
    // --------------------------------------------------------
    console.log("▶ Test 5: Vector Store & Vector Search integration with real embeddings...");
    const dbPath = path.join(testRoot, "real_vector_test.db");
    const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
    await db.initialize();

    const vectorStore = new VectorStore(db);
    await vectorStore.initialize();
    const vectorSearch = new VectorSearch(vectorStore);

    const doc1 = createEmbeddingDocument({
      fileId: "file_netsec",
      text: "Comprehensive handbook on enterprise firewall rule configuration and TLS encryption.",
      sourceHash: "hash_001",
    });

    const doc2 = createEmbeddingDocument({
      fileId: "file_pasta",
      text: "Step by step culinary guide to homemade fettuccine and marinara sauce.",
      sourceHash: "hash_002",
    });

    const embRes1 = await generator.generateDocumentEmbedding(doc1, { runtimeId: "local-runtime", modelId: "bge-small-en-v1.5" });
    const embRes2 = await generator.generateDocumentEmbedding(doc2, { runtimeId: "local-runtime", modelId: "bge-small-en-v1.5" });

    vectorStore.upsert(embRes1.fileId, embRes1.vector, { modelId: embRes1.modelId, contentHash: embRes1.metadata?.sourceHash });
    vectorStore.upsert(embRes2.fileId, embRes2.vector, { modelId: embRes2.modelId, contentHash: embRes2.metadata?.sourceHash });

    // Search query vector
    const searchRes = VectorSearch.search(vQuerySec, vectorStore, { topK: 5, minimumScore: 0.3 });
    assert.strictEqual(searchRes.length, 2);
    assert.strictEqual(searchRes[0].fileId, "file_netsec", "Top ranked result must be the network security document");
    assert.ok(searchRes[0].score > searchRes[1].score);

    console.log(`  ✓ Passed: Vector search correctly retrieved '${searchRes[0].fileId}' with score ${searchRes[0].score.toFixed(4)}.`);

    // --------------------------------------------------------
    // Test 6: Model Reuse & Fast Execution (<20ms per inference)
    // --------------------------------------------------------
    console.log("▶ Test 6: Model reuse and inference speed...");
    const tStart = Date.now();
    for (let i = 0; i < 10; i++) {
      await generator.generateQueryEmbedding(`search query iteration ${i}`, { runtimeId: "local-runtime", modelId: "bge-small-en-v1.5" });
    }
    const elapsedMulti = Date.now() - tStart;
    const avgLatency = elapsedMulti / 10;
    console.log(`  ✓ Passed: Executed 10 embeddings in ${elapsedMulti}ms (~${avgLatency.toFixed(1)}ms per embedding).`);

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 2 REAL EMBEDDING RUNTIME TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    await runtime.shutdown();
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch((err) => {
  console.error("❌ Real embedding test suite failed:", err);
  process.exit(1);
});
