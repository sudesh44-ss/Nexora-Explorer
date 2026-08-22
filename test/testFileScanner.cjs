"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const assert = require("assert");

const aiSearch = require("../electron/ai-search/index.cjs");
const { FileScanner } = aiSearch.discovery;
const { generateFileId } = aiSearch.discovery;
const { computeFileHash } = aiSearch.discovery;
const { detectMimeType } = aiSearch.discovery;
const { HashStrategy } = aiSearch.discovery;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING NEXORA AI SEARCH FILE SCANNER TEST SUITE");
  console.log("=================================================\n");

  const testRoot = path.join(os.tmpdir(), `nexora_test_scan_${Date.now()}`);
  await fsp.mkdir(testRoot, { recursive: true });

  try {
    // --------------------------------------------------------
    // Test 1: Empty Folder
    // --------------------------------------------------------
    console.log("▶ Test 1: Empty folder scanning...");
    const emptyDir = path.join(testRoot, "empty_dir");
    await fsp.mkdir(emptyDir, { recursive: true });

    const scanner1 = new FileScanner({ locations: [emptyDir] });
    const res1 = await scanner1.scan();
    assert.strictEqual(res1.files.length, 0, "Empty folder should discover 0 files");
    assert.strictEqual(res1.folders.length, 1, "Should discover 1 root folder");
    console.log("  ✓ Passed: Empty folder handled correctly.");

    // --------------------------------------------------------
    // Test 2: Single file & Multiple files in nested tree
    // --------------------------------------------------------
    console.log("▶ Test 2: Single and multiple files across nested folders...");
    const treeDir = path.join(testRoot, "tree_dir");
    const subDir1 = path.join(treeDir, "sub1");
    const subDir2 = path.join(subDir1, "sub2");
    await fsp.mkdir(subDir2, { recursive: true });

    await fsp.writeFile(path.join(treeDir, "root_file.txt"), "Hello Root File");
    await fsp.writeFile(path.join(subDir1, "doc1.pdf"), "%PDF-1.4 Mock PDF Content");
    await fsp.writeFile(path.join(subDir2, "deep.json"), JSON.stringify({ test: 123 }));

    const scanner2 = new FileScanner({ locations: [treeDir] });
    const res2 = await scanner2.scan();
    assert.strictEqual(res2.files.length, 3, "Should discover 3 files");
    assert.strictEqual(res2.folders.length, 3, "Should discover 3 folders");
    console.log("  ✓ Passed: Nested tree scanned accurately.");

    // --------------------------------------------------------
    // Test 3: Unicode Filenames, Folders, Spaces, and Special Characters
    // --------------------------------------------------------
    console.log("▶ Test 3: Unicode names, spaces, parentheses & special characters...");
    const unicodeDir = path.join(testRoot, "फ़ोल्डर フォルダ Spaces & (Tags)");
    await fsp.mkdir(unicodeDir, { recursive: true });

    const uniFile1 = path.join(unicodeDir, "दस्तावेज़ document #1 [v2.0].txt");
    const uniFile2 = path.join(unicodeDir, "写真 image 2 (final).jpg");
    await fsp.writeFile(uniFile1, "Unicode content text");
    await fsp.writeFile(uniFile2, "Fake JPG Data");

    const scanner3 = new FileScanner({ locations: [unicodeDir] });
    const res3 = await scanner3.scan();
    assert.strictEqual(res3.files.length, 2, "Should discover 2 unicode/special char files");
    assert.ok(res3.files.some(f => f.name.includes("दस्तावेज़")), "Should match Hindi unicode name");
    assert.ok(res3.files.some(f => f.name.includes("写真")), "Should match Japanese unicode name");
    console.log("  ✓ Passed: Unicode and special path characters preserved.");

    // --------------------------------------------------------
    // Test 4: Hidden Files Filter
    // --------------------------------------------------------
    console.log("▶ Test 4: Hidden file filtering...");
    const hiddenDir = path.join(testRoot, "hidden_test");
    await fsp.mkdir(hiddenDir, { recursive: true });
    await fsp.writeFile(path.join(hiddenDir, ".hidden_file.env"), "SECRET=123");
    await fsp.writeFile(path.join(hiddenDir, "visible_file.env"), "PUBLIC=456");

    // Scan with includeHidden = false
    const scanner4a = new FileScanner({ locations: [hiddenDir], includeHidden: false });
    const res4a = await scanner4a.scan();
    assert.strictEqual(res4a.files.length, 1, "Should only discover visible file");
    assert.strictEqual(res4a.files[0].name, "visible_file.env");

    // Scan with includeHidden = true
    const scanner4b = new FileScanner({ locations: [hiddenDir], includeHidden: true });
    const res4b = await scanner4b.scan();
    assert.strictEqual(res4b.files.length, 2, "Should discover both hidden and visible files");
    console.log("  ✓ Passed: Hidden files filter behaves according to configuration.");

    // --------------------------------------------------------
    // Test 5: Unsupported / Unknown Extensions & MIME Detection
    // --------------------------------------------------------
    console.log("▶ Test 5: Unsupported file types & MIME detection...");
    const extDir = path.join(testRoot, "ext_test");
    await fsp.mkdir(extDir, { recursive: true });
    await fsp.writeFile(path.join(extDir, "custom.unknown_ext_xyz"), "random data");
    await fsp.writeFile(path.join(extDir, "sample.pdf"), "pdf content");

    const scanner5 = new FileScanner({ locations: [extDir] });
    const res5 = await scanner5.scan();
    assert.strictEqual(res5.files.length, 2, "Must discover all files even if extension is unknown");
    const unknownRec = res5.files.find(f => f.name === "custom.unknown_ext_xyz");
    const pdfRec = res5.files.find(f => f.name === "sample.pdf");
    assert.strictEqual(unknownRec.mime_type, null, "Unknown extension should have null mime");
    assert.strictEqual(pdfRec.mime_type, "application/pdf", "PDF should have application/pdf mime");
    console.log("  ✓ Passed: Unsupported file types discovered with accurate MIME fallback.");

    // --------------------------------------------------------
    // Test 6: Stable File ID Generation & Content Hash Validation
    // --------------------------------------------------------
    console.log("▶ Test 6: File ID stability and hash strategies...");
    const hashDir = path.join(testRoot, "hash_test");
    await fsp.mkdir(hashDir, { recursive: true });
    const hashFile = path.join(hashDir, "data.txt");
    await fsp.writeFile(hashFile, "Deterministic Content 123456789");

    const stats = await fsp.stat(hashFile);
    const id1 = generateFileId(hashFile, stats);
    const id2 = generateFileId(hashFile, stats);
    assert.strictEqual(id1, id2, "File ID must be deterministic");
    assert.strictEqual(id1.length, 32, "File ID must be 32 hex chars");

    const fullHash = await computeFileHash(hashFile, stats.size, { hashStrategy: HashStrategy.FULL_STREAM });
    assert.ok(fullHash && fullHash.length === 64, "SHA-256 hash must be 64 hex chars");
    console.log(`  ✓ Passed: File ID (${id1}) & Hash (${fullHash.slice(0, 16)}...) generated cleanly.`);

    // --------------------------------------------------------
    // Test 7: Inaccessible / Missing Locations
    // --------------------------------------------------------
    console.log("▶ Test 7: Missing / inaccessible path handling without crashing...");
    const fakePath = path.join(testRoot, "non_existent_folder_987654");
    const scanner7 = new FileScanner({ locations: [fakePath, treeDir] });
    const res7 = await scanner7.scan();
    assert.strictEqual(res7.errors.length, 1, "Should record error for missing location");
    assert.strictEqual(res7.files.length, 3, "Should still successfully scan the valid tree");
    console.log("  ✓ Passed: Handled missing path gracefully with error emission.");

    // --------------------------------------------------------
    // Test 8: Cancellation Support
    // --------------------------------------------------------
    console.log("▶ Test 8: Scan cancellation responsiveness...");
    const cancelDir = path.join(testRoot, "cancel_test");
    await fsp.mkdir(cancelDir, { recursive: true });
    for (let i = 0; i < 50; i++) {
      await fsp.writeFile(path.join(cancelDir, `file_${i}.txt`), `Content ${i}`);
    }

    const scanner8 = new FileScanner({ locations: [cancelDir] });
    let cancelledEventFired = false;
    scanner8.on("cancelled", () => { cancelledEventFired = true; });

    const scanPromise = scanner8.scan();
    setTimeout(() => { scanner8.cancel(); }, 2);
    const res8 = await scanPromise;
    assert.strictEqual(res8.cancelled, true, "Scan result should mark cancelled: true");
    console.log("  ✓ Passed: Cancellation triggered and handled cleanly.");

    // --------------------------------------------------------
    // Test 9: Performance Benchmark on 1,000 Files
    // --------------------------------------------------------
    console.log("▶ Test 9: Performance benchmark with 1,000 files in deep tree...");
    const benchDir = path.join(testRoot, "bench_dir");
    await fsp.mkdir(benchDir, { recursive: true });

    const numFolders = 20;
    const filesPerFolder = 50; // Total 1,000 files
    for (let d = 0; d < numFolders; d++) {
      const folderPath = path.join(benchDir, `folder_${d}`);
      await fsp.mkdir(folderPath, { recursive: true });
      for (let f = 0; f < filesPerFolder; f++) {
        await fsp.writeFile(path.join(folderPath, `item_${f}.log`), `Log entry line ${f} in folder ${d}`);
      }
    }

    const tStart = Date.now();
    const benchScanner = new FileScanner({ locations: [benchDir], maxConcurrency: 24 });
    let progressCount = 0;
    benchScanner.on("progress", () => { progressCount++; });
    const benchRes = await benchScanner.scan();
    const tDuration = Date.now() - tStart;

    assert.strictEqual(benchRes.files.length, 1000, "Should discover all 1,000 files");
    assert.strictEqual(benchRes.folders.length, 21, "Should discover root + 20 folders");
    assert.strictEqual(benchRes.errors.length, 0, "Benchmark should have 0 errors");
    assert.ok(progressCount > 0, "Should emit progress events");

    console.log(`  ✓ Passed: 1,000 files discovered & hashed in ${tDuration}ms (${Math.round(1000 / (tDuration / 1000))} files/sec).`);

    console.log("\n=================================================");
    console.log("🎉 ALL PART 2 FILE SCANNER TESTS PASSED (100% SUCCESS)");
    console.log("=================================================");
  } finally {
    // Cleanup temporary test directory
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch(err => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
