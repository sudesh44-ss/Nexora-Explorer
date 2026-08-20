"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { spawn, execFile } = require("child_process");
const os = require("os");
const crypto = require("crypto");
const { clipboard, shell } = require("electron");
const hiddenFiles = require("./hiddenFiles.cjs");

// ============================================================
// 1. Terminal Service
// ============================================================
async function openTerminal(folderOrFilePath, terminalType) {
  if (!folderOrFilePath) {
    return { success: false, error: "Path is required." };
  }

  let targetPath = path.normalize(folderOrFilePath);
  try {
    const stat = await fsp.stat(targetPath);
    if (!stat.isDirectory()) {
      targetPath = path.dirname(targetPath);
    }
  } catch (err) {
    return { success: false, error: "Target path does not exist." };
  }

  const shellType = terminalType || "PowerShell";

  if (process.platform === "win32") {
    if (shellType === "Windows Terminal") {
      return new Promise((resolve) => {
        const wtProcess = spawn("wt.exe", ["-d", targetPath], {
          detached: true,
          stdio: "ignore"
        });
        wtProcess.unref();

        wtProcess.on("error", (err) => {
          console.warn("Windows Terminal fallback to PowerShell due to error:", err.message);
          const psProcess = spawn("cmd.exe", ["/c", "start", "powershell.exe"], {
            cwd: targetPath,
            detached: true,
            stdio: "ignore"
          });
          psProcess.unref();
        });
        resolve({ success: true });
      });
    } else if (shellType === "CMD") {
      spawn("cmd.exe", ["/c", "start", "cmd.exe"], {
        cwd: targetPath,
        detached: true,
        stdio: "ignore"
      }).unref();
      return { success: true };
    } else { // PowerShell
      spawn("cmd.exe", ["/c", "start", "powershell.exe"], {
        cwd: targetPath,
        detached: true,
        stdio: "ignore"
      }).unref();
      return { success: true };
    }
  } else if (process.platform === "darwin") {
    spawn("open", ["-a", "Terminal", targetPath], {
      detached: true,
      stdio: "ignore"
    }).unref();
    return { success: true };
  } else { // Linux
    spawn("x-terminal-emulator", [], {
      cwd: targetPath,
      detached: true,
      stdio: "ignore"
    }).unref();
    return { success: true };
  }
}

// ============================================================
// 2. Git Service
// ============================================================
function runGitCmd(args, cwd) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: stderr?.trim() || error.message });
      } else {
        resolve({ success: true, stdout: stdout.trim() });
      }
    });
  });
}

async function isGitInstalled() {
  const result = await runGitCmd(["--version"]);
  return result.success;
}

async function gitStatus(folderPath) {
  const hasGit = await isGitInstalled();
  if (!hasGit) {
    return { success: true, isGitInstalled: false, isRepo: false };
  }

  const cleanPath = path.normalize(folderPath);
  const isRepo = await runGitCmd(["rev-parse", "--is-inside-work-tree"], cleanPath);
  if (!isRepo.success || isRepo.stdout !== "true") {
    return { success: true, isGitInstalled: true, isRepo: false };
  }

  const statusRes = await runGitCmd(["status", "--porcelain"], cleanPath);
  if (!statusRes.success) {
    return { success: false, error: statusRes.error };
  }

  const files = [];
  const lines = statusRes.stdout.split(/\r?\n/).filter(Boolean);
  
  let modifiedCount = 0;
  let stagedCount = 0;
  let untrackedCount = 0;
  let deletedCount = 0;

  for (const line of lines) {
    const x = line[0];
    const y = line[1];
    const filePath = line.substring(3);

    let type = "untracked";
    let statusStr = "Untracked";

    if (x === "?" && y === "?") {
      type = "untracked";
      statusStr = "Untracked";
      untrackedCount++;
    } else if (y === "D" || x === "D") {
      type = "deleted";
      statusStr = "Deleted";
      deletedCount++;
    } else if (x !== " " && y === " ") {
      type = "staged";
      statusStr = "Staged";
      stagedCount++;
    } else {
      type = "modified";
      statusStr = "Modified";
      modifiedCount++;
    }

    files.push({
      name: filePath,
      status: statusStr,
      type
    });
  }

  // Get current branch
  const branchRes = await runGitCmd(["branch", "--show-current"], cleanPath);
  let branchName = "HEAD detached";
  if (branchRes.success && branchRes.stdout) {
    branchName = branchRes.stdout;
  } else {
    const revRes = await runGitCmd(["rev-parse", "--abbrev-ref", "HEAD"], cleanPath);
    if (revRes.success && revRes.stdout) {
      branchName = revRes.stdout;
    }
  }

  return {
    success: true,
    isGitInstalled: true,
    isRepo: true,
    branch: branchName,
    files,
    summary: {
      modified: modifiedCount,
      staged: stagedCount,
      untracked: untrackedCount,
      deleted: deletedCount
    }
  };
}

