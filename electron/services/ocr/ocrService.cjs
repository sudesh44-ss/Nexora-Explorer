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

// Active Jobs for cancellation tracking
const activeJobs = new Map(); // jobId -> { childProcess, isCancelled: false }

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
    if ($i -gt 0) {
        $line = [Console]::ReadLine()
        if ($line -eq "CANCEL") {
            break
        }
    }
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

// Start PDF rendering child process that runs page-by-page on stdin signal
function startPdfRenderer(pdfPath, outputDir, dpi = 150) {
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

  let totalPagesResolver = null;
  const totalPagesPromise = new Promise((resolve) => {
    totalPagesResolver = resolve;
  });

  const pageResolvers = new Map();

  child.stdout.on("data", (data) => {
    const str = data.toString();
    const lines = str.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith("TOTAL_PAGES:")) {
        const total = parseInt(line.split(":")[1], 10);
        if (totalPagesResolver) {
          totalPagesResolver(total);
          totalPagesResolver = null;
        }
      } else if (line.startsWith("RENDERED_PAGE:")) {
        const pageIdx = parseInt(line.split(":")[1], 10);
        const resolver = pageResolvers.get(pageIdx);
        if (resolver) {
          resolver();
          pageResolvers.delete(pageIdx);
        }
      }
    }
  });

  let exited = false;
  let exitCode = null;
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  child.on("close", (code) => {
    exited = true;
    exitCode = code;
    try {
      fs.unlinkSync(psFile);
    } catch (e) {}
    for (const resolver of pageResolvers.values()) {
      resolver(new Error(`PowerShell process exited with code ${code}`));
    }
    if (totalPagesResolver) {
      totalPagesResolver(0);
    }
  });

  return {
    child,
    totalPagesPromise,
    waitForPage: (index) => {
      if (exited) {
        return Promise.reject(new Error(stderr || `PowerShell process exited with code ${exitCode}`));
      }
      return new Promise((resolve, reject) => {
        pageResolvers.set(index, resolve);
      });
    },
    next: () => {
      if (child.stdin.writable) {
        child.stdin.write("NEXT\n");
      }
    },
    cancel: () => {
      if (child.stdin.writable) {
        child.stdin.write("CANCEL\n");
      }
      child.kill();
    },
    close: () => {
      child.kill();
    }
  };
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

// Cancel an active OCR job
function cancelOcrJob(jobId) {
  console.log(`[OCR] Cancelling job ${jobId}`);
  const jobState = activeJobs.get(jobId);
  if (jobState) {
    jobState.isCancelled = true;
    if (jobState.childProcess) {
      try {
        jobState.childProcess.kill();
      } catch (e) {}
    }
    return { success: true };
  }
  return { success: false, error: "Job not found" };
}

