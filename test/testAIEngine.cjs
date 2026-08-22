"use strict";

const assert = require("assert");
const aiSearch = require("../electron/ai-search/index.cjs");

const {
  AIEngine,
  ModelRegistry,
  ModelSelector,
  ModelManager,
  RuntimeRegistry,
  MockAIRuntime,
  AITaskType,
  QualityMode,
  createModelProfile,
  createAITask,
  AIErrorCode,
} = aiSearch.ai;

const { ResourceManager, ResourceState, ResourceAction } = aiSearch.resources;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH AI ENGINE & REGISTRY TEST SUITE");
  console.log("=================================================\n");

  // --------------------------------------------------------
  // Test 1: Model Registry Metadata & Lookups
  // --------------------------------------------------------
  console.log("▶ Test 1: Model Registry registration and lookups...");
  const registry = new ModelRegistry();

  const nomic = registry.getById("nomic-embed-text-v1.5");
  assert.ok(nomic, "Nomic Embed Text v1.5 profile must exist");
  assert.strictEqual(nomic.dimensions, 768);
  assert.strictEqual(nomic.license, "Apache-2.0");

  const embedModels = registry.findByTask(AITaskType.TEXT_EMBEDDING);
  assert.ok(embedModels.length >= 3, "Should find at least 3 embedding models");

  // Custom model registration
  const custom = createModelProfile({
    id: "custom-lite-embed",
    name: "Custom Lite Embed",
    task: AITaskType.TEXT_EMBEDDING,
    dimensions: 256,
    sizeBytes: 30 * 1024 * 1024,
    ramRequirementBytes: 128 * 1024 * 1024,
    qualityTier: QualityMode.FAST,
  });
  registry.register(custom);
  assert.ok(registry.getById("custom-lite-embed"), "Custom profile registered");

  console.log("  ✓ Passed: Model Registry initialized with standard profiles.");

  // --------------------------------------------------------
  // Test 2: Hardware & Quality Aware Model Selector
  // --------------------------------------------------------
  console.log("▶ Test 2: Model Selector hardware & quality mode matching...");
  const selector = new ModelSelector(registry);

  // Scenario A: Low-end PC (4GB RAM, no GPU, FAST mode)
  const lowEndModel = selector.selectModel({
    task: AITaskType.TEXT_EMBEDDING,
    hardware: { totalRamBytes: 4 * 1024 * 1024 * 1024, hasGpu: false },
    qualityMode: QualityMode.FAST,
  });
  assert.ok(lowEndModel, "Must select a low-end compatible model");
  assert.ok(lowEndModel.sizeBytes <= 70 * 1024 * 1024, "Should select smallest model for FAST mode");
  console.log(`  ✓ Passed: Low-end hardware selected: '${lowEndModel.name}' (${(lowEndModel.sizeBytes / (1024**2)).toFixed(0)}MB)`);

  // Scenario B: Mid/High-end PC (16GB RAM, BALANCED mode)
  const balancedModel = selector.selectModel({
    task: AITaskType.TEXT_EMBEDDING,
    hardware: { totalRamBytes: 16 * 1024 * 1024 * 1024, hasGpu: false },
    qualityMode: QualityMode.BALANCED,
  });
  assert.strictEqual(balancedModel.id, "nomic-embed-text-v1.5", "Selected balanced candidate Nomic v1.5");
  console.log(`  ✓ Passed: Balanced hardware selected: '${balancedModel.name}'`);

  // --------------------------------------------------------
  // Test 3: Model Manager & Storage Resolution
  // --------------------------------------------------------
  console.log("▶ Test 3: Model Manager storage resolution & status...");
  const manager = new ModelManager(registry);
  await manager.initialize();

  const status = manager.getStatus();
  assert.ok(status.modelsDir.includes("models"), "Storage directory resolved");
  assert.ok(status.availableCount >= 4, "Available count reported");
  console.log(`  ✓ Passed: Model storage isolated at '${status.modelsDir}'.`);

  // --------------------------------------------------------
  // Test 4: Runtime Registry & Mock Runtime
  // --------------------------------------------------------
  console.log("▶ Test 4: Runtime Registry & deterministic Mock Runtime...");
  const runtimes = new RuntimeRegistry();
  const mockRuntime = runtimes.get("mock-runtime");
  assert.ok(mockRuntime, "Mock runtime registered by default");

  await mockRuntime.loadModel(nomic);
  assert.strictEqual(mockRuntime.isReady(nomic.id), true);

  const sampleTask = createAITask({
    type: AITaskType.TEXT_EMBEDDING,
    input: "Cybersecurity and Network Forensics",
  });

  const aiResult = await mockRuntime.run(sampleTask, nomic);
  assert.strictEqual(aiResult.success, true);
  assert.strictEqual(aiResult.dimensions, 768);
  assert.strictEqual(aiResult.vector.length, 768);
  assert.ok(typeof aiResult.vector[0] === "number");
  console.log("  ✓ Passed: Mock runtime produced 768-dimensional normalized vector.");

  // --------------------------------------------------------
  // Test 5: End-to-End AI Engine Pipeline
  // --------------------------------------------------------
  console.log("▶ Test 5: End-to-end AI Engine task execution...");
  const aiEngine = new AIEngine({
    modelRegistry: registry,
    modelSelector: selector,
    modelManager: manager,
    runtimeRegistry: runtimes,
  });
  await aiEngine.initialize();

  const task = createAITask({
    type: AITaskType.TEXT_EMBEDDING,
    input: "Distributed file systems in cloud computing",
  });

  const res = await aiEngine.runTask(task, { qualityMode: QualityMode.BALANCED });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.modelId, "nomic-embed-text-v1.5");
  assert.strictEqual(res.vector.length, 768);
  console.log("  ✓ Passed: AI Engine successfully coordinated task -> selector -> runtime -> result.");

  // --------------------------------------------------------
  // Test 6: Resource Manager Integration (Pause Protection)
  // --------------------------------------------------------
  console.log("▶ Test 6: Resource Manager pause protection during AI tasks...");
  const mockResourceMgr = {
    getDecision: () => ({ action: ResourceAction.PAUSE, state: ResourceState.PAUSED }),
  };

  const busyAIEngine = new AIEngine({
    modelRegistry: registry,
    modelSelector: selector,
    modelManager: manager,
    runtimeRegistry: runtimes,
    resourceManager: mockResourceMgr,
  });

  let threwBusyError = false;
  try {
    await busyAIEngine.runTask(task);
  } catch (e) {
    if (e.code === AIErrorCode.RESOURCE_BUSY) {
      threwBusyError = true;
    }
  }
  assert.strictEqual(threwBusyError, true, "Must defer AI task when Resource Manager is PAUSED");
  console.log("  ✓ Passed: AI Engine respects system load limits and defers when PAUSED.");

  // --------------------------------------------------------
  // Test 7: Model Unload
  // --------------------------------------------------------
  console.log("▶ Test 7: Model unloading from runtime...");
  await aiEngine.unloadModel("nomic-embed-text-v1.5");
  assert.strictEqual(mockRuntime.isReady("nomic-embed-text-v1.5"), false, "Model should be unloaded");
  console.log("  ✓ Passed: Model memory released upon unload.");

  await aiEngine.shutdown();

  console.log("\n=================================================");
  console.log("🎉 ALL PART 7 AI MODEL REGISTRY TESTS PASSED (100% SUCCESS)");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
