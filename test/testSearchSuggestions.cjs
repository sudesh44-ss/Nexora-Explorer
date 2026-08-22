"use strict";

const assert = require("assert");
const aiSearch = require("../electron/ai-search/index.cjs");
const {
  SuggestionEngine,
  SuggestionResolver,
  SuggestionSources,
  SuggestionRanker,
  SuggestionNormalizer,
} = aiSearch.suggestions;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA SEARCH SUGGESTIONS TEST SUITE");
  console.log("=================================================\n");

  const engine = new SuggestionEngine({
    searchHistory: ["cybersecurity lecture", "python data science", "network architecture"],
    vocabulary: ["cybersecurity", "networking", "firewall", "python", "javascript", "machine learning"],
  });

  // --------------------------------------------------------
  // Test 1: Basic Query Completion ('cyber')
  // --------------------------------------------------------
  console.log("▶ Test 1: Query prefix completion ('cyber')...");
  const sugCyber = await engine.getSuggestions("cyber");
  assert.ok(sugCyber.length > 0);
  assert.ok(sugCyber.some((s) => s.text === "cybersecurity" || s.text.includes("cybersecurity")));
  console.log(`  ✓ Passed: Generated ${sugCyber.length} prefix suggestions for 'cyber'.`);

  // --------------------------------------------------------
  // Test 2: Operator & Filter Autocomplete ('type:', 'dur')
  // --------------------------------------------------------
  console.log("▶ Test 2: Operator & filter autocomplete ('type:', 'dur')...");
  const sugType = await engine.getSuggestions("type:");
  assert.ok(sugType.some((s) => s.text === "type:video"));
  assert.ok(sugType.some((s) => s.text === "type:image"));
  assert.ok(sugType.some((s) => s.text === "type:audio"));

  const sugDur = await engine.getSuggestions("dur");
  assert.ok(sugDur.some((s) => s.text === "duration:"));
  console.log("  ✓ Passed: Resolved operator and filter values accurately.");

  // --------------------------------------------------------
  // Test 3: Context-Aware Refinements ('cybersecurity videos' + 'only')
  // --------------------------------------------------------
  console.log("▶ Test 3: Context-aware refinement suggestions ('only')...");
  const activeContext = { rawQuery: "cybersecurity videos" };
  const sugContext = await engine.getSuggestions("only", activeContext);
  assert.ok(sugContext.some((s) => s.text.includes("only short ones")));
  assert.ok(sugContext.some((s) => s.text.includes("only images") || s.text.includes("only audio")));
  console.log("  ✓ Passed: Produced contextual refinement suggestions.");

  // --------------------------------------------------------
  // Test 4: Recent Search History Integration
  // --------------------------------------------------------
  console.log("▶ Test 4: Recent search history matching...");
  const sugHistory = await engine.getSuggestions("python");
  assert.ok(sugHistory.some((s) => s.text === "python data science" && s.source === "history"));
  console.log("  ✓ Passed: Matched recent search query from history.");

  // --------------------------------------------------------
  // Test 5: Duplicate Normalization (Case variations)
  // --------------------------------------------------------
  console.log("▶ Test 5: Case variation deduplication...");
  const duplicates = [
    { text: "Cybersecurity", source: "index" },
    { text: "cybersecurity", source: "history" },
    { text: "CYBERSECURITY", source: "operator" },
  ];
  const deduped = SuggestionNormalizer.deduplicate(duplicates);
  assert.strictEqual(deduped.length, 1);
  console.log("  ✓ Passed: Merged 3 case variations into 1 unique suggestion.");

  // --------------------------------------------------------
  // Test 6: Typo / Fuzzy Correction ('cybersecurty')
  // --------------------------------------------------------
  console.log("▶ Test 6: Typo correction suggestion ('cybersecurty')...");
  const sugTypo = await engine.getSuggestions("cybersecurty");
  assert.ok(sugTypo.some((s) => s.text === "cybersecurity" && s.category === "Did you mean?"));
  console.log("  ✓ Passed: Offered 'Did you mean: cybersecurity' for typo 'cybersecurty'.");

  // --------------------------------------------------------
  // Test 7: Cancellation Tracking
  // --------------------------------------------------------
  console.log("▶ Test 7: Keystroke cancellation tracking...");
  engine.setActiveRequest("req_keystroke_2");
  const cancelled = await engine.getSuggestions("cyber", null, { requestId: "req_keystroke_1" });
  assert.strictEqual(cancelled.length, 0);
  console.log("  ✓ Passed: Superseded keystroke request discarded safely.");

  // --------------------------------------------------------
  // Test 8: Cache Reuse
  // --------------------------------------------------------
  console.log("▶ Test 8: In-memory suggestion cache reuse...");
  engine.setActiveRequest("req_cache");
  const res1 = await engine.getSuggestions("network", null, { requestId: "req_cache", useCache: true });
  const res2 = await engine.getSuggestions("network", null, { requestId: "req_cache", useCache: true });
  assert.strictEqual(res1, res2);
  console.log("  ✓ Passed: Cached suggestion results reused seamlessly.");

  // --------------------------------------------------------
  // Test 9: High-Speed In-Memory Benchmark (1,000 keystrokes)
  // --------------------------------------------------------
  console.log("▶ Test 9: High-speed suggestion benchmark (1,000 keystrokes)...");
  const t0 = Date.now();
  for (let i = 0; i < 1000; i++) {
    await engine.getSuggestions(i % 2 === 0 ? "cyber" : "type:", null, { useCache: false });
  }
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 100, `1,000 suggestions must complete in <100ms (took ${elapsed}ms)`);
  console.log(`  ✓ Passed: Generated 1,000 suggestion batches in ${elapsed}ms.`);

  console.log("\n=================================================");
  console.log("🎉 ALL PART 24 SEARCH SUGGESTIONS TESTS PASSED (100% SUCCESS)");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
