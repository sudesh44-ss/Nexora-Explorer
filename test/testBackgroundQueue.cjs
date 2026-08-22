"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  IndexCoordinator,
  IndexQueue,
  PriorityScheduler,
  QueuePersistence,
  RetryManager,
  createIndexTask,
  TaskType,
  TaskPriority,
  TaskState,
  ErrorClassification,
} = aiSearch.indexing;

const { DatabaseManager } = aiSearch.database;
const { AIEngine } = aiSearch.ai;
const { EmbeddingManager } = aiSearch.vectors;
const { createFileRecord } = aiSearch.discovery;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH BACKGROUND QUEUE TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_queue_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "queue_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  const aiEngine = new AIEngine();
  await aiEngine.initialize();

  const vectors = new EmbeddingManager(aiEngine, db);
  await vectors.initialize();

  const persistence = new QueuePersistence(db);
  const queue = new IndexQueue(persistence);
  const scheduler = new PriorityScheduler({ maxWorkers: 2, maxHeavyWorkers: 1, agingRatePerMinute: 10 });

  try {
    // --------------------------------------------------------
    // Test 1: Task Enqueue & Priority Ranking
    // --------------------------------------------------------
    console.log("▶ Test 1: Task enqueue and priority ordering...");
    const taskLow = createIndexTask({ fileId: "f_1", taskType: TaskType.VIDEO_ANALYSIS, priority: TaskPriority.BACKGROUND });
    const taskHigh = createIndexTask({ fileId: "f_2", taskType: TaskType.METADATA_INDEX, priority: TaskPriority.HIGH });
    const taskCritical = createIndexTask({ fileId: "f_3", taskType: TaskType.IMAGE_ANALYSIS, priority: TaskPriority.CRITICAL });

    queue.enqueue(taskLow);
    queue.enqueue(taskHigh);
    queue.enqueue(taskCritical);

    const candidates = queue.fetchCandidates(10);
    const ranked = scheduler.rankCandidates(candidates);

    assert.strictEqual(ranked[0].fileId, "f_3", "Critical priority must be ranked #1");
    assert.strictEqual(ranked[1].fileId, "f_2", "High priority must be ranked #2");
    assert.strictEqual(ranked[2].fileId, "f_1", "Background priority must be ranked #3");
    console.log("  ✓ Passed: Priority scheduler ordered tasks deterministically.");

    // --------------------------------------------------------
    // Test 2: Task Deduplication
    // --------------------------------------------------------
    console.log("▶ Test 2: Task deduplication prevention...");
    const duplicateRes = queue.enqueue({ fileId: "f_1", taskType: TaskType.VIDEO_ANALYSIS });
    assert.strictEqual(duplicateRes.duplicate, true, "Duplicate task for active file must be skipped");
    assert.strictEqual(duplicateRes.enqueued, false);
    console.log("  ✓ Passed: Active task deduplication prevented redundant task insertion.");

    // --------------------------------------------------------
    // Test 3: Priority Aging (Starvation Prevention)
    // --------------------------------------------------------
    console.log("▶ Test 3: Priority aging prevents starvation of low-priority tasks...");
    const now = Date.now();
    // Task created 10 minutes ago
    const oldLowTask = {
      ...taskLow,
      priority: 20,
      createdAt: new Date(now - 10 * 60000).toISOString(),
    };
    // Task created just now
    const newNormalTask = {
      ...taskHigh,
      priority: 60,
      createdAt: new Date(now).toISOString(),
    };

    // Aging: 20 + (10 min * 10 pts/min) = 120 > 60
    const effOld = scheduler.calculateEffectivePriority(oldLowTask, now);
    const effNew = scheduler.calculateEffectivePriority(newNormalTask, now);
    assert.ok(effOld > effNew, `Old aged task (${effOld}) must surpass new normal task (${effNew})`);
    console.log(`  ✓ Passed: Aged task boosted to ${effOld} priority, defeating starvation.`);

    // --------------------------------------------------------
    // Test 4: Retry Manager Exponential Backoff & Classification
    // --------------------------------------------------------
    console.log("▶ Test 4: Exponential backoff delay calculation...");
    const delay1 = RetryManager.computeBackoffDelay(1, 500);
    const delay2 = RetryManager.computeBackoffDelay(2, 500);
    const delay3 = RetryManager.computeBackoffDelay(3, 500);

    assert.ok(delay1 >= 500 && delay1 <= 600);
    assert.ok(delay2 >= 1000 && delay2 <= 1200);
    assert.ok(delay3 >= 2000 && delay3 <= 2400);

    const transientErr = new Error("Database busy lock timeout");
    const permErr = new Error("Unsupported image format");
    assert.strictEqual(RetryManager.classifyError(transientErr), ErrorClassification.TRANSIENT);
    assert.strictEqual(RetryManager.classifyError(permErr), ErrorClassification.PERMANENT);
    assert.strictEqual(RetryManager.shouldRetry({ attempts: 1 }, permErr, 3), false, "Permanent error must not retry");
    console.log("  ✓ Passed: Backoff progression and error classification verified.");

    // --------------------------------------------------------
    // Test 5: Persistent Crash Recovery
    // --------------------------------------------------------
    console.log("▶ Test 5: Persistent crash recovery of interrupted processing tasks...");
    persistence.updateTaskStatus("task_interrupted_test", TaskState.PROCESSING, { startedAt: new Date().toISOString() });
    persistence.upsertTask({
      taskId: "task_interrupted_test",
      fileId: "f_crash_1",
      taskType: TaskType.TEXT_EXTRACTION,
      priority: 60,
      status: TaskState.PROCESSING,
      createdAt: new Date().toISOString(),
    });

    const recoveredCount = persistence.recoverInterruptedTasks();
    assert.ok(recoveredCount >= 1, "Interrupted PROCESSING task must be recovered to QUEUED");

    const recovered = persistence.findActiveTask("f_crash_1", TaskType.TEXT_EXTRACTION);
    assert.strictEqual(recovered.status, TaskState.QUEUED);
    console.log(`  ✓ Passed: Recovered ${recoveredCount} interrupted tasks upon restart.`);

    // --------------------------------------------------------
    // Test 6: End-to-End IndexCoordinator Lifecycle
    // --------------------------------------------------------
    console.log("▶ Test 6: End-to-End IndexCoordinator execution...");
    const filePath = path.join(testRoot, "doc_test.txt");
    await fsp.writeFile(filePath, "Cybersecurity penetration testing guidelines.");

    const fileRec = createFileRecord({
      file_id: "doc_test_1",
      name: "doc_test.txt",
      path: filePath,
      extension: ".txt",
      hash: "hash_txt_queue",
    });
    db.files.insert(fileRec);

    const coordinator = new IndexCoordinator({
      databaseManager: db,
      embeddingManager: vectors,
    }, { maxWorkers: 2, pollIntervalMs: 50 });

    let completedEvent = false;
    coordinator.on("task_completed", (e) => {
      if (e.task.fileId === "doc_test_1") {
        completedEvent = true;
      }
    });

    coordinator.start();
    coordinator.queueTask({
      fileId: "doc_test_1",
      taskType: TaskType.METADATA_INDEX,
      priority: TaskPriority.HIGH,
      payload: { fileRecord: fileRec },
    });

    // Wait for execution
    await new Promise((r) => setTimeout(r, 200));
    await coordinator.stop();

    assert.strictEqual(completedEvent, true, "Coordinator must complete task and emit event");
    console.log("  ✓ Passed: IndexCoordinator dispatched and completed background task.");

    // --------------------------------------------------------
    // Test 7: 10,000-Task Stress Simulation
    // --------------------------------------------------------
    console.log("▶ Test 7: 10,000-Task Stress Simulation...");
    const stressStart = Date.now();
    const memBefore = process.memoryUsage().heapUsed;

    const stressBatch = [];
    for (let i = 0; i < 10000; i++) {
      stressBatch.push({
        taskId: `stress_task_${i}`,
        fileId: `stress_file_${i % 500}`,
        taskType: i % 2 === 0 ? TaskType.METADATA_INDEX : TaskType.TEXT_EXTRACTION,
        priority: (i % 5) * 20 + 20,
        status: TaskState.QUEUED,
        createdAt: new Date().toISOString(),
      });
    }

    db.tx.run(() => {
      for (const t of stressBatch) {
        persistence.upsertTask(t);
      }
    });

    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);
    const tookMs = Date.now() - stressStart;

    const stats = persistence.getStats();
    assert.ok(stats.total >= 10000);
    console.log(`  ✓ Passed: 10,000 tasks persisted in ${tookMs}ms (RAM delta: ${memDeltaMB.toFixed(1)}MB).`);

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 12 BACKGROUND QUEUE TESTS PASSED (100% SUCCESS)");
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
