"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// ----------------------------------------------------------
// Constants & Configurations
// ----------------------------------------------------------
const CATEGORY_MAP = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".tiff", ".ico"],
  video: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm", ".m4v"],
  audio: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"],
  document: [
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".rtf", ".odt", 
    ".ods", ".odp", ".csv", ".log", ".xml", ".html", ".css", ".js", ".ts", ".py", ".sql", 
    ".yaml", ".yml", ".json", ".jsx", ".tsx", ".cjs", ".mjs"
  ],
  archive: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".iso", ".img", ".cab"]
};

const TEXT_SEARCH_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".xml", 
  ".csv", ".log", ".py", ".java", ".c", ".cpp", ".h", ".hpp", ".sql", ".yaml", ".yml",
  ".cjs", ".mjs", ".ini", ".conf", ".cfg", ".bat", ".cmd", ".ps1", ".sh"
]);

// Cancellation flag
let searchCancelled = false;

function cancelSearch() {
  searchCancelled = true;
}

// ----------------------------------------------------------
// 1. Query Language Parser
// ----------------------------------------------------------

function tokenize(queryStr) {
  const tokens = [];
  let currentToken = "";
  let inQuotes = false;
  
  for (let i = 0; i < queryStr.length; i++) {
    const char = queryStr[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentToken += char;
    } else if (inQuotes) {
      currentToken += char;
    } else if (char === "(" || char === ")") {
      if (currentToken.trim()) {
        tokens.push(currentToken.trim());
      }
      tokens.push(char);
      currentToken = "";
    } else if (/\s/.test(char)) {
      if (currentToken.trim()) {
        tokens.push(currentToken.trim());
        currentToken = "";
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken.trim()) {
    tokens.push(currentToken.trim());
  }

  return tokens.map(token => {
    const fieldMatch = token.match(/^(name|type|extension|size|date):"([^"]*)"$/i);
    if (fieldMatch) {
      return `${fieldMatch[1]}:${fieldMatch[2]}`;
    }
    if (token.startsWith('"') && token.endsWith('"')) {
      return token.slice(1, -1);
    }
    return token;
  });
}

function preprocessTokens(tokens) {
  const result = [];
  const isOperator = (t) => ["and", "or", "not"].includes(t.toLowerCase());
  
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const currentLower = current.toLowerCase();
    
    if (i > 0) {
      const prev = tokens[i - 1];
      const prevLower = prev.toLowerCase();
      
      const prevIsTerm = !isOperator(prev) && prevLower !== "(";
      const currentIsTerm = !isOperator(current) && currentLower !== ")";
      const currentIsUnary = currentLower === "not";
      
      if ((prevIsTerm || prevLower === ")") && (currentIsTerm || currentLower === "(" || currentIsUnary)) {
        result.push("AND");
      }
    }
    result.push(current);
  }
  return result;
}

function parseToPostfix(tokens) {
  const outputQueue = [];
  const operatorStack = [];
  const precedence = {
    "not": 3,
    "and": 2,
    "or": 1
  };

  const isOperator = (t) => ["and", "or", "not"].includes(t.toLowerCase());

  for (const token of tokens) {
    const lowerToken = token.toLowerCase();

    if (lowerToken === "(") {
      operatorStack.push(token);
    } else if (lowerToken === ")") {
      while (operatorStack.length && operatorStack[operatorStack.length - 1].toLowerCase() !== "(") {
        outputQueue.push(operatorStack.pop());
      }
      operatorStack.pop(); // remove "("
    } else if (isOperator(token)) {
      while (
        operatorStack.length &&
        isOperator(operatorStack[operatorStack.length - 1]) &&
        precedence[operatorStack[operatorStack.length - 1].toLowerCase()] >= precedence[lowerToken]
      ) {
        outputQueue.push(operatorStack.pop());
      }
      operatorStack.push(token);
    } else {
      outputQueue.push(token);
    }
  }

  while (operatorStack.length) {
    outputQueue.push(operatorStack.pop());
  }

  return outputQueue;
}

