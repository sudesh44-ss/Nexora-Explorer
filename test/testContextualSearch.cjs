"use strict";

const assert = require("assert");
const aiSearch = require("../electron/ai-search/index.cjs");
const {
  SearchContext,
  ContextResolver,
  QueryRefiner,
  QueryState,
  ContextValidator,
  ContextNormalizer,
} = aiSearch.context;

const { QueryUnderstanding } = aiSearch.query;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA CONTEXTUAL SEARCH TEST SUITE");
  console.log("=================================================\n");

  const qu = new QueryUnderstanding();
  const context = new SearchContext({ queryUnderstanding: qu });

  // --------------------------------------------------------
  // Test 1: Conversational Refinement Chain
  // --------------------------------------------------------
  console.log("▶ Test 1: Multi-turn conversational query refinement chain...");
  context.clear();
  const turn1 = context.pushQuery("cybersecurity");
  assert.ok(turn1.structuredQuery.keywords.includes("cybersecurity"));

  const turn2 = context.pushQuery("type:video");
  assert.ok(turn2.structuredQuery.keywords.includes("cybersecurity"));
  assert.ok(turn2.structuredQuery.fileTypes.includes("video"));

  const turn3 = context.pushQuery("from 2025");
  assert.ok(turn3.structuredQuery.keywords.includes("cybersecurity"));
  assert.ok(turn3.structuredQuery.fileTypes.includes("video"));
  assert.ok(turn3.structuredQuery.dateFilter !== null);

  const turn4 = context.pushQuery("firewall");
  assert.ok(turn4.structuredQuery.keywords.includes("cybersecurity"));
  assert.ok(turn4.structuredQuery.keywords.includes("firewall"));
  console.log("  ✓ Passed: 4-turn contextual refinement chain preserved keywords, modality, and date constraints.");

  // --------------------------------------------------------
  // Test 2: Explicit New Search (Reset Context)
  // --------------------------------------------------------
  console.log("▶ Test 2: Explicit new search ('now search python')...");
  const turnNew = context.pushQuery("now search python");
  assert.strictEqual(turnNew.structuredQuery.keywords.length, 1);
  assert.strictEqual(turnNew.structuredQuery.keywords[0], "python");
  assert.strictEqual(turnNew.structuredQuery.fileTypes.length, 0, "Old video type must be purged");
  console.log("  ✓ Passed: Explicit new search purged prior context without leaks.");

  // --------------------------------------------------------
  // Test 3: Modality Replacement ('same but audio')
  // --------------------------------------------------------
  console.log("▶ Test 3: Modality replacement ('same but audio')...");
  context.clear();
  context.pushQuery("cybersecurity type:video");
  const turnMod = context.pushQuery("same but type:audio");
  assert.ok(turnMod.structuredQuery.keywords.includes("cybersecurity"));
  assert.ok(turnMod.structuredQuery.fileTypes.includes("audio"));
  assert.strictEqual(turnMod.structuredQuery.fileTypes.includes("video"), false);
  console.log("  ✓ Passed: Modality replaced from video to audio cleanly.");

  // --------------------------------------------------------
  // Test 4: Filter & Modality Removal ('remove videos', 'remove size')
  // --------------------------------------------------------
  console.log("▶ Test 4: Constraint removals ('remove videos', 'remove size')...");
  context.clear();
  context.pushQuery("cybersecurity type:video size:>500MB");
  const turnRemType = context.pushQuery("remove videos");
  assert.strictEqual(turnRemType.structuredQuery.fileTypes.length, 0, "Video type must be removed");
  assert.ok(turnRemType.structuredQuery.sizeFilter !== null, "Size filter must remain");

  const turnRemSize = context.pushQuery("remove size");
  assert.strictEqual(turnRemSize.structuredQuery.sizeFilter, null, "Size filter must be removed");
  assert.ok(turnRemSize.structuredQuery.keywords.includes("cybersecurity"));
  console.log("  ✓ Passed: Selectively removed modality and size constraints while keeping search terms.");

  // --------------------------------------------------------
  // Test 5: Contradiction Handling (duration > 1hr then < 10min)
  // --------------------------------------------------------
  console.log("▶ Test 5: Contradictory duration filter detection...");
  context.clear();
  context.pushQuery("cybersecurity duration:>1hour");
  const turnContradiction = context.pushQuery("duration:<10min");
  assert.strictEqual(turnContradiction.resolvedState.contradiction, true);
  assert.ok(turnContradiction.resolvedState.contradictionReason.includes("conflict"));
  console.log("  ✓ Passed: Detected impossible duration constraint conflict safely.");

  // --------------------------------------------------------
  // Test 6: History Stack & Back Navigation
  // --------------------------------------------------------
  console.log("▶ Test 6: History stack & Back navigation (popQuery)...");
  context.clear();
  context.pushQuery("python");
  context.pushQuery("type:pdf");
  assert.strictEqual(context.activeState.fileTypes.includes("pdf"), true);

  context.popQuery();
  assert.strictEqual(context.activeState.keywords[0], "python");
  assert.strictEqual(context.activeState.fileTypes.length, 0);
  console.log("  ✓ Passed: PopQuery restored prior search state in the session.");

  // --------------------------------------------------------
  // Test 7: Context Reset ('clear')
  // --------------------------------------------------------
  console.log("▶ Test 7: Session context reset ('clear')...");
  context.pushQuery("machine learning notes");
  context.clear();
  assert.strictEqual(context.activeState.rawQuery, "");
  assert.strictEqual(context.activeState.keywords.length, 0);
  console.log("  ✓ Passed: Clear reset active state and history completely.");

  // --------------------------------------------------------
  // Test 8: Malformed State Sanitization
  // --------------------------------------------------------
  console.log("▶ Test 8: Malformed context sanitization & injection safety...");
  const sanitized = ContextValidator.sanitize({
    rawQuery: null,
    keywords: [123, null, "safe_keyword"],
    durationFilter: "invalid_string",
    sort: 456,
  });
  assert.strictEqual(sanitized.rawQuery, "");
  assert.strictEqual(sanitized.keywords.length, 1);
  assert.strictEqual(sanitized.keywords[0], "safe_keyword");
  assert.strictEqual(sanitized.durationFilter, null);
  assert.strictEqual(sanitized.sort, null);
  console.log("  ✓ Passed: Malformed objects safely sanitized without throwing.");

  // --------------------------------------------------------
  // Test 9: In-Memory Performance Benchmark (1,000 context turns)
  // --------------------------------------------------------
  console.log("▶ Test 9: High-speed in-memory context resolution (1,000 turns)...");
  context.clear();
  const t0 = Date.now();
  for (let i = 0; i < 1000; i++) {
    context.pushQuery(i % 2 === 0 ? "cybersecurity" : "type:video");
  }
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 100, `1,000 context resolutions must complete in <100ms (took ${elapsed}ms)`);
  console.log(`  ✓ Passed: Processed 1,000 context turns in ${elapsed}ms.`);

  console.log("\n=================================================");
  console.log("🎉 ALL PART 23 CONTEXTUAL SEARCH TESTS PASSED (100% SUCCESS)");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