async function gitInfo(folderPath) {
  const hasGit = await isGitInstalled();
  if (!hasGit) {
    return { success: true, isGitInstalled: false, isRepo: false };
  }

  const cleanPath = path.normalize(folderPath);
  const isRepo = await runGitCmd(["rev-parse", "--is-inside-work-tree"], cleanPath);
  if (!isRepo.success || isRepo.stdout !== "true") {
    return { success: true, isGitInstalled: true, isRepo: false };
  }

  const commitRes = await runGitCmd(["log", "-1", "--format=%H%n%an%n%ad%n%s", "--date=short"], cleanPath);
  
  let commitInfo = null;
  if (commitRes.success && commitRes.stdout) {
    const lines = commitRes.stdout.split("\n");
    commitInfo = {
      hash: lines[0] || "",
      author: lines[1] || "",
      date: lines[2] || "",
      message: lines[3] || ""
    };
  }

  const branchesRes = await runGitCmd(["branch", "--format=%(refname:short)"], cleanPath);
  const branches = branchesRes.success && branchesRes.stdout
    ? branchesRes.stdout.split(/\r?\n/).filter(Boolean)
    : [];

  return {
    success: true,
    isGitInstalled: true,
    isRepo: true,
    latestCommit: commitInfo,
    branches
  };
}

