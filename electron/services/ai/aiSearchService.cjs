"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

const aiSearch = require("../../ai-search/index.cjs");
const { DatabaseManager } = aiSearch.database;
const { AIEngine, ModelRegistry, LocalEmbeddingRuntime, LocalVisionRuntime, LocalWhisperRuntime } = aiSearch.ai;
const { LocalOCRProvider, OCREngine } = aiSearch.ocr;
const { ExtractionManager, ExtractionRegistry, PlainTextExtractor, JsonExtractor, CsvExtractor, CodeExtractor, PdfExtractor, DocxExtractor } = aiSearch.extraction;
const { EmbeddingManager } = aiSearch.vectors;
const { SearchEngine } = aiSearch.search;
const { QueryUnderstanding } = aiSearch.query;
const { VideoDuration } = aiSearch.video;
const { ChangeCoordinator } = aiSearch.changes;
const { IndexCoordinator } = aiSearch.indexing;
const { FileScanner } = aiSearch.discovery;
const { HardwareInterface } = require("../../ai-search/hardware/hardwareInterface.cjs");
const { ModelDownloadManager } = require("../../ai-search/ai/modelDownloadManager.cjs");
const { CustomModelImporter } = require("../../ai-search/ai/customModelImporter.cjs");

class AISearchService {
  constructor() {
    this.isInitialized = false;
    this._initPromise = null;
    this.appDataDir = path.join(os.homedir(), ".gemini", "antigravity");
    this.modelsDir = path.join(this.appDataDir, "models");
    this.dbDir = path.join(this.appDataDir, "db");
    this.dbPath = path.join(this.dbDir, "nexora_ai_search.db");

    this.hardware = new HardwareInterface();
    this.modelRegistry = null;
    this.downloadManager = null;
    this.customImporter = null;

    this.db = null;
    this.aiEngine = null;
    this.ocrEngine = null;
    this.extractionManager = null;
    this.vectors = null;
    this.searchEngine = null;
    this.changeCoordinator = null;
    this.indexCoordinator = null;
    this.fileScanner = null;
    this.qu = new QueryUnderstanding();
    this.isIndexingPaused = false;
  }

