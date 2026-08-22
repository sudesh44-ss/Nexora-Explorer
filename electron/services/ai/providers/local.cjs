"use strict";

const path = require("path");
const fs = require("fs");

async function checkAvailability() {
  return {
    available: true,
    provider: "local",
    model: "local-rules",
    capabilities: ["text", "json", "vision-rules", "embeddings-rules"]
  };
}

async function generateText(prompt, systemInstruction = "") {
  const p = prompt.toLowerCase();
  
  // Categorization prompts
  if (p.includes("categorize the following file")) {
    return JSON.stringify({
      category: p.includes(".pdf") || p.includes(".txt") || p.includes(".doc") ? "Documents" :
                p.includes(".jpg") || p.includes(".png") ? "Photos" :
                p.includes(".mp4") || p.includes(".mkv") ? "Videos" :
                p.includes("invoice") ? "Invoices" :
                p.includes("receipt") ? "Receipts" :
                p.includes("bill") ? "Bills" : "Personal",
      confidence: 0.85,
      reason: "Matched extension/name keyword offline"
    });
  }

  // Smart tag prompts
  if (p.includes("generate 3 to 6 highly relevant concept tags")) {
    return JSON.stringify({
      tags: ["local", "files", "indexed"],
      confidence: 0.9
    });
  }

  return `Local offline model response for: ${prompt}`;
}

async function generateJSON(prompt, schema) {
  const text = await generateText(prompt);
  try {
    return JSON.parse(text);
  } catch (e) {
    return { error: "Failed to parse local rules response as JSON" };
  }
}

async function generateImageUnderstanding(imagePath, prompt) {
  const filename = path.basename(imagePath).toLowerCase();
  
  let scene = "Unknown Scene";
  let objects = [];
  let concepts = [];
  
  if (filename.includes("screenshot")) {
    scene = "Desktop/Software Screenshot";
    objects = ["UI Elements", "Text", "Windows"];
    concepts = ["ui", "workspace", "computer"];
  } else if (filename.includes("img") || filename.includes("dsc") || filename.includes("photo")) {
    scene = "Photographic Scene";
    objects = ["Landscape", "People/Objects"];
    concepts = ["photography", "outdoor", "camera"];
  }

  return {
    description: `Offline description of ${filename} based on filename metadata.`,
    objects,
    scene,
    concepts,
    confidence: 0.7
  };
}

function generateEmbeddings(text) {
  const vec = new Array(128).fill(0);
  const clean = String(text || "").toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    vec[code % 128] += 1;
  }
  let sumSq = 0;
  for (let i = 0; i < 128; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < 128; i++) {
    vec[i] /= norm;
  }
  return vec;
}

module.exports = {
  checkAvailability,
  generateText,
  generateJSON,
  generateImageUnderstanding,
  generateEmbeddings
};
