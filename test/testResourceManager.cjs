"use strict";

const assert = require("assert");
const aiSearch = require("../electron/ai-search/index.cjs");

const {
  ResourceManager,
  CpuMonitor,
  MemoryMonitor,
  DiskMonitor,
  ResourceState,
  ResourceAction,
  PauseReason,
  ImpactLevel,
} = aiSearch.resources;

const { IndexManager, SessionStatus } = aiSearch.indexer;
const { DatabaseManager } = aiSearch.database;

/**
 * Mock monitor for deterministic threshold and hysteresis testing
 */
class MockCpuMonitor {
  constructor(initialVal = 20) {
    this.currentVal = initialVal;
  }
  set(val) {
    this.currentVal = val;
  }
  sample() {
    return this.currentVal;
  }
}

class MockMemoryMonitor {
  constructor(initialVal = 40) {
    this.currentVal = initialVal;
  }
  set(val) {
    this.currentVal = val;
  }
  sample() {
    return {
      totalBytes: 16 * 1024 * 1024 * 1024,
      freeBytes: Math.round((1 - this.currentVal / 100) * 16 * 1024 * 1024 * 1024),
      usedBytes: Math.round((this.currentVal / 100) * 16 * 1024 * 1024 * 1024),
      usagePercent: this.currentVal,
    };
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH RESOURCE MANAGER TEST SUITE");
  console.log("=================================================\n");

  // --------------------------------------------------------
  // Test 1: Real OS Hardware Monitoring
  // --------------------------------------------------------
  console.log("▶ Test 1: Real OS CPU & Memory monitoring...");
  const realCpu = new CpuMonitor();
  const realMem = new MemoryMonitor();
  const realDisk = new DiskMonitor();

  const cpuSample = realCpu.sample();
  const memSample = realMem.sample();
  const diskSample = await realDisk.sample();

  assert.ok(typeof cpuSample === "number", "CPU sample must be number");
  assert.ok(cpuSample >= 0 && cpuSample <= 100, "CPU sample must be 0-100%");
  assert.ok(memSample.usagePercent >= 0 && memSample.usagePercent <= 100, "RAM must be 0-100%");
  assert.ok(memSample.totalBytes > 0, "Total RAM must be greater than 0");
  console.log(`  ✓ Passed: System CPU (${cpuSample}%) & RAM (${memSample.usagePercent}%, ${(memSample.totalBytes / (1024**3)).toFixed(1)}GB) sampled safely.`);

  // --------------------------------------------------------
  // Test 2: Resource States, Actions, and Snapshot
  // --------------------------------------------------------
  console.log("▶ Test 2: Initial snapshot and state evaluation...");
  const mockCpu = new MockCpuMonitor(20);
  const mockMem = new MockMemoryMonitor(30);

  const rm = new ResourceManager({
    cpuMonitor: mockCpu,
    memoryMonitor: mockMem,
    policy: {
      hysteresis: { requiredSamples: 3, recoverySamples: 3 },
    },
  });

  await rm.initialize();
  const snapshot = rm.getSnapshot();

  assert.strictEqual(snapshot.state, ResourceState.NORMAL, "Initial state should be NORMAL");
  assert.strictEqual(snapshot.action, ResourceAction.RUN, "Initial action should be RUN");
  assert.strictEqual(snapshot.impactLevel, ImpactLevel.LOW, "Impact level should be LOW");
  assert.strictEqual(snapshot.recommendedBatchSize, 100, "Normal batch size should be 100");
  console.log("  ✓ Passed: Snapshot and decision logic verified.");

  // --------------------------------------------------------
  // Test 3: Hysteresis on Temporary CPU Spikes
  // --------------------------------------------------------
  console.log("▶ Test 3: Hysteresis on isolated single CPU spike...");
  mockCpu.set(90); // Spike to 90%
  await rm.sampleNow(); // 1st high sample

  assert.strictEqual(rm.getState(), ResourceState.NORMAL, "Must NOT jump to PAUSED on 1st spike");

  mockCpu.set(25); // Drops immediately back
  await rm.sampleNow();

  assert.strictEqual(rm.getState(), ResourceState.NORMAL, "Remains NORMAL after spike subsides");
  console.log("  ✓ Passed: Single CPU spike ignored by hysteresis.");

  // --------------------------------------------------------
  // Test 4: Sustained High CPU Escalation to THROTTLED and PAUSED
  // --------------------------------------------------------
  console.log("▶ Test 4: Sustained load escalation (THROTTLED -> PAUSED)...");
  // 1. Moderate load (70% CPU) for 3 consecutive ticks -> THROTTLED
  mockCpu.set(70);
  await rm.sampleNow(); // 1
  await rm.sampleNow(); // 2
  await rm.sampleNow(); // 3 -> Escalates to THROTTLED

  assert.strictEqual(rm.getState(), ResourceState.THROTTLED, "State must become THROTTLED");
  assert.strictEqual(rm.getDecision().action, ResourceAction.THROTTLE, "Action must become THROTTLE");
  assert.strictEqual(rm.getDecision().recommendedBatchSize, 30, "Throttled batch size should be 30");
  assert.strictEqual(rm.getDecision().impactLevel, ImpactLevel.MEDIUM, "Impact level should be MEDIUM");

  // 2. Severe load (85% CPU) for 3 consecutive ticks -> PAUSED
  mockCpu.set(85);
  await rm.sampleNow(); // 1
  await rm.sampleNow(); // 2
  await rm.sampleNow(); // 3 -> Escalates to PAUSED

  assert.strictEqual(rm.getState(), ResourceState.PAUSED, "State must become PAUSED");
  assert.strictEqual(rm.getDecision().action, ResourceAction.PAUSE, "Action must become PAUSE");
  assert.strictEqual(rm.getDecision().recommendedBatchSize, 0, "Paused batch size should be 0");
  assert.strictEqual(rm.getDecision().impactLevel, ImpactLevel.HIGH, "Impact level should be HIGH");
  console.log("  ✓ Passed: Escalation to THROTTLED and PAUSED verified.");

  // --------------------------------------------------------
  // Test 5: Sustained Recovery and Auto-Resume
  // --------------------------------------------------------
  console.log("▶ Test 5: Sustained recovery & auto_resume event...");
  let autoResumeFired = false;
  rm.on("auto_resume", () => {
    autoResumeFired = true;
  });

  // Low healthy load (25% CPU)
  mockCpu.set(25);
  await rm.sampleNow(); // 1
  assert.strictEqual(rm.getState(), ResourceState.PAUSED, "Stays PAUSED on 1st healthy sample");

  await rm.sampleNow(); // 2
  assert.strictEqual(rm.getState(), ResourceState.PAUSED, "Stays PAUSED on 2nd healthy sample");

  await rm.sampleNow(); // 3 -> Recovery threshold reached
  assert.strictEqual(rm.getState(), ResourceState.NORMAL, "Recovers to NORMAL on 3rd healthy sample");
  assert.strictEqual(autoResumeFired, true, "auto_resume event must fire");
  console.log("  ✓ Passed: Sustained recovery triggered auto_resume.");

  // --------------------------------------------------------
  // Test 6: Manual User Pause Protection
  // --------------------------------------------------------
  console.log("▶ Test 6: Manual user pause protection (auto_resume cannot override user)...");
  const testDb = new DatabaseManager({ databaseDir: ":memory:", databasePath: ":memory:" });
  const indexer = new IndexManager(testDb, { resourceManager: rm });

  // Simulate active session
  indexer.activeSession = {
    status: SessionStatus.RUNNING,
    pause: function() { this.status = SessionStatus.PAUSED; },
    resume: function() { this.status = SessionStatus.RUNNING; },
    getProgress: function() { return { status: this.status }; },
  };

  // User manually pauses
  indexer.pause(true);
  assert.strictEqual(indexer.pauseSource, "USER", "Pause source must be recorded as USER");
  assert.strictEqual(indexer.activeSession.status, SessionStatus.PAUSED, "Session is paused");

  // System attempts auto_resume (isUser = false)
  const resumeResult = indexer.resume(false);
  assert.strictEqual(resumeResult, false, "Auto-resume must return false and be blocked");
  assert.strictEqual(indexer.activeSession.status, SessionStatus.PAUSED, "Session must strictly remain PAUSED");

  // User explicitly resumes (isUser = true)
  const userResumeResult = indexer.resume(true);
  assert.strictEqual(userResumeResult, true, "User resume must succeed");
  assert.strictEqual(indexer.activeSession.status, SessionStatus.RUNNING, "Session resumed by user");
  console.log("  ✓ Passed: User manual pause is strictly protected against auto-resume.");

  rm.shutdown();

  console.log("\n=================================================");
  console.log("🎉 ALL PART 5 RESOURCE MANAGER TESTS PASSED (100% SUCCESS)");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
