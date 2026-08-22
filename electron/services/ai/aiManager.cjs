"use strict";

const fs = require("fs");
const path = require("path");
const providerManager = require("./providerManager.cjs");
const categorization = require("./categorization.cjs");
const tagging = require("./tagging.cjs");
const vision = require("./vision.cjs");
const documentAI = require("./documentAI.cjs");

const os = require("os");
const appDataDir = path.join(os.homedir(), ".gemini", "antigravity");
const cachePath = path.join(appDataDir, "ai_cache.json");
const indexPath = path.join(appDataDir, "ai_index.json");

let cancelFlag = false;

function cancelBatch() {
  cancelFlag = true;
}

function loadJSON(filePath, defaultVal = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (e) {}
  return defaultVal;
}

function saveJSON(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
}

async function analyzeFilesBatch(itemsList, options = {}, eventSender = null) {
  cancelFlag = false;
  const cache = loadJSON(cachePath, {});
  const index = loadJSON(indexPath, []);

  const results = [];
  const total = itemsList.length;
  let current = 0;
  let completed = 0;
  let failed = 0;

  for (const item of itemsList) {
    if (cancelFlag) break;

    current++;
    const ext = path.extname(item.path).toLowerCase();
    
    // Safety check: Skip directories unless explicitly instructed (folders don't get direct content embeddings)
    if (item.isDirectory) {
      if (eventSender) {
        eventSender.send("ai:progress", { phase: "analysis", current, total, percent: Math.round((current / total) * 100), completed, failed });
      }
      continue;
    }

    let stat;
    try {
      stat = fs.statSync(item.path);
    } catch (e) {
      failed++;
      continue;
    }

    const modified = stat.mtime.toISOString();
    const size = stat.size;

    // 1. Check Cache
    const cacheKey = item.path;
    const cached = cache[cacheKey];
    if (cached && cached.size === size && cached.modified === modified) {
      completed++;
      results.push({ path: item.path, ...cached });
      if (eventSender) {
        eventSender.send("ai:progress", { phase: "analysis", current, total, percent: Math.round((current / total) * 100), completed, failed });
      }
      continue;
    }

    // 2. Perform analysis
    try {
      const extraContent = {
        ocrText: "",
        docText: "",
        visionDescription: ""
      };

      // OCR / Text extraction
      if (ext === ".pdf" || ext === ".txt" || ext === ".md") {
        extraContent.docText = await documentAI.analyzeDocument(item.path).then(res => res.summary);
      }

      // Check existing OCR text index
      try {
        const ocrService = require("../ocr/ocrService.cjs");
        const ocrIndexRes = await ocrService.getOcrIndex();
        if (ocrIndexRes.success) {
          const match = ocrIndexRes.index.find(doc => doc.filePath === item.path);
          if (match) extraContent.ocrText = match.text;
        }
      } catch (e) {}

      // Vision image understanding
      if (ext.match(/\.(jpg|jpeg|png|webp)$/i)) {
        const vRes = await vision.analyzeImage(item.path);
        extraContent.visionDescription = vRes.description;
      }

      // Categorize
      const catRes = await categorization.categorizeFile({ name: item.name, path: item.path, size, modified }, extraContent);
      
      // Tagging
      const tagRes = await tagging.generateTags({ name: item.name, path: item.path, size, modified }, extraContent);

      // Embeddings for Semantic Search
      const vectorPayload = `${item.name} category: ${catRes.category} tags: ${tagRes.tags.join(" ")} ${extraContent.docText} ${extraContent.ocrText}`;
      const embeddingsVec = await providerManager.generateEmbeddings(vectorPayload);

      const analysisResult = {
        size,
        modified,
        category: catRes.category,
        confidence: catRes.confidence,
        reason: catRes.reason,
        tags: tagRes.tags,
        summary: extraContent.docText || extraContent.visionDescription || "No text description.",
        embeddings: embeddingsVec
      };

      // Store in Cache
      cache[cacheKey] = analysisResult;
      
      // Store in Index List
      const idxEntry = {
        filePath: item.path,
        isDirectory: false,
        size,
        modified,
        embeddings: embeddingsVec,
        category: catRes.category,
        tags: tagRes.tags,
        summary: analysisResult.summary
      };

      const existingIdx = index.findIndex(e => e.filePath === item.path);
      if (existingIdx !== -1) {
        index[existingIdx] = idxEntry;
      } else {
        index.push(idxEntry);
      }

      results.push({ path: item.path, ...analysisResult });
      completed++;
    } catch (err) {
      failed++;
    }

    if (eventSender) {
      eventSender.send("ai:progress", { phase: "analysis", current, total, percent: Math.round((current / total) * 100), completed, failed });
    }

    // Yield loop
    await new Promise(resolve => setImmediate(resolve));
  }

  // Save database states
  saveJSON(cachePath, cache);
  saveJSON(indexPath, index);

  return results;
}

function getAnalysis(filePath) {
  const cache = loadJSON(cachePath, {});
  return cache[filePath] || null;
}

function saveTags(filePath, tags) {
  const cache = loadJSON(cachePath, {});
  const index = loadJSON(indexPath, []);

  if (cache[filePath]) {
    cache[filePath].tags = tags;
    saveJSON(cachePath, cache);
  }

  const idxEntry = index.find(e => e.filePath === filePath);
  if (idxEntry) {
    idxEntry.tags = tags;
    saveJSON(indexPath, index);
  }

  return { success: true };
}

function getIndexStatus() {
  const index = loadJSON(indexPath, []);
  return {
    indexedCount: index.length,
    dbPath: indexPath
  };
}

function rebuildIndex() {
  saveJSON(cachePath, {});
  saveJSON(indexPath, []);
  return { success: true };
}

module.exports = {
  analyzeFilesBatch,
  getAnalysis,
  saveTags,
  getIndexStatus,
  rebuildIndex,
  cancelBatch
};