// ----------------------------------------------------------
// 2. Evaluator Functions
// ----------------------------------------------------------

const regexCache = new Map();
function getCompiledRegex(pattern) {
  if (regexCache.has(pattern)) {
    return regexCache.get(pattern);
  }
  try {
    const rx = new RegExp(pattern, "i");
    regexCache.set(pattern, rx);
    return rx;
  } catch (e) {
    return null;
  }
}

function matchText(text, searchVal, options = {}) {
  if (options.regex) {
    const rx = getCompiledRegex(searchVal);
    return rx ? rx.test(text) : false;
  }
  return text.toLowerCase().includes(searchVal.toLowerCase());
}

function matchType(item, typeVal) {
  const t = typeVal.toLowerCase();
  if (t === "folder" || t === "directory") return item.isDirectory;
  if (item.isDirectory) return false;

  const ext = path.extname(item.name).toLowerCase();
  if (t === "image") return CATEGORY_MAP.image.includes(ext);
  if (t === "video") return CATEGORY_MAP.video.includes(ext);
  if (t === "audio") return CATEGORY_MAP.audio.includes(ext);
  if (t === "document") return CATEGORY_MAP.document.includes(ext);
  if (t === "archive") return CATEGORY_MAP.archive.includes(ext);
  return false;
}

function matchExtension(filename, extVal) {
  const ext = path.extname(filename).toLowerCase();
  const allowed = extVal.split(",").map(e => {
    let s = e.trim().toLowerCase();
    if (!s.startsWith(".")) s = "." + s;
    return s;
  });
  return allowed.includes(ext);
}

function parseSizeToBytes(num, unit) {
  const u = (unit || "B").toUpperCase();
  if (u === "KB") return num * 1024;
  if (u === "MB") return num * 1024 * 1024;
  if (u === "GB") return num * 1024 * 1024 * 1024;
  if (u === "TB") return num * 1024 * 1024 * 1024 * 1024;
  return num;
}

function matchSize(item, sizeVal) {
  if (item.isDirectory) return false;
  
  const match = sizeVal.match(/^([><]=?|=)?\s*(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB|B)?$/i);
  if (!match) return false;

  const op = match[1] || "=";
  const num = parseFloat(match[2]);
  const unit = match[3] || "B";

  const bytes = parseSizeToBytes(num, unit);
  const size = item.size || 0;

  if (op === ">") return size > bytes;
  if (op === "<") return size < bytes;
  if (op === ">=") return size >= bytes;
  if (op === "<=") return size <= bytes;
  if (op === "=") return size === bytes;
  return false;
}

function matchDate(item, dateVal, options = {}) {
  const dateType = (options.dateType || "modified").toLowerCase();
  let timeMs = 0;
  if (dateType === "created") timeMs = item.ctimeMs || 0;
  else if (dateType === "accessed") timeMs = item.atimeMs || 0;
  else timeMs = item.mtimeMs || 0;

  const match = dateVal.match(/^([><]=?|=)?\s*(\d{4}-\d{2}-\d{2})$/);
  if (!match) return false;

  const op = match[1] || ">=";
  const targetStr = match[2];

  const dateParts = targetStr.split("-");
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);

  const localDayStart = new Date(year, month, day, 0, 0, 0, 0).getTime();
  const localDayEnd = new Date(year, month, day, 23, 59, 59, 999).getTime();

  if (op === ">") return timeMs > localDayEnd;
  if (op === "<") return timeMs < localDayStart;
  if (op === ">=") return timeMs >= localDayStart;
  if (op === "<=") return timeMs <= localDayEnd;
  if (op === "=") return timeMs >= localDayStart && timeMs <= localDayEnd;
  return false;
}

