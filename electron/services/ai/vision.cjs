"use strict";

const { generateImageUnderstanding } = require("./providerManager.cjs");

async function analyzeImage(imagePath) {
  const prompt = `
Analyze this image and describe:
1. What is the scene/setting?
2. What are the key objects detected?
3. What are the main concepts/concepts (e.g. workspace, nature, outdoor)?

Return your response as JSON in this format:
{
  "description": "Short overall description of the image",
  "objects": ["object1", "object2"],
  "scene": "General setting",
  "concepts": ["concept1", "concept2"],
  "confidence": 0.0 to 1.0
}
`;

  try {
    const res = await generateImageUnderstanding(imagePath, prompt);
    // If the provider returns JSON, check fields
    if (res && res.description) {
      return res;
    }
  } catch (e) {}

  // Local fallback description
  const path = require("path");
  const filename = path.basename(imagePath);
  return {
    description: `Local vision description for ${filename}. Connect cloud/vision AI for real visual detection.`,
    objects: ["Unknown Objects"],
    scene: "Unknown Scene",
    concepts: ["offline"],
    confidence: 0.5
  };
}

module.exports = {
  analyzeImage
};
