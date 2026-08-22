"use strict";

const assert = require("assert");
const aiSearch = require("../electron/ai-search/index.cjs");

const {
  QueryUnderstanding,
  QueryNormalizer,
  IntentDetector,
  FileTypeDetector,
  ConceptExtractor,
  DateResolver,
  FolderHintDetector,
  SemanticQueryBuilder,
  QueryValidator,
  QueryIntent,
  LLMQueryAdapter,
  QueryErrorCode,
} = aiSearch.query;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH QUERY UNDERSTANDING TEST SUITE");
  console.log("=================================================\n");

  const qu = new QueryUnderstanding();

  // --------------------------------------------------------
  // Test 1: Simple Keyword Query
  // --------------------------------------------------------
  console.log("▶ Test 1: Simple keyword query 'cybersecurity'...");
  const res1 = qu.understand("cybersecurity");
  assert.deepStrictEqual(res1.concepts, ["cybersecurity"]);
  assert.deepStrictEqual(res1.fileTypes, []);
  assert.strictEqual(res1.intent, QueryIntent.SEARCH_FILES);
  assert.strictEqual(res1.semanticQuery, "cybersecurity");
  console.log("  ✓ Passed: Simple keyword parsed accurately.");

  // --------------------------------------------------------
  // Test 2: Explicit Single File-Type Query
  // --------------------------------------------------------
  console.log("▶ Test 2: Query with explicit type 'cybersecurity pdf'...");
  const res2 = qu.understand("cybersecurity pdf");
  assert.deepStrictEqual(res2.concepts, ["cybersecurity"]);
  assert.deepStrictEqual(res2.fileTypes, ["pdf"]);
  assert.strictEqual(res2.semanticQuery, "cybersecurity documents");
  console.log("  ✓ Passed: PDF type extracted and semantic contextual string built.");

  // --------------------------------------------------------
  // Test 3: Multi-Type Query ("birthday photos and videos")
  // --------------------------------------------------------
  console.log("▶ Test 3: Multi-type query 'birthday photos and videos'...");
  const res3 = qu.understand("birthday photos and videos");
  assert.deepStrictEqual(res3.concepts, ["birthday"]);
  assert.ok(res3.fileTypes.includes("image") && res3.fileTypes.includes("video"));
  assert.strictEqual(res3.fileTypes.length, 2, "Must extract both IMAGE and VIDEO types");
  console.log("  ✓ Passed: Multi-type extracted (image + video).");

  // --------------------------------------------------------
  // Test 4: Folder Intent & Hint Extraction ("college folder")
  // --------------------------------------------------------
  console.log("▶ Test 4: Folder search intent 'college folder'...");
  const res4 = qu.understand("college folder");
  assert.strictEqual(res4.intent, QueryIntent.SEARCH_FOLDERS);
  assert.deepStrictEqual(res4.folderHints, ["college"]);
  console.log("  ✓ Passed: Intent classified as SEARCH_FOLDERS with folder hint 'college'.");

  // --------------------------------------------------------
  // Test 5: Ambiguous Query ("college")
  // --------------------------------------------------------
  console.log("▶ Test 5: Ambiguous query 'college' (least-assumptive handling)...");
  const res5 = qu.understand("college");
  assert.deepStrictEqual(res5.concepts, ["college"]);
  assert.strictEqual(res5.fileTypes.length, 0, "Do NOT force a file type");
  assert.strictEqual(res5.intent, QueryIntent.SEARCH_FILES, "Do NOT force folder-only intent");
  console.log("  ✓ Passed: Ambiguous query preserved conservatively without over-filtering.");

  // --------------------------------------------------------
  // Test 6: Relative Date Resolution ("last year birthday photos")
  // --------------------------------------------------------
  console.log("▶ Test 6: Relative date resolution 'last year birthday photos'...");
  const res6 = qu.understand("last year birthday photos");
  assert.deepStrictEqual(res6.concepts, ["birthday"]);
  assert.deepStrictEqual(res6.fileTypes, ["image"]);
  assert.ok(res6.dateFilter, "DateFilter must be populated");
  assert.strictEqual(res6.dateFilter.operator, "between");
  assert.ok(res6.dateFilter.start && res6.dateFilter.end);
  console.log(`  ✓ Passed: Date range resolved (${res6.dateFilter.start.slice(0, 10)} to ${res6.dateFilter.end.slice(0, 10)}).`);

  // --------------------------------------------------------
  // Test 7: Multilingual Conversational Phrasing ("meri pichle saal ki photos do")
  // --------------------------------------------------------
  console.log("▶ Test 7: Conversational Hinglish query 'meri pichle saal ki birthday wali photos do'...");
  const res7 = qu.understand("meri pichle saal ki birthday wali photos do");
  assert.deepStrictEqual(res7.concepts, ["birthday"]);
  assert.deepStrictEqual(res7.fileTypes, ["image"]);
  assert.ok(res7.dateFilter);
  console.log("  ✓ Passed: Conversational stop words stripped; core concept 'birthday' extracted.");

  // --------------------------------------------------------
  // Test 8: Empty & Whitespace Queries
  // --------------------------------------------------------
  console.log("▶ Test 8: Empty and whitespace queries...");
  const emptyRes = qu.understand("   ");
  assert.strictEqual(emptyRes.normalizedQuery, "");
  assert.strictEqual(emptyRes.concepts.length, 0);
  console.log("  ✓ Passed: Empty query handled safely.");

  // --------------------------------------------------------
  // Test 9: Schema Validation & Malformed Output Rejection
  // --------------------------------------------------------
  console.log("▶ Test 9: Strict Schema validation & error handling...");
  const invalidQuery = {
    intent: "INVALID_INTENT_NAME",
    concepts: ["test"],
  };

  const validation = QueryValidator.validate(invalidQuery);
  assert.strictEqual(validation.valid, false);
  assert.ok(validation.errors.length >= 1);

  let threwError = false;
  try {
    QueryValidator.assertValid(invalidQuery);
  } catch (err) {
    if (err.code === QueryErrorCode.INVALID_QUERY_SCHEMA) {
      threwError = true;
    }
  }
  assert.strictEqual(threwError, true);
  console.log("  ✓ Passed: Invalid schema rejected with structured error.");

  // --------------------------------------------------------
  // Test 10: Bridge to Part 9 SearchQuery Contract
  // --------------------------------------------------------
  console.log("▶ Test 10: Bridge to Part 9 SearchQuery contract...");
  const bridged = qu.toSearchQuery("Mere college ki cybersecurity wali PDFs do");
  assert.ok(bridged.keywords.includes("college") && bridged.keywords.includes("cybersecurity"));
  assert.deepStrictEqual(bridged.filters.fileTypes, ["pdf"]);
  assert.ok(bridged.semanticQuery.includes("college cybersecurity"));
  assert.strictEqual(bridged.limit, 20);
  console.log("  ✓ Passed: Bridged cleanly to Part 9 SearchQuery format.");

  console.log("\n=================================================");
  console.log("🎉 ALL PART 10 QUERY UNDERSTANDING TESTS PASSED (100% SUCCESS)");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
