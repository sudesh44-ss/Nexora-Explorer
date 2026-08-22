import { useState, useRef, useEffect, useCallback } from "react";
import "./AIFeatures.css";
import AISearchBasicSettings from "./components/ai-search/AISearchBasicSettings";
import AISearchSettings from "./components/ai-search/AISearchSettings";
import AISearchSetupModal from "./components/ai-search/AISearchSetupModal";
import SearchResultsArea from "./components/ai-search/SearchResultsArea";
import {
  SUGGESTED_KEYWORDS,
  POPULAR_KEYWORDS,
  FILE_TYPE_OPTIONS,
} from "./components/ai-search/mockData";

export default function AIFeatures({ onClose }) {
  const [view, setView] = useState("search"); // 'search' | 'settings' | 'advanced-settings'
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedDrive, setSelectedDrive] = useState("all");
  const [availableDrives, setAvailableDrives] = useState([
    { id: "all", label: "All Drives", icon: "💾" },
  ]);
  const [searchState, setSearchState] = useState("empty"); // 'empty' | 'loading' | 'results' | 'no-results' | 'error'
  const [results, setResults] = useState([]);
  const [loadingStep, setLoadingStep] = useState(1);
  const [statusMessage, setStatusMessage] = useState("");
  const [searchTookMs, setSearchTookMs] = useState(0);

  // Model Provisioning & Setup State
  const [modelsStatus, setModelsStatus] = useState(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupModalMode, setSetupModalMode] = useState("initial_setup");
  const [lazyTaskInfo, setLazyTaskInfo] = useState(null);

  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const activeRequestIdRef = useRef(0);

  // Fetch model readiness and connected drives on mount
  useEffect(() => {
    async function loadData() {
      try {
        if (window.electronFeatures?.aiGetModelsStatus) {
          const mStatus = await window.electronFeatures.aiGetModelsStatus();
          if (mStatus) {
            setModelsStatus(mStatus);
            if (mStatus.isSetupRequired && !mStatus.aiSetupDismissed) {
              setSetupModalMode("initial_setup");
              setShowSetupModal(true);
            }
          }
        }

        if (window.fileExplorer?.getDrives) {
          const drives = await window.fileExplorer.getDrives();
          if (Array.isArray(drives) && drives.length > 0) {
            const formatted = [
              { id: "all", label: "All Drives", icon: "💾" },
              ...drives.map((d) => ({
                id: d.path.replace(/\\$/, ""),
                label: d.name || d.path,
                icon: "💽",
              })),
            ];
            setAvailableDrives(formatted);
          }
        }
      } catch (err) {
        console.error("Failed to load initial AI search data:", err);
      }
    }
    loadData();
  }, []);

  // Focus search input on mount
  useEffect(() => {
    if (view === "search" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [view]);

  // Clean up debounce timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Execute real AI Search with backend integration & cancellation safety
  const handleExecuteSearch = useCallback(
    async (searchQuery = query, typeFilter = selectedType, driveFilter = selectedDrive) => {
      const q = (searchQuery || "").trim();

      if (!q && typeFilter === "all" && driveFilter === "all") {
        setSearchState("empty");
        setResults([]);
        setSearchTookMs(0);
        return;
      }

      // Request ID increment for race-condition / cancellation protection
      const requestId = ++activeRequestIdRef.current;

      setSearchState("loading");
      setLoadingStep(1);

      // Progressive visual feedback indicators
      const stepTimer1 = setTimeout(() => {
        if (activeRequestIdRef.current === requestId) setLoadingStep(2);
      }, 150);
      const stepTimer2 = setTimeout(() => {
        if (activeRequestIdRef.current === requestId) setLoadingStep(3);
      }, 300);
      const stepTimer3 = setTimeout(() => {
        if (activeRequestIdRef.current === requestId) setLoadingStep(4);
      }, 450);

      try {
        let outcome = null;

        if (window.electronFeatures?.aiSearch) {
          outcome = await window.electronFeatures.aiSearch({
            query: q,
            filters: {
              fileType: typeFilter,
              drive: driveFilter,
            },
          });
        } else if (window.fileExplorer?.searchDirectory) {
          // Fallback via fileExplorer searchDirectory
          const dirResults = await window.fileExplorer.searchDirectory(
            driveFilter === "all" ? "C:\\" : `${driveFilter}\\`,
            q,
            typeFilter
          );
          outcome = {
            status: dirResults.length > 0 ? "results" : "no-results",
            results: dirResults,
            total: dirResults.length,
          };
        } else {
          outcome = { status: "empty", results: [] };
        }

        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);

        // Discard stale responses
        if (activeRequestIdRef.current !== requestId) {
          return;
        }

        if (outcome && outcome.status) {
          setSearchState(outcome.status);
          setResults(outcome.results || []);
          setSearchTookMs(outcome.tookMs || 0);
        } else {
          setSearchState("no-results");
          setResults([]);
        }
      } catch (err) {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        clearTimeout(stepTimer3);

        if (activeRequestIdRef.current === requestId) {
          console.error("AI Search execution failed:", err);
          setSearchState("error");
          setResults([]);
        }
      }
    },
    [query, selectedType, selectedDrive]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      handleExecuteSearch();
    }
  };

  const handleQueryChange = (val) => {
    setQuery(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!val.trim() && selectedType === "all" && selectedDrive === "all") {
      setSearchState("empty");
      setResults([]);
      return;
    }

    // Debounce fast typing (350ms)
    debounceTimerRef.current = setTimeout(() => {
      handleExecuteSearch(val, selectedType, selectedDrive);
    }, 350);
  };

  const handleClearQuery = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setQuery("");
    setSelectedType("all");
    setSelectedDrive("all");
    setSearchState("empty");
    setResults([]);
    setSearchTookMs(0);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSelectKeyword = (kw) => {
    setQuery(kw);
    handleExecuteSearch(kw, selectedType, selectedDrive);
  };

  const handleSelectType = (typeId) => {
    const nextType = selectedType === typeId ? "all" : typeId;
    setSelectedType(nextType);

    // Lazy capability checks
    if (nextType === "images" && modelsStatus && !modelsStatus.isVisionReady) {
      setLazyTaskInfo({
        task: "image",
        title: "Image Search",
        modelId: "clip-vit-base-patch32",
        modelName: "CLIP ViT-Base Patch32 Vision Model",
        size: "~150 MB",
      });
      setSetupModalMode("lazy_capability");
      setShowSetupModal(true);
      return;
    }

    if (nextType === "audio" && modelsStatus && !modelsStatus.isAudioReady) {
      setLazyTaskInfo({
        task: "audio",
        title: "Audio Search",
        modelId: "whisper-tiny",
        modelName: "Whisper Tiny Audio Transcriber",
        size: "~75 MB",
      });
      setSetupModalMode("lazy_capability");
      setShowSetupModal(true);
      return;
    }

    if (query.trim() || nextType !== "all") {
      handleExecuteSearch(query, nextType, selectedDrive);
    }
  };

  const handleSelectDrive = (driveId) => {
    const nextDrive = selectedDrive === driveId ? "all" : driveId;
    setSelectedDrive(nextDrive);
    if (query.trim() || nextDrive !== "all") {
      handleExecuteSearch(query, selectedType, nextDrive);
    }
  };

  const handleChooseFolder = async () => {
    try {
      if (window.electronFeatures?.chooseFolder) {
        const folder = await window.electronFeatures.chooseFolder();
        if (folder && folder.path) {
          setStatusMessage(`Target folder selected: ${folder.path}`);
          setTimeout(() => setStatusMessage(""), 3000);
          handleExecuteSearch(query, selectedType, folder.path);
        }
      }
    } catch (err) {
      console.error("Choose folder error:", err);
    }
  };

  // If in Basic Settings view, render the dedicated AISearchBasicSettings page
  if (view === "settings") {
    return (
      <AISearchBasicSettings
        onBack={() => setView("search")}
        onOpenAdvanced={() => setView("advanced-settings")}
      />
    );
  }

  // If in Advanced Settings view, render the dedicated AISearchSettings (Neural Engine) page
  if (view === "advanced-settings") {
    return (
      <AISearchSettings
        onBack={() => setView("search")}
      />
    );
  }

  return (
    <div className="ai-search-root">
      {/* Top Header / Status Bar */}
      <div className="ai-top-header">
        <div className="ai-title-group">
          <div className="ai-brand-badge">
            <span className="ai-sparkle-icon">✦</span>
            <div className="ai-header-text">
              <div className="ai-header-title-row">
                <h2>AI Search</h2>
                <span className="ai-local-badge">● Local Neural Engine</span>
              </div>
              <p>Search your entire computer using natural language queries</p>
            </div>
          </div>
        </div>

        <div className="ai-header-actions">
          {statusMessage && <div className="ai-header-toast">{statusMessage}</div>}
          <button
            className="ai-btn-header-gear"
            onClick={() => setView("settings")}
            title="Open AI Search Settings"
          >
            <span className="ai-gear-icon">⚙</span>
            <span className="ai-gear-label">Settings</span>
          </button>
          <button
            className="ai-btn-header-close"
            onClick={onClose}
            title="Close AI Search"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Search Workspace */}
      <div className="ai-search-workspace">
        {/* Non-blocking Setup Required Banner if Models Missing */}
        {modelsStatus?.isSetupRequired && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              padding: "12px 18px",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "10px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>🟡</span>
              <div>
                <strong style={{ color: "#fbbf24", fontSize: "13.5px" }}>AI Search setup required</strong>
                <p style={{ margin: 0, fontSize: "12px", color: "#cbd5e1" }}>
                  Download local AI models to enable intelligent natural language search.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSetupModalMode("initial_setup");
                setShowSetupModal(true);
              }}
              style={{
                padding: "7px 14px",
                background: "#2563eb",
                border: "1px solid #3b82f6",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ⚡ Set Up AI Search
            </button>
          </div>
        )}

        {/* =========================================================
            SEARCH BAR AREA
            ========================================================= */}
        <div className="ai-search-bar-section">
          <div className="ai-search-input-wrapper">
            <span className="ai-search-input-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="ai-search-input"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask something... (e.g. 'my college project files', 'birthday photos', 'PDFs about cybersecurity')"
              autoFocus
            />
            {query && (
              <button
                className="ai-btn-input-clear"
                onClick={handleClearQuery}
                title="Clear query"
              >
                ✕
              </button>
            )}
          </div>

          <div className="ai-search-bar-actions">
            <button
              className={`ai-btn-enter ${searchState === "loading" ? "loading" : ""}`}
              onClick={() => handleExecuteSearch()}
              disabled={searchState === "loading"}
              title="Execute AI Search"
            >
              {searchState === "loading" ? (
                <>
                  <span className="ai-spinner-small"></span> Searching...
                </>
              ) : (
                <>
                  <span>→ Enter</span>
                </>
              )}
            </button>

            <button
              className="ai-btn-clear"
              onClick={handleClearQuery}
              title="Reset query and filters"
            >
              ✕ Clear
            </button>
          </div>
        </div>

        {/* =========================================================
            SUGGESTED KEYWORDS CHIPS
            ========================================================= */}
        <div className="ai-suggested-keywords-section">
          <span className="ai-keywords-label">Suggested Keywords:</span>
          <div className="ai-keywords-chips">
            {SUGGESTED_KEYWORDS.map((kw, idx) => (
              <button
                key={idx}
                className="ai-keyword-chip"
                onClick={() => handleSelectKeyword(kw)}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        {/* =========================================================
            OPTIONAL SEARCH SUGGESTIONS & FILTERS
            ========================================================= */}
        <div className="ai-filters-panel">
          {/* File Types */}
          <div className="ai-filter-group">
            <div className="ai-filter-group-title">What do you want to search?</div>
            <div className="ai-type-cards">
              {FILE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={`ai-type-card ${selectedType === opt.id ? "active" : ""}`}
                  onClick={() => handleSelectType(opt.id)}
                >
                  <span className="ai-type-icon">{opt.icon}</span>
                  <div className="ai-type-details">
                    <strong className="ai-type-name">{opt.label}</strong>
                    <small className="ai-type-exts">{opt.exts}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Drive & Popular Keywords Row */}
          <div className="ai-filters-row">
            {/* Search by Disk */}
            <div className="ai-drive-group">
              <div className="ai-filter-group-title">Search by Disk</div>
              <div className="ai-drive-chips">
                {availableDrives.map((d) => (
                  <button
                    key={d.id}
                    className={`ai-drive-chip ${selectedDrive === d.id ? "active" : ""}`}
                    onClick={() => handleSelectDrive(d.id)}
                  >
                    <span className="ai-drive-icon">{d.icon}</span>
                    <span>{d.label}</span>
                  </button>
                ))}
                <button
                  className="ai-drive-chip ai-choose-folder-btn"
                  onClick={handleChooseFolder}
                >
                  <span>📁</span>
                  <span>Choose Folder</span>
                </button>
              </div>
            </div>

            {/* Popular Keywords */}
            <div className="ai-popular-group">
              <div className="ai-filter-group-title">Popular Keywords</div>
              <div className="ai-popular-chips">
                {POPULAR_KEYWORDS.map((pKw, idx) => (
                  <button
                    key={idx}
                    className="ai-popular-chip"
                    onClick={() => handleSelectKeyword(pKw.toLowerCase())}
                  >
                    {pKw}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            RESULTS AREA (Empty, Loading, Results, No Results, Error)
            ========================================================= */}
        <div className="ai-results-viewport">
          <SearchResultsArea
            searchState={searchState}
            query={query}
            results={results}
            tookMs={searchTookMs}
            loadingStep={loadingStep}
            onSelectSampleQuery={(sampleText) => {
              setQuery(sampleText);
              handleExecuteSearch(sampleText, selectedType, selectedDrive);
            }}
            onClearQuery={handleClearQuery}
            onRetry={() => handleExecuteSearch()}
            onOpenSettings={() => setView("settings")}
          />
        </div>
      </div>

      {/* Model Setup / Provisioning Modal */}
      <AISearchSetupModal
        isOpen={showSetupModal}
        mode={setupModalMode}
        lazyTask={lazyTaskInfo}
        onClose={() => setShowSetupModal(false)}
        onDismiss={() => {
          if (modelsStatus) {
            setModelsStatus({ ...modelsStatus, aiSetupDismissed: true });
          }
        }}
        onComplete={async () => {
          if (window.electronFeatures?.aiGetModelsStatus) {
            const updated = await window.electronFeatures.aiGetModelsStatus();
            if (updated) setModelsStatus(updated);
          }
        }}
      />
    </div>
  );
}