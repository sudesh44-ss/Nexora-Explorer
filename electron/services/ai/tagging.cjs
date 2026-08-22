"use strict";

const { generateJSON } = require("./providerManager.cjs");

async function generateTags(fileInfo, extraContent = {}) {
  const prompt = `
Generate 3 to 6 highly relevant concept tags (lowercase keywords starting with #, e.g. #nature, #invoice, #finance) based on this file details:

File Details:
- Name: ${fileInfo.name}
- Path: ${fileInfo.path}
- Size: ${fileInfo.size} bytes
${extraContent.ocrText ? `- OCR Text: ${extraContent.ocrText.substring(0, 500)}` : ""}
${extraContent.docText ? `- Document Text: ${extraContent.docText.substring(0, 500)}` : ""}
${extraContent.visionDescription ? `- Visual Scene: ${extraContent.visionDescription}` : ""}

Output your response as JSON in this format:
{
  "tags": ["#tag1", "#tag2", "#tag3"],
  "confidence": 0.0 to 1.0
}
`;

  try {
    const res = await generateJSON(prompt);
    if (res && Array.isArray(res.tags)) {
      return {
        tags: res.tags.map(t => t.startsWith("#") ? t : `#${t}`),
        confidence: res.confidence || 0.8
      };
    }
  } catch (e) {}

  // Local fallback tagging rules
  const name = fileInfo.name.toLowerCase();
  const tags = [];
  
  if (name.includes("invoice")) tags.push("#finance", "#invoice", "#payment");
  else if (name.includes("receipt")) tags.push("#receipt", "#finance", "#expense");
  else if (name.includes("bill")) tags.push("#bill", "#utility", "#finance");
  else if (name.includes("screenshot")) tags.push("#screenshot", "#desktop");
  else if (name.match(/\.(jpg|jpeg|png|webp)$/i)) tags.push("#photo", "#image");
  else if (name.match(/\.(mp4|mkv)$/i)) tags.push("#video", "#media");
  else if (name.match(/\.(mp3|wav)$/i)) tags.push("#audio", "#music");
  else if (name.match(/\.(js|ts|py|cpp|html|json)$/i)) tags.push("#code", "#developer");
  else tags.push("#file", "#local");

  return {
    tags,
    confidence: 0.6
  };
}

module.exports = {
  generateTags
};
