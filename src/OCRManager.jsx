/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import "./OCRManager.css";

const languageCodes = {
  "English": "eng",
  "Hindi": "hin",
  "Hindi + English": "eng+hin",
  "Multi-language": "eng+hin"
};

const languageNames = {
  "eng": "English",
  "hin": "Hindi",
  "eng+hin": "Hindi + English"
};

function OCRManager({ selectedItem, onClose }) {
  const [activeTab, setActiveTab] = useState("extract");
  const [selectedFile, setSelectedFile] = useState(null);
  const [confidence, setConfidence] = useState("—");
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("Waiting for OCR operation");
  
  // Settings State
  const [engine, setEngine] = useState("Default OCR Engine");
  const [ocrSettings, setOcrSettings] = useState({
    engine: "tesseract",
    language: "eng",
    dpi: 150,
    pdfRange: "all",
    preprocessing: "none"
  });

  // Engine Availability
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [engineStatusError, setEngineStatusError] = useState("");

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState("all"); // all, current, selected
  const [searchExact, setSearchExact] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchRan, setSearchRan] = useState(false);

  // Queue State
  const [queueState, setQueueState] = useState({
    items: [],
    isProcessing: false,
    isPaused: false,
    currentIndex: -1
  });

  const [ocrOutput, setOcrOutput] = useState("");
  const [ocrResultMeta, setOcrResultMeta] = useState(null);

  // Tabs layout
  const tabs = [
    { id: "extract", label: "Extract Text", icon: "▤" },
    { id: "search", label: "OCR Search", icon: "⌕" },
    { id: "output", label: "OCR Output", icon: "⇩" },
    { id: "queue", label: "OCR Queue", icon: "☷" },
    { id: "settings", label: "Settings", icon: "⚙" }
  ];

  // 1. Initial status checks and settings fetch
  const updateEngineStatus = () => {
    window.electronFeatures.ocrGetStatus()
      .then((status) => {
        if (status.available) {
          setIsEngineReady(true);
          setEngineStatusError("");
        } else {
          setIsEngineReady(false);
          setEngineStatusError("OCR engine is not installed/configured.");
        }
      })
      .catch((err) => {
        setIsEngineReady(false);
        setEngineStatusError(`Failed status check: ${err.message}`);
      });
  };

  const loadSettings = () => {
    window.electronFeatures.ocrGetSettings()
      .then((settings) => {
        if (settings) {
          setOcrSettings(settings);
          setEngine(settings.engine === "tesseract" ? "Local OCR Engine" : "Default OCR Engine");
          setSelectedLanguage(languageNames[settings.language] || "English");
        }
      });
  };

  const loadQueue = () => {
    window.electronFeatures.ocrGetQueue()
      .then((q) => {
        if (q) setQueueState(q);
      });
  };

  useEffect(() => {
    updateEngineStatus();
    loadSettings();
    loadQueue();

    // Setup IPC listeners for queue events
    const unsubQueue = window.electronFeatures.onOcrQueueChanged((updatedQueue) => {
      if (updatedQueue) setQueueState(updatedQueue);
    });

    const unsubProgress = window.electronFeatures.onOcrProgress((progressData) => {
      // Progress details for current item
      setOcrProgress(progressData.progress);
      setStatusText(`Processing page ${progressData.currentPage} of ${progressData.totalPages}...`);
    });

    const unsubFinished = window.electronFeatures.onOcrQueueFinished(() => {
      loadQueue();
      alert("Batch OCR queue operations completed!");
    });

    return () => {
      unsubQueue();
      unsubProgress();
      unsubFinished();
    };
  }, []);

  // Update selected file from prop
  useEffect(() => {
    if (selectedItem) {
      setSelectedFile(selectedItem);
      setConfidence("—");
      setOcrProgress(0);
      setIsProcessing(false);
      setOcrOutput("");
      setOcrResultMeta(null);
    } else {
      setSelectedFile(null);
    }
  }, [selectedItem]);

  // ----------------------------------------------------------
  // File Picker
  // ----------------------------------------------------------
  const selectFile = async () => {
    const res = await window.electronFeatures.chooseFile();
    if (res.success && !res.canceled && res.path) {
      const fileName = res.path.split(/[/\\]/).pop();
      setSelectedFile({
        name: fileName,
        path: res.path
      });
      setConfidence("—");
      setOcrProgress(0);
      setIsProcessing(false);
      setOcrOutput("");
      setOcrResultMeta(null);
    }
  };

  // ----------------------------------------------------------
  // OCR Operation Triggers
  // ----------------------------------------------------------
  const startOCR = () => {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }
    
    // Check if it's a PDF and we want to process it
    const isPdf = selectedFile.name.endsWith(".pdf");
    if (!isPdf && !isEngineReady) {
      alert(`Error: ${engineStatusError}`);
      return;
    }

    setIsProcessing(true);
    setOcrProgress(5);
    setOcrOutput("");
    setStatusText("Initializing OCR process...");

    const options = {
      language: languageCodes[selectedLanguage] || "eng",
      dpi: ocrSettings.dpi,
      pdfRange: ocrSettings.pdfRange,
      preprocessing: ocrSettings.preprocessing
    };

    window.electronFeatures.ocrStartFile(selectedFile.path, options)
      .then((res) => {
        setIsProcessing(false);
        if (res.success) {
          setConfidence(res.confidence === 100 ? "Selectable Text (100%)" : `${res.confidence}%`);
          setOcrOutput(res.text);
          setOcrResultMeta(res);
          setOcrProgress(100);
          setStatusText("Processing completed.");
          setActiveTab("output");
        } else {
          setOcrProgress(0);
          setStatusText("Failed");
          alert(`OCR processing failed: ${res.error}`);
        }
      })
      .catch((err) => {
        setIsProcessing(false);
        setOcrProgress(0);
        setStatusText("Error");
        alert(`Error: ${err.message}`);
      });
  };

  // ----------------------------------------------------------
  // Settings Form Management
  // ----------------------------------------------------------
  const handleSettingChange = (key, value) => {
    const updated = { ...ocrSettings, [key]: value };
    setOcrSettings(updated);
    window.electronFeatures.ocrSaveSettings(updated);
  };

  // ----------------------------------------------------------
  // Queue Management
  // ----------------------------------------------------------
  const handleAddFileToQueue = async () => {
    const res = await window.electronFeatures.chooseFile();
    if (res.success && !res.canceled && res.path) {
      window.electronFeatures.ocrAddQueue([res.path], {
        language: languageCodes[selectedLanguage] || "eng"
      })
        .then(() => {
          loadQueue();
          setStatusText("Added file to batch queue.");
        });
    }
  };

  const handleAddCurrentFileToQueue = () => {
    if (!selectedFile) return;
    window.electronFeatures.ocrAddQueue([selectedFile.path], {
      language: languageCodes[selectedLanguage] || "eng"
    })
      .then(() => {
        loadQueue();
        alert("Current file added to OCR Queue.");
      });
  };

  const handleQueueAction = (action, itemId) => {
    window.electronFeatures.ocrControlQueue(action, itemId)
      .then(() => {
        loadQueue();
      });
  };

  // ----------------------------------------------------------
  // Index Searching
  // ----------------------------------------------------------
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearchRan(true);

    // If scope matches current or selected, target path can be set to selectedFile directory
    const targetPath = selectedFile ? selectedFile.path : "";

    window.electronFeatures.ocrSearch(searchQuery.trim(), searchScope, targetPath)
      .then((res) => {
        if (res.success) {
          setSearchResults(res.results || []);
        } else {
          alert(`Search failed: ${res.error}`);
        }
      });
  };

  // ----------------------------------------------------------
  // Exporters
  // ----------------------------------------------------------
  const handleExportText = async () => {
    if (!ocrOutput) return;
    const dest = await window.electronFeatures.chooseFolder();
    if (dest.success && !dest.canceled && dest.path) {
      const fileName = selectedFile ? selectedFile.name.split(".")[0] : "ocr_result";
      const fullPath = `${dest.path}\\${fileName}_extracted.txt`;
      
      window.electronFeatures.ocrExportText(fullPath, ocrOutput)
        .then((res) => {
          if (res.success) {
            alert(`Extracted text exported successfully to:\n${fullPath}`);
          } else {
            alert(`Export failed: ${res.error}`);
          }
        });
    }
  };

  const handleExportJson = async () => {
    if (!ocrOutput) return;
    const dest = await window.electronFeatures.chooseFolder();
    if (dest.success && !dest.canceled && dest.path) {
      const fileName = selectedFile ? selectedFile.name.split(".")[0] : "ocr_result";
      const fullPath = `${dest.path}\\${fileName}_metadata.json`;

      const meta = ocrResultMeta || {
        text: ocrOutput,
        language: selectedLanguage,
        confidence,
        pages: 1,
        source: "unknown",
        engine: "tesseract"
      };

      window.electronFeatures.ocrExportJson(fullPath, meta)
        .then((res) => {
          if (res.success) {
            alert(`OCR Metadata exported successfully to:\n${fullPath}`);
          } else {
            alert(`Export failed: ${res.error}`);
          }
        });
    }
  };

  return (
    <div className="ocr-manager">

      {/* =====================================================
          HEADER
          ===================================================== */}
      <div className="ocr-header">
        <div className="ocr-title-section">
          <div className="ocr-main-icon">🧠</div>
          <div>
            <h2>OCR Center</h2>
            <p>Extract, search and manage text from images and scanned documents</p>
          </div>
        </div>

        <div className="ocr-status">
          <span className="ocr-status-dot" style={{ backgroundColor: isEngineReady ? "#10b981" : "#ef4444" }}></span>
          <span>OCR Engine</span>
          <strong style={{ color: isEngineReady ? "#10b981" : "#ef4444" }}>
            {isEngineReady ? "Ready" : "Unavailable"}
          </strong>
        </div>

        <button className="ocr-close-btn" onClick={onClose}>×</button>
      </div>

      {/* =====================================================
          NAVIGATION
          ===================================================== */}
      <div className="ocr-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "ocr-nav-item active" : "ocr-nav-item"}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="ocr-nav-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* =====================================================
          BODY
          ===================================================== */}
      <div className="ocr-body">

        {/* =================================================
            EXTRACT TEXT
            ================================================= */}
        {activeTab === "extract" && (
          <div className="ocr-page">
            <div className="ocr-page-header">
              <div>
                <h3>Extract Text</h3>
                <p>Extract readable text from images and PDFs.</p>
              </div>
              <button className="ocr-secondary-btn" onClick={selectFile}>
                Select File
              </button>
            </div>

            {/* Error alerts */}
            {!isEngineReady && (
              <div style={{ color: "#b91c1c", backgroundColor: "#fee2e2", padding: "12px", borderRadius: "6px", fontSize: "12px", marginBottom: "15px" }}>
                <strong>Attention:</strong> {engineStatusError}. Only text-selectable PDFs can be parsed without Tesseract.
              </div>
            )}

            {/* File Selection */}
            <div className="ocr-file-selector">
              <div className="ocr-file-icon">▧</div>
              <div className="ocr-file-details">
                <strong>{selectedFile ? selectedFile.name : "No file selected"}</strong>
                <span>Supported: JPG, PNG, WebP, BMP, TIFF, PDF</span>
              </div>
              <button className="ocr-secondary-btn" onClick={selectFile}>
                Browse
              </button>
            </div>

            {/* OCR Settings Summary */}
            <div className="ocr-grid">
              <div className="ocr-card">
                <div className="ocr-card-title">Language</div>
                <div className="ocr-form-group">
                  <label>OCR Language</label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => {
                      setSelectedLanguage(e.target.value);
                      handleSettingChange("language", languageCodes[e.target.value]);
                    }}
                  >
                    {Object.keys(languageCodes).map((language) => (
                      <option key={language} value={language}>{language}</option>
                    ))}
                  </select>
                </div>
                <div className="ocr-language-info">
                  <span>Target Tesseract language code</span>
                  <strong>{languageCodes[selectedLanguage] || "eng"}</strong>
                </div>
              </div>

              <div className="ocr-card">
                <div className="ocr-card-title">OCR Configuration</div>
                <div className="ocr-form-group">
                  <label>Engine</label>
                  <select
                    value={engine}
                    onChange={(e) => {
                      setEngine(e.target.value);
                      handleSettingChange("engine", e.target.value === "Local OCR Engine" ? "tesseract" : "default");
                    }}
                  >
                    <option>Default OCR Engine</option>
                    <option>Local OCR Engine</option>
                  </select>
                </div>
                <div className="ocr-language-info">
                  <span>Engine status</span>
                  <strong>{isEngineReady ? "Ready" : "Offline"}</strong>
                </div>
              </div>
            </div>

            {/* Start OCR */}
            <div className="ocr-action-panel">
              <div>
                <strong>Ready to extract text</strong>
                <p>Select an image or scanned document and start OCR processing.</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="ocr-secondary-btn" onClick={handleAddCurrentFileToQueue} disabled={!selectedFile}>
                  Add to Batch Queue
                </button>
                <button className="ocr-primary-btn" onClick={startOCR} disabled={isProcessing || !selectedFile}>
                  {isProcessing ? "Processing..." : "Start OCR"}
                </button>
              </div>
            </div>

            {/* Progress */}
            <div className="ocr-progress-card">
              <div className="ocr-progress-header">
                <span>OCR Progress</span>
                <strong>{isProcessing ? `${ocrProgress}%` : "0%"}</strong>
              </div>
              <div className="ocr-progress-track">
                <div className="ocr-progress-value" style={{ width: `${ocrProgress}%` }} />
              </div>
              <div className="ocr-progress-status">{isProcessing ? statusText : "Waiting for OCR operation"}</div>
            </div>
          </div>
        )}

        {/* =================================================
            OCR SEARCH
            ================================================= */}
        {activeTab === "search" && (
          <div className="ocr-page">
            <div className="ocr-page-header">
              <div>
                <h3>OCR Search</h3>
                <p>Search text stored inside images and scanned documents indexed locally.</p>
              </div>
            </div>

            {/* Search Box */}
            <div className="ocr-search-box">
              <span className="ocr-search-icon">⌕</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search text inside images and PDFs..."
              />
              <button className="ocr-primary-btn" onClick={handleSearch}>
                Search
              </button>
            </div>

            {/* Search Filters */}
            <div className="ocr-search-filters">
              <select value={searchScope} onChange={(e) => setSearchScope(e.target.value)}>
                <option value="all">Entire Drive</option>
                <option value="current">Current Folder</option>
                <option value="selected">Selected Folder</option>
              </select>

              <label className="ocr-checkbox">
                <input
                  type="checkbox"
                  checked={searchExact}
                  onChange={(e) => setSearchExact(e.target.checked)}
                />
                <span>Exact phrase</span>
              </label>
            </div>

            {/* Search Results */}
            <div className="ocr-results">
              <div className="ocr-results-header">
                <span>Search Results</span>
                <strong>{searchResults.length} results</strong>
              </div>

              {searchResults.length === 0 ? (
                <div className="ocr-empty">
                  <div className="ocr-empty-icon">⌕</div>
                  <strong>No OCR results</strong>
                  <p>
                    {searchRan ? "No matching text found in indexed documents." : "Search for text contained inside images or scanned documents."}
                  </p>
                </div>
              ) : (
                <div className="ocr-share-list" style={{ maxHeight: "250px", overflowY: "auto" }}>
                  {searchResults.map((res, i) => (
                    <div
                      className="ocr-share-row"
                      key={i}
                      style={{ padding: "10px", display: "flex", justifyContent: "space-between", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                      onClick={() => {
                        setSelectedFile({ name: res.fileName, path: res.filePath });
                        setOcrOutput(res.text);
                        setConfidence(`${res.confidence}%`);
                        setActiveTab("output");
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "12px", display: "block" }}>{res.fileName}</strong>
                        <span style={{ fontSize: "10px", color: "#6b7280", wordBreak: "break-all" }}>{res.filePath}</span>
                        <div style={{ fontSize: "11px", color: "#4b5563", marginTop: "4px", fontStyle: "italic" }}>
                          "...{res.text.substr(res.text.toLowerCase().indexOf(searchQuery.toLowerCase()), 60)}..."
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                        <span style={{ fontSize: "11px", color: "#059669" }}>{res.confidence}% Conf</span>
                        <span style={{ fontSize: "9px", color: "#9ca3af" }}>{new Date(res.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================
            OCR OUTPUT
            ================================================= */}
        {activeTab === "output" && (
          <div className="ocr-page">
            <div className="ocr-page-header">
              <div>
                <h3>Extracted Text</h3>
                <p>View, edit, copy or export OCR results.</p>
              </div>
              <div className="ocr-header-actions">
                <button className="ocr-secondary-btn" onClick={startOCR} disabled={!selectedFile}>
                  Re-run OCR
                </button>
                <button className="ocr-primary-btn" onClick={handleExportText} disabled={!ocrOutput}>
                  Export Text
                </button>
              </div>
            </div>

            {/* OCR Output Layout */}
            <div className="ocr-output-layout">
              <div className="ocr-text-panel">
                <div className="ocr-text-panel-header">
                  <span>Extracted Text</span>
                  <button onClick={() => { if (ocrOutput) navigator.clipboard.writeText(ocrOutput); alert("Copied to clipboard!"); }}>
                    Copy
                  </button>
                </div>
                <textarea
                  placeholder="Extracted OCR text will appear here..."
                  value={ocrOutput}
                  onChange={(e) => setOcrOutput(e.target.value)}
                />
              </div>

              <div className="ocr-output-info">
                <div className="ocr-card-title">OCR Information</div>
                
                <div className="ocr-info-row">
                  <span>Source File</span>
                  <strong style={{ fontSize: "10px", wordBreak: "break-all" }}>{selectedFile ? selectedFile.name : "—"}</strong>
                </div>

                <div className="ocr-info-row">
                  <span>Language</span>
                  <strong>{selectedLanguage}</strong>
                </div>

                <div className="ocr-info-row">
                  <span>Characters</span>
                  <strong>{ocrOutput ? ocrOutput.length : 0}</strong>
                </div>

                <div className="ocr-info-row">
                  <span>Confidence</span>
                  <strong style={{ color: "#059669" }}>{confidence}</strong>
                </div>

                <div className="ocr-output-actions" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "15px" }}>
                  <button className="ocr-secondary-btn" onClick={handleExportText} disabled={!ocrOutput}>
                    Export TXT
                  </button>
                  <button className="ocr-secondary-btn" onClick={handleExportJson} disabled={!ocrOutput}>
                    Export JSON
                  </button>
                  <button className="ocr-primary-btn" onClick={() => alert("Result saved automatically to Local Search Index!")} disabled={!ocrOutput}>
                    Save Result
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            OCR QUEUE
            ================================================= */}
        {activeTab === "queue" && (
          <div className="ocr-page">
            <div className="ocr-page-header">
              <div>
                <h3>OCR Queue</h3>
                <p>Manage multiple documents for batch OCR processing in the background.</p>
              </div>
              <div className="ocr-header-actions">
                <button className="ocr-secondary-btn" onClick={handleAddFileToQueue}>
                  + Add File
                </button>
                <button
                  className="ocr-secondary-btn"
                  onClick={() => handleQueueAction(queueState.isProcessing ? "pause" : queueState.isPaused ? "resume" : "start")}
                >
                  {queueState.isProcessing ? "Pause Queue" : queueState.isPaused ? "Resume Queue" : "Start Batch Queue"}
                </button>
                <button className="ocr-danger-btn" onClick={() => handleQueueAction("clear-completed")}>
                  Clear Completed
                </button>
              </div>
            </div>

            <div className="ocr-queue-summary">
              <div>
                <span>Queued</span>
                <strong>{queueState.items.filter(i => i.status === "queued").length}</strong>
              </div>
              <div>
                <span>Processing</span>
                <strong>{queueState.items.filter(i => i.status === "processing").length}</strong>
              </div>
              <div>
                <span>Completed</span>
                <strong style={{ color: "#059669" }}>{queueState.items.filter(i => i.status === "completed").length}</strong>
              </div>
              <div>
                <span>Failed</span>
                <strong style={{ color: "#dc2626" }}>{queueState.items.filter(i => i.status === "failed").length}</strong>
              </div>
            </div>

            <div className="ocr-queue-table" style={{ maxHeight: "250px", overflowY: "auto" }}>
              <div className="ocr-queue-header" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", fontWeight: "bold", padding: "8px", borderBottom: "1px solid #e5e7eb" }}>
                <span>File</span>
                <span>Type</span>
                <span>Language</span>
                <span>Status</span>
                <span>Progress</span>
              </div>

              {queueState.items.length === 0 ? (
                <div className="ocr-empty">
                  <div className="ocr-empty-icon">☷</div>
                  <strong>OCR queue is empty</strong>
                  <p>Batch OCR files will appear here.</p>
                </div>
              ) : (
                queueState.items.map((item) => (
                  <div
                    className="ocr-queue-row"
                    key={item.id}
                    style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "8px", borderBottom: "1px solid #f3f4f6", fontSize: "12px", alignItems: "center" }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.filePath}>
                      {item.fileName}
                    </span>
                    <span>{item.filePath.split(".").pop().toUpperCase()}</span>
                    <span>{languageNames[item.language] || "English"}</span>
                    <span style={{
                      fontWeight: "bold",
                      color: item.status === "completed" ? "#059669" : item.status === "failed" ? "#dc2626" : item.status === "processing" ? "#2563eb" : "#4b5563"
                    }}>
                      {item.status}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{item.progress}%</span>
                      {item.status === "processing" && (
                        <button className="ocr-small-btn" style={{ color: "#dc2626", border: "1px solid #dc2626", padding: "1px 4px", fontSize: "10px" }} onClick={() => handleQueueAction("cancel", item.id)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =================================================
            SETTINGS
            ================================================= */}
        {activeTab === "settings" && (
          <div className="ocr-page">
            <div className="ocr-page-header">
              <div>
                <h3>OCR Settings</h3>
                <p>Configure default OCR behaviour and image preprocessing.</p>
              </div>
            </div>

            <div className="ocr-settings-grid">
              <div className="ocr-settings-card">
                <div className="ocr-card-title">Default Settings</div>
                <div className="ocr-form-group" style={{ marginBottom: "10px" }}>
                  <label>OCR Engine</label>
                  <select
                    value={ocrSettings.engine}
                    onChange={(e) => handleSettingChange("engine", e.target.value)}
                  >
                    <option value="tesseract">Tesseract OCR</option>
                  </select>
                </div>
                <div className="ocr-form-group">
                  <label>Default Language</label>
                  <select
                    value={languageNames[ocrSettings.language] || "English"}
                    onChange={(e) => handleSettingChange("language", languageCodes[e.target.value])}
                  >
                    {Object.keys(languageCodes).map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ocr-settings-card">
                <div className="ocr-card-title">PDF Options</div>
                <div className="ocr-form-group" style={{ marginBottom: "10px" }}>
                  <label>Render Resolution (DPI)</label>
                  <select
                    value={ocrSettings.dpi}
                    onChange={(e) => handleSettingChange("dpi", parseInt(e.target.value, 10))}
                  >
                    <option value={72}>72 DPI (Fast)</option>
                    <option value={150}>150 DPI (Balanced)</option>
                    <option value={300}>300 DPI (High Quality)</option>
                  </select>
                </div>
                <div className="ocr-form-group">
                  <label>Default Range</label>
                  <select
                    value={ocrSettings.pdfRange}
                    onChange={(e) => handleSettingChange("pdfRange", e.target.value)}
                  >
                    <option value="all">All Pages</option>
                    <option value="first">First Page Only</option>
                  </select>
                </div>
              </div>

              <div className="ocr-settings-card">
                <div className="ocr-card-title">Preprocessing options</div>
                <div className="ocr-form-group">
                  <label>Image Enhancements</label>
                  <select
                    value={ocrSettings.preprocessing}
                    onChange={(e) => handleSettingChange("preprocessing", e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="grayscale">Grayscale Conversion</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="ocr-security-card">
              <span>🔐</span>
              <div>
                <strong>OCR Security Statement</strong>
                <p>
                  All OCR processing is done fully locally on your device using native tools and libraries. Documents are never transmitted or uploaded to external cloud APIs.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* =====================================================
          FOOTER
          ===================================================== */}
      <div className="ocr-footer">
        <div className="ocr-footer-left">
          <span>OCR Center</span>
          <span>•</span>
          <strong>{tabs.find((tab) => tab.id === activeTab)?.label}</strong>
        </div>

        <div className="ocr-footer-right">
          <span className="ocr-ready-dot" style={{ backgroundColor: isEngineReady ? "#10b981" : "#ef4444" }}></span>
          <span>
            {isEngineReady ? "OCR system ready" : "OCR engine unavailable"}
          </span>
        </div>
      </div>

    </div>
  );
}

export default OCRManager;