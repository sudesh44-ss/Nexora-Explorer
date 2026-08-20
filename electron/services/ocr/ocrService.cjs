"use strict";

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { spawn, execFile } = require("child_process");
const os = require("os");
const pdfParse = require("pdf-parse");

// Paths and stores
const ocrDir = path.join(os.homedir(), ".gemini", "antigravity");
const ocrIndexPath = path.join(ocrDir, "ocr_index.json");
const ocrSettingsPath = path.join(ocrDir, "ocr_settings.json");

// Tesseract executables search paths on Windows
const tesseractSearchPaths = [
  "tesseract.exe", // in PATH
  "tesseract",
  "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
  "C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe"
];

// Active Queue State
const queue = {
  items: [],
  isProcessing: false,
  isPaused: false,
  currentIndex: -1,
  activeChildProcess: null
};

// Default Settings
const defaultSettings = {
  engine: "tesseract",
  language: "eng",
  dpi: 150,
  pdfRange: "all",
  preprocessing: "none"
};

// ============================================================
// Helper Utilities
// ============================================================
async function ensureOcrDirectory() {
  try {
    await fsp.mkdir(ocrDir, { recursive: true });
  } catch (e) {}
}

async function findTesseract() {
  for (const tPath of tesseractSearchPaths) {
    try {
      await new Promise((resolve, reject) => {
        execFile(tPath, ["--version"], (err) => {
          if (err && err.code === "ENOENT") {
            reject();
          } else {
            resolve();
          }
        });
      });
      return tPath; // Found working Tesseract
    } catch (e) {}
  }
  return null;
}

// PowerShell rendering script content
const psScript = `
Param(
    [string]$pdfPath,
    [string]$outputDir,
    [int]$dpi = 150
)
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
[void][Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType=WindowsRuntime]
[void][Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf, ContentType=WindowsRuntime]

$file = [Windows.Storage.StorageFile]::GetFileFromPathAsync($pdfPath).GetAwaiter().GetResult()
$pdf = [Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file).GetAwaiter().GetResult()
$count = $pdf.PageCount
Write-Output "TOTAL_PAGES:$count"

$options = New-Object Windows.Data.Pdf.PdfPageRenderOptions
$zoom = $dpi / 72.0

for ($i = 0; $i -lt $count; $i++) {
    $page = $pdf.GetPage($i)
    $options.DestinationWidth = [uint32]($page.Size.Width * $zoom)
    $outputPath = Join-Path $outputDir "page-$i.png"
    if (-not (Test-Path $outputPath)) {
        New-Item -Path $outputPath -ItemType File -Force | Out-Null
    }
    $outFile = [Windows.Storage.StorageFile]::GetFileFromPathAsync($outputPath).GetAwaiter().GetResult()
    $stream = $outFile.OpenTransactedWriteAsync().GetAwaiter().GetResult()
    $page.RenderToStreamAsync($stream.Stream, $options).GetAwaiter().GetResult()
    $stream.CommitAsync().GetAwaiter().GetResult()
    $stream.Dispose()
    $page.Dispose()
    Write-Output "RENDERED_PAGE:$i"
}
$pdf.Dispose()
`;

// Render PDF pages using PowerShell
function renderPdfPages(pdfPath, outputDir, dpi = 150, onPageRendered, onTotalPages) {
  return new Promise((resolve, reject) => {
    const psFile = path.join(ocrDir, "ocr_pdf_render.ps1");
    fs.writeFileSync(psFile, psScript, "utf8");

    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", psFile,
      "-pdfPath", pdfPath,
      "-outputDir", outputDir,
      "-dpi", dpi.toString()
    ]);

    queue.activeChildProcess = child;

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const str = data.toString();
      stdout += str;
      const lines = str.split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith("TOTAL_PAGES:")) {
          const total = parseInt(line.split(":")[1], 10);
          if (onTotalPages) onTotalPages(total);
        } else if (line.startsWith("RENDERED_PAGE:")) {
          const pageIdx = parseInt(line.split(":")[1], 10);
          if (onPageRendered) onPageRendered(pageIdx);
        }
      }
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      queue.activeChildProcess = null;
      try {
        fs.unlinkSync(psFile);
      } catch (e) {}

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `PowerShell render script failed with code ${code}`));
      }
    });
  });
}

