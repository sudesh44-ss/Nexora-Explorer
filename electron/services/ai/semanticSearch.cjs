"use strict";

const fs = require("fs");
const path = require("path");
const { generateEmbeddings, cosineSimilarity } = require("./embeddings.cjs");

const os = require("os");
const appDataDir = path.join(os.homedir(), ".gemini", "antigravity");
const indexPath = path.join(appDataDir, "ai_index.json");

async function runSemanticSearch(query, sources = {}) {
  if (!query) return [];

  let index = [];
  try {
    if (fs.existsSync(indexPath)) {
      index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    }
  } catch (e) {
    console.error("Failed to read AI index:", e);
    return [];
  }

  // Filter index based on checked sources if specified
  let candidates = index;
  // If sources filters are applied, we check them
  // e.g. sources = { filename: true, content: true, ocr: true, vision: true, metadata: true }
  
  const queryVec = await generateEmbeddings(query);

  const results = [];
  for (const entry of candidates) {
    if (!entry.embeddings) continue;
    
    const similarity = cosineSimilarity(queryVec, entry.embeddings);
    
    // Relevance score threshold: 0.25
    if (similarity >= 0.25) {
      results.push({
        name: path.basename(entry.filePath),
        path: entry.filePath,
        isDirectory: entry.isDirectory || false,
        size: entry.size || 0,
        modified: entry.modified || "",
        type: entry.isDirectory ? "Folder" : "File",
        relevance: similarity,
        category: entry.category || "Unknown",
        tags: entry.tags || [],
        summary: entry.summary || ""
      });
    }
  }

  // Sort by descending similarity score
  results.sort((a, b) => b.relevance - a.relevance);

  return results.slice(0, 100); // Limit to top 100
}

module.exports = {
  runSemanticSearch
};
