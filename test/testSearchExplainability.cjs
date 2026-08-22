"use strict";

const assert = require("assert");
const aiSearch = require("../electron/ai-search/index.cjs");
const {
  SearchExplanation,
  EvidenceCollector,
  ExplanationBuilder,
  RankingTrace,
} = aiSearch.explainability;

const { createSearchResult } = aiSearch.discovery;
const { QueryUnderstanding } = aiSearch.query;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA SEARCH EXPLAINABILITY TEST SUITE");
  console.log("=================================================\n");

  const qu = new QueryUnderstanding();

  // --------------------------------------------------------
  // Test 1: Basic Filename & Semantic Evidence
  // --------------------------------------------------------
  console.log("▶ Test 1: Basic filename & semantic evidence explanation...");
  const sqCyber = qu.understand("cybersecurity");
  const resDoc = {
    fileId: "doc_1",
    name: "Cybersecurity_Handbook.pdf",
    path: "C:/Docs/Cybersecurity_Handbook.pdf",
    score: 0.92,
    matchedBy: ["filename", "semantic"],
    scoreBreakdown: {
      filenameScore: 0.95,
      semanticScore: 0.88,
      modality: "document",
    },
  };

  const explainedDoc = SearchExplanation.explainResults([resDoc], sqCyber)[0];
  assert.ok(explainedDoc.explanation !== null);
  assert.ok(explainedDoc.explanation.bullets.some((b) => b.includes("File name matches")));
  assert.ok(explainedDoc.explanation.bullets.some((b) => b.includes("Semantically related")));
  console.log("  ✓ Passed: User-facing bullets accurately described filename and semantic matches.");

  // --------------------------------------------------------
  // Test 2: Exact Phrase Match Evidence ('"network security"')
  // --------------------------------------------------------
  console.log("▶ Test 2: Exact phrase match evidence ('\"network security\"')...");
  const sqPhrase = qu.understand('"network security"');
  const resPhrase = {
    fileId: "doc_2",
    name: "notes.txt",
    score: 0.98,
    matchedBy: ["exact_phrase"],
    scoreBreakdown: {
      phraseScore: 1.0,
      modality: "document",
    },
  };

  const explainedPhrase = SearchExplanation.explainResults([resPhrase], sqPhrase)[0];
  assert.ok(explainedPhrase.explanation.bullets.some((b) => b.includes("Exact phrase matched")));
  console.log("  ✓ Passed: Identified exact phrase evidence accurately.");

  // --------------------------------------------------------
  // Test 3: Video Transcript Match with Timestamp
  // --------------------------------------------------------
  console.log("▶ Test 3: Video transcript match and timestamp extraction...");
  const resVid = {
    fileId: "vid_1",
    name: "Lecture_01.mp4",
    score: 0.94,
    matchedBy: ["transcript"],
    scoreBreakdown: {
      transcriptScore: 0.95,
      bestMatchTimestamp: "14:22",
      modality: "video",
    },
  };

  const explainedVid = SearchExplanation.explainResults([resVid], sqCyber)[0];
  assert.strictEqual(explainedVid.explanation.bestMatchTimestamp, "14:22");
  assert.ok(explainedVid.explanation.bullets.some((b) => b.includes("Transcript contains")));
  console.log(`  ✓ Passed: Transcript evidence matched with timestamp ${explainedVid.explanation.bestMatchTimestamp}.`);

  // --------------------------------------------------------
  // Test 4: Image OCR & Visual Object Detection
  // --------------------------------------------------------
  console.log("▶ Test 4: Image OCR and visual object detection evidence...");
  const resImg = {
    fileId: "img_1",
    name: "diagram.png",
    score: 0.89,
    matchedBy: ["ocr", "vision"],
    scoreBreakdown: {
      ocrScore: 0.90,
      objectScore: 0.85,
      modality: "image",
    },
  };

  const explainedImg = SearchExplanation.explainResults([resImg], sqCyber)[0];
  assert.ok(explainedImg.explanation.bullets.some((b) => b.includes("Detected text") || b.includes("Visual object")));
  console.log("  ✓ Passed: OCR and visual object evidence explained cleanly.");

  // --------------------------------------------------------
  // Test 5: Developer Ranking Trace ('debug: true')
  // --------------------------------------------------------
  console.log("▶ Test 5: Developer ranking trace generation...");
  const explainedTrace = SearchExplanation.explainResults([resVid], sqCyber, null, { debug: true })[0];
  assert.ok(explainedTrace._trace !== null);
  assert.strictEqual(explainedTrace._trace.candidateId, "vid_1");
  assert.strictEqual(explainedTrace._trace.rank, 1);
  assert.strictEqual(explainedTrace._trace.finalScore, 0.94);
  assert.strictEqual(explainedTrace._trace.signals.transcriptScore, 0.95);
  console.log("  ✓ Passed: Complete developer ranking trace generated with signal scores.");

  // --------------------------------------------------------
  // Test 6: Zero-Result Explanation
  // --------------------------------------------------------
  console.log("▶ Test 6: Zero-result filter diagnostics explanation...");
  const sqFilteredZero = {
    rawQuery: "cybersecurity",
    fileTypes: ["video"],
    durationFilter: { operator: ">", seconds: 3600 },
  };

  const zeroReport = SearchExplanation.explainZeroResults(sqFilteredZero);
  assert.strictEqual(zeroReport.zeroResults, true);
  assert.ok(zeroReport.reason.includes("duration constraint"));
  console.log(`  ✓ Passed: Zero-result report explained active filter cause: "${zeroReport.reason}".`);

  // --------------------------------------------------------
  // Test 7: Error Isolation & Fault Tolerance
  // --------------------------------------------------------
  console.log("▶ Test 7: Error isolation on corrupted result object...");
  const corruptResults = [{ invalid: true }];
  const safeExplained = SearchExplanation.explainResults(corruptResults, sqCyber);
  assert.strictEqual(safeExplained.length, 1);
  console.log("  ✓ Passed: Search results survived corrupted explainability inputs.");

  // --------------------------------------------------------
  // Test 8: High-Speed In-Memory Benchmark (1,000 results)
  // --------------------------------------------------------
  console.log("▶ Test 8: High-speed explainability benchmark (1,000 results)...");
  const batch1000 = [];
  for (let i = 0; i < 1000; i++) {
    batch1000.push({ ...resVid, fileId: `res_${i}` });
  }

  const t0 = Date.now();
  const benchmarked = SearchExplanation.explainResults(batch1000, sqCyber, null, { debug: true });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 100, `1,000 result explanations must complete in <100ms (took ${elapsed}ms)`);
  assert.strictEqual(benchmarked.length, 1000);
  console.log(`  ✓ Passed: Explained and traced 1,000 search results in ${elapsed}ms.`);

  console.log("\n=================================================");
  console.log("🎉 ALL PART 25 SEARCH EXPLAINABILITY TESTS PASSED (100% SUCCESS)");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
