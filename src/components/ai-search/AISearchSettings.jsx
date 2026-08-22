import { useState, useEffect } from "react";
import CustomModelImportModal from "./CustomModelImportModal";

export default function AISearchSettings({ onBack }) {
  const [activeTab, setActiveTab] = useState("models");

  // Model & Backend State
  const [modelsList, setModelsList] = useState([]);
  const [modelSearchFilter, setModelSearchFilter] = useState("");
  const [modelSubTab, setModelSubTab] = useState("all"); // 'all' | 'installed' | 'available' | 'custom'
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeModels, setActiveModels] = useState({
    embedding: null,
    vision: null,
    audio: null,
  });

  // Modal State for Model Selector
  const [selectorModalTask, setSelectorModalTask] = useState(null); // 'embedding' | 'vision' | 'audio' | null

  // AI Models state (Preset dropdowns)
  const [embeddingPreset, setEmbeddingPreset] = useState("auto");
  const [visionPreset, setVisionPreset] = useState("auto");
  const [audioPreset, setAudioPreset] = useState("auto");

  // Indexing state
  const [isIndexingPaused, setIsIndexingPaused] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [isBackendReady, setIsBackendReady] = useState(false);

  // Performance state
  const [perfPreset, setPerfPreset] = useState("balanced");
  const [cpuUsage, setCpuUsage] = useState(20);
  const [pauseHighCpu, setPauseHighCpu] = useState(true);
  const [pauseGaming, setPauseGaming] = useState(true);
  const [pauseRendering, setPauseRendering] = useState(true);
  const [resumeAuto, setResumeAuto] = useState(true);

  // Search settings state
  const [resultsPerPage, setResultsPerPage] = useState("50");
  const [searchInFilename, setSearchInFilename] = useState(true);
  const [searchInContent, setSearchInContent] = useState(true);
  const [searchInSemantic, setSearchInSemantic] = useState(true);
  const [searchInTags, setSearchInTags] = useState(true);
  const [searchInMetadata, setSearchInMetadata] = useState(true);

  // Privacy & AI state
  const [processingMode, setProcessingMode] = useState("local");
  const [neverUpload, setNeverUpload] = useState(true);
  const [askBeforeCloud, setAskBeforeCloud] = useState(true);
  const [deleteTempData, setDeleteTempData] = useState(true);
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  // Storage & Maintenance stats
  const [storageInfo, setStorageInfo] = useState({
    databaseSizeBytes: 0,
    databaseSizeFormatted: "0 B",
    cacheSizeBytes: 0,
    cacheSizeFormatted: "0 B",
    totalVectorCount: 0,
    totalFilesIndexed: 0,
  });

  const [integrityStatus, setIntegrityStatus] = useState("Healthy");
  const [actionMessage, setActionMessage] = useState("");

  const triggerToast = (msg) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(""), 4000);
  };

  // Helper to persist preferences immediately
  const persistSettings = async (partial) => {
    try {
      if (window.electronFeatures?.aiSaveSettings) {
        await window.electronFeatures.aiSaveSettings(partial);
      }
    } catch (err) {
      console.warn("Failed to persist settings:", err);
    }
  };

  // Load all live backend data on mount
  useEffect(() => {
    async function loadAllBackendData() {
      try {
        if (window.electronFeatures?.aiGetIndexStatus) {
          const indexRes = await window.electronFeatures.aiGetIndexStatus();
          if (indexRes) {
            setIndexedCount(indexRes.totalIndexedFiles || 0);
            setIsBackendReady(Boolean(indexRes.ready));
            if (indexRes.isIndexingPaused !== undefined) {
              setIsIndexingPaused(Boolean(indexRes.isIndexingPaused));
            }
          }
        }

        if (window.electronFeatures?.aiGetModels) {
          const models = await window.electronFeatures.aiGetModels();
          if (Array.isArray(models)) setModelsList(models);
        }

        if (window.electronFeatures?.aiGetActiveModels) {
          const active = await window.electronFeatures.aiGetActiveModels();
          if (active) setActiveModels(active);
        }

        if (window.electronFeatures?.aiGetSettings) {
          const s = await window.electronFeatures.aiGetSettings();
          if (s) {
            if (s.perfPreset) setPerfPreset(s.perfPreset);
            if (s.cpuUsage) setCpuUsage(s.cpuUsage);
            if (s.pauseHighCpu !== undefined) setPauseHighCpu(s.pauseHighCpu);
            if (s.pauseGaming !== undefined) setPauseGaming(s.pauseGaming);
            if (s.pauseRendering !== undefined) setPauseRendering(s.pauseRendering);
            if (s.resumeAuto !== undefined) setResumeAuto(s.resumeAuto);
            if (s.resultsPerPage) setResultsPerPage(s.resultsPerPage);
            if (s.searchInFilename !== undefined) setSearchInFilename(s.searchInFilename);
            if (s.searchInContent !== undefined) setSearchInContent(s.searchInContent);
            if (s.searchInSemantic !== undefined) setSearchInSemantic(s.searchInSemantic);
            if (s.searchInTags !== undefined) setSearchInTags(s.searchInTags);
            if (s.searchInMetadata !== undefined) setSearchInMetadata(s.searchInMetadata);
            if (s.processingMode) setProcessingMode(s.processingMode);
            if (s.neverUpload !== undefined) setNeverUpload(s.neverUpload);
            if (s.askBeforeCloud !== undefined) setAskBeforeCloud(s.askBeforeCloud);
            if (s.deleteTempData !== undefined) setDeleteTempData(s.deleteTempData);
            if (s.openaiApiKey) setOpenaiKey(s.openaiApiKey);
            if (s.geminiApiKey) setGeminiKey(s.geminiApiKey);
          }
        }

        if (window.electronFeatures?.aiGetStorageInfo) {
          const st = await window.electronFeatures.aiGetStorageInfo();
          if (st) setStorageInfo(st);
        }
      } catch (err) {
        console.warn("Settings loading error:", err);
      }
    }

    loadAllBackendData();
  }, []);

  // Handle active model switch
  const handleSelectModel = async (task, modelId) => {
    try {
      if (window.electronFeatures?.aiSetActiveModel) {
        const res = await window.electronFeatures.aiSetActiveModel(task, modelId);
        if (res?.success && res.activeModels) {
          setActiveModels(res.activeModels);
          const chosen = modelsList.find((m) => m.id === modelId);
          triggerToast(`Active ${task} model switched to: ${chosen?.name || modelId}`);
        } else {
          triggerToast(`Failed to switch model: ${res?.error || "Unknown error"}`);
        }
      }
    } catch (err) {
      triggerToast(`Error switching model: ${err.message}`);
    } finally {
      setSelectorModalTask(null);
    }
  };

  // Handle model verification
  const handleVerifyModel = async (modelId) => {
    try {
      if (window.electronFeatures?.aiVerifyModel) {
        const res = await window.electronFeatures.aiVerifyModel(modelId);
        if (res?.success) {
          triggerToast(res.message || `Model ${modelId} verified successfully.`);
        } else {
          triggerToast(`Verification failed: ${res?.error || "Unknown error"}`);
        }
      }
    } catch (err) {
      triggerToast(`Verification error: ${err.message}`);
    }
  };

  // Handle model download
  const handleDownloadModel = async (modelId) => {
    triggerToast(`Starting download for ${modelId}...`);
    try {
      if (window.electronFeatures?.aiDownloadModel) {
        const res = await window.electronFeatures.aiDownloadModel(modelId);
        if (res?.success) {
          triggerToast(`Model ${modelId} downloaded and verified successfully!`);
          const allM = await window.electronFeatures.aiGetModels();
          if (allM) setModelsList(allM);
        } else {
          triggerToast(`Download failed: ${res?.error || "Unknown error"}`);
        }
      }
    } catch (err) {
      triggerToast(`Download error: ${err.message}`);
    }
  };

  // Handle model uninstall
  const handleUninstallModel = async (modelId) => {
    try {
      if (window.electronFeatures?.aiUninstallModel) {
        const res = await window.electronFeatures.aiUninstallModel(modelId);
        if (res?.success) {
          triggerToast(`Model ${modelId} uninstalled.`);
          const allM = await window.electronFeatures.aiGetModels();
          if (allM) setModelsList(allM);
        } else {
          triggerToast(`Uninstall failed.`);
        }
      }
    } catch (err) {
      triggerToast(`Uninstall error: ${err.message}`);
    }
  };

  const navItems = [
    { id: "models", label: "AI Models", icon: "🧠" },
    { id: "indexing", label: "Indexing", icon: "⚡" },
    { id: "performance", label: "Performance", icon: "⚙️" },
    { id: "search", label: "Search", icon: "🔍" },
    { id: "privacy", label: "Privacy & AI", icon: "🔒" },
    { id: "storage", label: "Storage", icon: "💾" },
    { id: "maintenance", label: "Maintenance", icon: "🛠️" },
    { id: "model-manager", label: "Model Manager", icon: "📦" },
    { id: "about", label: "About AI Search", icon: "ℹ️" },
  ];

  // Filter models for selector modal
  const getCandidateModelsForTask = (task) => {
    if (task === "embedding") return modelsList.filter((m) => m.category === "text" || m.modality === "text");
    if (task === "vision") return modelsList.filter((m) => m.category === "vision" || m.modality === "image");
    if (task === "audio") return modelsList.filter((m) => m.category === "audio" || m.modality === "audio");
    return modelsList;
  };

  // Group and sort models for Model Manager
  const matchesSearch = (m) => {
    // Sub-tab filter
    if (modelSubTab === "installed" && !m.isInstalled) return false;
    if (modelSubTab === "available" && m.isInstalled) return false;
    if (modelSubTab === "custom" && !m.isCustom) return false;

    if (!modelSearchFilter.trim()) return true;
    const q = modelSearchFilter.toLowerCase();
    return (
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.id && m.id.toLowerCase().includes(q)) ||
      (m.role && m.role.toLowerCase().includes(q)) ||
      (m.capability && m.capability.toLowerCase().includes(q)) ||
      (m.type && m.type.toLowerCase().includes(q)) ||
      (m.provider && m.provider.toLowerCase().includes(q))
    );
  };

  const isModelActive = (m) => {
    return (
      activeModels.embedding?.id === m.id ||
      activeModels.vision?.id === m.id ||
      activeModels.audio?.id === m.id ||
      activeModels.ocr?.id === m.id
    );
  };

  const sortModels = (list) => {
    return [...list].sort((a, b) => {
      const aActive = isModelActive(a);
      const bActive = isModelActive(b);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const textModels = sortModels(modelsList.filter((m) => m.category === "text" && matchesSearch(m)));
  const visionModels = sortModels(modelsList.filter((m) => m.category === "vision" && matchesSearch(m)));
  const ocrModels = sortModels(modelsList.filter((m) => m.category === "ocr" && matchesSearch(m)));
  const audioModels = sortModels(modelsList.filter((m) => m.category === "audio" && matchesSearch(m)));
  const multimodalModels = sortModels(modelsList.filter((m) => m.category === "multimodal" && matchesSearch(m)));

  const renderModelCard = (m) => {
    const isActive = isModelActive(m);
    const taskType = m.category === "vision" ? "vision" : (m.category === "audio" ? "audio" : (m.category === "ocr" ? "ocr" : "embedding"));

    return (
      <div className={`ai-model-card ${isActive ? "active-model-border" : ""}`} key={m.id} style={{
        background: isActive ? "rgba(30, 41, 59, 0.95)" : "var(--color-bg-secondary, #1e293b)",
        border: isActive ? "1px solid #3b82f6" : "1px solid #334155",
        borderRadius: "10px",
        padding: "16px 20px",
        marginBottom: "14px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h4 style={{ margin: 0, fontSize: "15px", color: "#f8fafc", fontWeight: 600 }}>{m.name}</h4>
              {isActive ? (
                <span className="ai-badge-active" style={{ background: "#2563eb", color: "#fff", fontSize: "11px", padding: "2px 8px", borderRadius: "12px" }}>
                  ● Active
                </span>
              ) : m.isInstalled ? (
                <span className="ai-badge-idle" style={{ background: "#334155", color: "#94a3b8", fontSize: "11px", padding: "2px 8px", borderRadius: "12px" }}>
                  Ready
                </span>
              ) : (
                <span style={{ background: "rgba(245, 158, 11, 0.2)", color: "#f59e0b", fontSize: "11px", padding: "2px 8px", borderRadius: "12px", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
                  Available for Download
                </span>
              )}
              <span className="ai-badge-local" style={{ background: m.isCustom ? "#3b0764" : "#065f46", color: m.isCustom ? "#d8b4fe" : "#6ee7b7", fontSize: "11px", padding: "2px 8px", borderRadius: "12px" }}>
                {m.isCustom ? "Custom ONNX" : "Local ONNX"}
              </span>
            </div>

            <div style={{ fontSize: "13px", color: "#38bdf8", marginTop: "4px", fontWeight: 500 }}>
              Role: {m.role}
            </div>

            <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
              {m.capability}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {!m.isInstalled ? (
              <button
                className="ai-btn-sm ai-btn-primary"
                onClick={() => handleDownloadModel(m.id)}
                style={{ fontSize: "12px", padding: "4px 12px" }}
              >
                ⬇ Download
              </button>
            ) : (
              <>
                {!isActive && (
                  <button
                    className="ai-btn-sm ai-btn-primary"
                    onClick={() => handleSelectModel(taskType, m.id)}
                    style={{ fontSize: "12px", padding: "4px 12px" }}
                  >
                    Activate
                  </button>
                )}
                <button
                  className="ai-btn-sm ai-btn-secondary"
                  onClick={() => handleVerifyModel(m.id)}
                  style={{ fontSize: "12px", padding: "4px 12px" }}
                >
                  Verify
                </button>
                <button
                  className="ai-btn-sm ai-btn-secondary"
                  onClick={() => handleUninstallModel(m.id)}
                  style={{ fontSize: "12px", padding: "4px 12px", color: "#f87171" }}
                  title="Uninstall model files"
                >
                  Uninstall
                </button>
              </>
            )}
          </div>
        </div>

        {/* Model Spec Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "10px",
          marginTop: "12px",
          padding: "10px 12px",
          background: "rgba(15, 23, 42, 0.6)",
          borderRadius: "6px",
          fontSize: "12px",
        }}>
          <div>
            <span style={{ color: "#64748b", display: "block" }}>Format</span>
            <strong style={{ color: "#e2e8f0" }}>{m.type}</strong>
          </div>
          <div>
            <span style={{ color: "#64748b", display: "block" }}>Size / Parameters</span>
            <strong style={{ color: "#e2e8f0" }}>{m.sizeFormatted} ({m.parameters})</strong>
          </div>
          <div>
            <span style={{ color: "#64748b", display: "block" }}>Context / Tokens</span>
            <strong style={{ color: "#e2e8f0" }}>{m.contextTokens ? `${m.contextTokens} Tokens` : "Adaptive"}</strong>
          </div>
          <div>
            <span style={{ color: "#64748b", display: "block" }}>Runtime</span>
            <strong style={{ color: "#e2e8f0" }}>{m.runtime}</strong>
          </div>
        </div>

        {/* Used By Consumers */}
        {Array.isArray(m.usedBy) && m.usedBy.length > 0 && (
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Used by:</span>
            {m.usedBy.map((consumer, idx) => (
              <span key={idx} style={{
                background: "rgba(51, 65, 85, 0.7)",
                color: "#cbd5e1",
                fontSize: "11px",
                padding: "2px 7px",
                borderRadius: "4px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}>
                <span style={{ color: "#10b981", fontSize: "10px" }}>✓</span> {consumer}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="ai-settings-container">
      {/* Settings Header */}
      <div className="ai-settings-header">
        <div className="ai-settings-header-left">
          <button className="ai-btn-back" onClick={onBack} title="Return to AI Search">
            <span className="ai-back-icon">←</span>
            <span>Back to AI Search</span>
          </button>
          <div className="ai-settings-title-group">
            <h2>AI Search Settings</h2>
            <span className="ai-settings-badge">Nexora Neural Engine</span>
          </div>
        </div>
        {actionMessage && <div className="ai-settings-toast">{actionMessage}</div>}
      </div>

      <div className="ai-settings-body">
        {/* Settings Left Navigation */}
        <div className="ai-settings-sidebar">
          <div className="ai-settings-nav-title">CONFIGURATION</div>
          <div className="ai-settings-nav-list">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`ai-settings-nav-btn ${activeTab === item.id ? "active" : ""}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className="ai-nav-icon">{item.icon}</span>
                <span className="ai-nav-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Settings Main Content Area */}
        <div className="ai-settings-content">
          {/* =========================================================
              1. AI MODELS
              ========================================================= */}
          {activeTab === "models" && (
            <div className="ai-settings-section">
              <div className="ai-section-header">
                <h3>Search / Embedding Model</h3>
                <p>Choose the neural embedding model used to vectorize and search your personal files.</p>
              </div>

              <div className="ai-card">
                <div className="ai-form-row">
                  <label>Model Preset</label>
                  <select
                    className="ai-select"
                    value={embeddingPreset}
                    onChange={(e) => {
                      setEmbeddingPreset(e.target.value);
                      persistSettings({ embeddingPreset: e.target.value });
                    }}
                  >
                    <option value="auto">Automatic (Recommended)</option>
                    <option value="lightweight">Lightweight (Fastest, Low Memory)</option>
                    <option value="balanced">Balanced (Optimal Speed & Recall)</option>
                    <option value="high-accuracy">High Accuracy (Deep Semantic Comprehension)</option>
                  </select>
                </div>

                <div className="ai-info-card">
                  <div className="ai-info-card-header">
                    <div className="ai-info-card-title">
                      <span className="ai-active-indicator">●</span>
                      <strong>Current Model:</strong> {activeModels.embedding?.name || "BGE Small English v1.5"}
                    </div>
                    <span className="ai-badge-local">Local</span>
                  </div>
                  <div className="ai-info-grid">
                    <div className="ai-info-item">
                      <span className="ai-info-label">Size</span>
                      <span className="ai-info-val">{activeModels.embedding?.sizeFormatted || "67 MB"}</span>
                    </div>
                    <div className="ai-info-item">
                      <span className="ai-info-label">Type</span>
                      <span className="ai-info-val">{activeModels.embedding?.type || "Quantized Q8_0 / ONNX"}</span>
                    </div>
                    <div className="ai-info-item">
                      <span className="ai-info-label">Context</span>
                      <span className="ai-info-val">{activeModels.embedding?.contextTokens ? `${activeModels.embedding.contextTokens} Tokens` : "512 Tokens"}</span>
                    </div>
                  </div>
                  <div className="ai-info-card-footer">
                    <button
                      className="ai-btn-secondary"
                      onClick={() => setSelectorModalTask("embedding")}
                    >
                      Change Model
                    </button>
                  </div>
                </div>
              </div>

              <div className="ai-section-header" style={{ marginTop: "24px" }}>
                <h3>Vision / Image Understanding Model</h3>
                <p>Enables natural language search inside photos, screenshots, diagrams and images.</p>
              </div>

              <div className="ai-card">
                <div className="ai-form-row">
                  <label>Vision Model</label>
                  <select
                    className="ai-select"
                    value={visionPreset}
                    onChange={(e) => {
                      setVisionPreset(e.target.value);
                      persistSettings({ visionPreset: e.target.value });
                    }}
                  >
                    <option value="auto">Automatic (Recommended)</option>
                    <option value="clip-base">CLIP ViT-B/32 (Local)</option>
                    <option value="clip-large">CLIP ViT-L/14 (High Precision)</option>
                  </select>
                </div>

                <div className="ai-info-card">
                  <div className="ai-info-card-header">
                    <div className="ai-info-card-title">
                      <span className="ai-active-indicator">●</span>
                      <strong>Current Model:</strong> {activeModels.vision?.name || "CLIP ViT-Base Patch32 Vision"}
                    </div>
                    <span className="ai-badge-local">Local</span>
                  </div>
                  <div className="ai-info-grid">
                    <div className="ai-info-item">
                      <span className="ai-info-label">Size</span>
                      <span className="ai-info-val">{activeModels.vision?.sizeFormatted || "150 MB"}</span>
                    </div>
                    <div className="ai-info-item">
                      <span className="ai-info-label">Type</span>
                      <span className="ai-info-val">{activeModels.vision?.type || "Local ONNX Model"}</span>
                    </div>
                    <div className="ai-info-item">
                      <span className="ai-info-label">Capabilities</span>
                      <span className="ai-info-val">Zero-Shot Visual Search</span>
                    </div>
                  </div>
                  <div className="ai-info-card-footer">
                    <button
                      className="ai-btn-secondary"
                      onClick={() => setSelectorModalTask("vision")}
                    >
                      Change Model
                    </button>
                  </div>
                </div>
              </div>

              <div className="ai-section-header" style={{ marginTop: "24px" }}>
                <h3>Audio Transcription Model</h3>
                <p>Indexes audio files and video audio tracks by spoken keywords.</p>
              </div>

              <div className="ai-card">
                <div className="ai-form-row">
                  <label>Transcription Model</label>
                  <select
                    className="ai-select"
                    value={audioPreset}
                    onChange={(e) => {
                      setAudioPreset(e.target.value);
                      persistSettings({ audioPreset: e.target.value });
                    }}
                  >
                    <option value="auto">Automatic (Recommended)</option>
                    <option value="whisper-tiny">Whisper Tiny (Ultralight)</option>
                    <option value="whisper-small">Whisper Small (High Accuracy)</option>
                  </select>
                </div>

                <div className="ai-info-card">
                  <div className="ai-info-card-header">
                    <div className="ai-info-card-title">
                      <span className="ai-active-indicator">●</span>
                      <strong>Current Model:</strong> {activeModels.audio?.name || "Whisper Tiny Audio Transcriber"}
                    </div>
                    <span className="ai-badge-local">Local</span>
                  </div>
                  <div className="ai-info-grid">
                    <div className="ai-info-item">
                      <span className="ai-info-label">Size</span>
                      <span className="ai-info-val">{activeModels.audio?.sizeFormatted || "75 MB"}</span>
                    </div>
                    <div className="ai-info-item">
                      <span className="ai-info-label">Type</span>
                      <span className="ai-info-val">{activeModels.audio?.type || "Local ONNX Model"}</span>
                    </div>
                    <div className="ai-info-item">
                      <span className="ai-info-label">Capabilities</span>
                      <span className="ai-info-val">Speech-to-text & Timestamps</span>
                    </div>
                  </div>
                  <div className="ai-info-card-footer">
                    <button
                      className="ai-btn-secondary"
                      onClick={() => setSelectorModalTask("audio")}
                    >
                      Change Model
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              2. INDEXING
              ========================================================= */}
          {activeTab === "indexing" && (
            <div className="ai-settings-section">
              <div className="ai-section-header">
                <h3>Index Status</h3>
                <p>Monitor real-time indexing progress and configured scanning directories.</p>
              </div>

              <div className="ai-card">
                <div className="ai-status-summary-grid">
                  <div className="ai-stat-box">
                    <span className="ai-stat-label">Index Status</span>
                    <span className="ai-stat-value text-green">
                      <span className="ai-stat-dot green"></span>
                      {isIndexingPaused ? "Paused" : "Up to date"}
                    </span>
                  </div>
                  <div className="ai-stat-box">
                    <span className="ai-stat-label">Indexed Files</span>
                    <span className="ai-stat-value">{indexedCount} files</span>
                  </div>
                  <div className="ai-stat-box">
                    <span className="ai-stat-label">Engine Status</span>
                    <span className="ai-stat-value text-blue">{isBackendReady ? "Local ONNX Ready" : "Standby"}</span>
                  </div>
                  <div className="ai-stat-box">
                    <span className="ai-stat-label">Watch Status</span>
                    <span className="ai-stat-value text-blue">Active</span>
                  </div>
                </div>

                <div className="ai-progress-bar-container" style={{ marginTop: "16px" }}>
                  <div className="ai-progress-bar-fill" style={{ width: "100%" }}></div>
                </div>

                <div className="ai-btn-group" style={{ marginTop: "20px" }}>
                  <button
                    className="ai-btn-primary"
                    onClick={async () => {
                      try {
                        if (window.electronFeatures?.chooseFolder) {
                          const f = await window.electronFeatures.chooseFolder();
                          if (f && f.path) {
                            triggerToast(`Scanning folder: ${f.path}`);
                            if (window.electronFeatures?.aiRebuildIndex) {
                              const outcome = await window.electronFeatures.aiRebuildIndex(f.path);
                              if (outcome?.count !== undefined) setIndexedCount(outcome.count);
                              triggerToast(`Indexed folder: ${f.path}`);
                            }
                          }
                        }
                      } catch (err) {
                        triggerToast(`Folder selection failed: ${err.message}`);
                      }
                    }}
                  >
                    Manage Locations
                  </button>
                  <button
                    className="ai-btn-secondary"
                    onClick={async () => {
                      triggerToast("Rebuilding AI Search Index...");
                      try {
                        if (window.electronFeatures?.aiRebuildIndex) {
                          const outcome = await window.electronFeatures.aiRebuildIndex();
                          if (outcome?.count !== undefined) setIndexedCount(outcome.count);
                          triggerToast("AI Search Index rebuild complete!");
                        }
                      } catch (err) {
                        triggerToast(`Rebuild failed: ${err.message}`);
                      }
                    }}
                  >
                    Rebuild Index
                  </button>
                  <button
                    className="ai-btn-secondary"
                    onClick={async () => {
                      const next = !isIndexingPaused;
                      setIsIndexingPaused(next);
                      try {
                        if (next && window.electronFeatures?.aiPauseIndexing) {
                          await window.electronFeatures.aiPauseIndexing();
                        } else if (!next && window.electronFeatures?.aiResumeIndexing) {
                          await window.electronFeatures.aiResumeIndexing();
                        }
                      } catch (err) {
                        console.warn("Indexing pause/resume error:", err);
                      }
                      triggerToast(next ? "Indexing paused" : "Indexing resumed");
                    }}
                  >
                    {isIndexingPaused ? "Resume Indexing" : "Pause Indexing"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              3. PERFORMANCE
              ========================================================= */}
          {activeTab === "performance" && (
            <div className="ai-settings-section">
              <div className="ai-section-header">
                <h3>Indexing Performance</h3>
                <p>Control hardware utilization and throttling rules to prevent interference with your work.</p>
              </div>

              <div className="ai-card">
                <label className="ai-field-heading">Performance Profile</label>
                <div className="ai-preset-grid">
                  <button
                    className={`ai-preset-btn ${perfPreset === "battery" ? "active" : ""}`}
                    onClick={() => {
                      setPerfPreset("battery");
                      setCpuUsage(10);
                      persistSettings({ perfPreset: "battery", cpuUsage: 10 });
                    }}
                  >
                    <span className="ai-preset-icon">🔋</span>
                    <strong>Battery Saver</strong>
                    <small>Minimal background CPU (10%)</small>
                  </button>

                  <button
                    className={`ai-preset-btn ${perfPreset === "balanced" ? "active" : ""}`}
                    onClick={() => {
                      setPerfPreset("balanced");
                      setCpuUsage(20);
                      persistSettings({ perfPreset: "balanced", cpuUsage: 20 });
                    }}
                  >
                    <span className="ai-preset-icon">⚖️</span>
                    <strong>Balanced</strong>
                    <small>Default adaptive indexing (20%)</small>
                  </button>

                  <button
                    className={`ai-preset-btn ${perfPreset === "perf" ? "active" : ""}`}
                    onClick={() => {
                      setPerfPreset("perf");
                      setCpuUsage(60);
                      persistSettings({ perfPreset: "perf", cpuUsage: 60 });
                    }}
                  >
                    <span className="ai-preset-icon">⚡</span>
                    <strong>Performance</strong>
                    <small>High speed indexing (60%)</small>
                  </button>
                </div>

                <div className="ai-slider-section" style={{ marginTop: "24px" }}>
                  <div className="ai-slider-header">
                    <span>Maximum CPU Usage</span>
                    <span className="ai-slider-val">{cpuUsage}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="90"
                    step="5"
                    value={cpuUsage}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCpuUsage(val);
                      persistSettings({ cpuUsage: val });
                    }}
                    className="ai-range-slider"
                  />
                  <div className="ai-slider-ticks">
                    <span>5% (Silent)</span>
                    <span>20% (Recommended)</span>
                    <span>90% (Maximum)</span>
                  </div>
                </div>

                <div className="ai-checkbox-list" style={{ marginTop: "20px" }}>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={pauseHighCpu}
                      onChange={(e) => {
                        setPauseHighCpu(e.target.checked);
                        persistSettings({ pauseHighCpu: e.target.checked });
                      }}
                    />
                    <span>Pause indexing when system CPU is above 80%</span>
                  </label>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={pauseGaming}
                      onChange={(e) => {
                        setPauseGaming(e.target.checked);
                        persistSettings({ pauseGaming: e.target.checked });
                      }}
                    />
                    <span>Pause indexing during full-screen games or applications</span>
                  </label>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={pauseRendering}
                      onChange={(e) => {
                        setPauseRendering(e.target.checked);
                        persistSettings({ pauseRendering: e.target.checked });
                      }}
                    />
                    <span>Pause indexing during video exports or 3D rendering</span>
                  </label>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={resumeAuto}
                      onChange={(e) => {
                        setResumeAuto(e.target.checked);
                        persistSettings({ resumeAuto: e.target.checked });
                      }}
                    />
                    <span>Automatically resume indexing when system is idle</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              4. SEARCH
              ========================================================= */}
          {activeTab === "search" && (
            <div className="ai-settings-section">
              <div className="ai-section-header">
                <h3>Search Behavior</h3>
                <p>Configure matching rules, target fields, and result page limits.</p>
              </div>

              <div className="ai-card">
                <div className="ai-form-row">
                  <label>Results per Page</label>
                  <select
                    className="ai-select"
                    value={resultsPerPage}
                    onChange={(e) => {
                      setResultsPerPage(e.target.value);
                      persistSettings({ resultsPerPage: e.target.value });
                    }}
                  >
                    <option value="25">25 results</option>
                    <option value="50">50 results (Recommended)</option>
                    <option value="100">100 results</option>
                    <option value="200">200 results</option>
                  </select>
                </div>

                <label className="ai-field-heading" style={{ marginTop: "20px" }}>Search Targets</label>
                <div className="ai-checkbox-list">
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={searchInFilename}
                      onChange={(e) => {
                        setSearchInFilename(e.target.checked);
                        persistSettings({ searchInFilename: e.target.checked });
                      }}
                    />
                    <span>Search in file and folder names (Exact &amp; Fuzzy)</span>
                  </label>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={searchInContent}
                      onChange={(e) => {
                        setSearchInContent(e.target.checked);
                        persistSettings({ searchInContent: e.target.checked });
                      }}
                    />
                    <span>Search inside file contents (PDFs, Docs, Text, Code)</span>
                  </label>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={searchInSemantic}
                      onChange={(e) => {
                        setSearchInSemantic(e.target.checked);
                        persistSettings({ searchInSemantic: e.target.checked });
                      }}
                    />
                    <span>Enable Natural Language Semantic Search (Vector Embedding)</span>
                  </label>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={searchInTags}
                      onChange={(e) => {
                        setSearchInTags(e.target.checked);
                        persistSettings({ searchInTags: e.target.checked });
                      }}
                    />
                    <span>Search in AI generated tags and visual concepts</span>
                  </label>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={searchInMetadata}
                      onChange={(e) => {
                        setSearchInMetadata(e.target.checked);
                        persistSettings({ searchInMetadata: e.target.checked });
                      }}
                    />
                    <span>Search file metadata (Author, Camera, Dimensions, Timestamps)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              5. PRIVACY & AI
              ========================================================= */}
          {activeTab === "privacy" && (
            <div className="ai-settings-section">
              <div className="ai-section-header">
                <h3>Privacy &amp; Data Security</h3>
                <p>Nexora AI operates 100% locally by default. Your files and embeddings never leave your device.</p>
              </div>

              <div className="ai-card">
                <label className="ai-field-heading">Processing Mode</label>
                <div className="ai-form-row">
                  <select
                    className="ai-select"
                    value={processingMode}
                    onChange={(e) => {
                      setProcessingMode(e.target.value);
                      persistSettings({ processingMode: e.target.value });
                    }}
                  >
                    <option value="local">Local Only (100% Private, Offline Safe)</option>
                    <option value="hybrid">Hybrid (Local + Cloud LLM enhancement)</option>
                  </select>
                </div>

                <div className="ai-checkbox-list" style={{ marginTop: "16px" }}>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={neverUpload}
                      onChange={(e) => {
                        setNeverUpload(e.target.checked);
                        persistSettings({ neverUpload: e.target.checked });
                      }}
                    />
                    <span>Never upload indexed file content or embeddings to cloud servers</span>
                  </label>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={askBeforeCloud}
                      onChange={(e) => {
                        setAskBeforeCloud(e.target.checked);
                        persistSettings({ askBeforeCloud: e.target.checked });
                      }}
                    />
                    <span>Always ask confirmation before connecting to any online AI API</span>
                  </label>
                  <label className="ai-checkbox-item">
                    <input
                      type="checkbox"
                      checked={deleteTempData}
                      onChange={(e) => {
                        setDeleteTempData(e.target.checked);
                        persistSettings({ deleteTempData: e.target.checked });
                      }}
                    />
                    <span>Automatically delete extracted temporary OCR and audio buffers on exit</span>
                  </label>
                </div>

                {processingMode === "hybrid" && (
                  <div style={{ marginTop: "24px", borderTop: "1px solid var(--color-border)", paddingTop: "16px" }}>
                    <label className="ai-field-heading">Optional Cloud API Keys</label>
                    <div className="ai-form-row">
                      <label>OpenAI API Key</label>
                      <input
                        type="password"
                        placeholder="sk-..."
                        className="ai-input"
                        value={openaiKey}
                        onChange={(e) => {
                          setOpenaiKey(e.target.value);
                          persistSettings({ openaiApiKey: e.target.value });
                        }}
                      />
                    </div>
                    <div className="ai-form-row" style={{ marginTop: "12px" }}>
                      <label>Google Gemini API Key</label>
                      <input
                        type="password"
                        placeholder="AIza..."
                        className="ai-input"
                        value={geminiKey}
                        onChange={(e) => {
                          setGeminiKey(e.target.value);
                          persistSettings({ geminiApiKey: e.target.value });
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              6. STORAGE
              ========================================================= */}
          {activeTab === "storage" && (
            <div className="ai-settings-section">
              <div className="ai-section-header">
                <h3>Storage Utilization</h3>
                <p>Monitor disk space utilized by SQLite databases, vector embeddings, and model caches.</p>
              </div>

              <div className="ai-card">
                <div className="ai-storage-summary">
                  <div className="ai-storage-item">
                    <span className="ai-info-label">Database Path</span>
                    <span className="ai-info-val" style={{ fontSize: "12px", wordBreak: "break-all" }}>{storageInfo.databasePath || "Default"}</span>
                  </div>
                  <div className="ai-storage-item">
                    <span className="ai-info-label">Database Size</span>
                    <span className="ai-info-val">{storageInfo.databaseSizeFormatted}</span>
                  </div>
                  <div className="ai-storage-item">
                    <span className="ai-info-label">Model Cache Size</span>
                    <span className="ai-info-val">{storageInfo.cacheSizeFormatted}</span>
                  </div>
                  <div className="ai-storage-item">
                    <span className="ai-info-label">Indexed Vector Count</span>
                    <span className="ai-info-val text-green">{storageInfo.totalVectorCount} Vectors</span>
                  </div>
                </div>

                <div className="ai-btn-group" style={{ marginTop: "24px" }}>
                  <button
                    className="ai-btn-primary"
                    onClick={async () => {
                      try {
                        if (window.electronFeatures?.chooseFolder) {
                          const f = await window.electronFeatures.chooseFolder();
                          if (f && f.path) {
                            triggerToast(`Custom location set: ${f.path}`);
                          }
                        }
                      } catch (err) {
                        triggerToast(`Location error: ${err.message}`);
                      }
                    }}
                  >
                    Change Location
                  </button>
                  <button
                    className="ai-btn-secondary"
                    onClick={async () => {
                      try {
                        if (window.electronFeatures?.aiClearCache) {
                          const res = await window.electronFeatures.aiClearCache();
                          if (res?.success) {
                            triggerToast(`Model cache cleared (${res.reclaimedFormatted} reclaimed)`);
                            const updated = await window.electronFeatures.aiGetStorageInfo();
                            if (updated) setStorageInfo(updated);
                          }
                        }
                      } catch (err) {
                        triggerToast(`Clear cache error: ${err.message}`);
                      }
                    }}
                  >
                    Clear Cache
                  </button>
                  <button
                    className="ai-btn-secondary"
                    onClick={async () => {
                      try {
                        if (window.electronFeatures?.aiOptimizeDatabase) {
                          const res = await window.electronFeatures.aiOptimizeDatabase();
                          if (res?.success) {
                            triggerToast("SQLite database defragmented and optimized");
                            const updated = await window.electronFeatures.aiGetStorageInfo();
                            if (updated) setStorageInfo(updated);
                          }
                        }
                      } catch (err) {
                        triggerToast(`Optimization error: ${err.message}`);
                      }
                    }}
                  >
                    Optimize Database
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              7. MAINTENANCE
              ========================================================= */}
          {activeTab === "maintenance" && (
            <div className="ai-settings-section">
              <div className="ai-section-header">
                <h3>Maintenance &amp; Diagnostics</h3>
                <p>Database integrity checks, index healing, and emergency repair routines.</p>
              </div>

              <div className="ai-card">
                <div className="ai-status-summary-grid">
                  <div className="ai-stat-box">
                    <span className="ai-stat-label">Database</span>
                    <span className="ai-stat-value text-green">{integrityStatus}</span>
                  </div>
                  <div className="ai-stat-box">
                    <span className="ai-stat-label">Index</span>
                    <span className="ai-stat-value text-green">Up to date</span>
                  </div>
                  <div className="ai-stat-box">
                    <span className="ai-stat-label">Total Indexed Records</span>
                    <span className="ai-stat-value">{indexedCount} files</span>
                  </div>
                </div>

                <div className="ai-btn-group" style={{ marginTop: "24px" }}>
                  <button
                    className="ai-btn-secondary"
                    onClick={async () => {
                      try {
                        if (window.electronFeatures?.aiCheckIntegrity) {
                          const res = await window.electronFeatures.aiCheckIntegrity();
                          if (res?.success && res.healthy) {
                            setIntegrityStatus("Healthy (0 errors)");
                            triggerToast("Integrity check completed: 0 errors found");
                          } else {
                            setIntegrityStatus("Issues Detected");
                            triggerToast(`Integrity check warning: ${res?.error || "Check failed"}`);
                          }
                        }
                      } catch (err) {
                        triggerToast(`Integrity check error: ${err.message}`);
                      }
                    }}
                  >
                    Check Index
                  </button>
                  <button
                    className="ai-btn-secondary"
                    onClick={async () => {
                      try {
                        if (window.electronFeatures?.aiRepairIndex) {
                          const res = await window.electronFeatures.aiRepairIndex();
                          if (res?.success) {
                            triggerToast("Index repair and reindex completed successfully");
                          }
                        }
                      } catch (err) {
                        triggerToast(`Repair error: ${err.message}`);
                      }
                    }}
                  >
                    Repair Index
                  </button>
                  <button
                    className="ai-btn-secondary"
                    onClick={async () => {
                      triggerToast("Rebuilding full AI index...");
                      try {
                        if (window.electronFeatures?.aiRebuildIndex) {
                          const outcome = await window.electronFeatures.aiRebuildIndex();
                          if (outcome?.count !== undefined) setIndexedCount(outcome.count);
                          triggerToast("Full index rebuild complete!");
                        }
                      } catch (err) {
                        triggerToast(`Rebuild error: ${err.message}`);
                      }
                    }}
                  >
                    Rebuild Index
                  </button>
                  <button
                    className="ai-btn-danger"
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to purge all local AI index and vector data? This will reset your AI Search index.")) {
                        try {
                          if (window.electronFeatures?.aiClearData) {
                            const res = await window.electronFeatures.aiClearData();
                            if (res?.success) {
                              setIndexedCount(0);
                              triggerToast("AI index data purged successfully");
                            }
                          }
                        } catch (err) {
                          triggerToast(`Purge error: ${err.message}`);
                        }
                      }
                    }}
                  >
                    Clear AI Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              8. MODEL MANAGER (REAL CATEGORIZATION & ORGANIZATION)
              ========================================================= */}
          {activeTab === "model-manager" && (
            <div className="ai-settings-section">
              <div className="ai-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3>Installed AI Models</h3>
                  <p>Categorized catalog of registered local neural models, active runtimes, and multi-modal pipeline consumers.</p>
                </div>
                <button
                  onClick={() => setShowImportModal(true)}
                  style={{
                    padding: "8px 16px",
                    background: "#2563eb",
                    border: "1px solid #3b82f6",
                    borderRadius: "8px",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>+</span>
                  <span>Import Local Model</span>
                </button>
              </div>

              {/* Sub-tabs & Search / Filter bar */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { id: "all", label: `All (${modelsList.length})` },
                    { id: "installed", label: `Installed (${modelsList.filter((m) => m.isInstalled).length})` },
                    { id: "available", label: `Available (${modelsList.filter((m) => !m.isInstalled).length})` },
                    { id: "custom", label: `Custom (${modelsList.filter((m) => m.isCustom).length})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setModelSubTab(tab.id)}
                      style={{
                        padding: "6px 14px",
                        background: modelSubTab === tab.id ? "#1e293b" : "transparent",
                        border: modelSubTab === tab.id ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "6px",
                        color: modelSubTab === tab.id ? "#60a5fa" : "#94a3b8",
                        fontSize: "12.5px",
                        fontWeight: modelSubTab === tab.id ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="🔍 Search models by name, role, capability, or format..."
                  value={modelSearchFilter}
                  onChange={(e) => setModelSearchFilter(e.target.value)}
                  className="ai-input"
                  style={{ width: "100%", padding: "10px 14px", fontSize: "13px", background: "#0f172a", border: "1px solid #334155" }}
                />
              </div>

              {/* 📄 1. TEXT & DOCUMENT MODELS */}
              {textModels.length > 0 && (
                <div className="ai-model-category-group" style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <h4 style={{ margin: 0, fontSize: "16px", color: "#f8fafc", fontWeight: 600 }}>📄 Text &amp; Document Models</h4>
                    <span style={{ fontSize: "12px", background: "#1e293b", color: "#94a3b8", padding: "1px 8px", borderRadius: "10px" }}>{textModels.length}</span>
                  </div>
                  <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#94a3b8" }}>
                    Models used to convert text and documents into neural embeddings for semantic and hybrid search.
                  </p>
                  {textModels.map((m) => renderModelCard(m))}
                </div>
              )}

              {/* 🖼️ 2. IMAGE & VISION MODELS */}
              {visionModels.length > 0 && (
                <div className="ai-model-category-group" style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <h4 style={{ margin: 0, fontSize: "16px", color: "#f8fafc", fontWeight: 600 }}>🖼️ Image &amp; Vision Models</h4>
                    <span style={{ fontSize: "12px", background: "#1e293b", color: "#94a3b8", padding: "1px 8px", borderRadius: "10px" }}>{visionModels.length}</span>
                  </div>
                  <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#94a3b8" }}>
                    Models used to understand images, photos, visual concepts, and video keyframes.
                  </p>
                  {visionModels.map((m) => renderModelCard(m))}
                </div>
              )}

              {/* 🔤 3. OCR MODELS */}
              {ocrModels.length > 0 && (
                <div className="ai-model-category-group" style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <h4 style={{ margin: 0, fontSize: "16px", color: "#f8fafc", fontWeight: 600 }}>🔤 OCR Models</h4>
                    <span style={{ fontSize: "12px", background: "#1e293b", color: "#94a3b8", padding: "1px 8px", borderRadius: "10px" }}>{ocrModels.length}</span>
                  </div>
                  <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#94a3b8" }}>
                    Models used to detect and extract visible text from screenshots, scanned documents, and video frames.
                  </p>
                  {ocrModels.map((m) => renderModelCard(m))}
                </div>
              )}

              {/* 🎬 4. VIDEO INTELLIGENCE (PIPELINE ARCHITECTURE) */}
              <div className="ai-model-category-group" style={{ marginBottom: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <h4 style={{ margin: 0, fontSize: "16px", color: "#f8fafc", fontWeight: 600 }}>🎬 Video Intelligence Pipeline</h4>
                  <span style={{ fontSize: "11px", background: "#1e1b4b", color: "#a5b4fc", padding: "2px 8px", borderRadius: "10px" }}>Multi-Model Pipeline</span>
                </div>
                <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#94a3b8" }}>
                  Video analysis is an integrated pipeline combining visual frame understanding, OCR text extraction, and audio speech transcription.
                </p>

                <div style={{
                  background: "var(--color-bg-secondary, #1e293b)",
                  border: "1px solid #334155",
                  borderRadius: "10px",
                  padding: "16px 20px",
                }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#f8fafc", marginBottom: "8px" }}>
                    Active Video Pipeline Architecture
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#38bdf8" }}>├── 🖼️ Frame Vision:</span>
                      <strong style={{ color: "#e2e8f0" }}>{activeModels.vision?.name || "CLIP ViT-Base Patch32 Vision"}</strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>(Visual concepts &amp; scene matching)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#a855f7" }}>├── 🔤 Video OCR:</span>
                      <strong style={{ color: "#e2e8f0" }}>TrOCR Small Printed Text Recognition</strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>(On-screen text &amp; slide detection)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#34d399" }}>└── 🎧 Video Audio Transcriber:</span>
                      <strong style={{ color: "#e2e8f0" }}>{activeModels.audio?.name || "Whisper Tiny Audio Transcriber"}</strong>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>(Timestamped speech transcripts)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🎧 5. AUDIO & SPEECH MODELS */}
              {audioModels.length > 0 && (
                <div className="ai-model-category-group" style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <h4 style={{ margin: 0, fontSize: "16px", color: "#f8fafc", fontWeight: 600 }}>🎧 Audio &amp; Speech Models</h4>
                    <span style={{ fontSize: "12px", background: "#1e293b", color: "#94a3b8", padding: "1px 8px", borderRadius: "10px" }}>{audioModels.length}</span>
                  </div>
                  <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#94a3b8" }}>
                    Models used to convert spoken audio in podcasts, meetings, and video tracks into searchable transcripts.
                  </p>
                  {audioModels.map((m) => renderModelCard(m))}
                </div>
              )}

              {/* 🧠 6. MULTIMODAL MODELS (Only if present) */}
              {multimodalModels.length > 0 && (
                <div className="ai-model-category-group" style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <h4 style={{ margin: 0, fontSize: "16px", color: "#f8fafc", fontWeight: 600 }}>🧠 Multimodal Models</h4>
                    <span style={{ fontSize: "12px", background: "#1e293b", color: "#94a3b8", padding: "1px 8px", borderRadius: "10px" }}>{multimodalModels.length}</span>
                  </div>
                  <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#94a3b8" }}>
                    Models capable of cross-modal reasoning across multiple input forms simultaneously.
                  </p>
                  {multimodalModels.map((m) => renderModelCard(m))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              9. ABOUT AI SEARCH
              ========================================================= */}
          {activeTab === "about" && (
            <div className="ai-settings-section">
              <div className="ai-section-header">
                <h3>About Nexora AI Search</h3>
                <p>Privacy-first neural search engine engineered for local desktop file exploration.</p>
              </div>

              <div className="ai-card">
                <div className="ai-about-header">
                  <div className="ai-about-logo">✦</div>
                  <div>
                    <h3 style={{ margin: 0, color: "#f8fafc" }}>Nexora AI Search</h3>
                    <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>Version 2.0.0 (Local Neural Edition)</p>
                  </div>
                </div>

                <div className="ai-divider"></div>

                <div className="ai-about-features">
                  <div className="ai-about-feature-item">
                    <strong>⚡ Instant Natural Language Queries:</strong>
                    <span>Find files by meaning, context, or conversational phrasing without exact filenames.</span>
                  </div>
                  <div className="ai-about-feature-item">
                    <strong>🔒 100% Local Privacy:</strong>
                    <span>All neural embeddings and vector similarity calculations occur locally on your machine.</span>
                  </div>
                  <div className="ai-about-feature-item">
                    <strong>🖼️ Deep Multimodal Indexing:</strong>
                    <span>Searches text inside PDFs, codebases, photos, and voice notes.</span>
                  </div>
                </div>

                <div className="ai-divider"></div>

                <div className="ai-about-footer">
                  <span>© 2026 Nexora Explorer. All rights reserved.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================
          REAL MODEL SELECTOR MODAL
          ========================================================= */}
      {selectorModalTask && (
        <div className="modal-overlay" onClick={() => setSelectorModalTask(null)}>
          <div className="ai-modal-dialog" onClick={(e) => e.stopPropagation()} style={{
            background: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "12px",
            padding: "24px",
            width: "550px",
            maxWidth: "90vw",
            color: "#f8fafc",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>Select {selectorModalTask.toUpperCase()} Model</h3>
              <button
                onClick={() => setSelectorModalTask(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: 0 }}>
              Choose a registered neural model from the local Model Registry:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "350px", overflowY: "auto", margin: "16px 0" }}>
              {getCandidateModelsForTask(selectorModalTask).map((m) => {
                const isSelected = (
                  (selectorModalTask === "embedding" && activeModels.embedding?.id === m.id) ||
                  (selectorModalTask === "vision" && activeModels.vision?.id === m.id) ||
                  (selectorModalTask === "audio" && activeModels.audio?.id === m.id)
                );

                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectModel(selectorModalTask, m.id)}
                    style={{
                      padding: "12px 16px",
                      background: isSelected ? "rgba(59, 130, 246, 0.15)" : "#1e293b",
                      border: isSelected ? "2px solid #3b82f6" : "1px solid #334155",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#f8fafc" }}>
                        {m.name} {isSelected && <span style={{ color: "#3b82f6", fontSize: "12px", marginLeft: "6px" }}>● Active</span>}
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "3px" }}>
                        {m.type} • {m.sizeFormatted} • {m.provider}
                      </div>
                    </div>
                    <button
                      className={isSelected ? "ai-btn-primary" : "ai-btn-secondary"}
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectModel(selectorModalTask, m.id);
                      }}
                    >
                      {isSelected ? "Active" : "Select"}
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                className="ai-btn-secondary"
                onClick={() => setSelectorModalTask(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Model Import Wizard Modal */}
      <CustomModelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={async (imported) => {
          triggerToast(`Model ${imported?.name || "Custom Model"} imported successfully!`);
          try {
            if (window.electronFeatures?.aiGetModels) {
              const allM = await window.electronFeatures.aiGetModels();
              if (allM) setModelsList(allM);
            }
          } catch (err) {
            console.warn(err);
          }
        }}
      />
    </div>
  );
}
