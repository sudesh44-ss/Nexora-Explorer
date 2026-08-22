"use strict";

const { generateJSON } = require("./providerManager.cjs");

const CATEGORIES = [
  "Documents", "Bills", "Invoices", "Receipts", "Photos", "Screenshots",
  "IDs / Documents", "Videos", "Music", "Projects", "Code", "Personal", "Work"
];

async function categorizeFile(fileInfo, extraContent = {}) {
  const prompt = `
Categorize the following file into exactly one of these categories: ${CATEGORIES.join(", ")}.

File Details:
- Name: ${fileInfo.name}
- Path: ${fileInfo.path}
- Size: ${fileInfo.size} bytes
- Mtime: ${fileInfo.modified}
- MIME type: ${fileInfo.mimeType || "unknown"}
${extraContent.ocrText ? `- OCR Text: ${extraContent.ocrText.substring(0, 1000)}` : ""}
${extraContent.docText ? `- Document Text: ${extraContent.docText.substring(0, 1000)}` : ""}
${extraContent.visionDescription ? `- Image Description: ${extraContent.visionDescription}` : ""}

Output your response as JSON in this format:
{
  "category": "One of the listed categories",
  "confidence": 0.0 to 1.0,
  "reason": "Detailed reason why this file belongs to the category"
}
`;

  try {
    const res = await generateJSON(prompt);
    if (res && res.category && CATEGORIES.includes(res.category)) {
      return {
        category: res.category,
        confidence: res.confidence || 0.8,
        reason: res.reason || "Successfully categorized by AI"
      };
    }
  } catch (e) {}

  // Fallback to local heuristic checks
  const name = fileInfo.name.toLowerCase();
  let category = "Personal";
  let reason = "Fallback rule match";
  
  if (name.includes("invoice")) {
    category = "Invoices";
  } else if (name.includes("receipt")) {
    category = "Receipts";
  } else if (name.includes("bill") || name.includes("statement")) {
    category = "Bills";
  } else if (name.includes("screenshot")) {
    category = "Screenshots";
  } else if (name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
    category = "Photos";
  } else if (name.match(/\.(mp4|mkv|mov|avi|wmv)$/i)) {
    category = "Videos";
  } else if (name.match(/\.(mp3|wav|flac|m4a|ogg)$/i)) {
    category = "Music";
  } else if (name.match(/\.(js|ts|py|c|cpp|cs|go|java|html|css|json|yaml|yml|sh|bat)$/i)) {
    category = "Code";
  } else if (name.match(/\.(pdf|docx|txt|md|xlsx|pptx)$/i)) {
    category = "Documents";
  }

  return {
    category,
    confidence: 0.7,
    reason
  };
}

module.exports = {
  categorizeFile
};