function evaluateTerm(term, item, options = {}, fileContentText = null) {
  const match = term.match(/^(name|type|extension|size|date):(.+)$/i);
  let field = "default";
  let value = term;
  if (match) {
    field = match[1].toLowerCase();
    value = match[2];
  }

  if (field === "name") {
    return matchText(item.name, value, options);
  }
  if (field === "type") {
    return matchType(item, value);
  }
  if (field === "extension") {
    return matchExtension(item.name, value);
  }
  if (field === "size") {
    return matchSize(item, value);
  }
  if (field === "date") {
    return matchDate(item, value, options);
  }

  if (field === "default") {
    const matchesName = matchText(item.name, value, options);
    if (matchesName) return true;

    if (options.metadata) {
      const ext = path.extname(item.name);
      const matchesPath = matchText(item.path, value, options);
      const matchesExt = ext ? matchText(ext, value, options) : false;
      const matchesCreated = item.created ? matchText(item.created, value, options) : false;
      const matchesModified = item.modified ? matchText(item.modified, value, options) : false;
      const matchesType = matchText(item.isDirectory ? "folder" : "file", value, options);
      if (matchesPath || matchesExt || matchesCreated || matchesModified || matchesType) {
        return true;
      }
    }

    if (options.content && fileContentText && !item.isDirectory) {
      let matchesContent = false;
      if (options.regex) {
        const rx = getCompiledRegex(value);
        matchesContent = rx ? rx.test(fileContentText) : false;
      } else {
        matchesContent = fileContentText.toLowerCase().includes(value.toLowerCase());
      }
      if (matchesContent) return true;
    }
    return false;
  }

  return matchText(item.name, value, options);
}

function evaluatePostfix(postfix, item, options = {}, fileContentText = null) {
  if (!postfix.length) return true;
  const stack = [];
  const isOperator = (t) => ["and", "or", "not"].includes(t.toLowerCase());

  for (const token of postfix) {
    const lowerToken = token.toLowerCase();
    if (lowerToken === "and") {
      const right = stack.pop();
      const left = stack.pop();
      stack.push(left && right);
    } else if (lowerToken === "or") {
      const right = stack.pop();
      const left = stack.pop();
      stack.push(left || right);
    } else if (lowerToken === "not") {
      const operand = stack.pop();
      stack.push(!operand);
    } else {
      stack.push(evaluateTerm(token, item, options, fileContentText));
    }
  }

  return stack.length ? stack[0] : true;
}

// ----------------------------------------------------------
// 3. Content Search
// ----------------------------------------------------------
async function searchFileContent(filePath, query, options = {}) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_SEARCH_EXTENSIONS.has(ext)) {
    return { hasMatch: false, line: "", count: 0 };
  }

  try {
    const stat = await fsp.stat(filePath);
    // Limit to 10MB to prevent out-of-memory crashes
    if (stat.size > 10 * 1024 * 1024) {
      return { hasMatch: false, line: "", count: 0 };
    }

    const content = await fsp.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    let matchCount = 0;
    let firstMatchingLine = "";

    const lowerQuery = query.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let matches = false;
      
      if (options.regex) {
        try {
          const rx = new RegExp(query, "i");
          matches = rx.test(line);
        } catch (e) {}
      } else {
        matches = line.toLowerCase().includes(lowerQuery);
      }

      if (matches) {
        matchCount++;
        if (!firstMatchingLine) {
          firstMatchingLine = `Line ${i + 1}: ${line.trim().substring(0, 120)}`;
        }
      }
    }

    return {
      hasMatch: matchCount > 0,
      line: firstMatchingLine,
      count: matchCount
    };
  } catch (e) {
    return { hasMatch: false, line: "", count: 0 };
  }
}

// ----------------------------------------------------------
// 4. Asynchronous Directory Crawler Search
// ----------------------------------------------------------
const MAX_SEARCH_RESULTS = 5000;

