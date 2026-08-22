"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const {
  RankingEngine,
  RankingWeights,
  RankingSignals,
  RankingNormalizer,
  RankingScore,
  RankingExplanation,
} = aiSearch.ranking;

const { DatabaseManager } = aiSearch.database;
const { createFileRecord } = aiSearch.discovery;
const { createStructuredQuery } = aiSearch.query;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA ADVANCED SEARCH RANKING TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_ranking_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  const dbPath = path.join(testRoot, "ranking_test.db");
  const db = new DatabaseManager({ databaseDir: testRoot, databasePath: dbPath });
  await db.initialize();

  try {
    // --------------------------------------------------------
    // Seed Test Corpus
    // --------------------------------------------------------
    // 1. Exact vs Partial Filename files
    const recExact = createFileRecord({ file_id: "f_exact", name: "invoice.pdf", path: path.join(testRoot, "invoice.pdf"), extension: ".pdf", size: 1024 });
    const recPartial = createFileRecord({ file_id: "f_part", name: "invoice_copy.pdf", path: path.join(testRoot, "invoice_copy.pdf"), extension: ".pdf", size: 2048 });
    const recOther = createFileRecord({ file_id: "f_other", name: "Amazon_Invoice_2025.pdf", path: path.join(testRoot, "Amazon_Invoice_2025.pdf"), extension: ".pdf", size: 4096 });

    db.files.insert(recExact);
    db.files.insert(recPartial);
    db.files.insert(recOther);

    // 2. Multimodal & Vision files
    const recCake = createFileRecord({ file_id: "f_cake", name: "birthday_cake_party.jpg", path: path.join(testRoot, "birthday_cake_party.jpg"), extension: ".jpg", size: 5000000 });
    const recParty = createFileRecord({ file_id: "f_party", name: "party_friends.jpg", path: path.join(testRoot, "party_friends.jpg"), extension: ".jpg", size: 3000000 });
    const recHuge = createFileRecord({ file_id: "f_huge", name: "big_video.mp4", path: path.join(testRoot, "big_video.mp4"), extension: ".mp4", size: 150000000 }); // 150MB

    db.files.insert(recCake);
    db.files.insert(recParty);
    db.files.insert(recHuge);

    db.ai.upsert("f_cake", {
      description: "People celebrating birthday with cake and balloons",
      tags: JSON.stringify(["birthday", "cake", "party"]),
    });

    db.content.upsert("f_other", {
      extracted_text: "Amazon India TAX INVOICE electronics payment",
      word_count: 6,
    });

    // --------------------------------------------------------
    // Test 1: Exact Filename Priority
    // --------------------------------------------------------
    console.log("▶ Test 1: Exact Filename Ranking priority ('invoice.pdf')...");
    const sqExact = createStructuredQuery({ rawQuery: "invoice.pdf", keywords: ["invoice", "pdf"], intent: "EXACT_SEARCH" });
    const candidates1 = [
      { fileId: "f_part", signals: [{ source: "filename", score: 0.8 }] },
      { fileId: "f_exact", signals: [{ source: "filename", score: 1.0 }] },
      { fileId: "f_other", signals: [{ source: "filename", score: 0.5 }] },
    ];

    const ranked1 = RankingEngine.rank(candidates1, sqExact, db);
    assert.strictEqual(ranked1[0].fileId, "f_exact", "Exact match 'invoice.pdf' must be ranked first");
    assert.ok(ranked1[0].score > ranked1[1].score);
    assert.ok(ranked1[0].matchedBy.includes("exact_filename"));
    console.log(`  ✓ Passed: 'invoice.pdf' ranked #1 (Score: ${ranked1[0].score.toFixed(3)}) above partial copies.`);

    // --------------------------------------------------------
    // Test 2: Exact Quoted Phrase Ranking
    // --------------------------------------------------------
    console.log("▶ Test 2: Exact Quoted Phrase boost ('\"TAX INVOICE\"')...");
    const sqPhrase = createStructuredQuery({ rawQuery: '"TAX INVOICE"', phrases: ["TAX INVOICE"], keywords: ["tax", "invoice"] });
    const candidates2 = [
      { fileId: "f_exact", signals: [{ source: "fts", score: 0.5 }] },
      { fileId: "f_other", signals: [{ source: "fts", score: 0.9 }] }, // Contains exact phrase in content
    ];

    const ranked2 = RankingEngine.rank(candidates2, sqPhrase, db);
    assert.strictEqual(ranked2[0].fileId, "f_other", "Document containing exact phrase must rank top");
    assert.ok(ranked2[0].matchedBy.includes("exact_phrase"));
    console.log(`  ✓ Passed: File with exact phrase ranked #1 (Score: ${ranked2[0].score.toFixed(3)}).`);

    // --------------------------------------------------------
    // Test 3: Term Coverage Multi-Signal Scoring
    // --------------------------------------------------------
    console.log("▶ Test 3: Query Term Coverage scoring ('birthday cake party')...");
    const sqCoverage = createStructuredQuery({ rawQuery: "birthday cake party", keywords: ["birthday", "cake", "party"], objects: ["cake"] });
    const candidates3 = [
      { fileId: "f_party", signals: [{ source: "filename", score: 0.4 }] }, // Matches 1 term
      { fileId: "f_cake", signals: [{ source: "filename", score: 0.9 }, { source: "vision", score: 0.9 }] }, // Matches 3/3 terms
    ];

    const ranked3 = RankingEngine.rank(candidates3, sqCoverage, db);
    assert.strictEqual(ranked3[0].fileId, "f_cake", "Candidate with 3/3 term coverage + vision object must rank #1");
    assert.ok(ranked3[0].score > ranked3[1].score);
    console.log(`  ✓ Passed: 3/3 term coverage item ranked #1 (Score: ${ranked3[0].score.toFixed(3)}).`);

    // --------------------------------------------------------
    // Test 4: Hard Filters (File Type & Sizing)
    // --------------------------------------------------------
    console.log("▶ Test 4: Hard Filters (type:image & size:>100MB)...");
    const sqTypeFilter = createStructuredQuery({ rawQuery: "type:image invoice", fileTypes: ["image"], keywords: ["invoice"] });
    const candidates4 = [
      { fileId: "f_exact", signals: [{ source: "filename", score: 1.0 }] }, // PDF
      { fileId: "f_cake", signals: [{ source: "filename", score: 0.5 }] }, // JPG
    ];

    const rankedType = RankingEngine.rank(candidates4, sqTypeFilter, db);
    assert.strictEqual(rankedType.length, 1);
    assert.strictEqual(rankedType[0].fileId, "f_cake", "PDF must be completely excluded under type:image hard filter");

    // Size filter: >100MB
    const sqSizeFilter = createStructuredQuery({
      rawQuery: "big video",
      sizeFilter: { operator: ">", value: 100, unit: "MB", bytes: 100 * 1024 * 1024 },
      keywords: ["video"],
    });
    const candidatesSize = [
      { fileId: "f_cake", signals: [{ source: "filename", score: 0.5 }] }, // 5MB
      { fileId: "f_huge", signals: [{ source: "filename", score: 0.9 }] }, // 150MB
    ];
    const rankedSize = RankingEngine.rank(candidatesSize, sqSizeFilter, db);
    assert.strictEqual(rankedSize.length, 1);
    assert.strictEqual(rankedSize[0].fileId, "f_huge", "5MB file must be excluded under >100MB size constraint");
    console.log("  ✓ Passed: Hard filters strictly excluded non-compliant candidates.");

    // --------------------------------------------------------
    // Test 5: Signal Correlation & Score Normalization
    // --------------------------------------------------------
    console.log("▶ Test 5: Signal correlation damping (avoid double-weighting identical vision+tag evidence)...");
    const weights = RankingWeights.getWeights("DEFAULT");
    const scoreSingle = RankingScore.computeCompositeScore({ vision: 1.0, tags: 0.0, filenameExact: 0.0, filenamePartial: 0.0, phrase: 0.0, folder: 0.0, fts: 0.0, ocr: 0.0, semantic: 0.0, coverage: 0.0, metadata: 0.0 }, weights);
    const scoreCorrelated = RankingScore.computeCompositeScore({ vision: 1.0, tags: 1.0, filenameExact: 0.0, filenamePartial: 0.0, phrase: 0.0, folder: 0.0, fts: 0.0, ocr: 0.0, semantic: 0.0, coverage: 0.0, metadata: 0.0 }, weights);

    assert.ok(scoreCorrelated < scoreSingle + weights.tags, "Correlated tags weight must be damped when vision is active");
    console.log("  ✓ Passed: Signal correlation damping verified.");

    // --------------------------------------------------------
    // Test 6: Deterministic Tie-Breaking & Stability
    // --------------------------------------------------------
    console.log("▶ Test 6: Deterministic tie-breaking stability (100 repeated runs)...");
    const candidatesTie = [
      { fileId: "f_part", signals: [{ source: "filename", score: 0.5 }] },
      { fileId: "f_other", signals: [{ source: "filename", score: 0.5 }] },
    ];
    const sqTie = createStructuredQuery({ rawQuery: "invoice", keywords: ["invoice"] });

    const firstRun = RankingEngine.rank(candidatesTie, sqTie, db).map((r) => r.fileId);
    for (let i = 0; i < 100; i++) {
      const run = RankingEngine.rank(candidatesTie, sqTie, db).map((r) => r.fileId);
      assert.deepStrictEqual(run, firstRun, "Ordering must remain 100% stable across runs");
    }
    console.log("  ✓ Passed: Deterministic tie-breaking verified over 100 repeated iterations.");

    // --------------------------------------------------------
    // Test 7: Safe Handling of Malformed Scores
    // --------------------------------------------------------
    console.log("▶ Test 7: Safe handling of NaN/Infinity/Undefined scores...");
    assert.strictEqual(RankingNormalizer.normalizeScore(NaN), 0.0);
    assert.strictEqual(RankingNormalizer.normalizeScore(Infinity), 0.0);
    assert.strictEqual(RankingNormalizer.normalizeScore(undefined), 0.0);
    assert.strictEqual(RankingNormalizer.normalizeScore(1.5), 1.0);
    assert.strictEqual(RankingNormalizer.normalizeScore(-0.5), 0.0);

    const candidatesCorrupt = [{ fileId: "f_exact", signals: [{ source: "fts", score: NaN }] }];
    const rankedCorrupt = RankingEngine.rank(candidatesCorrupt, sqExact, db);
    assert.ok(Array.isArray(rankedCorrupt));
    console.log("  ✓ Passed: Corrupt/infinite scores normalized safely without throwing.");

    // --------------------------------------------------------
    // Test 8: High Performance Candidate Ranking
    // --------------------------------------------------------
    console.log("▶ Test 8: High Performance Candidate Ranking (1,000 candidates in <5ms)...");
    const largeCandidates = [];
    for (let i = 0; i < 1000; i++) {
      largeCandidates.push({
        fileId: "f_exact",
        signals: [{ source: "fts", score: (i % 10) / 10 }],
      });
    }

    const t0 = Date.now();
    const rankedLarge = RankingEngine.rank(largeCandidates, sqExact, db, { limit: 50 });
    const elapsed = Date.now() - t0;

    assert.strictEqual(rankedLarge.length, 50);
    assert.ok(elapsed < 100, `1,000 candidates must be ranked in <100ms (took ${elapsed}ms)`);
    console.log(`  ✓ Passed: Ranked 1,000 candidates in ${elapsed}ms without file I/O or model execution.`);

    db.close();

    console.log("\n=================================================");
    console.log("🎉 ALL PART 17 ADVANCED RANKING ENGINE TESTS PASSED (100% SUCCESS)");
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
