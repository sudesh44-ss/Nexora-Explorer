"use strict";

const assert = require("assert");
const aiSearch = require("../electron/ai-search/index.cjs");
const {
  HardeningAdapter,
  InputValidator,
  QuerySanitizer,
  FtsGuard,
  PathGuard,
  SymlinkGuard,
  FilesystemGuard,
  IpcGuard,
  ErrorBoundary,
  ERROR_CATEGORIES,
  WorkerGuard,
  CacheIntegrityGuard,
  DatabaseRecovery,
} = aiSearch.security;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA SEARCH HARDENING & SECURITY TEST SUITE");
  console.log("=================================================\n");

  const hardening = new HardeningAdapter();

  // --------------------------------------------------------
  // Test 1: Input Validation (Null, Undefined, Long string)
  // --------------------------------------------------------
  console.log("▶ Test 1: Input validation against malformed and extreme inputs...");
  const nullCheck = InputValidator.validateQuery(null);
  assert.strictEqual(nullCheck.valid, true);
  assert.strictEqual(nullCheck.query, "");

  const numCheck = InputValidator.validateQuery(12345);
  assert.strictEqual(numCheck.valid, false);

  const longQuery = "a".repeat(1000);
  const longCheck = InputValidator.validateQuery(longQuery);
  assert.strictEqual(longCheck.valid, true);
  assert.strictEqual(longCheck.truncated, true);
  assert.strictEqual(longCheck.query.length, 500);
  console.log("  ✓ Passed: Handled null, non-string, and 1,000-char queries safely.");

  // --------------------------------------------------------
  // Test 2: Unmatched Quote Balancing
  // --------------------------------------------------------
  console.log("▶ Test 2: Unmatched quote balancing in QuerySanitizer...");
  const unclosed = QuerySanitizer.sanitize('"network security');
  assert.strictEqual(unclosed, '"network security"');
  console.log(`  ✓ Passed: Balanced unclosed quote -> ${unclosed}.`);

  // --------------------------------------------------------
  // Test 3: FTS5 Boolean Keyword Protection
  // --------------------------------------------------------
  console.log("▶ Test 3: FTS5 query protection against malformed boolean operators...");
  const malformedFts = FtsGuard.cleanFtsExpression("AND cybersecurity NOT");
  assert.strictEqual(malformedFts, "cybersecurity");

  const repeatFts = FtsGuard.cleanFtsExpression("cybersecurity AND AND firewall");
  assert.strictEqual(repeatFts, "cybersecurity AND firewall");
  console.log(`  ✓ Passed: Cleaned malformed FTS expression -> '${malformedFts}'.`);

  // --------------------------------------------------------
  // Test 4: Path Traversal & Root Boundary Protection
  // --------------------------------------------------------
  console.log("▶ Test 4: Path traversal and root boundary escape protection...");
  const allowedRoot = "C:/Users/User/Documents";
  const safePath = "C:/Users/User/Documents/subfolder/file.pdf";
  const traversalPath = "C:/Users/User/Documents/../../Windows/System32";
  const escapePath = "C:/Users/User/Documents-Evil/file.pdf";

  assert.strictEqual(PathGuard.isPathInsideRoot(safePath, allowedRoot), true);
  assert.strictEqual(PathGuard.isPathInsideRoot(traversalPath, allowedRoot), false);
  assert.strictEqual(PathGuard.isPathInsideRoot(escapePath, allowedRoot), false);
  console.log("  ✓ Passed: Prevented directory traversal and boundary escape attempts.");

  // --------------------------------------------------------
  // Test 5: Symlink Loop Guard
  // --------------------------------------------------------
  console.log("▶ Test 5: Symlink loop detection...");
  const symlinkGuard = new SymlinkGuard();
  // Using process.cwd() as test location
  const cwd = process.cwd();
  assert.strictEqual(symlinkGuard.isLoopOrVisited(cwd), false); // 1st visit
  assert.strictEqual(symlinkGuard.isLoopOrVisited(cwd), true);  // 2nd visit -> loop/already visited
  console.log("  ✓ Passed: Detected repeat/recursive canonical path visit.");

  // --------------------------------------------------------
  // Test 6: Filesystem Safety (Non-existent / missing files)
  // --------------------------------------------------------
  console.log("▶ Test 6: Filesystem safe operations...");
  const nonExistentContent = FilesystemGuard.safeReadFile("C:/non_existent_folder_12345/test.txt");
  assert.strictEqual(nonExistentContent, null);
  assert.strictEqual(FilesystemGuard.safeExists("C:/non_existent_folder_12345/test.txt"), false);
  console.log("  ✓ Passed: Missing files handled safely without throwing exceptions.");

  // --------------------------------------------------------
  // Test 7: IPC Payload Validation
  // --------------------------------------------------------
  console.log("▶ Test 7: IPC search payload validation...");
  const validIpc = IpcGuard.validateSearchPayload({ query: "cybersecurity", options: { mode: "FAST" } });
  assert.strictEqual(validIpc.valid, true);
  assert.strictEqual(validIpc.data.query, "cybersecurity");

  const invalidIpc = IpcGuard.validateSearchPayload("not_an_object");
  assert.strictEqual(invalidIpc.valid, false);
  console.log("  ✓ Passed: Validated IPC payloads and rejected malformed calls.");

  // --------------------------------------------------------
  // Test 8: Error Boundary Isolation
  // --------------------------------------------------------
  console.log("▶ Test 8: Error boundary structured wrapping...");
  const caught = await ErrorBoundary.wrapAsync(async () => {
    throw new Error("Simulated vector index crash");
  }, ERROR_CATEGORIES.VECTOR_ERROR, []);
  assert.strictEqual(caught._isError, true);
  assert.strictEqual(caught.category, ERROR_CATEGORIES.VECTOR_ERROR);
  console.log(`  ✓ Passed: Caught error under category ${caught.category}: "${caught.message}".`);

  // --------------------------------------------------------
  // Test 9: Worker Crash Loop Breaker
  // --------------------------------------------------------
  console.log("▶ Test 9: Worker retry & crash loop breaker...");
  const workerGuard = new WorkerGuard({ maxRetries: 3 });
  assert.strictEqual(workerGuard.canRetry("task_corrupt"), true);
  workerGuard.recordFailure("task_corrupt");
  workerGuard.recordFailure("task_corrupt");
  workerGuard.recordFailure("task_corrupt");
  assert.strictEqual(workerGuard.canRetry("task_corrupt"), false);
  console.log("  ✓ Passed: Blocked permanently failing task after 3 failures.");

  // --------------------------------------------------------
  // Test 10: Cache Integrity Guard
  // --------------------------------------------------------
  console.log("▶ Test 10: Cache integrity validation...");
  assert.strictEqual(CacheIntegrityGuard.validateCachedResults([{ fileId: "doc_1" }]), true);
  assert.strictEqual(CacheIntegrityGuard.validateCachedResults([{ corrupted: true }]), false);
  assert.strictEqual(CacheIntegrityGuard.validateCachedResults("not_an_array"), false);
  console.log("  ✓ Passed: Verified cache entry structures safely.");

  // --------------------------------------------------------
  // Test 11: Database Integrity Verification
  // --------------------------------------------------------
  console.log("▶ Test 11: Database integrity verification...");
  const dbCheck = DatabaseRecovery.verifyIntegrity(null);
  assert.strictEqual(dbCheck.ok, true);
  console.log("  ✓ Passed: Database integrity verification executed safely.");

  // --------------------------------------------------------
  // Test 12: Normal Search Regression Verification
  // --------------------------------------------------------
  console.log("▶ Test 12: Normal legitimate queries regression test...");
  const normalQueries = [
    "cybersecurity",
    "birthday photos",
    '"network security"',
    "type:video",
    "cybersecurity NOT gaming",
    "pichle saal ki birthday photos",
  ];

  for (const q of normalQueries) {
    const hardened = hardening.hardenQuery(q);
    assert.ok(hardened.length > 0);
  }
  console.log(`  ✓ Passed: Verified ${normalQueries.length} normal queries passed through hardening cleanly.`);

  console.log("\n=================================================");
  console.log("🎉 ALL PART 28 SEARCH HARDENING TESTS PASSED (100% SUCCESS)");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