// ============================================================
// 3. Encoding / Decoding Utilities
// ============================================================
async function encodeData(input, algorithm, isFilePath) {
  try {
    let rawBuffer;
    if (isFilePath) {
      if (!fs.existsSync(input)) {
        return { success: false, error: "Input file does not exist." };
      }
      rawBuffer = await fsp.readFile(input);
    } else {
      rawBuffer = Buffer.from(input, "utf8");
    }

    let output = "";
    const algo = algorithm.toLowerCase();

    if (algo === "utf8" || algo === "utf-8") {
      output = rawBuffer.toString("utf8");
    } else if (algo === "base64") {
      output = rawBuffer.toString("base64");
    } else if (algo === "hex") {
      output = rawBuffer.toString("hex");
    } else if (algo === "url") {
      output = encodeURIComponent(rawBuffer.toString("utf8"));
    } else if (algo === "ascii") {
      output = rawBuffer.toString("ascii");
    } else {
      return { success: false, error: `Unsupported encoding algorithm: ${algorithm}` };
    }

    return { success: true, output };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function decodeData(input, algorithm, isFilePath) {
  try {
    let rawInput = input;
    if (isFilePath) {
      if (!fs.existsSync(input)) {
        return { success: false, error: "Input file does not exist." };
      }
      rawInput = await fsp.readFile(input, "utf8");
    }

    let decodedBuffer;
    const algo = algorithm.toLowerCase();

    if (algo === "utf8" || algo === "utf-8") {
      decodedBuffer = Buffer.from(rawInput, "utf8");
    } else if (algo === "base64") {
      const cleanB64 = rawInput.replace(/\s+/g, "");
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanB64) || cleanB64.length % 4 !== 0) {
        return { success: false, error: "Invalid Base64 input string." };
      }
      decodedBuffer = Buffer.from(cleanB64, "base64");
    } else if (algo === "hex") {
      const cleanHex = rawInput.replace(/\s+/g, "");
      if (!/^[0-9a-fA-F]*$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
        return { success: false, error: "Invalid Hex input string (must contain even number of hex characters)." };
      }
      decodedBuffer = Buffer.from(cleanHex, "hex");
    } else if (algo === "url") {
      const decodedStr = decodeURIComponent(rawInput);
      decodedBuffer = Buffer.from(decodedStr, "utf8");
    } else if (algo === "ascii") {
      decodedBuffer = Buffer.from(rawInput, "ascii");
    } else {
      return { success: false, error: `Unsupported decoding algorithm: ${algorithm}` };
    }

    return { success: true, output: decodedBuffer.toString("utf8") };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 4. Hex Viewer Service
// ============================================================
async function readHexChunk(filePath, offset, limit) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File does not exist." };
    }
    const stat = await fsp.stat(filePath);
    const size = stat.size;

    const startOffset = Math.max(0, Number(offset) || 0);
    const limitBytes = Math.max(16, Number(limit) || 256);

    if (startOffset >= size) {
      return { success: true, data: { size, offset: startOffset, limit: limitBytes, lines: [], hasMore: false } };
    }

    const readLen = Math.min(limitBytes, size - startOffset);
    const buffer = Buffer.alloc(readLen);
    
    const fd = await fsp.open(filePath, "r");
    try {
      await fd.read(buffer, 0, readLen, startOffset);
    } finally {
      await fd.close();
    }

    const lines = [];
    for (let i = 0; i < readLen; i += 16) {
      const lineOffset = startOffset + i;
      const lineBuffer = buffer.slice(i, Math.min(i + 16, readLen));
      
      const offsetHex = lineOffset.toString(16).toUpperCase().padStart(8, "0");

      const hexBytes = [];
      for (let j = 0; j < 16; j++) {
        if (j < lineBuffer.length) {
          hexBytes.push(lineBuffer[j].toString(16).toUpperCase().padStart(2, "0"));
        } else {
          hexBytes.push("  ");
        }
      }
      const hexStr = hexBytes.join(" ");

      const asciiChars = [];
      for (let j = 0; j < lineBuffer.length; j++) {
        const byte = lineBuffer[j];
        if (byte >= 32 && byte <= 126) {
          asciiChars.push(String.fromCharCode(byte));
        } else {
          asciiChars.push(".");
        }
      }
      const asciiStr = asciiChars.join("");

      lines.push({
        offset: offsetHex,
        hex: hexStr,
        ascii: asciiStr
      });
    }

    return {
      success: true,
      data: {
        size,
        offset: startOffset,
        limit: limitBytes,
        lines,
        hasMore: startOffset + readLen < size
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 5. JSON Tool Service
// ============================================================
async function jsonParse(jsonText, filePath) {
  try {
    let content = jsonText;
    if (filePath) {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: "File does not exist." };
      }
      content = await fsp.readFile(filePath, "utf8");
    }

    if (!content || !content.trim()) {
      return { success: false, error: "JSON content is empty." };
    }

    const parsedObj = JSON.parse(content);
    return { success: true, data: parsedObj, text: content };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function jsonFormat(jsonText, mode) {
  try {
    if (!jsonText || !jsonText.trim()) {
      return { success: false, error: "JSON text is empty." };
    }
    const obj = JSON.parse(jsonText);
    const output = mode === "minified"
      ? JSON.stringify(obj)
      : JSON.stringify(obj, null, 2);

    return { success: true, output };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function jsonSave(filePath, jsonText) {
  try {
    if (!filePath) {
      return { success: false, error: "File path is required for saving." };
    }
    JSON.parse(jsonText);
    await fsp.writeFile(filePath, jsonText, "utf8");
    return { success: true, message: "JSON file saved successfully." };
  } catch (err) {
    return { success: false, error: `Invalid JSON format: ${err.message}. Save aborted.` };
  }
}

// ============================================================
// 6. Code Preview Service
// ============================================================
async function getCodePreview(filePath, maxLines = 1000, maxBytes = 100 * 1024) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File does not exist." };
    }
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      return { success: false, error: "Directories cannot be previewed as source code." };
    }

    const readSize = Math.min(stat.size, maxBytes);
    const fd = await fsp.open(filePath, "r");
    const buffer = Buffer.alloc(readSize);
    try {
      await fd.read(buffer, 0, readSize, 0);
    } finally {
      await fd.close();
    }

    let encoding = "UTF-8";
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      encoding = "UTF-8 BOM";
    } else if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      encoding = "UTF-16 LE";
    } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      encoding = "UTF-16 BE";
    }

    let content = "";
    if (encoding.startsWith("UTF-16")) {
      content = buffer.toString("utf16le");
    } else {
      content = buffer.toString("utf8");
    }

    const isBinary = content.includes("\u0000");
    if (isBinary) {
      return { success: false, error: "File appears to be binary, cannot preview as code." };
    }

    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;
    let truncated = false;
    let previewLines = lines;
    
    if (lines.length > maxLines) {
      previewLines = lines.slice(0, maxLines);
      truncated = true;
    }

    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
      ".js": "javascript",
      ".cjs": "javascript",
      ".mjs": "javascript",
      ".jsx": "jsx",
      ".ts": "typescript",
      ".tsx": "tsx",
      ".json": "json",
      ".html": "html",
      ".htm": "html",
      ".css": "css",
      ".py": "python",
      ".java": "java",
      ".c": "c",
      ".h": "c",
      ".cpp": "cpp",
      ".hpp": "cpp",
      ".cs": "csharp",
      ".php": "php",
      ".sql": "sql",
      ".md": "markdown",
      ".yaml": "yaml",
      ".yml": "yaml",
      ".xml": "xml",
      ".sh": "bash",
      ".ps1": "powershell",
      ".bat": "batch",
      ".cmd": "batch"
    };
    const language = langMap[ext] || "plaintext";

    return {
      success: true,
      data: {
        content: previewLines.join("\n"),
        language,
        encoding,
        totalLines,
        truncated,
        fileSize: stat.size
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 7. File Hashing & Comparison
// ============================================================
function calculateFileHash(filePath, algorithm = "sha256") {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      return resolve({ success: false, error: "File does not exist." });
    }

    let algoName = String(algorithm).toLowerCase().replace("-", "");
    let hash;
    try {
      hash = crypto.createHash(algoName);
    } catch (e) {
      return resolve({ success: false, error: `Unsupported algorithm: ${algorithm}` });
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    stream.on("data", (chunk) => {
      hash.update(chunk);
    });

    stream.on("end", async () => {
      try {
        const stat = await fsp.stat(filePath);
        resolve({
          success: true,
          hash: hash.digest("hex"),
          size: stat.size,
          algorithm: algoName
        });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  });
}

async function compareFileHashes(firstPath, secondPath, algorithm = "sha256") {
  const res1 = await calculateFileHash(firstPath, algorithm);
  const res2 = await calculateFileHash(secondPath, algorithm);

  if (!res1.success) return { success: false, error: `File 1 Error: ${res1.error}` };
  if (!res2.success) return { success: false, error: `File 2 Error: ${res2.error}` };

  return {
    success: true,
    identical: res1.hash === res2.hash,
    firstHash: res1.hash,
    secondHash: res2.hash,
    firstSize: res1.size,
    secondSize: res2.size,
    algorithm
  };
}

// ============================================================
// 8. File Metadata Service
// ============================================================
async function getImageMetadata(filePath) {
  const fd = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(24);
    await fd.read(buffer, 0, 24, 0);

    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
        buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
      const width = buffer.readInt32BE(16);
      const height = buffer.readInt32BE(20);
      return { width, height, mime: "image/png" };
    }

    // JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      const { size } = await fd.stat();
      let offset = 2;
      while (offset < size) {
        const markerBuf = Buffer.alloc(4);
        const { bytesRead } = await fd.read(markerBuf, 0, 4, offset);
        if (bytesRead < 4) break;
        
        if (markerBuf[0] !== 0xff) break;

        const marker = markerBuf[1];
        const length = markerBuf.readUInt16BE(2);

        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const sofBuf = Buffer.alloc(5);
          await fd.read(sofBuf, 0, 5, offset + 4);
          const height = sofBuf.readUInt16BE(1);
          const width = sofBuf.readUInt16BE(3);
          return { width, height, mime: "image/jpeg" };
        }
        offset += 2 + length;
      }
      return { mime: "image/jpeg" };
    }

    // GIF
    if ((buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
         (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61)) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      return { width, height, mime: "image/gif" };
    }

    // BMP
    if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      const width = buffer.readInt32LE(18);
      const height = Math.abs(buffer.readInt32LE(22));
      return { width, height, mime: "image/bmp" };
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    };
    return { mime: mimeTypes[ext] || "application/octet-stream" };
  } catch (err) {
    console.error("Failed to read image dimensions:", err.message);
    return { mime: "application/octet-stream" };
  } finally {
    await fd.close();
  }
}

