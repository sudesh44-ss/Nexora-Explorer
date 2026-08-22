"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const pdfParse = require("pdf-parse");
const { generateJSON, generateText } = require("./providerManager.cjs");

async function extractDocumentText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    try {
      const buffer = await fsp.readFile(filePath);
      const data = await pdfParse(buffer);
      return data.text || "";
    } catch (e) {
      console.error("PDF parse error, fallback to blank:", e);
      return "";
    }
  }

  if (ext === ".txt" || ext === ".md" || ext === ".json" || ext === ".html") {
    try {
      return await fsp.readFile(filePath, "utf8");
    } catch (e) {
      return "";
    }
  }

  return "";
}

async function analyzeDocument(filePath) {
  const text = await extractDocumentText(filePath);
  const cleanText = text.trim();
  
  if (!cleanText) {
    return {
      documentType: "Unknown",
      date: null,
      amount: null,
      organization: null,
      person: null,
      referenceNumber: null,
      importantEntities: [],
      summary: "Could not extract text. Check OCR status.",
      keyPoints: ["No text available"]
    };
  }

  // Generate Structured Info
  const prompt = `
Extract the following information from the document text. Return null or "unknown" for fields not found.

Document Text (Sample):
${cleanText.substring(0, 3000)}

Output your response as JSON in this format:
{
  "documentType": "Invoice / Receipt / Resume / Bank Statement / Bill / Contract / Other",
  "date": "Extracted date or null",
  "amount": "Extracted amount/value or null",
  "organization": "Extracted company/organization or null",
  "person": "Extracted person name or null",
  "referenceNumber": "Invoice/Ref number or null",
  "importantEntities": ["entity1", "entity2"],
  "summary": "Short document summary",
  "keyPoints": ["Key point 1", "Key point 2"]
}
`;

  try {
    const res = await generateJSON(prompt);
    if (res && res.documentType) {
      return res;
    }
  } catch (e) {}

  // Local fallback heuristics
  const lower = cleanText.toLowerCase();
  let documentType = "Other";
  if (lower.includes("invoice")) documentType = "Invoice";
  else if (lower.includes("receipt")) documentType = "Receipt";
  else if (lower.includes("resume") || lower.includes("curriculum vitae")) documentType = "Resume";
  else if (lower.includes("bank statement")) documentType = "Bank Statement";
  else if (lower.includes("bill") || lower.includes("statement")) documentType = "Bill";
  else if (lower.includes("contract") || lower.includes("agreement")) documentType = "Contract";

  return {
    documentType,
    date: "unknown",
    amount: "unknown",
    organization: "unknown",
    person: "unknown",
    referenceNumber: "unknown",
    importantEntities: [],
    summary: "Analyzed offline via heuristic fallback.",
    keyPoints: ["Offline scan - please connect AI provider for full summary"]
  };
}

async function summarizeDocument(filePath) {
  const text = await extractDocumentText(filePath);
  const clean = text.trim();
  if (!clean) return "No readable text found in document to summarize.";

  // Handle chunking if text exceeds 10,000 characters
  if (clean.length <= 10000) {
    const prompt = `Summarize this text in 3 sentences, capturing key details:\n\n${clean}`;
    try {
      return await generateText(prompt);
    } catch (e) {
      return "Offline summary fallback: Text found but generation failed.";
    }
  }

  // Chunking
  const chunks = [];
  const chunkSize = 8000;
  for (let i = 0; i < clean.length; i += chunkSize) {
    chunks.push(clean.substring(i, i + chunkSize));
  }

  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkPrompt = `Summarize this part ${i + 1} of ${chunks.length}:\n\n${chunks[i]}`;
    try {
      const s = await generateText(chunkPrompt);
      chunkSummaries.push(s);
    } catch (e) {
      chunkSummaries.push("");
    }
  }

  const combinedPrompt = `Combine these chunk summaries into a single cohesive summary:\n\n${chunkSummaries.join("\n\n")}`;
  try {
    return await generateText(combinedPrompt);
  } catch (e) {
    return chunkSummaries.filter(Boolean).join(" ");
  }
}

module.exports = {
  analyzeDocument,
  summarizeDocument
};