async function runSearch(scopesList, queryStr, filterType = "all", showHidden = false, options = {}, eventSender = null) {
  searchCancelled = false;
  const results = [];

  const logFilePath = "C:\\Users\\suryw\\.gemini\\antigravity\\brain\\c9265c3d-8f8f-4708-9c0e-f8a8b7784398\\scratch\\gui_debug.log";
  const runSearchLog = {
    source: "SearchService",
    message: "[SearchService] runSearch started",
    data: { scopesList, queryStr, filterType, options }
  };
  try {
    fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${JSON.stringify(runSearchLog)}\n`, "utf8");
  } catch(e) {}
  
  // 1. Validate paths
  const validScopes = [];
  for (const s of scopesList) {
    if (s && fs.existsSync(s)) {
      validScopes.push(s);
    }
  }
  if (!validScopes.length) return [];

  // 2. Parse Query
  let rawTokens;
  if (options.exactPhrase && queryStr) {
    rawTokens = [queryStr];
  } else {
    rawTokens = tokenize(queryStr);
  }

  const tokens = preprocessTokens(rawTokens);
  const postfix = parseToPostfix(tokens);

  // Check for regex syntax validity at start
  if (options.regex) {
    for (const token of postfix) {
      if (!["and", "or", "not"].includes(token.toLowerCase())) {
        const match = token.match(/^(name|type|extension|size|date):(.+)$/i);
        const value = match ? match[2] : token;
        try {
          new RegExp(value);
        } catch (err) {
          throw new Error(`Invalid regular expression: "${value}"`);
        }
      }
    }
  }

  // 3. Crawler Stack/Queue with junction/loop protection
  const pending = [...validScopes];
  const visitedPaths = new Set();
  for (const scope of validScopes) {
    try {
      const real = await fsp.realpath(scope);
      visitedPaths.add(real);
    } catch (e) {}
  }

  let scannedItemsCount = 0;
  let skippedFoldersCount = 0;

  while (pending.length && results.length < MAX_SEARCH_RESULTS) {
    if (searchCancelled) {
      break;
    }

    const current = pending.pop();
    
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch (e) {
      skippedFoldersCount++;
      continue;
    }

    for (const entry of entries) {
      if (searchCancelled) break;
      scannedItemsCount++;

      // Throttle progress updates to 100 scanned items and yield
      if (scannedItemsCount % 100 === 0) {
        if (eventSender) {
          eventSender.send("search:progress", {
            scanned: scannedItemsCount,
            resultsCount: results.length,
            currentPath: current
          });
        }
        await new Promise(resolve => setImmediate(resolve));
      }

      const fullPath = path.join(current, entry.name);
      const isDirectory = entry.isDirectory();

      // Check Hidden (No expensiveattrib command per item!)
      const isHidden = entry.name.startsWith(".") || entry.name.startsWith("$");
      if (isHidden && !showHidden && !options.includeHidden) {
        continue;
      }

      // Check System Folders
      const isSystem = 
        entry.name === "System Volume Information" || 
        entry.name === "$RECYCLE.BIN" || 
        entry.name === "$Recycle.Bin" || 
        entry.name === "AppData" ||
        fullPath.includes("Windows\\System32");

      if (isSystem && !options.includeSystem) {
        continue;
      }

      // Push subdirectory to crawler stack with realpath validation to prevent junction loops
      if (isDirectory) {
        const isRecursive = 
          options.searchScope === "Subfolders" || 
          options.searchScope === "Entire Drive" || 
          options.searchScope === "Multiple Drives" ||
          options.searchScope === undefined;
          
        if (isRecursive) {
          try {
            const real = await fsp.realpath(fullPath);
            if (!visitedPaths.has(real)) {
              visitedPaths.add(real);
              pending.push(fullPath);
            }
          } catch (e) {
            // Skip broken junctions/links
          }
        }
      }

      // Query verification - fetch metadata stats
      let stats = null;
      try {
        stats = await fsp.stat(fullPath);
      } catch (e) {
        continue;
      }

      const item = {
        name: entry.name,
        path: fullPath,
        isDirectory,
        size: isDirectory ? null : stats.size,
        mtimeMs: stats.mtimeMs,
        ctimeMs: stats.ctimeMs,
        atimeMs: stats.atimeMs,
        mtime: stats.mtime.toISOString(),
        created: stats.birthtime ? stats.birthtime.toISOString() : stats.ctime.toISOString()
      };

      // Apply quick type filter first
      let matchesQuickFilter = true;
      if (filterType !== "all") {
        matchesQuickFilter = matchType(item, filterType);
      }
      if (!matchesQuickFilter) continue;

      // Check specific UI options filters (name, extension, size, date) BEFORE reading content
      const nameMatch = options.name ? matchText(item.name, options.name, options) : true;
      const extMatch = options.extension ? matchExtension(item.name, options.extension) : true;
      const sizeMatch = options.sizeValue ? matchSize(item, `${options.sizeOperator || ">"}${options.sizeValue}${options.sizeUnit || "MB"}`) : true;
      const dateMatch = options.dateValue ? matchDate(item, `${options.dateOperator || ">="}${options.dateValue}`, options) : true;

      if (!nameMatch || !extMatch || !sizeMatch || !dateMatch) continue;

      // Read file content ONLY if content search is enabled and it is a supported text file
      let fileContentText = null;
      if (options.content && !isDirectory) {
        if (searchCancelled) break;
        const ext = path.extname(item.path).toLowerCase();
        if (TEXT_SEARCH_EXTENSIONS.has(ext)) {
          try {
            if (stats.size <= 10 * 1024 * 1024) {
              fileContentText = await fsp.readFile(item.path, "utf8");
            }
          } catch (e) {}
        }
      }

      // Apply Query Language Evaluation
      const matchesQuery = evaluatePostfix(postfix, item, options, fileContentText);
      if (!matchesQuery) continue;

      // Extract content search snippet if matched
      let contentMatchLine = "";
      let contentMatchCount = 0;
      if (options.content && !isDirectory && fileContentText) {
        const plainTerms = postfix.filter(t => !["and", "or", "not"].includes(t.toLowerCase()) && !t.match(/^(name|type|extension|size|date):/i));
        const target = plainTerms.length > 0 ? plainTerms[0] : queryStr;
        if (target) {
          const lines = fileContentText.split(/\r?\n/);
          for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            let matches = false;
            if (options.regex) {
              const rx = getCompiledRegex(target);
              matches = rx ? rx.test(line) : false;
            } else {
              matches = line.toLowerCase().includes(target.toLowerCase());
            }
            if (matches) {
              contentMatchCount++;
              if (!contentMatchLine) {
                contentMatchLine = `Line ${idx + 1}: ${line.trim().substring(0, 120)}`;
              }
            }
          }
        }
      }

      // Success, add to result set
      results.push({
        name: item.name,
        path: item.path,
        isDirectory,
        size: item.size,
        modified: item.mtime,
        created: item.created,
        type: isDirectory ? "Folder" : "File",
        extension: path.extname(item.name),
        contentLine: contentMatchLine,
        contentCount: contentMatchCount
      });

      if (results.length >= MAX_SEARCH_RESULTS) break;
    }
  }

  console.log(`[Search Engine] Search finished. Skipped ${skippedFoldersCount} inaccessible folders.`);

  // 4. Sort Results
  sortResults(results, options.sortBy || "Relevance", queryStr, tokens);

  try {
    fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${JSON.stringify({
      source: "SearchService",
      message: "[SearchService] FINAL RESULTS",
      data: { count: results.length, sample: results.map(r => r.name).slice(0, 5) }
    })}\n`, "utf8");
  } catch(e) {}

  return results;
}