  async initialize() {
    if (this.isInitialized) return true;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      try {
        if (!fs.existsSync(this.dbDir)) {
          fs.mkdirSync(this.dbDir, { recursive: true });
        }
        if (!fs.existsSync(this.modelsDir)) {
          fs.mkdirSync(this.modelsDir, { recursive: true });
        }

        // 1. Database Manager & Repositories
        this.db = new DatabaseManager({
          databaseDir: this.dbDir,
          databasePath: this.dbPath,
        });
        await this.db.initialize();

        // 2. Model Registry & Provisioning Tools
        this.modelRegistry = new ModelRegistry({
          metadataDir: path.join(this.modelsDir, "metadata"),
        });

        this.downloadManager = new ModelDownloadManager({
          modelsDir: this.modelsDir,
        });

        this.customImporter = new CustomModelImporter({
          modelsDir: this.modelsDir,
          modelRegistry: this.modelRegistry,
        });

        // 3. AI Engine with verified local runtimes
        this.aiEngine = new AIEngine({
          modelRegistry: this.modelRegistry,
          modelsDir: this.modelsDir,
        });

        const embeddingRuntime = new LocalEmbeddingRuntime({
          cacheDir: path.join(this.appDataDir, "models_cache"),
          modelsDir: this.modelsDir,
        });
        const visionRuntime = new LocalVisionRuntime({
          cacheDir: path.join(this.appDataDir, "models_cache"),
          modelsDir: this.modelsDir,
        });
        const whisperRuntime = new LocalWhisperRuntime({
          cacheDir: path.join(this.appDataDir, "models_cache"),
          modelsDir: this.modelsDir,
        });

        this.aiEngine.runtimes.register(embeddingRuntime);
        this.aiEngine.runtimes.register(visionRuntime);
        this.aiEngine.runtimes.register(whisperRuntime);
        this.aiEngine.manager.setRuntimes(this.aiEngine.runtimes);
        await this.aiEngine.initialize();

        // 4. OCR Engine
        const localOCR = new LocalOCRProvider({
          cacheDir: path.join(this.appDataDir, "models_cache"),
        });
        this.ocrEngine = new OCREngine({ providerId: "local_ocr" });
        this.ocrEngine.registerProvider(localOCR);
        this.ocrEngine.setActiveProvider("local_ocr");

        // 5. Content Extraction Manager
        const extractionRegistry = new ExtractionRegistry();
        extractionRegistry.register(new PlainTextExtractor());
        extractionRegistry.register(new JsonExtractor());
        extractionRegistry.register(new CsvExtractor());
        extractionRegistry.register(new CodeExtractor());
        extractionRegistry.register(new PdfExtractor());
        extractionRegistry.register(new DocxExtractor());
        this.extractionManager = new ExtractionManager({ registry: extractionRegistry });

        // 6. Vector Embedding Manager
        this.vectors = new EmbeddingManager(this.aiEngine, this.db);
        await this.vectors.initialize();

        // 7. Hybrid Search Engine
        this.searchEngine = new SearchEngine({
          databaseManager: this.db,
          embeddingManager: this.vectors,
        });

        // 8. Index Coordinator & Background Workers
        this.indexCoordinator = new IndexCoordinator({
          databaseManager: this.db,
          extractionManager: this.extractionManager,
          embeddingManager: this.vectors,
          ocrEngine: this.ocrEngine,
        });
        this.indexCoordinator.start();

        // 9. Change Coordinator & File Scanner
        this.changeCoordinator = new ChangeCoordinator({
          databaseManager: this.db,
          embeddingManager: this.vectors,
          indexCoordinator: this.indexCoordinator,
        });

        this.fileScanner = new FileScanner({
          db: this.db,
        });

        this.isInitialized = true;
        return true;
      } catch (err) {
        console.error("[AISearchService] Initialization failed:", err);
        return false;
      } finally {
        this._initPromise = null;
      }
    })();

    return this._initPromise;
  }

  // ----------------------------------------------------------
  // Settings & Preferences Persistence
  // ----------------------------------------------------------

  _getSettingsPath() {
    return path.join(this.appDataDir, "ai_settings.json");
  }

  loadSettings() {
    try {
      const p = this._getSettingsPath();
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      }
    } catch {}
    return {
      aiEnabled: true,
      aiSetupDismissed: false,
      embeddingModel: "bge-small-en-v1.5",
      visionModel: "clip-vit-base-patch32",
      audioModel: "whisper-tiny",
      ocrModel: "trocr-small-printed",
      perfPreset: "auto",
      cpuUsage: 20,
      pauseHighCpu: true,
      pauseGaming: true,
      pauseRendering: true,
      resumeAuto: true,
      resultsPerPage: "50",
      searchInFilename: true,
      searchInContent: true,
      searchInSemantic: true,
      searchImages: true,
      searchAudioVideo: true,
      searchOCR: true,
      searchInTags: true,
      searchInMetadata: true,
      processingMode: "local",
      neverUpload: true,
      askBeforeCloud: true,
      deleteTempData: true,
      autoStartIndexing: true,
      showFilePreview: true,
      openInNewTab: false,
      rememberHistory: true,
    };
  }

  saveSettings(newSettings) {
    try {
      const p = this._getSettingsPath();
      const current = this.loadSettings();
      const merged = { ...current, ...newSettings };
      fs.writeFileSync(p, JSON.stringify(merged, null, 2), "utf-8");
      return { success: true, settings: merged };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ----------------------------------------------------------
  // Hardware Detection & Recommendations
  // ----------------------------------------------------------

  getHardwareProfile() {
    return this.hardware.getProfile();
  }

  getRecommendedModels(capabilities = {}) {
    const hw = this.getHardwareProfile();
    if (!this.aiEngine || !this.aiEngine.selector) {
      return {
        tier: hw.tier,
        hardwareSummary: hw.summary,
        models: [],
        capabilities: [],
        totalSizeBytes: 0,
        estimatedDownloadMb: 0,
        estimatedDownloadFormatted: "~0 MB",
      };
    }
    return this.aiEngine.selector.selectRecommended(hw, capabilities);
  }

  // ----------------------------------------------------------
  // Model Provisioning, Status & Lifecycle Management
  // ----------------------------------------------------------

  getAllModels() {
    if (!this.modelRegistry) {
      const reg = new ModelRegistry();
      return reg.getAll().map((m) => this._formatModelProfile(m));
    }
    return this.modelRegistry.getAll().map((m) => this._formatModelProfile(m));
  }

  _formatModelProfile(m) {
    let category = "text";
    let categoryName = "Text & Document";
    let role = "Text Embedding & Document Search";
    let capability = "Semantic text search, PDF & document embeddings";
    let usedBy = ["PDF Search", "Document Search", "Code & Text", "Semantic Search"];

    const task = String(m.task || "").toUpperCase();
    const modality = String(m.modality || "").toUpperCase();

    if (task.includes("OCR") || m.id.includes("trocr") || m.id.includes("ocr")) {
      category = "ocr";
      categoryName = "OCR";
      role = "Optical Character Recognition";
      capability = "Text detection & recognition in images, screenshots and scanned documents";
      usedBy = ["Screenshot Search", "Scanned Documents", "Video Frame OCR"];
    } else if (task.includes("AUDIO") || modality === "AUDIO" || m.id.includes("whisper")) {
      category = "audio";
      categoryName = "Audio & Speech";
      role = "Speech Recognition & Transcription";
      capability = "Speech-to-text audio transcription with timestamp synchronization";
      usedBy = ["Audio File Search", "Video Speech Search", "Timestamp Navigation"];
    } else if (task.includes("IMAGE") || modality === "IMAGE" || m.id.includes("clip") || m.id.includes("vision")) {
      category = "vision";
      categoryName = "Image & Vision";
      role = "Visual Understanding & Similarity";
      capability = "Zero-shot image classification, visual concepts & photo search";
      usedBy = ["Image Search", "Photo Recognition", "Video Frame Analysis"];
    }

    const isInstalled = this.aiEngine?.manager ? this.aiEngine.manager.isInstalled(m.id) : false;
    const isDownloading = this.downloadManager ? this.downloadManager.isDownloading(m.id) : false;

    let status = "available";
    if (isDownloading) status = "downloading";
    else if (isInstalled) status = "ready";

    return {
      id: m.id,
      name: m.name,
      provider: m.provider,
      task: m.task,
      modality: m.modality,
      category,
      categoryName,
      role,
      capability,
      usedBy,
      qualityTier: m.qualityTier,
      sizeBytes: m.sizeBytes,
      sizeFormatted: this.formatBytes(m.sizeBytes),
      contextTokens: m.capabilities?.maxTokens || (category === "text" ? 8192 : null),
      type: m.quantization ? `Quantized ${m.quantization.toUpperCase()} / ONNX` : "Local ONNX Model",
      runtime: m.runtime || "Local ONNX Runtime",
      status,
      isInstalled,
      isDownloading,
      isCustom: Boolean(m.isCustom),
      isOfficial: Boolean(m.isOfficial),
      customPath: m.customPath || null,
      isLocal: true,
      parameters: m.sizeBytes > 200 * 1024 * 1024 ? "137M" : (m.sizeBytes > 100 * 1024 * 1024 ? "86M" : "33M"),
      description: m.name,
    };
  }

  getModelsStatus() {
    const all = this.getAllModels();
    const settings = this.loadSettings();

    const isTextReady = all.some((m) => m.category === "text" && m.isInstalled);
    const isVisionReady = all.some((m) => m.category === "vision" && m.isInstalled);
    const isOCRReady = all.some((m) => m.category === "ocr" && m.isInstalled);
    const isAudioReady = all.some((m) => m.category === "audio" && m.isInstalled);

    const isSetupRequired = !isTextReady;
    const isPartial = isTextReady && (!isVisionReady || !isOCRReady || !isAudioReady);
    const allReady = isTextReady && isVisionReady && isOCRReady && isAudioReady;

    let overallState = "READY";
    if (isSetupRequired) {
      overallState = "SETUP_REQUIRED";
    } else if (isPartial) {
      overallState = "PARTIAL";
    }

    const recommendedPack = this.getRecommendedModels({
      text: true,
      image: settings.searchImages,
      ocr: settings.searchOCR,
      audio: settings.searchAudioVideo,
    });

    return {
      overallState,
      isSetupRequired,
      isPartial,
      allReady,
      isTextReady,
      isVisionReady,
      isOCRReady,
      isAudioReady,
      activeModels: this.getActiveModels(),
      installedCount: all.filter((m) => m.isInstalled).length,
      totalModels: all.length,
      recommendedPack,
      aiSetupDismissed: Boolean(settings.aiSetupDismissed),
    };
  }

  getActiveModels() {
    const settings = this.loadSettings();
    const all = this.getAllModels();
    const activeEmbedding = all.find((m) => m.id === settings.embeddingModel) || all.find((m) => m.category === "text" && m.isInstalled) || all[0];
    const activeVision = all.find((m) => m.id === settings.visionModel) || all.find((m) => m.category === "vision" && m.isInstalled) || all.find((m) => m.category === "vision");
    const activeAudio = all.find((m) => m.id === settings.audioModel) || all.find((m) => m.category === "audio" && m.isInstalled) || all.find((m) => m.category === "audio");
    const activeOCR = all.find((m) => m.id === settings.ocrModel) || all.find((m) => m.category === "ocr" && m.isInstalled) || all.find((m) => m.category === "ocr");

    return {
      embedding: activeEmbedding,
      vision: activeVision,
      audio: activeAudio,
      ocr: activeOCR,
    };
  }

  async downloadModel(modelId, sender = null) {
    await this.initialize();
    const model = this.modelRegistry.getById(modelId);
    if (!model) {
      return { success: false, error: `Model '${modelId}' not found in registry.` };
    }

    try {
      const onProg = (evt) => {
        if (sender && typeof sender.send === "function") {
          sender.send("ai:progress", evt);
        }
      };

      await this.downloadManager.downloadModel(model, onProg);
      await this.aiEngine.manager.verify(modelId);

      return {
        success: true,
        modelId,
        message: `Model ${model.name} downloaded and ready.`,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async downloadRecommendedPack(capabilities = {}, sender = null) {
    await this.initialize();
    const pack = this.getRecommendedModels(capabilities);
    const modelsToDownload = pack.models.filter((m) => !this.aiEngine.manager.isInstalled(m.id));

    if (modelsToDownload.length === 0) {
      return { success: true, message: "All recommended models are already installed." };
    }

    const totalCount = modelsToDownload.length;
    let completedCount = 0;

    for (const m of modelsToDownload) {
      const onProg = (evt) => {
        if (sender && typeof sender.send === "function") {
          const overallPackPercent = Math.min(100, Math.round(((completedCount + (evt.progress / 100)) / totalCount) * 100));
          sender.send("ai:progress", {
            ...evt,
            currentModelIndex: completedCount + 1,
            totalModelsInPack: totalCount,
            packProgress: overallPackPercent,
          });
        }
      };

      try {
        await this.downloadManager.downloadModel(m, onProg);
        await this.aiEngine.manager.verify(m.id);
        completedCount++;
      } catch (err) {
        return {
          success: false,
          error: `Failed downloading ${m.name}: ${err.message}`,
          completed: completedCount,
        };
      }
    }

    // Mark setup as completed in settings
    this.saveSettings({ aiSetupDismissed: false, aiEnabled: true });

    return {
      success: true,
      message: `Recommended AI Pack (${totalCount} models) installed and ready.`,
      installedCount: totalCount,
    };
  }

  cancelDownload(modelId) {
    if (!this.downloadManager) return { success: false };
    if (modelId) {
      const cancelled = this.downloadManager.cancelDownload(modelId);
      return { success: cancelled };
    }
    this.downloadManager.cancelAll();
    return { success: true };
  }

  async verifyModel(modelId) {
    await this.initialize();
    try {
      const res = await this.aiEngine.manager.verify(modelId);
      return {
        success: res.ok,
        healthy: res.healthy,
        modelId,
        status: res.status,
        message: res.message || res.reason,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  setActiveModel(task, modelId) {
    const all = this.getAllModels();
    const target = all.find((m) => m.id === modelId);
    if (!target) {
      return { success: false, error: `Model ${modelId} not found` };
    }
    const update = {};
    if (task === "embedding" || target.category === "text") update.embeddingModel = modelId;
    if (task === "vision" || target.category === "vision") update.visionModel = modelId;
    if (task === "audio" || target.category === "audio") update.audioModel = modelId;
    if (task === "ocr" || target.category === "ocr") update.ocrModel = modelId;

    this.saveSettings(update);
    return { success: true, activeModels: this.getActiveModels() };
  }

  uninstallModel(modelId) {
    if (!this.aiEngine?.manager) return { success: false, error: "Not initialized" };
    const success = this.aiEngine.manager.uninstall(modelId);
    return { success };
  }

  validateCustomModel(sourcePath) {
    if (!this.customImporter) {
      return { valid: false, compatible: false, error: "Custom model importer unavailable" };
    }
    return this.customImporter.validateSource(sourcePath);
  }

  async importCustomModel(validationResult, userOverrides = {}) {
    await this.initialize();
    if (!this.customImporter) {
      return { success: false, error: "Custom model importer unavailable" };
    }
    try {
      const res = await this.customImporter.importModel(validationResult, userOverrides);
      if (res?.success) {
        await this.aiEngine.manager.verify(res.modelId);
      }
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ----------------------------------------------------------
  // Storage & Cache Information
  // ----------------------------------------------------------

  getStorageInfo() {
    let dbSize = 0;
    try {
      if (fs.existsSync(this.dbPath)) {
        dbSize = fs.statSync(this.dbPath).size;
      }
    } catch {}

    let cacheSize = 0;
    const cacheDir = path.join(this.appDataDir, "models_cache");
    try {
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        for (const f of files) {
          try {
            cacheSize += fs.statSync(path.join(cacheDir, f)).size;
          } catch {}
        }
      }
    } catch {}

    let modelsDirSize = 0;
    try {
      if (fs.existsSync(this.modelsDir)) {
        const getDirSize = (d) => {
          let s = 0;
          const entries = fs.readdirSync(d);
          for (const e of entries) {
            const full = path.join(d, e);
            try {
              const st = fs.statSync(full);
              if (st.isDirectory()) s += getDirSize(full);
              else s += st.size;
            } catch {}
          }
          return s;
        };
        modelsDirSize = getDirSize(this.modelsDir);
      }
    } catch {}

    return {
      databasePath: this.dbPath,
      databaseSizeBytes: dbSize,
      databaseSizeFormatted: this.formatBytes(dbSize),
      modelsPath: this.modelsDir,
      modelsSizeBytes: modelsDirSize,
      modelsSizeFormatted: this.formatBytes(modelsDirSize),
      cachePath: cacheDir,
      cacheSizeBytes: cacheSize,
      cacheSizeFormatted: this.formatBytes(cacheSize),
      totalVectorCount: this.vectors?.store?.count ? this.vectors.store.count() : 0,
      totalFilesIndexed: this.db?.files?.count({ status: "indexed" }) || 0,
    };
  }

  clearCache() {
    const cacheDir = path.join(this.appDataDir, "models_cache");
    let reclaimed = 0;
    try {
      if (fs.existsSync(cacheDir)) {
        const entries = fs.readdirSync(cacheDir);
        for (const e of entries) {
          try {
            const p = path.join(cacheDir, e);
            const st = fs.statSync(p);
            reclaimed += st.size;
            fs.unlinkSync(p);
          } catch {}
        }
      }
    } catch {}
    return { success: true, reclaimedBytes: reclaimed, reclaimedFormatted: this.formatBytes(reclaimed) };
  }

  optimizeDatabase() {
    if (!this.db || !this.db.db) return { success: false, error: "Database not ready" };
    try {
      this.db.db.exec("VACUUM;");
      return { success: true, message: "SQLite database defragmented and optimized" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  checkIntegrity() {
    if (!this.db || !this.db.db) return { success: false, healthy: false, error: "Database not ready" };
    try {
      const row = this.db.db.prepare("PRAGMA integrity_check").get();
      const isOk = row && (row.integrity_check === "ok" || Object.values(row)[0] === "ok");
      return {
        success: true,
        healthy: isOk,
        status: isOk ? "Healthy" : "Integrity issues detected",
        errorsCount: isOk ? 0 : 1,
        details: row,
      };
    } catch (err) {
      return { success: false, healthy: false, error: err.message };
    }
  }

  repairIndex() {
    if (!this.db || !this.db.db) return { success: false, error: "Database not ready" };
    try {
      this.db.db.exec("REINDEX;");
      return { success: true, message: "Index repair completed successfully" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  clearAIData() {
    if (!this.db || !this.db.db) return { success: false, error: "Database not ready" };
    try {
      this.db.db.exec("DELETE FROM file_ai; DELETE FROM file_vectors; DELETE FROM file_search; DELETE FROM file_content; DELETE FROM files; VACUUM;");
      if (this.vectors?.store) {
        this.vectors.store._memoryStore?.clear();
      }
      return { success: true, message: "AI index data purged successfully" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  formatDate(dateVal) {
    if (!dateVal) return "Recently";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "Recently";
      return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "Recently";
    }
  }

  getCategoryType(ext) {
    const e = String(ext || "").toLowerCase().replace(/^\./, "");
    if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"].includes(e)) return "images";
    if (["mp4", "mkv", "avi", "mov", "webm", "m4v", "wmv"].includes(e)) return "videos";
    if (["mp3", "wav", "flac", "aac", "m4a", "ogg", "wma", "opus"].includes(e)) return "audio";
    return "documents";
  }

  // ----------------------------------------------------------
  // Real File Indexing Pipeline & Rebuild Index
  // ----------------------------------------------------------

  async rebuildIndex(targetLocations = null, sender = null) {
    await this.initialize();
    const startTime = Date.now();

    // Resolve target locations
    let locs = [];
    if (Array.isArray(targetLocations) && targetLocations.length > 0) {
      locs = targetLocations;
    } else if (typeof targetLocations === "string" && targetLocations.trim()) {
      locs = [targetLocations.trim()];
    } else {
      const home = os.homedir();
      const defaultDirs = [
        path.join(home, "Documents"),
        path.join(home, "Downloads"),
        path.join(home, "Pictures"),
        path.join(home, "Desktop"),
      ].filter((d) => fs.existsSync(d));
      locs = defaultDirs.length > 0 ? defaultDirs : [home];
    }

    let totalDiscovered = 0;
    let totalIndexed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let embeddingsGenerated = 0;

    const settings = this.loadSettings();
    const isAiSearchEnabled = settings.aiEnabled !== false;
    const activeEmbeddingModel = settings.embeddingModel || "bge-small-en-v1.5";
    const canEmbed = isAiSearchEnabled && Boolean(this.aiEngine?.manager?.isInstalled(activeEmbeddingModel));

    try {
      const scanResult = await this.fileScanner.scan({ locations: locs });
      const discoveredFiles = scanResult.files || [];
      totalDiscovered = discoveredFiles.length;

      const totalCount = discoveredFiles.length;

      for (let i = 0; i < totalCount; i++) {
        if (this.isIndexingPaused) {
          break;
        }

        const fileRecord = discoveredFiles[i];
        const percent = totalCount > 0 ? Math.round(((i + 1) / totalCount) * 100) : 100;

        // Emit live indexing progress
        const progressPayload = {
          currentFile: fileRecord.name,
          currentPath: fileRecord.path,
          processed: i + 1,
          total: totalCount,
          percent,
          embeddingsCount: embeddingsGenerated,
          stage: "indexing",
        };

        if (sender && typeof sender.send === "function") {
          sender.send("ai:indexing-progress", progressPayload);
        }

        try {
          // 1. Upsert file record in database
          this.db.files.upsert(fileRecord);

          // 2. Extract content and update FTS5
          let extractedText = "";
          if (this.extractionManager && this.extractionManager.canExtract(fileRecord)) {
            const extRes = await this.extractionManager.extractAndPersist(fileRecord, this.db);
            if (extRes.success && extRes.result?.text) {
              extractedText = extRes.result.text;
            }
          } else {
            // Still index filename & path in FTS5
            if (this.db.fts) {
              this.db.fts.updateSearchableContent(fileRecord.file_id, {
                text: fileRecord.name,
              });
            }
          }

          // 3. Generate and store embeddings if AI model is installed & ready
          if (canEmbed && this.vectors) {
            const textToEmbed = extractedText
              ? `${fileRecord.name}. ${extractedText.slice(0, 2000)}`
              : fileRecord.name;
            const embRes = await this.vectors.embedFile(fileRecord, { text: textToEmbed });
            if (embRes.success && !embRes.skipped) {
              embeddingsGenerated++;
            }
          }

          // 4. Mark status indexed
          this.db.files.updateStatus(fileRecord.file_id, "indexed");
          totalIndexed++;
        } catch (fileErr) {
          totalFailed++;
          try {
            this.db.files.updateStatus(fileRecord.file_id, "failed", fileErr.message);
          } catch {}
        }
      }

      const tookMs = Date.now() - startTime;
      return {
        success: true,
        discovered: totalDiscovered,
        indexed: totalIndexed,
        skipped: totalSkipped,
        failed: totalFailed,
        embeddingsGenerated,
        duration: tookMs,
        count: totalIndexed,
      };
    } catch (err) {
      console.error("[AISearchService] rebuildIndex failed:", err);
      return {
        success: false,
        error: err.message,
        discovered: totalDiscovered,
        indexed: totalIndexed,
        failed: totalFailed,
      };
    }
  }

  // ----------------------------------------------------------
  // Search & Retrieval with Diagnostics & Model Availability Safety
  // ----------------------------------------------------------

  async search(rawQuery, filters = {}, options = {}) {
    await this.initialize();

    const q = (rawQuery || "").trim();
    if (!q && (!filters || Object.keys(filters).length === 0)) {
      return { status: "empty", results: [], total: 0, tookMs: 0 };
    }

    const startTime = Date.now();
    const settings = this.loadSettings();
    const activeEmbeddingModel = settings.embeddingModel || "bge-small-en-v1.5";
    const isVectorReady = this.aiEngine?.manager ? this.aiEngine.manager.isInstalled(activeEmbeddingModel) : false;

    try {
      const searchOptions = {
        ...options,
        useVector: isVectorReady && settings.searchInSemantic !== false,
        useFts: settings.searchInContent !== false,
        useMetadata: settings.searchInFilename !== false,
        fileType: filters.fileType && filters.fileType !== "all" ? filters.fileType : undefined,
        drive: filters.drive && filters.drive !== "all" ? filters.drive : undefined,
      };

      if (filters.duration) {
        searchOptions.durationFilter = VideoDuration.parse(filters.duration);
      }

      const outcome = await this.searchEngine.search(q, searchOptions);
      const rawResults = outcome.results || [];
      const tookMs = Date.now() - startTime;

      // Backend Diagnostics Logging
      console.log(
        `[AISearch Diagnostics] Query: "${q}" | Total: ${rawResults.length} | VectorReady: ${isVectorReady} | IndexedFiles: ${this.db?.files?.count({ status: "indexed" }) || 0} | Took: ${tookMs}ms`
      );

      if (rawResults.length === 0) {
        return {
          status: "no-results",
          results: [],
          total: 0,
          tookMs,
          queryInfo: {
            ...outcome.query,
            isVectorReady,
            diagnostics: {
              activeModel: activeEmbeddingModel,
              indexedFilesCount: this.db?.files?.count({ status: "indexed" }) || 0,
              vectorCount: this.vectors?.store?.count ? this.vectors.store.count() : 0,
            },
          },
        };
      }

      // Format results for UI presentation
      const formattedResults = rawResults.map((r) => {
        let aiMeta = null;
        let aiDescription = "";
        let aiTags = [];

        if (this.db && this.db.isOpen && this.db.ai) {
          const aiRec = this.db.ai.findByFileId(r.fileId);
          if (aiRec) {
            aiDescription = aiRec.description || "";
            if (aiRec.tags) {
              try {
                aiTags = JSON.parse(aiRec.tags);
              } catch {
                aiTags = Array.isArray(aiRec.tags) ? aiRec.tags : [];
              }
            }
            if (aiRec.entities) {
              try {
                aiMeta = typeof aiRec.entities === "string" ? JSON.parse(aiRec.entities) : aiRec.entities;
              } catch {}
            }
          }
        }

        const extClean = (r.extension || path.extname(r.path || "")).replace(/^\./, "").toUpperCase();
        const typeCategory = this.getCategoryType(r.extension || path.extname(r.path || ""));

        // Extract timestamp evidence if available
        let bestTimestamp = null;
        if (aiMeta) {
          if (Array.isArray(aiMeta.ocrFrames) && aiMeta.ocrFrames.length > 0) {
            bestTimestamp = aiMeta.ocrFrames[0].timestampFormatted || "00:15";
          } else if (Array.isArray(aiMeta.transcriptSegments) && aiMeta.transcriptSegments.length > 0) {
            bestTimestamp = aiMeta.transcriptSegments[0].timestampFormatted || "00:30";
          }
        }

        return {
          id: r.fileId,
          name: r.name,
          path: path.dirname(r.path),
          fullPath: r.path,
          type: typeCategory,
          ext: extClean || "FILE",
          size: this.formatBytes(r.size),
          sizeBytes: r.size,
          date: this.formatDate(r.modifiedAt),
          tags: aiTags.length > 0 ? aiTags : [typeCategory],
          score: `${Math.min(99, Math.max(75, Math.round(r.score * 100)))}% match`,
          scoreValue: r.score,
          summary: aiDescription || `Matched content via ${r.matchedBy?.join(", ") || "AI Search"}`,
          matchedBy: r.matchedBy || ["hybrid"],
          evidence: {
            timestamp: bestTimestamp,
            duration: aiMeta?.duration || null,
            ocrFrames: aiMeta?.ocrFrames || [],
            transcriptSegments: aiMeta?.transcriptSegments || [],
            scenes: aiMeta?.scenes || [],
            objects: aiMeta?.objects || [],
          },
          drive: r.path ? r.path.slice(0, 2).toUpperCase() : "C:",
        };
      });

      return {
        status: "results",
        results: formattedResults,
        total: formattedResults.length,
        tookMs,
        queryInfo: {
          ...outcome.query,
          isVectorReady,
        },
      };
    } catch (err) {
      console.error("[AISearchService] Search failed:", err);
      return {
        status: "error",
        error: err.message,
        results: [],
        total: 0,
      };
    }
  }

  getStatus() {
    const activeModels = this.getActiveModels();
    return {
      isInitialized: this.isInitialized,
      isDbReady: Boolean(this.db?.isOpen),
      isVectorsReady: Boolean(this.vectors?.isInitialized),
      isIndexingPaused: this.isIndexingPaused,
      activeModels,
      modelProfiles: ["bge-small-en-v1.5", "all-minilm-l6-v2", "nomic-embed-text-v1.5", "clip-vit-base-patch32", "trocr-small-printed", "whisper-tiny"],
    };
  }

  getIndexStatus() {
    if (!this.db || !this.db.isOpen) {
      return {
        totalIndexedFiles: 0,
        filesDiscovered: 0,
        filesIndexed: 0,
        filesPending: 0,
        filesFailed: 0,
        vectorCount: 0,
        ready: false,
        isIndexingPaused: this.isIndexingPaused,
        database: "Closed",
      };
    }

    const totalDiscovered = this.db.files?.count() || 0;
    const totalIndexed = this.db.files?.count({ status: "indexed" }) || 0;
    const totalDiscoveredStatus = this.db.files?.count({ status: "discovered" }) || 0;
    const totalPendingStatus = this.db.files?.count({ status: "pending" }) || 0;
    const totalFailed = this.db.files?.count({ status: "failed" }) || 0;
    const vectorCount = this.vectors?.store?.count ? this.vectors.store.count() : 0;

    return {
      totalIndexedFiles: totalIndexed,
      filesDiscovered: totalDiscovered,
      filesIndexed: totalIndexed,
      filesPending: totalDiscoveredStatus + totalPendingStatus,
      filesFailed: totalFailed,
      vectorCount,
      ready: Boolean(this.db.isOpen),
      database: "Ready",
      isIndexingPaused: this.isIndexingPaused,
    };
  }

  pauseIndexing() {
    this.isIndexingPaused = true;
    if (this.indexCoordinator) {
      this.indexCoordinator.pause();
    }
    return { success: true, isPaused: true };
  }

  resumeIndexing() {
    this.isIndexingPaused = false;
    if (this.indexCoordinator) {
      this.indexCoordinator.resume();
    }
    return { success: true, isPaused: false };
  }

  close() {
    try {
      if (this.indexCoordinator) {
        this.indexCoordinator.stop();
      }
      if (this.db && this.db.isOpen) {
        this.db.close();
      }
      this.isInitialized = false;
    } catch (err) {
      console.warn("[AISearchService] Close warning:", err.message);
    }
  }
}

const defaultAISearchService = new AISearchService();

module.exports = {
  AISearchService,
  aiSearchService: defaultAISearchService,
};