async function getFileMetadata(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File does not exist." };
    }
    const stat = await fsp.stat(filePath);
    
    // Hidden status check
    const isWindows = process.platform === "win32";
    let winAttrs = { hidden: false, system: false, readonly: false, archive: false };
    if (isWindows) {
      try {
        const status = await hiddenFiles.getHiddenStatus(filePath);
        if (status.success) {
          winAttrs = {
            hidden: status.hidden,
            system: status.system,
            readonly: status.readonly,
            archive: status.archive
          };
        }
      } catch (e) {
        console.warn("Failed to retrieve Windows attributes:", e.message);
      }
    } else {
      winAttrs.hidden = path.basename(filePath).startsWith(".");
    }

    // Image-specific check
    let imageInfo = null;
    const ext = path.extname(filePath).toLowerCase();
    const isImage = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".ico"].includes(ext);
    if (isImage && stat.isFile()) {
      imageInfo = await getImageMetadata(filePath);
    }

    let fileType = "File";
    if (stat.isDirectory()) fileType = "Folder";
    else if (stat.isSymbolicLink()) fileType = "Symbolic Link";

    return {
      success: true,
      data: {
        name: path.basename(filePath),
        fullPath: path.resolve(filePath),
        extension: stat.isDirectory() ? "" : ext,
        size: stat.size,
        created: stat.birthtime,
        modified: stat.mtime,
        accessed: stat.atime,
        type: fileType,
        permissions: (stat.mode & 0o777).toString(8),
        hidden: winAttrs.hidden,
        system: winAttrs.system,
        readonly: winAttrs.readonly,
        isSymlink: stat.isSymbolicLink(),
        image: imageInfo
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================================
// 9. Context Action Service Dispatch
// ============================================================
async function runContextAction(actionName, filePath, extraArgs) {
  if (!filePath) {
    return { success: false, error: "File path is required." };
  }

  const cleanPath = path.normalize(filePath);

  switch (actionName) {
    case "open-terminal":
      return await openTerminal(cleanPath, extraArgs?.terminalType);
    case "copy-path":
      clipboard.writeText(cleanPath);
      return { success: true, message: "Path copied to clipboard." };
    case "copy-filename":
      clipboard.writeText(path.basename(cleanPath));
      return { success: true, message: "Filename copied to clipboard." };
    case "calculate-hash":
      return await calculateFileHash(cleanPath, extraArgs?.algorithm || "sha256");
    case "open-default": {
      const err = await shell.openPath(cleanPath);
      if (err) return { success: false, error: err };
      return { success: true };
    }
    case "open-containing":
      shell.showItemInFolder(cleanPath);
      return { success: true };
    default:
      return { success: false, error: `Unknown context action: ${actionName}` };
  }
}

module.exports = {
  openTerminal,
  gitStatus,
  gitInfo,
  encodeData,
  decodeData,
  readHexChunk,
  jsonParse,
  jsonFormat,
  jsonSave,
  getCodePreview,
  calculateFileHash,
  compareFileHashes,
  getFileMetadata,
  runContextAction
};