// ----------------------------------------------------------
// 5. Sorting
// ----------------------------------------------------------
function sortResults(results, sortBy, queryStr, tokens = []) {
  const lowerQuery = String(queryStr || "").toLowerCase();

  if (sortBy === "Name") {
    results.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === "Size") {
    results.sort((a, b) => (b.size || 0) - (a.size || 0));
  } else if (sortBy === "Date") {
    results.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  } else if (sortBy === "Type") {
    results.sort((a, b) => a.type.localeCompare(b.type));
  } else {
    // Default: Relevance sorting
    const cleanQuery = tokens
      .filter(t => !["and", "or", "not"].includes(t.toLowerCase()) && !t.match(/^(name|type|extension|size|date):/i))
      .map(t => t.toLowerCase())
      .join(" ");

    if (!cleanQuery) {
      results.sort((a, b) => a.name.localeCompare(b.name));
      return;
    }

    results.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // Priority 1: Exact Match
      const aExact = aName === cleanQuery;
      const bExact = bName === cleanQuery;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      // Priority 2: Starts With
      const aStarts = aName.startsWith(cleanQuery);
      const bStarts = bName.startsWith(cleanQuery);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // Priority 3: Contains
      const aContains = aName.includes(cleanQuery);
      const bContains = bName.includes(cleanQuery);
      if (aContains && !bContains) return -1;
      if (bContains && !aContains) return 1;

      // Priority 4: Length
      if (aName.length !== bName.length) {
        return aName.length - bName.length;
      }

      // Priority 5: Alphabetical
      return aName.localeCompare(bName);
    });
  }
}