// Parse Tesseract TSV format for average word confidence
async function parseConfidenceFromTsv(tsvFilePath) {
  try {
    const content = await fsp.readFile(tsvFilePath, "utf8");
    const lines = content.split(/\r?\n/);
    let sum = 0;
    let count = 0;

    for (const line of lines) {
      const cols = line.split("\t");
      if (cols.length >= 11) {
        const conf = parseInt(cols[10], 10);
        if (!isNaN(conf) && conf > 0) {
          sum += conf;
          count++;
        }
      }
    }
    return count > 0 ? Math.round(sum / count) : 85;
  } catch (e) {
    return 85;
  }
}

// ============================================================
// 1. OCR Engine Operations
// ============================================================
async function checkOcrEngineStatus() {
  const binaryPath = await findTesseract();
  return {
    available: binaryPath !== null,
    engine: "tesseract",
    path: binaryPath
  };
}

async function runOcrOnImage(tPath, imagePath, language) {
  const outputBase = path.join(ocrDir, `ocr_temp_${Date.now()}`);
  const txtPath = `${outputBase}.txt`;
  const tsvPath = `${outputBase}.tsv`;

  return new Promise((resolve, reject) => {
    // Run tesseract to produce txt and tsv files
    const args = [imagePath, outputBase, "-l", language, "txt", "tsv"];
    const child = execFile(tPath, args, async (error, stdout, stderr) => {
      queue.activeChildProcess = null;
      if (error) {
        return reject(new Error(stderr?.trim() || error.message));
      }

      try {
        const text = await fsp.readFile(txtPath, "utf8");
        const confidence = await parseConfidenceFromTsv(tsvPath);

        // Clean up
        try { await fsp.unlink(txtPath); } catch (e) {}
        try { await fsp.unlink(tsvPath); } catch (e) {}

        resolve({ text, confidence });
      } catch (err) {
        reject(err);
      }
    });

    queue.activeChildProcess = child;
  });
}

async function processOcr(filePath, options = {}, eventSender = null, itemId = null) {
  const startTime = Date.now();
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Load Settings
  const settings = await getSettings();
  const language = options.language || settings.language || "eng";
  const dpi = parseInt(options.dpi || settings.dpi || 150, 10);

  // 1. Check if Tesseract is required and installed
  let tPath = null;
  if (ext !== ".pdf") {
    const status = await checkOcrEngineStatus();
    if (!status.available) {
      throw new Error("OCR engine is not installed/configured.");
    }
    tPath = status.path;
  }

  // 2. Handle PDF file
  if (ext === ".pdf") {
    let selectableText = "";
    let pages = 0;
    
    // First, attempt direct text extraction
    try {
      const dataBuffer = await fsp.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      selectableText = data.text || "";
      pages = data.numpages || 0;
    } catch (e) {
      // Failed to parse, fallback to scanned PDF flow
    }

    const cleanTest = selectableText.replace(/\s/g, "");
    if (cleanTest.length > 50) {
      // Selectable text exists! Return directly.
      const processingTime = Date.now() - startTime;
      const result = {
        success: true,
        text: selectableText,
        language: "pdf-extracted",
        confidence: 100,
        pages,
        processingTime,
        source: "pdf-selectable",
        engine: "pdf-parse"
      };
      await addDocumentToIndex(filePath, filename, selectableText, "eng", 100, pages, "pdf-selectable");
      return result;
    }

    // Scanned PDF Flow (rendering pages and running OCR)
    const status = await checkOcrEngineStatus();
    if (!status.available) {
      throw new Error("OCR engine is not installed/configured.");
    }
    tPath = status.path;

    const tempOutputDir = path.join(ocrDir, `pdf_pages_${Date.now()}`);
    await fsp.mkdir(tempOutputDir, { recursive: true });

    try {
      let totalPdfPages = 0;
      let renderedPagesCount = 0;

      // Render pages to image files via PowerShell UWP API
      await renderPdfPages(filePath, tempOutputDir, dpi, 
        // Page rendered callback
        (idx) => {
          renderedPagesCount++;
          if (eventSender && itemId) {
            eventSender.send("ocr:progress", {
              progress: Math.round((renderedPagesCount / (totalPdfPages || 1)) * 40), // 40% for rendering
              currentPage: renderedPagesCount,
              totalPages: totalPdfPages,
              itemId
            });
          }
        },
        // Total pages callback
        (total) => {
          totalPdfPages = total;
        }
      );

      // Now run OCR page by page
      let combinedText = "";
      let confidenceSum = 0;
      let validOcrPages = 0;

      for (let i = 0; i < totalPdfPages; i++) {
        // Handle cancel
        if (queue.isPaused) {
          throw new Error("Queue execution paused");
        }

        const pageImgPath = path.join(tempOutputDir, `page-${i}.png`);
        if (fs.existsSync(pageImgPath)) {
          const pageResult = await runOcrOnImage(tPath, pageImgPath, language);
          combinedText += `\n--- Page ${i + 1} ---\n` + pageResult.text;
          confidenceSum += pageResult.confidence;
          validOcrPages++;

          if (eventSender && itemId) {
            eventSender.send("ocr:progress", {
              progress: 40 + Math.round((validOcrPages / totalPdfPages) * 60), // 60% for OCR
              currentPage: validOcrPages,
              totalPages: totalPdfPages,
              itemId
            });
          }
        }
      }

      const averageConfidence = validOcrPages > 0 ? Math.round(confidenceSum / validOcrPages) : 85;
      const processingTime = Date.now() - startTime;

      // Clean up temp directory
      try {
        const files = await fsp.readdir(tempOutputDir);
        for (const file of files) {
          await fsp.unlink(path.join(tempOutputDir, file));
        }
        await fsp.rmdir(tempOutputDir);
      } catch (e) {}

      const result = {
        success: true,
        text: combinedText,
        language,
        confidence: averageConfidence,
        pages: totalPdfPages,
        processingTime,
        source: "scanned-pdf",
        engine: "tesseract"
      };

      await addDocumentToIndex(filePath, filename, combinedText, language, averageConfidence, totalPdfPages, "scanned-pdf");
      return result;

    } catch (err) {
      // Cleanup on error
      try {
        const files = await fsp.readdir(tempOutputDir);
        for (const file of files) {
          await fsp.unlink(path.join(tempOutputDir, file));
        }
        await fsp.rmdir(tempOutputDir);
      } catch (e) {}
      throw err;
    }
  }

  // 3. Handle Standard Image Files
  const ocrRes = await runOcrOnImage(tPath, filePath, language);
  const processingTime = Date.now() - startTime;

  const result = {
    success: true,
    text: ocrRes.text,
    language,
    confidence: ocrRes.confidence,
    pages: 1,
    processingTime,
    source: "image",
    engine: "tesseract"
  };

  await addDocumentToIndex(filePath, filename, ocrRes.text, language, ocrRes.confidence, 1, "image");
  return result;
}

