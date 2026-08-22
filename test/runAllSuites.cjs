"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const testDir = __dirname;
const files = fs.readdirSync(testDir).filter(f => f.startsWith("test") && f.endsWith(".cjs") && f !== "runAllSuites.cjs");

console.log("=================================================");
console.log(`🚀 RUNNING ALL ${files.length} NEXORA TEST SUITES`);
console.log("=================================================\n");

let passed = 0;
let failed = 0;
const failures = [];

for (const file of files) {
  process.stdout.write(`▶ Running ${file}... `);
  const start = Date.now();
  const res = spawnSync("node", [path.join(testDir, file)], {
    stdio: "pipe",
    encoding: "utf-8",
    timeout: 120000,
  });

  const duration = Date.now() - start;
  if (res.status === 0) {
    console.log(`✅ PASSED (${duration}ms)`);
    passed++;
  } else {
    console.log(`❌ FAILED (${duration}ms)`);
    failed++;
    failures.push({ file, output: res.stdout + "\n" + res.stderr });
  }
}

console.log("\n=================================================");
console.log(`TEST SUMMARY: ${passed}/${files.length} SUITES PASSED (${failed} FAILED)`);
console.log("=================================================");

if (failed > 0) {
  console.log("\nFAILURES DETAIL:");
  for (const f of failures) {
    console.log(`\n--- ${f.file} ---`);
    console.log(f.output);
  }
  process.exit(1);
} else {
  console.log("\n✨ ALL SUITES PASSED WITH 100% SUCCESS!");
  process.exit(0);
}