// ----------------------------------------------------------
// 6. Persistence: Search History & Saved Searches
// ----------------------------------------------------------
const searchDir = path.join(os.homedir(), ".gemini", "antigravity");
const historyFile = path.join(searchDir, "search_history.json");
const savedSearchesFile = path.join(searchDir, "saved_searches.json");

async function ensureSearchDir() {
  try {
    await fsp.mkdir(searchDir, { recursive: true });
  } catch (e) {}
}

async function getSearchHistory() {
  await ensureSearchDir();
  try {
    if (!fs.existsSync(historyFile)) return [];
    const data = await fsp.readFile(historyFile, "utf8");
    return JSON.parse(data || "[]");
  } catch (e) {
    return [];
  }
}

async function addToSearchHistory(item) {
  await ensureSearchDir();
  try {
    const history = await getSearchHistory();
    // Exclude duplicates, keeping newest at front
    const filtered = history.filter(h => h.query !== item.query || JSON.stringify(h.filters) !== JSON.stringify(item.filters));
    filtered.unshift({
      query: item.query,
      filters: item.filters,
      scope: item.scope,
      timestamp: new Date().toISOString(),
      resultCount: item.resultCount || 0
    });
    // Keep max 50 history entries
    const sliced = filtered.slice(0, 50);
    await fsp.writeFile(historyFile, JSON.stringify(sliced, null, 2), "utf8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function clearSearchHistory() {
  await ensureSearchDir();
  try {
    await fsp.writeFile(historyFile, "[]", "utf8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getSavedSearches() {
  await ensureSearchDir();
  try {
    if (!fs.existsSync(savedSearchesFile)) return [];
    const data = await fsp.readFile(savedSearchesFile, "utf8");
    return JSON.parse(data || "[]");
  } catch (e) {
    return [];
  }
}

async function saveSearch(item) {
  await ensureSearchDir();
  try {
    const saved = await getSavedSearches();
    // Remove if already exists with same name
    const filtered = saved.filter(s => s.name.toLowerCase() !== item.name.toLowerCase());
    filtered.push({
      name: item.name,
      query: item.query,
      filters: item.filters,
      scope: item.scope,
      timestamp: new Date().toISOString()
    });
    await fsp.writeFile(savedSearchesFile, JSON.stringify(filtered, null, 2), "utf8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function deleteSavedSearch(name) {
  await ensureSearchDir();
  try {
    const saved = await getSavedSearches();
    const filtered = saved.filter(s => s.name.toLowerCase() !== name.toLowerCase());
    await fsp.writeFile(savedSearchesFile, JSON.stringify(filtered, null, 2), "utf8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  runSearch,
  cancelSearch,
  getSearchHistory,
  addToSearchHistory,
  clearSearchHistory,
  getSavedSearches,
  saveSearch,
  deleteSavedSearch
};