// ============================================================
// 2. Queue Operations
// ============================================================
function getQueueState() {
  return {
    items: queue.items,
    isProcessing: queue.isProcessing,
    isPaused: queue.isPaused,
    currentIndex: queue.currentIndex
  };
}

function addToQueue(filePaths, options = {}) {
  const newItems = filePaths.map(fPath => ({
    id: `ocr-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    filePath: fPath,
    fileName: path.basename(fPath),
    status: "queued",
    progress: 0,
    currentPage: 0,
    totalPages: 0,
    text: "",
    error: "",
    language: options.language || "eng",
    confidence: 0,
    pagesCount: 0,
    processingTime: 0
  }));

  queue.items.push(...newItems);
  return { success: true, addedCount: newItems.length };
}

async function processNextQueueItem(eventSender) {
  if (queue.isPaused || !queue.isProcessing) return;

  // Find next queued item
  const nextIdx = queue.items.findIndex(i => i.status === "queued");
  if (nextIdx === -1) {
    queue.isProcessing = false;
    queue.currentIndex = -1;
    if (eventSender) {
      eventSender.send("ocr:queue-finished", { items: queue.items });
    }
    return;
  }

  queue.currentIndex = nextIdx;
  const item = queue.items[nextIdx];
  item.status = "processing";
  item.progress = 5;

  if (eventSender) {
    eventSender.send("ocr:queue-changed", getQueueState());
  }

  try {
    const ocrResult = await processOcr(item.filePath, { language: item.language }, eventSender, item.id);
    item.status = "completed";
    item.progress = 100;
    item.text = ocrResult.text;
    item.confidence = ocrResult.confidence;
    item.pagesCount = ocrResult.pages;
    item.processingTime = ocrResult.processingTime;
  } catch (err) {
    item.status = "failed";
    item.progress = 0;
    item.error = err.message;
  }

  if (eventSender) {
    eventSender.send("ocr:queue-changed", getQueueState());
  }

  // Continue to next item
  setTimeout(() => {
    processNextQueueItem(eventSender);
  }, 100);
}

function startQueue(eventSender) {
  if (queue.isProcessing) return { success: true };
  queue.isProcessing = true;
  queue.isPaused = false;
  processNextQueueItem(eventSender);
  return { success: true };
}

function pauseQueue() {
  queue.isPaused = true;
  queue.isProcessing = false;
  return { success: true };
}

function resumeQueue(eventSender) {
  if (!queue.isPaused) return { success: true };
  queue.isPaused = false;
  queue.isProcessing = true;
  processNextQueueItem(eventSender);
  return { success: true };
}

function cancelQueueItem(itemId) {
  const item = queue.items.find(i => i.id === itemId);
  if (item) {
    if (item.status === "processing") {
      if (queue.activeChildProcess) {
        try {
          queue.activeChildProcess.kill();
        } catch (e) {}
      }
    }
    item.status = "failed";
    item.error = "Cancelled by user";
  }
  return { success: true };
}

function clearCompletedQueue() {
  queue.items = queue.items.filter(i => i.status !== "completed" && i.status !== "failed");
  return { success: true };
}

// ============================================================
// 3. Database / Index Management
// ============================================================
async function getOcrIndex() {
  await ensureOcrDirectory();
  try {
    if (!fs.existsSync(ocrIndexPath)) {
      return { success: true, index: [] };
    }
    const data = await fsp.readFile(ocrIndexPath, "utf8");
    const index = JSON.parse(data || "[]");
    return { success: true, index };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function addDocumentToIndex(filePath, fileName, text, language, confidence, pages, source) {
  await ensureOcrDirectory();
  try {
    const listRes = await getOcrIndex();
    if (!listRes.success) return;

    const index = listRes.index || [];
    const timestamp = new Date().toISOString();

    // Check if document already exists, if so update it
    const existingIdx = index.findIndex(doc => doc.filePath === filePath);
    const newDoc = {
      filePath,
      fileName,
      text,
      language,
      confidence,
      pages,
      source,
      timestamp
    };

    if (existingIdx !== -1) {
      index[existingIdx] = newDoc;
    } else {
      index.push(newDoc);
    }

    await fsp.writeFile(ocrIndexPath, JSON.stringify(index, null, 2), "utf8");
  } catch (e) {
    console.error("Index write error:", e);
  }
}

async function searchOcrIndex(query, scope, targetPath) {
  const listRes = await getOcrIndex();
  if (!listRes.success) return listRes;

  let entries = listRes.index || [];
  const lowerQuery = query.toLowerCase();

  // Scoped path checks
  if (scope === "current" && targetPath) {
    const targetDir = path.normalize(targetPath).toLowerCase();
    entries = entries.filter(e => {
      const dir = path.dirname(path.normalize(e.filePath)).toLowerCase();
      return dir === targetDir;
    });
  } else if (scope === "selected" && targetPath) {
    const targetDir = path.normalize(targetPath).toLowerCase();
    entries = entries.filter(e => {
      const p = path.normalize(e.filePath).toLowerCase();
      return p.startsWith(targetDir);
    });
  }

  // Exact phrase match, case insensitive
  const results = entries.filter(e => e.text.toLowerCase().includes(lowerQuery));

  return { success: true, results };
}

// ============================================================
// 4. Settings Operations
// ============================================================
async function getSettings() {
  await ensureOcrDirectory();
  try {
    if (!fs.existsSync(ocrSettingsPath)) {
      return defaultSettings;
    }
    const data = await fsp.readFile(ocrSettingsPath, "utf8");
    return JSON.parse(data || JSON.stringify(defaultSettings));
  } catch (e) {
    return defaultSettings;
  }
}

async function saveSettings(newSettings) {
  await ensureOcrDirectory();
  try {
    const current = await getSettings();
    const updated = { ...current, ...newSettings };
    await fsp.writeFile(ocrSettingsPath, JSON.stringify(updated, null, 2), "utf8");
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// 5. Exporters
// ============================================================
async function exportToTxt(localDestPath, text) {
  try {
    await fsp.writeFile(localDestPath, text, "utf8");
    return { success: true, message: `Successfully exported to ${localDestPath}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function exportToJson(localDestPath, data) {
  try {
    await fsp.writeFile(localDestPath, JSON.stringify(data, null, 2), "utf8");
    return { success: true, message: `Successfully exported to ${localDestPath}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  checkOcrEngineStatus,
  processOcr,
  getQueueState,
  addToQueue,
  startQueue,
  pauseQueue,
  resumeQueue,
  cancelQueueItem,
  clearCompletedQueue,
  getOcrIndex,
  searchOcrIndex,
  getSettings,
  saveSettings,
  exportToTxt,
  exportToJson
};
