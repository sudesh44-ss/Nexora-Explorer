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
  // Put spaces around parentheses so they separate cleanly
  const clean = queryStr.replace(/\(/g, " ( ").replace(/\)/g, " ) ");
  const regex = /("[^"]*"|\S+)/g;
  const matches = clean.match(regex) || [];
  return matches.map(token => {
    let val = token;
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    return val;
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

function matchText(text, searchVal, options = {}) {
  if (options.regex) {
    try {
      const rx = new RegExp(searchVal, "i");
      return rx.test(text);
    } catch (e) {
      return false;
    }
  }
  if (options.exactPhrase) {
    return text.toLowerCase() === searchVal.toLowerCase();
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

function matchSize(item, sizeVal) {
  if (item.isDirectory) return false; // Skip size match on folders
  
  const match = sizeVal.match(/^([><]=?|=)?\s*(\d+(?:\.\d+)?)\s*(KB|MB|GB|B)?$/i);
  if (!match) return false;

  const op = match[1] || "=";
  const num = parseFloat(match[2]);
  const unit = (match[3] || "B").toUpperCase();

  let bytes = num;
  if (unit === "KB") bytes = num * 1024;
  else if (unit === "MB") bytes = num * 1024 * 1024;
  else if (unit === "GB") bytes = num * 1024 * 1024 * 1024;

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

  // Check for operators in dateVal, e.g. ">2026-08-20"
  const match = dateVal.match(/^([><]=?|=)?\s*(\d{4}-\d{2}-\d{2})$/);
  let op = ">="; // Default: from that date onward
  let targetStr = dateVal;

  if (match) {
    op = match[1] || ">=";
    targetStr = match[2];
  }

  const targetTime = new Date(targetStr).getTime();
  if (isNaN(targetTime)) return false;

  if (op === ">") return timeMs > targetTime;
  if (op === "<") return timeMs < targetTime;
  if (op === ">=") return timeMs >= targetTime;
  if (op === "<=") return timeMs <= targetTime;
  if (op === "=") {
    // Check if on that calendar day (24h span)
    const dayEnd = targetTime + 24 * 60 * 60 * 1000;
    return timeMs >= targetTime && timeMs < dayEnd;
  }
  return false;
}

// Evaluate single term against item properties
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
    if (options.content && fileContentText && !item.isDirectory) {
      let matchesContent = false;
      if (options.regex) {
        try {
          const rx = new RegExp(value, "i");
          matchesContent = rx.test(fileContentText);
        } catch (e) {}
      } else {
        matchesContent = fileContentText.toLowerCase().includes(value.toLowerCase());
      }
      return matchesName || matchesContent;
    }
    return matchesName;
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
async function runSearch(scopesList, queryStr, filterType = "all", showHidden = false, options = {}, eventSender = null) {
  searchCancelled = false;
  const results = [];
  
  // 1. Validate paths
  const validScopes = [];
  for (const s of scopesList) {
    if (s && fs.existsSync(s)) {
      validScopes.push(s);
    }
  }
  if (!validScopes.length) return [];

  // 2. Parse Query
  const rawTokens = tokenize(queryStr);
  
  // Check for regex syntax validity at start
  if (options.regex && queryStr) {
    try {
      new RegExp(queryStr);
    } catch (err) {
      throw new Error("Invalid regular expression.");
    }
  }

  const tokens = preprocessTokens(rawTokens);
  const postfix = parseToPostfix(tokens);

  // 3. Crawler Stack/Queue
  const pending = [...validScopes];
  let processedCount = 0;

  while (pending.length && results.length < 5000) {
    if (searchCancelled) {
      break;
    }

    const current = pending.pop();
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch (e) {
      // Access denied / skip
      continue;
    }

    for (const entry of entries) {
      if (searchCancelled) break;

      const fullPath = path.join(current, entry.name);
      const isDirectory = entry.isDirectory();

      // Check Hidden
      let isHidden = false;
      try {
        if (entry.name.startsWith(".")) {
          isHidden = true;
        } else {
          // Check Windows attributes
          const attributes = execSync(`attrib "${fullPath}"`, { windowsHide: true }).toString();
          if (attributes.substring(0, 12).includes("H")) {
            isHidden = true;
          }
        }
      } catch (e) {}

      if (isHidden && !showHidden && !options.includeHidden) {
        continue;
      }

      // Check System Folders
      const isSystemPath = 
        fullPath.includes("System Volume Information") || 
        fullPath.includes("$Recycle.Bin") || 
        fullPath.includes("Windows\\System32");
        
      if (isSystemPath && !options.includeSystem) {
        continue;
      }

      // Push subdirectory to crawler stack
      if (isDirectory) {
        // Only recurse if scope is recursive (Subfolders, Entire Drive, Multi)
        const isRecursive = 
          options.searchScope === "Subfolders" || 
          options.searchScope === "Entire Drive" || 
          options.searchScope === "Multiple Drives" ||
          options.searchScope === undefined; // Default recursive
          
        if (isRecursive) {
          pending.push(fullPath);
        }
      }

      // Query verification
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

      // Apply quick filterType first
      let matchesQuickFilter = true;
      if (filterType !== "all") {
        matchesQuickFilter = matchType(item, filterType);
      }

      if (!matchesQuickFilter) continue;

      // Read file content first if content search is enabled
      let fileContentText = null;
      if (options.content && !isDirectory) {
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

      // If user specific filters exist (size, date, extension, name)
      if (options.name && !matchText(item.name, options.name, options)) continue;
      if (options.extension && !matchExtension(item.name, options.extension)) continue;
      if (options.sizeValue && !matchSize(item, `${options.sizeOperator || ">"}${options.sizeValue}${options.sizeUnit || "MB"}`)) continue;
      if (options.dateValue && !matchDate(item, `${options.dateValue}`, options)) continue;

      // Content Search
      let contentMatchLine = "";
      let contentMatchCount = 0;
      if (options.content && !isDirectory) {
        if (fileContentText) {
          const plainTerms = postfix.filter(t => !["and","or","not"].includes(t.toLowerCase()) && !t.match(/^(name|type|extension|size|date):/i));
          const target = plainTerms.length > 0 ? plainTerms[0] : queryStr;
          if (target) {
            const lines = fileContentText.split(/\r?\n/);
            for (let idx = 0; idx < lines.length; idx++) {
              const line = lines[idx];
              let matches = false;
              if (options.regex) {
                try {
                  matches = new RegExp(target, "i").test(line);
                } catch(e){}
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

      if (results.length >= 5000) break;
    }

    processedCount++;
    if (processedCount % 50 === 0) {
      if (eventSender) {
        eventSender.send("search:progress", {
          scanned: processedCount,
          resultsCount: results.length,
          currentPath: current
        });
      }
      // Yield to event loop to allow cancellation
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  // 4. Sort Results
  sortResults(results, options.sortBy || "Relevance", queryStr);

  return results;
}

// ----------------------------------------------------------
// 5. Sorting
// ----------------------------------------------------------
function sortResults(results, sortBy, queryStr) {
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
    // Default: Relevance
    results.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      // Priority 1: Exact Match
      if (aName === lowerQuery && bName !== lowerQuery) return -1;
      if (bName === lowerQuery && aName !== lowerQuery) return 1;

      // Priority 2: Starts With
      const aStarts = aName.startsWith(lowerQuery);
      const bStarts = bName.startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // Priority 3: Length
      return aName.length - bName.length;
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