async function processOcr(filePath, options = {}, eventSender = null, itemId = null) {
  const startTime = Date.now();
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  const jobId = itemId || options.jobId || `ocr-${Date.now()}`;
  activeJobs.set(jobId, { childProcess: null, isCancelled: false });

  const sendProgress = (stage, status, percent, currentPage = 0, totalPages = 0, completedPages = 0, message = "") => {
    const isCancelled = activeJobs.get(jobId)?.isCancelled;
    if (isCancelled) {
      status = "cancelled";
      stage = "CANCELLED";
      message = "OCR cancelled";
    }
    console.log(`[OCR] Progress: job=${jobId}, status=${status}, stage=${stage}, page=${currentPage}/${totalPages}, percent=${percent}%`);
    if (eventSender) {
      const elapsedMs = Date.now() - startTime;
      let estimatedRemainingMs = null;
      if (totalPages > 0 && completedPages > 0) {
        const avgTimePerPage = elapsedMs / completedPages;
        const remainingPages = totalPages - completedPages;
        estimatedRemainingMs = Math.round(avgTimePerPage * remainingPages);
      }
      eventSender.send("ocr:progress", {
        jobId,
        filePath,
        status,
        stage,
        currentPage,
        totalPages,
        completedPages,
        percent,
        elapsedMs,
        estimatedRemainingMs,
        message
      });
    }
  };

  try {
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
      sendProgress("PREPARING", "processing", 0, 0, 0, 0, "Loading PDF...");
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

      if (activeJobs.get(jobId)?.isCancelled) {
        throw new Error("OCR_CANCELLED");
      }

      const cleanTest = selectableText.replace(/\s/g, "");
      if (cleanTest.length > 50) {
        // Selectable text exists! Return directly.
        sendProgress("FINALIZING", "processing", 50, 0, pages, 0, "Direct Text Extraction...");
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
        sendProgress("COMPLETED", "completed", 100, pages, pages, pages, "Completed");
        activeJobs.delete(jobId);
        return result;
      }

      // Scanned PDF Flow (rendering pages and running OCR)
      sendProgress("PREPARING", "processing", 0, 0, 0, 0, "Scanned PDF detected. Running OCR...");
      
      const status = await checkOcrEngineStatus();
      if (!status.available) {
        throw new Error("OCR engine is not installed/configured.");
      }
      tPath = status.path;

      if (activeJobs.get(jobId)?.isCancelled) {
        throw new Error("OCR_CANCELLED");
      }

      const tempOutputDir = path.join(ocrDir, `pdf_pages_${Date.now()}`);
      await fsp.mkdir(tempOutputDir, { recursive: true });

      const renderer = startPdfRenderer(filePath, tempOutputDir, dpi);
      
      const jobState = activeJobs.get(jobId);
      if (jobState) {
        jobState.childProcess = renderer.child;
      }

      try {
        sendProgress("PREPARING", "processing", 0, 0, 0, 0, "Detecting page count...");
        const totalPdfPages = await renderer.totalPagesPromise;
        if (totalPdfPages <= 0) {
          throw new Error("Failed to detect PDF pages or PDF is empty");
        }

        let combinedText = "";
        let confidenceSum = 0;
        let validOcrPages = 0;

        for (let i = 0; i < totalPdfPages; i++) {
          if (activeJobs.get(jobId)?.isCancelled) {
            throw new Error("OCR_CANCELLED");
          }

          // Rendering stage
          sendProgress("EXTRACTING_PDF", "processing", Math.round((i / totalPdfPages) * 100), i + 1, totalPdfPages, i, `Rendering page ${i + 1}...`);
          
          if (i > 0) {
            renderer.next();
          }
          await renderer.waitForPage(i);

          if (activeJobs.get(jobId)?.isCancelled) {
            throw new Error("OCR_CANCELLED");
          }

          // OCR stage
          sendProgress("OCR_PROCESSING", "processing", Math.round(((i + 0.5) / totalPdfPages) * 100), i + 1, totalPdfPages, i, `Running OCR on page ${i + 1}...`);

          const pageImgPath = path.join(tempOutputDir, `page-${i}.png`);
          if (!fs.existsSync(pageImgPath)) {
            throw new Error(`Rendered page image not found for page ${i + 1}`);
          }

          const runOcrPromise = runOcrOnImage(tPath, pageImgPath, language);
          
          const js = activeJobs.get(jobId);
          if (js) {
            js.childProcess = queue.activeChildProcess; // running Tesseract
          }

          const pageResult = await runOcrPromise;

          if (js) {
            js.childProcess = renderer.child; // restore renderer
          }

          combinedText += `\n--- Page ${i + 1} ---\n` + pageResult.text;
          confidenceSum += pageResult.confidence;
          validOcrPages++;

          try {
            await fsp.unlink(pageImgPath);
          } catch (e) {}

          // Completed page progress
          sendProgress("OCR_PROCESSING", "processing", Math.round((validOcrPages / totalPdfPages) * 100), i + 1, totalPdfPages, validOcrPages, `Page ${i + 1} completed`);
        }

        sendProgress("FINALIZING", "processing", 95, totalPdfPages, totalPdfPages, validOcrPages, "Combining extracted text...");

        const averageConfidence = validOcrPages > 0 ? Math.round(confidenceSum / validOcrPages) : 85;
        const processingTime = Date.now() - startTime;

        // Clean up temp directory
        try {
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
        
        sendProgress("COMPLETED", "completed", 100, totalPdfPages, totalPdfPages, validOcrPages, "OCR completed");
        
        activeJobs.delete(jobId);
        return result;

      } catch (err) {
        renderer.close();
        try {
          const files = await fsp.readdir(tempOutputDir);
          for (const file of files) {
            await fsp.unlink(path.join(tempOutputDir, file));
          }
          await fsp.rmdir(tempOutputDir);
        } catch (e) {}
        throw err;
      } finally {
        renderer.close();
      }
    }

    // 3. Handle Standard Image Files
    sendProgress("PREPARING", "processing", null, 0, 1, 0, "Preparing image...");
    
    if (activeJobs.get(jobId)?.isCancelled) {
      throw new Error("OCR_CANCELLED");
    }

    sendProgress("OCR_PROCESSING", "processing", null, 0, 1, 0, "Running Tesseract...");
    
    const ocrPromise = runOcrOnImage(tPath, filePath, language);
    const js = activeJobs.get(jobId);
    if (js) {
      js.childProcess = queue.activeChildProcess;
    }

    const ocrRes = await ocrPromise;
    
    sendProgress("FINALIZING", "processing", 95, 1, 1, 0, "Reading OCR result...");
    
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
    
    sendProgress("COMPLETED", "completed", 100, 1, 1, 1, "OCR completed");
    activeJobs.delete(jobId);
    return result;

  } catch (err) {
    activeJobs.delete(jobId);
    if (err.message === "OCR_CANCELLED" || activeJobs.get(jobId)?.isCancelled) {
      sendProgress("CANCELLED", "cancelled", 0, 0, 0, 0, "OCR cancelled");
      return { success: false, error: "OCR cancelled by user", cancelled: true };
    } else {
      sendProgress("ERROR", "failed", 0, 0, 0, 0, err.message);
      throw err;
    }
  }
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
      cancelOcrJob(itemId);
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
  exportToJson,
  cancelOcrJob
};
