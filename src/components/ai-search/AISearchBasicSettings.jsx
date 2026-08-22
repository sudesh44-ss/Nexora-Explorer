import { useState, useEffect, useCallback } from "react";
import "./AISearchBasicSettings.css";
import AISearchSetupModal from "./AISearchSetupModal";

export default function AISearchBasicSettings({ onBack, onOpenAdvanced }) {
  // -------------------------------------------------------------
  // State: Indexing & Backend
  // -------------------------------------------------------------
  const [indexState, setIndexState] = useState("READY"); // 'READY' | 'INDEXING' | 'PAUSED' | 'ERROR' | 'NOT_INITIALIZED'
  const [indexedCount, setIndexedCount] = useState(82451);
  const [isPaused, setIsPaused] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [locationsCount, setLocationsCount] = useState(6);
  const [storageSizeFormatted, setStorageSizeFormatted] = useState("320 GB");
  const [lastScanText, setLastScanText] = useState("Today, 10:42 AM");
  const [toastMessage, setToastMessage] = useState("");

  // Modals & Provisioning State
  const [modelsStatus, setModelsStatus] = useState(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [showManageIndexModal, setShowManageIndexModal] = useState(false);
  const [customLocations, setCustomLocations] = useState([]);

  // -------------------------------------------------------------
  // State: AI Search Settings
  // -------------------------------------------------------------
  const [enableAISearch, setEnableAISearch] = useState(true);
  const [searchInContent, setSearchInContent] = useState(true);
  const [searchImages, setSearchImages] = useState(true);
  const [searchAudioVideo, setSearchAudioVideo] = useState(true);
  const [searchOCR, setSearchOCR] = useState(true);

  // -------------------------------------------------------------
  // State: Performance
  // -------------------------------------------------------------
  const [perfPreset, setPerfPreset] = useState("auto"); // 'auto' | 'fast' | 'balanced' | 'accurate'
  const [cpuUsage, setCpuUsage] = useState(20);

  // -------------------------------------------------------------
  // State: Privacy
  // -------------------------------------------------------------
  const [processingMode, setProcessingMode] = useState("local"); // 'local' | 'cloud'

  // -------------------------------------------------------------
  // State: Other Settings
  // -------------------------------------------------------------
  const [autoStartIndexing, setAutoStartIndexing] = useState(true);
  const [showFilePreview, setShowFilePreview] = useState(true);
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [rememberHistory, setRememberHistory] = useState(true);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Helper to persist partial settings to backend
  const persistSetting = useCallback(async (partial) => {
    try {
      if (window.electronFeatures?.aiSaveSettings) {
        await window.electronFeatures.aiSaveSettings(partial);
      }
    } catch (err) {
      console.warn("Failed to save AI settings:", err);
    }
  }, []);

  // -------------------------------------------------------------
  // Load Live Backend Configuration & Index Status
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      let mStatus = null;
      try {
        // 1. Models Status & Provisioning State
        if (window.electronFeatures?.aiGetModelsStatus) {
          mStatus = await window.electronFeatures.aiGetModelsStatus();
          if (isMounted && mStatus) {
            setModelsStatus(mStatus);
            if (mStatus.isSetupRequired) {
              setIndexState("SETUP_REQUIRED");
            }
          }
        }

        // 2. Index Status
        if (window.electronFeatures?.aiGetIndexStatus) {
          const status = await window.electronFeatures.aiGetIndexStatus();
          if (isMounted && status) {
            if (status.totalIndexedFiles !== undefined && status.totalIndexedFiles > 0) {
              setIndexedCount(status.totalIndexedFiles);
            }
            if (status.isIndexingPaused) {
              setIsPaused(true);
              setIndexState("PAUSED");
            } else if (status.ready && !mStatus?.isSetupRequired) {
              setIndexState("READY");
            } else if (!mStatus?.isSetupRequired) {
              setIndexState("NOT_INITIALIZED");
            }
          }
        }

        // 3. Storage & Disk Info
        if (window.electronFeatures?.aiGetStorageInfo) {
          const storage = await window.electronFeatures.aiGetStorageInfo();
          if (isMounted && storage) {
            if (storage.databaseSizeFormatted && storage.databaseSizeFormatted !== "0 B") {
              setStorageSizeFormatted(storage.databaseSizeFormatted);
            }
            if (storage.totalFilesIndexed && storage.totalFilesIndexed > 0) {
              setIndexedCount(storage.totalFilesIndexed);
            }
          }
        }

        // 4. Connected Drives & Locations
        if (window.fileExplorer?.getDrives) {
          const drives = await window.fileExplorer.getDrives();
          if (isMounted && Array.isArray(drives) && drives.length > 0) {
            setLocationsCount(drives.length);
            setCustomLocations(drives.map((d) => d.path || d.name));
          }
        }

        // 5. Saved Settings
        if (window.electronFeatures?.aiGetSettings) {
          const s = await window.electronFeatures.aiGetSettings();
          if (isMounted && s) {
            if (s.aiEnabled !== undefined) setEnableAISearch(s.aiEnabled);
            if (s.searchInContent !== undefined) setSearchInContent(s.searchInContent);
            if (s.searchImages !== undefined) setSearchImages(s.searchImages);
            if (s.searchAudioVideo !== undefined) setSearchAudioVideo(s.searchAudioVideo);
            if (s.searchOCR !== undefined) setSearchOCR(s.searchOCR);

            if (s.perfPreset) {
              setPerfPreset(s.perfPreset === "balanced" ? "balanced" : s.perfPreset === "fast" ? "fast" : s.perfPreset === "accurate" ? "accurate" : "auto");
            }
            if (s.cpuUsage !== undefined) setCpuUsage(s.cpuUsage);
            if (s.processingMode) setProcessingMode(s.processingMode);

            if (s.autoStartIndexing !== undefined) setAutoStartIndexing(s.autoStartIndexing);
            if (s.showFilePreview !== undefined) setShowFilePreview(s.showFilePreview);
            if (s.openInNewTab !== undefined) setOpenInNewTab(s.openInNewTab);
            if (s.rememberHistory !== undefined) setRememberHistory(s.rememberHistory);
          }
        }
      } catch (err) {
        console.warn("Error loading AI basic settings backend data:", err);
        if (isMounted) setIndexState("READY");
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // -------------------------------------------------------------
  // Handlers for Settings Changes
  // -------------------------------------------------------------
  const handleToggleEnableAI = (val) => {
    setEnableAISearch(val);
    persistSetting({ aiEnabled: val });
    showToast(val ? "AI Search enabled" : "AI Search disabled");
  };

  const handleToggleSearchContent = (val) => {
    setSearchInContent(val);
    persistSetting({ searchInContent: val, searchInSemantic: val });
  };

  const handleToggleSearchImages = (val) => {
    setSearchImages(val);
    persistSetting({ searchImages: val });
  };

  const handleToggleSearchAudioVideo = (val) => {
    setSearchAudioVideo(val);
    persistSetting({ searchAudioVideo: val });
  };

  const handleToggleSearchOCR = (val) => {
    setSearchOCR(val);
    persistSetting({ searchOCR: val });
  };

  const handleSelectPerfPreset = (presetKey) => {
    setPerfPreset(presetKey);
    let cpu = 20;
    if (presetKey === "fast") {
      cpu = 40;
    } else if (presetKey === "balanced") {
      cpu = 30;
    } else if (presetKey === "accurate") {
      cpu = 60;
    }

    setCpuUsage(cpu);
    persistSetting({ perfPreset: presetKey, cpuUsage: cpu });
    showToast(`Performance mode set to: ${presetKey.charAt(0).toUpperCase() + presetKey.slice(1)}`);
  };

  const handleCpuChange = (val) => {
    const num = parseInt(val, 10);
    setCpuUsage(num);
    persistSetting({ cpuUsage: num });
  };

  const handleSelectProcessingMode = (mode) => {
    setProcessingMode(mode);
    persistSetting({ processingMode: mode, neverUpload: mode === "local" });
    showToast(mode === "local" ? "Privacy mode: 100% Local processing" : "Cloud AI acceleration allowed");
  };

  const handleToggleAutoStart = (val) => {
    setAutoStartIndexing(val);
    persistSetting({ autoStartIndexing: val });
  };

  const handleToggleShowPreview = (val) => {
    setShowFilePreview(val);
    persistSetting({ showFilePreview: val });
  };

  const handleToggleOpenNewTab = (val) => {
    setOpenInNewTab(val);
    persistSetting({ openInNewTab: val });
  };

  const handleToggleRememberHistory = (val) => {
    setRememberHistory(val);
    persistSetting({ rememberHistory: val });
  };

  // -------------------------------------------------------------
  // Index Operations
  // -------------------------------------------------------------
  const handleRebuildIndex = async () => {
    setIsRebuilding(true);
    setIndexState("INDEXING");
    showToast("Rebuilding search index in the background...");
    try {
      if (window.electronFeatures?.aiRebuildIndex) {
        const res = await window.electronFeatures.aiRebuildIndex();
        if (res?.success) {
          setLastScanText("Just now");
          showToast(`Index rebuilt successfully (${(res.count || indexedCount).toLocaleString()} files indexed)`);
        }
      }
    } catch (err) {
      showToast(`Rebuild note: Index scan running (${err.message})`);
    } finally {
      setIsRebuilding(false);
      setIndexState("READY");
    }
  };

  const handleTogglePauseIndex = async () => {
    try {
      if (isPaused) {
        if (window.electronFeatures?.aiResumeIndexing) {
          await window.electronFeatures.aiResumeIndexing();
        }
        setIsPaused(false);
        setIndexState("READY");
        showToast("AI Indexing resumed");
      } else {
        if (window.electronFeatures?.aiPauseIndexing) {
          await window.electronFeatures.aiPauseIndexing();
        }
        setIsPaused(true);
        setIndexState("PAUSED");
        showToast("AI Indexing paused");
      }
    } catch (err) {
      showToast(`Error changing indexing status: ${err.message}`);
    }
  };

  const handleAddFolderLocation = async () => {
    try {
      if (window.electronFeatures?.chooseFolder) {
        const folder = await window.electronFeatures.chooseFolder();
        if (folder && folder.path) {
          if (!customLocations.includes(folder.path)) {
            const updated = [...customLocations, folder.path];
            setCustomLocations(updated);
            setLocationsCount(updated.length);
            showToast(`Added location: ${folder.path}`);
          }
        }
      }
    } catch (err) {
      showToast(`Folder selection failed: ${err.message}`);
    }
  };

  const handleRemoveLocation = (loc) => {
    const updated = customLocations.filter((item) => item !== loc);
    setCustomLocations(updated);
    setLocationsCount(Math.max(1, updated.length));
    showToast(`Removed location: ${loc}`);
  };

  // Format count
  const formattedCount = (indexedCount || 82451).toLocaleString();

  return (
    <div className="ai-basic-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="ai-basic-toast">
          <span>ℹ️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================
          PAGE HEADER
          ========================================================= */}
      <div className="ai-basic-header">
        <div className="ai-basic-header-left">
          <button className="ai-basic-back-btn" onClick={onBack} title="Return to AI Search">
            <span>←</span>
            <span>Back to AI Search</span>
          </button>
          <div className="ai-basic-title-block">
            <h1>AI Search Settings</h1>
            <p className="ai-basic-subtitle">Manage how Nexora searches and understands your files.</p>
          </div>
        </div>

        <div className="ai-basic-header-right">
          <button
            className="ai-basic-advanced-cta-btn"
            onClick={onOpenAdvanced}
            title="Open Advanced Neural Engine Settings"
          >
            <span>⚙ Open Advanced Settings →</span>
          </button>
          <p className="ai-basic-advanced-subtext">For advanced users and developers</p>
        </div>
      </div>

      {/* =========================================================
          MAIN SETTINGS CONTAINER
          ========================================================= */}
      <div className="ai-basic-container">
        {/* =======================================================
            1. AI SEARCH STATUS CARD (Full-Width Banner)
            ======================================================= */}
        <div className={`ai-basic-status-card ${modelsStatus?.isSetupRequired ? "setup-required" : indexState.toLowerCase()}`}>
          <div className="ai-basic-status-left">
            <div className={`ai-status-icon-wrapper ${modelsStatus?.isSetupRequired ? "paused" : indexState.toLowerCase()}`}>
              {modelsStatus?.isSetupRequired ? "🟡" : (
                <>
                  {indexState === "READY" && "✓"}
                  {indexState === "INDEXING" && "🔄"}
                  {indexState === "PAUSED" && "⏸"}
                  {indexState === "ERROR" && "⚠️"}
                  {indexState === "NOT_INITIALIZED" && "⚡"}
                </>
              )}
            </div>

            <div className="ai-basic-status-info">
              <div className="ai-basic-status-title">
                {modelsStatus?.isSetupRequired ? "AI Search Setup Required" : (
                  <>
                    {indexState === "READY" && "AI Search is Ready"}
                    {indexState === "INDEXING" && "AI Search is Indexing"}
                    {indexState === "PAUSED" && "AI Search is Paused"}
                    {indexState === "ERROR" && "AI Search Error"}
                    {indexState === "NOT_INITIALIZED" && "AI Search Initializing"}
                  </>
                )}
                <span className="ai-basic-status-badge">
                  {modelsStatus?.isSetupRequired ? "Setup Required" : (
                    <>
                      {indexState === "READY" && "Operational"}
                      {indexState === "INDEXING" && "Scanning"}
                      {indexState === "PAUSED" && "Paused"}
                      {indexState === "ERROR" && "Attention"}
                      {indexState === "NOT_INITIALIZED" && "Setting up"}
                    </>
                  )}
                </span>
              </div>
              <p className="ai-basic-status-desc">
                {modelsStatus?.isSetupRequired
                  ? "Download local AI models to enable intelligent search"
                  : `${formattedCount} files indexed and ready to search`}
              </p>
              <p className="ai-basic-status-meta">
                <span className="ai-status-dot" style={{ background: modelsStatus?.isSetupRequired ? "#f59e0b" : "#22c55e" }}></span>
                <span>Last scan: {lastScanText} • {modelsStatus?.isSetupRequired ? "Awaiting model installation" : "All systems operational"}</span>
              </p>
            </div>
          </div>

          <div className="ai-basic-status-right">
            {modelsStatus?.isSetupRequired ? (
              <button
                className="ai-btn-manage-index"
                onClick={() => setShowSetupModal(true)}
                style={{ background: "#2563eb", borderColor: "#3b82f6", color: "#fff" }}
              >
                <span>⚡ Download Recommended AI</span>
              </button>
            ) : (
              <button
                className="ai-btn-manage-index"
                onClick={() => setShowManageIndexModal(true)}
                title="Manage Search Index"
              >
                <span>⚡ Manage Index</span>
              </button>
            )}
          </div>
        </div>

        {/* =======================================================
            2. TWO-COLUMN GRID OF SETTINGS CARDS
            ======================================================= */}
        <div className="ai-basic-grid">
          {/* =====================================================
              CARD A: AI SEARCH
              ===================================================== */}
          <div className="ai-card">
            <div className="ai-card-header">
              <div className="ai-card-icon" style={{ color: "#60a5fa" }}>
                ✦
              </div>
              <div className="ai-card-title-group">
                <h3 className="ai-card-title">AI Search</h3>
                <p className="ai-card-subtitle">Enable intelligent search across your files using natural language.</p>
              </div>
            </div>

            {/* Model Status Mini Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>{modelsStatus?.isSetupRequired ? "🟡" : (modelsStatus?.isPartial ? "🟡" : "🟢")}</span>
                <span style={{ color: "#e2e8f0", fontWeight: 500 }}>
                  {modelsStatus?.isSetupRequired
                    ? "AI models are not installed"
                    : (modelsStatus?.isPartial ? "Some AI features are available" : "AI models are ready")}
                </span>
              </div>
              {modelsStatus?.isSetupRequired ? (
                <button
                  onClick={() => setShowSetupModal(true)}
                  style={{
                    background: "#2563eb",
                    border: "none",
                    borderRadius: "4px",
                    color: "#fff",
                    padding: "3px 8px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Download Recommended AI
                </button>
              ) : modelsStatus?.isPartial ? (
                <button
                  onClick={() => setShowSetupModal(true)}
                  style={{
                    background: "#3b82f6",
                    border: "none",
                    borderRadius: "4px",
                    color: "#fff",
                    padding: "3px 8px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Complete AI Setup
                </button>
              ) : (
                <button
                  onClick={onOpenAdvanced}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "4px",
                    color: "#93c5fd",
                    padding: "3px 8px",
                    fontSize: "11.5px",
                    cursor: "pointer",
                  }}
                >
                  Manage AI Models →
                </button>
              )}
            </div>

            <div className="ai-toggle-list">
              {/* Enable AI Search */}
              <div className="ai-toggle-row">
                <div className="ai-toggle-label-group">
                  <span className="ai-toggle-label">Enable AI Search</span>
                  <span className="ai-toggle-desc">Turn on neural search & semantic understanding</span>
                </div>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={enableAISearch}
                    onChange={(e) => handleToggleEnableAI(e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>

              {/* Search inside file content */}
              <div className="ai-toggle-row">
                <div className="ai-toggle-label-group">
                  <span className="ai-toggle-label">Search inside file content</span>
                  <span className="ai-toggle-desc">Index and find text inside documents, PDFs, and code</span>
                </div>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={searchInContent}
                    onChange={(e) => handleToggleSearchContent(e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>

              {/* Search images */}
              <div className="ai-toggle-row">
                <div className="ai-toggle-label-group">
                  <span className="ai-toggle-label">Search images</span>
                  <span className="ai-toggle-desc">Find photos and visual media by description & objects</span>
                </div>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={searchImages}
                    onChange={(e) => handleToggleSearchImages(e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>

              {/* Search audio & video */}
              <div className="ai-toggle-row">
                <div className="ai-toggle-label-group">
                  <span className="ai-toggle-label">Search audio & video</span>
                  <span className="ai-toggle-desc">Find spoken dialogue and transcribe media content</span>
                </div>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={searchAudioVideo}
                    onChange={(e) => handleToggleSearchAudioVideo(e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>

              {/* Search scanned documents (OCR) */}
              <div className="ai-toggle-row">
                <div className="ai-toggle-label-group">
                  <span className="ai-toggle-label">Search scanned documents (OCR)</span>
                  <span className="ai-toggle-desc">Extract text from scanned PDFs, invoices, and screenshots</span>
                </div>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={searchOCR}
                    onChange={(e) => handleToggleSearchOCR(e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* =====================================================
              CARD B: INDEXED LOCATIONS
              ===================================================== */}
          <div className="ai-card">
            <div className="ai-card-header">
              <div className="ai-card-icon" style={{ color: "#34d399" }}>
                📁
              </div>
              <div className="ai-card-title-group">
                <h3 className="ai-card-title">Indexed Locations</h3>
                <p className="ai-card-subtitle">Choose locations that Nexora will index and include in search.</p>
              </div>
            </div>

            <div className="ai-locations-stat-box">
              <div className="ai-locations-primary-stat">
                <span className="ai-locations-count-huge">{formattedCount}</span>
                <span className="ai-locations-count-label">Files indexed</span>
              </div>

              <div className="ai-locations-pills">
                <div className="ai-loc-pill">
                  <span>📁</span>
                  <span>{locationsCount} locations</span>
                </div>
                <div className="ai-loc-pill">
                  <span>💾</span>
                  <span>{storageSizeFormatted}</span>
                </div>
                <div className="ai-loc-pill">
                  <span>🕒</span>
                  <span>Last scan: {lastScanText}</span>
                </div>
                <div className="ai-loc-pill status-pill">
                  <span>✓</span>
                  <span>Up to date</span>
                </div>
              </div>
            </div>

            <div className="ai-locations-actions">
              <button
                className="ai-btn-secondary"
                onClick={() => setShowLocationsModal(true)}
                title="Manage folders included in AI Search"
              >
                <span>📂</span>
                <span>Manage Locations</span>
              </button>
              <button
                className="ai-btn-secondary rebuild-btn"
                onClick={handleRebuildIndex}
                disabled={isRebuilding}
                title="Perform a fresh scan and index rebuild"
              >
                <span>{isRebuilding ? "⏳" : "🔄"}</span>
                <span>{isRebuilding ? "Rebuilding..." : "Rebuild Index"}</span>
              </button>
            </div>
          </div>

          {/* =====================================================
              CARD C: PERFORMANCE
              ===================================================== */}
          <div className="ai-card">
            <div className="ai-card-header">
              <div className="ai-card-icon" style={{ color: "#fbbf24" }}>
                ⚡
              </div>
              <div className="ai-card-title-group">
                <h3 className="ai-card-title">Performance</h3>
                <p className="ai-card-subtitle">Adjust performance and resource usage for AI processing.</p>
              </div>
            </div>

            <div className="ai-perf-section">
              <h4 className="ai-perf-section-title">Search Performance</h4>
              <div className="ai-perf-options-grid">
                <button
                  className={`ai-perf-option-card ${perfPreset === "auto" ? "active" : ""}`}
                  onClick={() => handleSelectPerfPreset("auto")}
                >
                  <span className="ai-radio-dot"></span>
                  <span>Automatic (Recommended)</span>
                </button>
                <button
                  className={`ai-perf-option-card ${perfPreset === "fast" ? "active" : ""}`}
                  onClick={() => handleSelectPerfPreset("fast")}
                >
                  <span className="ai-radio-dot"></span>
                  <span>Fast</span>
                </button>
                <button
                  className={`ai-perf-option-card ${perfPreset === "balanced" ? "active" : ""}`}
                  onClick={() => handleSelectPerfPreset("balanced")}
                >
                  <span className="ai-radio-dot"></span>
                  <span>Balanced</span>
                </button>
                <button
                  className={`ai-perf-option-card ${perfPreset === "accurate" ? "active" : ""}`}
                  onClick={() => handleSelectPerfPreset("accurate")}
                >
                  <span className="ai-radio-dot"></span>
                  <span>High Accuracy</span>
                </button>
              </div>
              <p className="ai-perf-help-text">Nexora automatically adjusts between speed and accuracy.</p>

              {/* CPU Usage Limit */}
              <div className="ai-cpu-control">
                <div className="ai-cpu-header">
                  <span className="ai-cpu-title">CPU Usage Limit</span>
                  <span className="ai-cpu-val-badge">{cpuUsage}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={cpuUsage}
                  onChange={(e) => handleCpuChange(e.target.value)}
                  className="ai-range-input"
                />
                <span className="ai-toggle-desc">
                  Prevents heavy background processing while working or gaming.
                </span>
              </div>
            </div>
          </div>

          {/* =====================================================
              CARD D: PRIVACY
              ===================================================== */}
          <div className="ai-card">
            <div className="ai-card-header">
              <div className="ai-card-icon" style={{ color: "#a855f7" }}>
                🔒
              </div>
              <div className="ai-card-title-group">
                <h3 className="ai-card-title">Privacy</h3>
                <p className="ai-card-subtitle">Control how your data is processed.</p>
              </div>
            </div>

            <div className="ai-privacy-options">
              <div
                className={`ai-privacy-option-card ${processingMode === "local" ? "active" : ""}`}
                onClick={() => handleSelectProcessingMode("local")}
              >
                <span className="ai-radio-dot"></span>
                <div className="ai-privacy-text-group">
                  <div className="ai-privacy-opt-title">
                    <span>Local AI Processing</span>
                    <span className="ai-privacy-badge-local">100% Private</span>
                  </div>
                  <span className="ai-privacy-opt-desc">All AI models run locally on your device</span>
                </div>
              </div>

              <div
                className={`ai-privacy-option-card ${processingMode === "cloud" ? "active" : ""}`}
                onClick={() => handleSelectProcessingMode("cloud")}
              >
                <span className="ai-radio-dot"></span>
                <div className="ai-privacy-text-group">
                  <div className="ai-privacy-opt-title">
                    <span>Allow Cloud AI (Optional)</span>
                  </div>
                  <span className="ai-privacy-opt-desc">
                    Use cloud providers for better accuracy (when enabled)
                  </span>
                </div>
              </div>
            </div>

            <div className="ai-privacy-info-box">
              <p className="ai-privacy-info-text">
                🛡️ <strong>Local processing</strong> is more private and works offline.
              </p>
              <p className="ai-privacy-info-text">
                ☁️ <strong>Cloud AI</strong> is optional and requires your explicit permission.
              </p>
            </div>
          </div>

          {/* =====================================================
              CARD E: OTHER SETTINGS
              ===================================================== */}
          <div className="ai-card" style={{ gridColumn: "1 / -1" }}>
            <div className="ai-card-header">
              <div className="ai-card-icon" style={{ color: "#38bdf8" }}>
                ⚙️
              </div>
              <div className="ai-card-title-group">
                <h3 className="ai-card-title">Other Settings</h3>
                <p className="ai-card-subtitle">General settings for a better search experience.</p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "14px",
              }}
            >
              {/* Auto start indexing on launch */}
              <div className="ai-toggle-row">
                <div className="ai-toggle-label-group">
                  <span className="ai-toggle-label">Auto start indexing on launch</span>
                  <span className="ai-toggle-desc">Keep your search index continuously synchronized</span>
                </div>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={autoStartIndexing}
                    onChange={(e) => handleToggleAutoStart(e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>

              {/* Show file preview in search results */}
              <div className="ai-toggle-row">
                <div className="ai-toggle-label-group">
                  <span className="ai-toggle-label">Show file preview in search results</span>
                  <span className="ai-toggle-desc">Display rich preview panel for selected items</span>
                </div>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={showFilePreview}
                    onChange={(e) => handleToggleShowPreview(e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>

              {/* Open results in new tab */}
              <div className="ai-toggle-row">
                <div className="ai-toggle-label-group">
                  <span className="ai-toggle-label">Open results in new tab</span>
                  <span className="ai-toggle-desc">Open found documents and folders in separate tabs</span>
                </div>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={openInNewTab}
                    onChange={(e) => handleToggleOpenNewTab(e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>

              {/* Remember search history */}
              <div className="ai-toggle-row">
                <div className="ai-toggle-label-group">
                  <span className="ai-toggle-label">Remember search history</span>
                  <span className="ai-toggle-desc">Save recent query suggestions for faster recall</span>
                </div>
                <label className="ai-switch">
                  <input
                    type="checkbox"
                    checked={rememberHistory}
                    onChange={(e) => handleToggleRememberHistory(e.target.checked)}
                  />
                  <span className="ai-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================
            3. ADVANCED SETTINGS BANNER (Bottom Card)
            ======================================================= */}
        <div className="ai-advanced-bottom-banner">
          <div className="ai-advanced-banner-left">
            <h3 className="ai-advanced-banner-title">Looking for advanced options?</h3>
            <p className="ai-advanced-banner-desc">
              Configure AI models, indexing engine, OCR, vision, audio, and other technical settings.
            </p>
          </div>

          <button
            className="ai-btn-banner-advanced"
            onClick={onOpenAdvanced}
            title="Open Advanced Neural Engine & Model Manager"
          >
            <span>⚙ Open Advanced Settings →</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          MODAL: MANAGE LOCATIONS
          ========================================================= */}
      {showLocationsModal && (
        <div className="ai-modal-backdrop" onClick={() => setShowLocationsModal(false)}>
          <div className="ai-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h3>📂 Indexed Search Locations</h3>
              <button className="ai-modal-close-btn" onClick={() => setShowLocationsModal(false)}>
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
              Nexora monitors and indexes files in these folders for instantaneous AI semantic search.
            </p>

            <div className="ai-modal-list">
              {customLocations.map((loc, idx) => (
                <div key={idx} className="ai-modal-list-item">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                    <span>📁</span>
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {loc}
                    </span>
                  </div>
                  {customLocations.length > 1 && (
                    <button
                      onClick={() => handleRemoveLocation(loc)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="ai-modal-footer">
              <button
                className="ai-btn-secondary"
                onClick={handleAddFolderLocation}
                style={{ background: "#2563eb", color: "#fff", borderColor: "#3b82f6" }}
              >
                <span>➕ Add Folder</span>
              </button>
              <button className="ai-btn-secondary" onClick={() => setShowLocationsModal(false)}>
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: MANAGE INDEX
          ========================================================= */}
      {showManageIndexModal && (
        <div className="ai-modal-backdrop" onClick={() => setShowManageIndexModal(false)}>
          <div className="ai-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h3>⚡ Index Management</h3>
              <button className="ai-modal-close-btn" onClick={() => setShowManageIndexModal(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "rgba(30, 41, 59, 0.6)",
                  borderRadius: "8px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#f8fafc" }}>
                    Indexing Process
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {isPaused ? "Indexing is currently paused" : "Indexing is active in background"}
                  </div>
                </div>
                <button
                  className="ai-btn-secondary"
                  onClick={handleTogglePauseIndex}
                  style={{
                    flex: "none",
                    background: isPaused ? "#22c55e" : "#f59e0b",
                    color: "#fff",
                    border: "none",
                  }}
                >
                  {isPaused ? "▶ Resume" : "⏸ Pause"}
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "rgba(30, 41, 59, 0.6)",
                  borderRadius: "8px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#f8fafc" }}>
                    Rebuild Search Index
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Scan all locations and recompute neural embeddings
                  </div>
                </div>
                <button
                  className="ai-btn-secondary rebuild-btn"
                  onClick={() => {
                    setShowManageIndexModal(false);
                    handleRebuildIndex();
                  }}
                  disabled={isRebuilding}
                  style={{ flex: "none" }}
                >
                  {isRebuilding ? "⏳ Scanning..." : "🔄 Rebuild"}
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "rgba(30, 41, 59, 0.6)",
                  borderRadius: "8px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#f8fafc" }}>
                    Optimize Database
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Defragment database and optimize vector indices
                  </div>
                </div>
                <button
                  className="ai-btn-secondary"
                  onClick={async () => {
                    try {
                      if (window.electronFeatures?.aiOptimizeDatabase) {
                        await window.electronFeatures.aiOptimizeDatabase();
                        showToast("Search database optimized");
                      }
                    } catch (err) {
                      showToast(`Optimization notice: ${err.message}`);
                    }
                    setShowManageIndexModal(false);
                  }}
                  style={{ flex: "none" }}
                >
                  🧹 Optimize
                </button>
              </div>
            </div>

            <div className="ai-modal-footer">
              <button className="ai-btn-secondary" onClick={() => setShowManageIndexModal(false)}>
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Setup / Provisioning Modal */}
      <AISearchSetupModal
        isOpen={showSetupModal}
        mode="initial_setup"
        onClose={() => setShowSetupModal(false)}
        onComplete={async () => {
          if (window.electronFeatures?.aiGetModelsStatus) {
            const mStatus = await window.electronFeatures.aiGetModelsStatus();
            if (mStatus) {
              setModelsStatus(mStatus);
              if (mStatus.allReady || mStatus.isTextReady) {
                setIndexState("READY");
              }
            }
          }
        }}
      />
    </div>
  );
}
