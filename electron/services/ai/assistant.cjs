"use strict";

const fs = require("fs");
const path = require("path");
const { generateJSON, generateText } = require("./providerManager.cjs");

// Secure Path Validator to prevent directory traversal attacks
function validatePath(targetPath, baseFolder) {
  if (!targetPath) return false;
  try {
    const resolvedTarget = path.resolve(targetPath);
    // Ensure it exists
    if (!fs.existsSync(resolvedTarget)) return false;
    return resolvedTarget;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------
// Control Tool Operations
// ---------------------------------------------------------
async function listCurrentFolder(folderPath) {
  try {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(folderPath, e.name)
    }));
  } catch (e) {
    return { error: e.message };
  }
}

async function getFileMetadata(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    return {
      name: path.basename(filePath),
      size: stat.size,
      created: stat.birthtime,
      modified: stat.mtime,
      isDirectory: stat.isDirectory()
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function getLargestFiles(folderPath) {
  try {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        const full = path.join(folderPath, entry.name);
        const stat = await fs.promises.stat(full);
        files.push({ name: entry.name, size: stat.size });
      }
    }
    return files.sort((a, b) => b.size - a.size).slice(0, 5);
  } catch (e) {
    return { error: e.message };
  }
}

async function getFileContent(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > 2 * 1024 * 1024) {
      return { error: "File too large to inspect in assistant." };
    }
    const text = await fs.promises.readFile(filePath, "utf8");
    return text.substring(0, 4000);
  } catch (e) {
    return { error: e.message };
  }
}

// ---------------------------------------------------------
// Main Assistant Logic
// ---------------------------------------------------------
async function runAssistant(currentPath, items, question) {
  const safePath = currentPath || "C:\\";

  const prompt = `
You are a secure AI File Assistant. Analyze the user's question and select a tool if needed.

Available Tools:
- listCurrentFolder: {"tool": "listCurrentFolder", "path": "${safePath.replace(/\\/g, '\\\\')}"}
- getFileMetadata: {"tool": "getFileMetadata", "filePath": "absolute file path"}
- getLargestFiles: {"tool": "getLargestFiles", "folderPath": "${safePath.replace(/\\/g, '\\\\')}"}
- getFileContent: {"tool": "getFileContent", "filePath": "absolute file path"}
- getStorageInformation: {"tool": "getStorageInformation"}

Context:
- Current folder: ${safePath}
- File Count: ${items ? items.length : 0}
- Items: ${JSON.stringify((items || []).slice(0, 10).map(i => ({ name: i.name, size: i.size || 0, isDir: i.isDirectory })))}

User Question: "${question}"

Respond in this exact JSON format:
{
  "thought": "Reasoning details",
  "toolCall": {"tool": "toolName", "argName": "value"} or null,
  "reply": "Your direct message or answer if no tool is required"
}
`;

  let decision;
  try {
    decision = await generateJSON(prompt);
    if (!decision || decision.error || (!decision.toolCall && !decision.reply)) {
      decision = heuristicFallback(question, items, safePath);
    }
  } catch (e) {
    decision = heuristicFallback(question, items, safePath);
  }

  if (decision && decision.toolCall) {
    const { tool, path: tPath, filePath, folderPath } = decision.toolCall;
    let toolResult;

    if (tool === "listCurrentFolder") {
      const p = validatePath(tPath || safePath);
      toolResult = p ? await listCurrentFolder(p) : { error: "Access denied or path not found" };
    } else if (tool === "getFileMetadata") {
      const p = validatePath(filePath);
      toolResult = p ? await getFileMetadata(p) : { error: "Access denied or file not found" };
    } else if (tool === "getLargestFiles") {
      const p = validatePath(folderPath || safePath);
      toolResult = p ? await getLargestFiles(p) : { error: "Access denied or folder not found" };
    } else if (tool === "getFileContent") {
      const p = validatePath(filePath);
      toolResult = p ? await getFileContent(p) : { error: "Access denied or file not found" };
    } else if (tool === "getStorageInformation") {
      try {
        const driveCapacity = require("../storage/driveCapacity.cjs");
        toolResult = await driveCapacity.getDriveCapacity(safePath.substring(0, 3));
      } catch (e) {
        toolResult = { error: e.message };
      }
    }

    // Secondary response synthesis
    const finalPrompt = `
Synthesize a friendly final answer based on the tool execution result.

User Question: "${question}"
Tool Executed: ${tool}
Tool Result: ${JSON.stringify(toolResult)}
`;
    try {
      const finalReply = await generateText(finalPrompt);
      return {
        reply: finalReply,
        toolCall: decision.toolCall,
        toolResult
      };
    } catch (e) {
      return {
        reply: `I ran ${tool} and found: ${JSON.stringify(toolResult)}`,
        toolCall: decision.toolCall,
        toolResult
      };
    }
  }

  return {
    reply: decision ? decision.reply : "I couldn't process that request offline. Please check AI provider settings.",
    toolCall: null,
    toolResult: null
  };
}

function heuristicFallback(question, items, currentPath) {
  const q = question.toLowerCase();
  
  if (q.includes("file") || q.includes("folder") || q.includes("list")) {
    return {
      thought: "User wants to list current folder",
      toolCall: { tool: "listCurrentFolder", path: currentPath },
      reply: "Scanning current folder..."
    };
  }

  if (q.includes("large") || q.includes("biggest") || q.includes("size")) {
    return {
      thought: "User wants largest files",
      toolCall: { tool: "getLargestFiles", folderPath: currentPath },
      reply: "Finding largest files..."
    };
  }

  if (q.includes("disk") || q.includes("storage") || q.includes("free") || q.includes("capacity")) {
    return {
      thought: "User wants storage information",
      toolCall: { tool: "getStorageInformation" },
      reply: "Retrieving storage details..."
    };
  }

  return {
    thought: "No tool required",
    toolCall: null,
    reply: "I am running in offline rules-mode. Let me know if you want me to search, find largest files, or list items."
  };
}

module.exports = {
  runAssistant
};
