import { useState, useEffect, useRef } from "react";

import "./AdvancedSearch.css";
import SearchProgress from "./SearchProgress";

const LIST_SIZES = {
  1: { rowHeight: "26px", iconSize: "14px", fontSize: "11px" },
  2: { rowHeight: "30px", iconSize: "16px", fontSize: "12px" },
  3: { rowHeight: "34px", iconSize: "18px", fontSize: "12px" }, // Default
  4: { rowHeight: "38px", iconSize: "22px", fontSize: "13px" },
  5: { rowHeight: "44px", iconSize: "26px", fontSize: "14px" }
};

const isPhysical = (p) => {
  return p && !p.startsWith("tool:") && !p.startsWith("favorites:") && !p.startsWith("drives:");
};

const trace = (message, obj) => {
  console.log(message, obj);
  if (window.fileExplorer && window.fileExplorer.debugLog) {
    window.fileExplorer.debugLog({ source: "Renderer", message, data: obj }).catch(() => {});
  }
};

function AdvancedSearch({ currentPath, onNavigate, onClose, clickBehavior = "double", itemSize = 3 }) {
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchScope, setSearchScope] = useState(() => {
    return isPhysical(currentPath) ? "Current Folder" : "Selected Folder";
  });
  const [selectedFolderPath, setSelectedFolderPath] = useState(null);
  const [prevPath, setPrevPath] = useState(currentPath);
  const inputRef = useRef(null);
  const [selectedResultPath, setSelectedResultPath] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progressData, setProgressData] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [finalStats, setFinalStats] = useState(null);
  const startTimeRef = useRef(null);

  if (currentPath !== prevPath) {
    setPrevPath(currentPath);
    setSearchScope(isPhysical(currentPath) ? "Current Folder" : "Selected Folder");
  }

  const [filters, setFilters] = useState({
    name: "",
    type: "All",
    extension: "",
    sizeOperator: ">",
    sizeValue: "",
    sizeUnit: "MB",
    dateType: "Modified",
    dateValue: "",
    includeHidden: false,
    includeSystem: false,
    regex: false,
    content: false,
    metadata: false,
    exactPhrase: false,
  });

  const [sortBy, setSortBy] = useState("Relevance");
  const [groupBy, setGroupBy] = useState("None");

  // History & Saved Searches
  const [history, setHistory] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showSaveNameInput, setShowSaveNameInput] = useState(false);

  const fileTypes = [
    "All",
    "Image",
    "Video",
    "Audio",
    "Document",
    "Archive",
    "Folder",
  ];

  const scopes = [
    "Current Folder",
    "Selected Folder",
    "Subfolders",
    "Entire Drive",
    "Multiple Drives",
  ];

  const isLocationSetupRequired = () => {
    if (selectedFolderPath) {
      return false;
    }
    if (searchScope === "Selected Folder") {
      return !selectedFolderPath;
    }
    if (searchScope === "Current Folder" || searchScope === "Subfolders") {
      return !isPhysical(currentPath);
    }
    return false;
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const loadHistory = () => {
    window.electronFeatures.getSearchHistory().then(setHistory).catch(() => {});
  };

  const loadSavedSearches = () => {
    window.electronFeatures.getSavedSearches().then(setSavedSearches).catch(() => {});
  };

  useEffect(() => {
    loadHistory();
    loadSavedSearches();
  }, []);

  const handleChooseFolder = async () => {
    const defaultPath = isPhysical(currentPath) ? currentPath : (selectedFolderPath || null);
    const res = await window.fileExplorer.chooseFolder(defaultPath);
    if (res && res.success && res.path) {
      trace("[AdvancedSearch] Selected folder changed:", res.path);
      setSelectedFolderPath(res.path);
      setSearchScope("Selected Folder");
    }
  };

  const handleScopeChange = async (scope) => {
    trace("[AdvancedSearch] Scope changed:", scope);
    setSearchScope(scope);
    if (scope === "Selected Folder" && !selectedFolderPath) {
      const defaultPath = isPhysical(currentPath) ? currentPath : null;
      const res = await window.fileExplorer.chooseFolder(defaultPath);
      if (res && res.success && res.path) {
        trace("[AdvancedSearch] Selected folder changed via scope change:", res.path);
        setSelectedFolderPath(res.path);
      }
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim() && !filters.name && !filters.extension && !filters.sizeValue && !filters.dateValue) {
      alert("Please enter a query or configure at least one filter.");
      return;
    }
    setLoading(true);
    setError("");
    setIsCancelled(false);
    setIsComplete(false);
    setProgressData(null);
    setFinalStats(null);
    setSelectedResultPath(null);
    startTimeRef.current = Date.now();

    let foldersCount = 0;
    let filesCount = 0;

    const unsubscribeProgress = window.electronFeatures.onSearchProgress((data) => {
      setProgressData(data);
      foldersCount = data.scannedFolders || 0;
      filesCount = data.scannedFiles || 0;
    });

    try {
      let scopePath = null;
      if (searchScope === "Selected Folder") {
        if (!selectedFolderPath) {
          setError("Please choose a folder to search.");
          setLoading(false);
          unsubscribeProgress();
          return;
        }
        scopePath = selectedFolderPath;
      } else if (searchScope === "Current Folder" || searchScope === "Subfolders") {
        if (isPhysical(currentPath)) {
          scopePath = currentPath;
        } else if (selectedFolderPath) {
          scopePath = selectedFolderPath;
        } else {
          setError("Cannot search from a virtual/tool view. Please select a physical folder to search.");
          setLoading(false);
          unsubscribeProgress();
          return;
        }
      } else if (searchScope === "Entire Drive") {
        if (isPhysical(currentPath)) {
          scopePath = currentPath;
        } else if (selectedFolderPath) {
          scopePath = selectedFolderPath;
        } else {
          setError("Please select a physical folder to determine the drive root.");
          setLoading(false);
          unsubscribeProgress();
          return;
        }
      } else if (searchScope === "Multiple Drives") {
        scopePath = isPhysical(currentPath) ? currentPath : (selectedFolderPath || "C:\\");
      }

      const filterType =
        filters.type === "All" ? "all" : filters.type.toLowerCase();
      
      const options = {
        name: filters.name,
        extension: filters.extension,
        sizeOperator: filters.sizeOperator,
        sizeValue: filters.sizeValue,
        sizeUnit: filters.sizeUnit,
        dateType: filters.dateType,
        dateValue: filters.dateValue,
        includeHidden: filters.includeHidden,
        includeSystem: filters.includeSystem,
        regex: filters.regex,
        content: filters.content,
        metadata: filters.metadata,
        exactPhrase: filters.exactPhrase,
        sortBy,
        groupBy,
        searchScope
      };

      trace("[AdvancedSearch] SEARCH REQUEST", {
        currentPath,
        searchScope,
        selectedFolderPath,
        scopePath,
        searchText,
        filterType,
        includeHidden: filters.includeHidden,
        options
      });

      const res = await window.fileExplorer.searchDirectory(
        scopePath,
        searchText,
        filterType,
        filters.includeHidden,
        options
      );

      unsubscribeProgress();

      trace("[AdvancedSearch] SEARCH RESPONSE", {
        isArray: Array.isArray(res),
        length: Array.isArray(res) ? res.length : null,
        result: res
      });

      if (res && res.error) {
        setError(res.error);
        setResults([]);
      } else {
        setResults(res || []);
        setIsComplete(true);
        setFinalStats({
          scannedFolders: foldersCount,
          scannedFiles: filesCount,
          resultsCount: res ? res.length : 0,
          elapsedSeconds: Math.round((Date.now() - startTimeRef.current) / 1000)
        });
        
        // Add to history list
        await window.electronFeatures.addToSearchHistory({
          query: searchText,
          filters,
          scope: searchScope,
          resultCount: res ? res.length : 0
        });
        loadHistory();
      }
    } catch (err) {
      unsubscribeProgress();
      setError(err.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCurrentSearch = async () => {
    if (!saveName.trim()) return;
    try {
      await window.electronFeatures.saveSearch({
        name: saveName.trim(),
        query: searchText,
        filters,
        scope: searchScope
      });
      setSaveName("");
      setShowSaveNameInput(false);
      loadSavedSearches();
      alert("Search query saved successfully!");
    } catch (e) {
      alert(`Save failed: ${e.message}`);
    }
  };

  const handleDeleteSaved = async (name) => {
    try {
      await window.electronFeatures.deleteSavedSearch(name);
      loadSavedSearches();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleClearHistory = async () => {
    try {
      await window.electronFeatures.clearSearchHistory();
      loadHistory();
    } catch (e) {
      alert(`Clear failed: ${e.message}`);
    }
  };

  const setDateShortcut = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split("T")[0];
    updateFilter("dateValue", dateStr);
  };

  const handleCancel = async () => {
    try {
      await window.electronFeatures.cancelSearch();
      setIsCancelled(true);
      setLoading(false);
      const elapsed = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
      setFinalStats({
        scannedFolders: progressData?.scannedFolders || 0,
        scannedFiles: progressData?.scannedFiles || 0,
        resultsCount: results.length,
        elapsedSeconds: elapsed
      });
    } catch (e) {
      setError(`Cancel failed: ${e.message}`);
    }
  };

  const clearSearch = () => {
    setSearchText("");
    setResults([]);
    setError("");
    setProgressData(null);
    setIsCancelled(false);
    setIsComplete(false);
    setFinalStats(null);
    setSelectedResultPath(null);

    setFilters({
      name: "",
      type: "All",
      extension: "",
      sizeOperator: ">",
      sizeValue: "",
      sizeUnit: "MB",
      dateType: "Modified",
      dateValue: "",
      includeHidden: false,
      includeSystem: false,
      regex: false,
      content: false,
      metadata: false,
      exactPhrase: false,
    });

    setActiveFilter("All");
  };

  const getGroupedResults = () => {
    if (groupBy === "None" || !results.length) return { "All Results": results };
    const groups = {};
    for (const item of results) {
      let g = "Other";
      if (groupBy === "Type") {
        g = item.isDirectory ? "Folders" : (item.extension || "Unknown File");
      } else if (groupBy === "Date") {
        if (item.modified) {
          const date = new Date(item.modified);
          g = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        }
      } else if (groupBy === "Location") {
        g = item.path.substring(0, item.path.lastIndexOf("\\")) || item.path;
      }
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  };

  return (
    <div className="advanced-search">
      {/* Header */}
      <div className="advanced-search-header">
        <div>
          <div className="advanced-search-title">
            <span className="search-title-icon">⌕</span>
            Advanced Search
          </div>

          <div className="advanced-search-subtitle">
            Search files and folders using powerful filters
          </div>
        </div>

        <button className="close-search-btn" title="Close" onClick={onClose}>
          ×
        </button>
      </div>

      {/* Search Bar */}
      <div className="advanced-search-main">
        <div 
          className="search-input-wrapper" 
          onClick={(e) => {
            if (e.target.tagName !== "BUTTON") {
              inputRef.current?.focus();
            }
          }}
          style={{ cursor: "text" }}
        >
          <span className="search-input-icon">⌕</span>

          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            placeholder="Search files...  e.g. name:photo type:image size:>100MB"
          />

          {searchText && (
            <button
              className="clear-input-btn"
              onClick={() => setSearchText("")}
              title="Clear"
            >
              ×
            </button>
          )}

          <button className="search-button" onClick={handleSearch}>
            Search
          </button>
        </div>

        {/* Query Examples */}
        <div className="query-examples">
          <span>Examples:</span>

          <button onClick={() => setSearchText("name:photo")}>
            name:photo
          </button>

          <button onClick={() => setSearchText("type:image")}>
            type:image
          </button>

          <button onClick={() => setSearchText("size:>100MB")}>
            size:&gt;100MB
          </button>

          <button onClick={() => setSearchText("type:image AND size:>50MB")}>
            type:image AND size:&gt;50MB
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="advanced-search-body">
        {/* Left Filter Panel */}
        <aside className="search-filter-panel">
          <div className="filter-panel-header">
            <div className="filter-panel-title">Filters</div>

            <button className="clear-filters-btn" onClick={clearSearch}>
              Clear all
            </button>
          </div>

          {/* Quick Filter */}
          <div className="filter-section">
            <div className="filter-section-title">Quick Filters</div>

            <div className="quick-filter-list">
              {fileTypes.map((type) => (
                <button
                  key={type}
                  className={
                    activeFilter === type
                      ? "quick-filter active"
                      : "quick-filter"
                  }
                  onClick={() => {
                    setActiveFilter(type);
                    updateFilter("type", type);
                  }}
                >
                  <span className="filter-icon">
                    {type === "All" && "◉"}
                    {type === "Image" && "▧"}
                    {type === "Video" && "▶"}
                    {type === "Audio" && "♫"}
                    {type === "Document" && "▤"}
                    {type === "Archive" && "▱"}
                    {type === "Folder" && "▰"}
                  </span>

                  <span>{type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name Filter */}
          <div className="filter-section">
            <div className="filter-section-title">Name</div>

            <input
              className="filter-input"
              type="text"
              value={filters.name}
              onChange={(e) => updateFilter("name", e.target.value)}
              placeholder="photo, invoice..."
            />
          </div>

          {/* Extension */}
          <div className="filter-section">
            <div className="filter-section-title">Extension</div>

            <input
              className="filter-input"
              type="text"
              value={filters.extension}
              onChange={(e) => updateFilter("extension", e.target.value)}
              placeholder="jpg, png, pdf..."
            />

            <div className="filter-hint">
              Multiple extensions: jpg, png, webp
            </div>
          </div>

          {/* Size */}
          <div className="filter-section">
            <div className="filter-section-title">File Size</div>

            <div className="size-filter-row">
              <select
                value={filters.sizeOperator}
                onChange={(e) => updateFilter("sizeOperator", e.target.value)}
              >
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="=">=</option>
              </select>

              <input
                className="filter-input"
                type="number"
                value={filters.sizeValue}
                onChange={(e) => updateFilter("sizeValue", e.target.value)}
                placeholder="100"
              />

              <select
                value={filters.sizeUnit}
                onChange={(e) => updateFilter("sizeUnit", e.target.value)}
              >
                <option value="KB">KB</option>
                <option value="MB">MB</option>
                <option value="GB">GB</option>
              </select>
            </div>
          </div>

          {/* Date */}
          <div className="filter-section">
            <div className="filter-section-title">Date (From Date Onward)</div>

            <select
              className="filter-select"
              value={filters.dateType}
              onChange={(e) => updateFilter("dateType", e.target.value)}
            >
              <option value="Modified">Modified</option>

              <option value="Created">Created</option>

              <option value="Accessed">Accessed</option>
            </select>

            <input
              className="filter-input date-input"
              type="date"
              value={filters.dateValue}
              onChange={(e) => updateFilter("dateValue", e.target.value)}
            />

            <div className="date-shortcuts">
              <button onClick={() => setDateShortcut(0)}>Today</button>
              <button onClick={() => setDateShortcut(1)}>Yesterday</button>
              <button onClick={() => setDateShortcut(7)}>7 days</button>
              <button onClick={() => setDateShortcut(30)}>30 days</button>
            </div>
          </div>

          {/* Location */}
          <div className="filter-section">
            <div className="filter-section-title">Search Location</div>

            <select
              className="filter-select"
              value={searchScope}
              onChange={(e) => handleScopeChange(e.target.value)}
            >
              {scopes.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>

            {(searchScope === "Selected Folder" || (!isPhysical(currentPath) && (searchScope === "Current Folder" || searchScope === "Subfolders"))) && (
              <div className="selected-folder-info" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "12px" }}>
                <span style={{ color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  Folder: <strong style={{ color: "var(--color-text)" }}>{selectedFolderPath || "None Selected"}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleChooseFolder}
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    background: "var(--color-bg-light)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "4px",
                    color: "var(--color-text)",
                    cursor: "pointer"
                  }}
                >
                  Choose...
                </button>
              </div>
            )}

            <label className="checkbox-row">
              <input 
                type="checkbox" 
                checked={filters.includeHidden}
                onChange={(e) => updateFilter("includeHidden", e.target.checked)}
              />
              <span>Include hidden folders</span>
            </label>

            <label className="checkbox-row">
              <input 
                type="checkbox" 
                checked={filters.includeSystem}
                onChange={(e) => updateFilter("includeSystem", e.target.checked)}
              />
              <span>Include system folders</span>
            </label>
          </div>

          {/* Advanced Toggle */}
          <button
            className="advanced-toggle"
            onClick={() => setShowFilters(!showFilters)}
          >
            <span>{showFilters ? "⌃" : "⌄"}</span>
            Advanced Filters
          </button>

          {showFilters && (
            <div className="advanced-filter-options">
              <label className="checkbox-row">
                <input 
                  type="checkbox" 
                  checked={filters.regex}
                  onChange={(e) => updateFilter("regex", e.target.checked)}
                />
                <span>Regex search</span>
              </label>

              <label className="checkbox-row">
                <input 
                  type="checkbox" 
                  checked={filters.content}
                  onChange={(e) => updateFilter("content", e.target.checked)}
                />
                <span>Search file content</span>
              </label>

              <label className="checkbox-row">
                <input 
                  type="checkbox" 
                  checked={filters.metadata}
                  onChange={(e) => updateFilter("metadata", e.target.checked)}
                />
                <span>Search metadata</span>
              </label>

              <label className="checkbox-row">
                <input 
                  type="checkbox" 
                  checked={filters.exactPhrase}
                  onChange={(e) => updateFilter("exactPhrase", e.target.checked)}
                />
                <span>Exact phrase</span>
              </label>
            </div>
          )}
        </aside>

        {/* Right Results Area */}
        <section className="search-results-panel" style={{ position: "relative" }}>
          {/* Results Header */}
          <div className="results-header">
            <div className="results-info">
              <div className="results-title">Search Results</div>

              <div className="results-count" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span>{results.length} results</span>
                {results.length > 0 && !showSaveNameInput && (
                  <button 
                    onClick={() => setShowSaveNameInput(true)} 
                    style={{ fontSize: "11px", padding: "2px 6px", cursor: "pointer", borderRadius: "3px", border: "1px solid #ccc", backgroundColor: "#f9f9f9" }}
                  >
                    ☆ Save Query
                  </button>
                )}
              </div>
              {showSaveNameInput && (
                <div style={{ marginTop: "5px", display: "flex", gap: "5px", alignItems: "center" }}>
                  <input 
                    type="text" 
                    placeholder="Enter name..." 
                    value={saveName} 
                    onChange={(e) => setSaveName(e.target.value)}
                    style={{ padding: "3px 6px", fontSize: "12px" }}
                  />
                  <button onClick={handleSaveCurrentSearch} style={{ padding: "3px 6px", fontSize: "12px", cursor: "pointer" }}>Save</button>
                  <button onClick={() => setShowSaveNameInput(false)} style={{ padding: "3px 6px", fontSize: "12px", cursor: "pointer" }}>Cancel</button>
                </div>
              )}
            </div>

            <div className="results-actions">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="Relevance">Sort: Relevance</option>

                <option value="Name">Sort: Name</option>

                <option value="Size">Sort: Size</option>

                <option value="Date">Sort: Date</option>

                <option value="Type">Sort: Type</option>
              </select>

              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="None">Group: None</option>

                <option value="Type">Group: Type</option>

                <option value="Date">Group: Date</option>

                <option value="Location">Group: Location</option>
              </select>
            </div>
          </div>

          <SearchProgress
            isSearching={loading}
            progressData={progressData}
            isComplete={isComplete}
            isCancelled={isCancelled}
            onCancel={handleCancel}
            finalStats={finalStats}
          />

          {error && (
            <div
              className="search-error-state"
              style={{ padding: "20px", color: "#ff4343", textAlign: "center" }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Location Setup required view */}
          {isLocationSetupRequired() && (
            <div className="location-setup-state" style={{ padding: "80px 20px", textAlign: "center", color: "#888" }}>
              <div style={{ fontSize: "28px", marginBottom: "15px" }}>📁</div>
              <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px", color: "var(--color-text)" }}>
                No Search Directory Selected
              </div>
              <div style={{ fontSize: "13px", marginBottom: "20px", maxWidth: "400px", margin: "0 auto 20px", lineHeight: "1.5" }}>
                Current location is not a physical folder. Please select a physical folder from your drive to begin searching.
              </div>
              <button
                type="button"
                onClick={handleChooseFolder}
                style={{
                  padding: "8px 20px",
                  background: "var(--color-accent, #0078d4)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "background 0.2s"
                }}
              >
                Choose Folder...
              </button>
            </div>
          )}

          {/* Grouped results view */}
          {!isLocationSetupRequired() && !loading && !error && results.length > 0 && (
            <div
              className="search-results-list"
              style={{ flex: 1, overflowY: "auto", padding: "10px" }}
            >
              {Object.entries(getGroupedResults()).map(([groupName, groupItems]) => (
                <div key={groupName} className="search-results-group" style={{ marginBottom: "15px" }}>
                  {groupBy !== "None" && (
                    <div style={{ fontWeight: "bold", padding: "5px 10px", backgroundColor: "#f0f0f0", borderRadius: "3px", color: "#333", fontSize: "13px", display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span>{groupName}</span>
                      <span>({groupItems.length} items)</span>
                    </div>
                  )}
                  {groupItems.map((item) => (
                    <div
                      key={item.path}
                      className="search-result-row"
                      onClick={() => {
                        if (clickBehavior === "single") {
                          onNavigate(
                            item.isDirectory
                              ? item.path
                              : item.path.substring(0, item.path.lastIndexOf("\\")),
                          );
                        } else {
                          setSelectedResultPath(item.path);
                        }
                      }}
                      onDoubleClick={() => {
                        if (clickBehavior === "double") {
                          onNavigate(
                            item.isDirectory
                              ? item.path
                              : item.path.substring(0, item.path.lastIndexOf("\\")),
                          );
                        }
                      }}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: `calc((${LIST_SIZES[itemSize].rowHeight} - 16px) / 2) 10px`,
                        minHeight: LIST_SIZES[itemSize].rowHeight,
                        borderBottom: "1px solid #eee",
                        cursor: "pointer",
                        borderRadius: "5px",
                        transition: "background 0.2s",
                        backgroundColor: selectedResultPath === item.path ? "rgba(0, 120, 212, 0.15)" : "transparent",
                        border: selectedResultPath === item.path ? "1px solid #0078d4" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (selectedResultPath !== item.path) {
                          e.currentTarget.style.backgroundColor = "#f5f5f5";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedResultPath !== item.path) {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span style={{ fontSize: LIST_SIZES[itemSize].iconSize, marginRight: "8px", lineHeight: "1" }}>
                            {item.isDirectory ? "📁" : "📄"}
                          </span>
                          <span style={{ fontWeight: "500", color: "#333", fontSize: LIST_SIZES[itemSize].fontSize }}>
                            {item.name}
                          </span>
                        </div>
                        <span style={{ fontSize: `calc(${LIST_SIZES[itemSize].fontSize} - 1px)`, color: "#888", marginTop: "2px" }}>
                          {item.path}
                        </span>
                        {item.contentLine && (
                          <span style={{ fontSize: `calc(${LIST_SIZES[itemSize].fontSize} - 1px)`, color: "#555", fontStyle: "italic", marginTop: "3px" }}>
                            🔍 Match: {item.contentLine} ({item.contentCount} matches)
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center" }}>
                        <span style={{ fontSize: `calc(${LIST_SIZES[itemSize].fontSize} - 1px)`, color: "#666" }}>
                          {item.isDirectory ? "Folder" : "File"}
                        </span>
                        {item.size !== null && (
                          <span style={{ fontSize: `calc(${LIST_SIZES[itemSize].fontSize} - 2px)`, color: "#888", marginTop: "2px" }}>
                            {(item.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {!isLocationSetupRequired() && !loading && !error && results.length === 0 && (
            <div className="search-empty-state">
              <div
                className="empty-search-title"
                style={{ padding: "20px 0 10px 0" }}
              >
                {searchText ? "No results found" : "Start searching"}
              </div>
              <div
                className="empty-search-description"
                style={{ color: "#666", marginBottom: "20px" }}
              >
                {searchText
                  ? "Try adjusting your query or filters."
                  : "Enter a search query or select filters to find files and folders."}
              </div>
              <div className="empty-search-examples">
                <div
                  className="empty-example-title"
                  style={{ display: searchText ? "none" : "block" }}
                >
                  Try something like:
                </div>

                <button
                  onClick={() => setSearchText("type:image AND size:>50MB")}
                >
                  type:image AND size:&gt;50MB
                </button>

                <button
                  onClick={() => setSearchText("extension:jpg date:2026")}
                >
                  extension:jpg date:2026
                </button>

                <button onClick={() => setSearchText("name:invoice")}>
                  name:invoice
                </button>
              </div>
            </div>
          )}

          {/* History Overlay */}
          {showHistoryModal && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#fff", zIndex: 10, display: "flex", flexDirection: "column", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px", marginBottom: "15px" }}>
                <h3 style={{ margin: 0 }}>Search History</h3>
                <div>
                  <button onClick={handleClearHistory} style={{ marginRight: "10px", padding: "5px 10px", cursor: "pointer" }}>Clear All</button>
                  <button onClick={() => setShowHistoryModal(false)} style={{ padding: "5px 10px", cursor: "pointer" }}>Close</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {history.length === 0 ? (
                  <p style={{ color: "#666", textAlign: "center" }}>No history found.</p>
                ) : (
                  history.map((h, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderBottom: "1px solid #eee" }}>
                      <div>
                        <div style={{ fontWeight: "bold" }}>"{h.query || "(Filters Only)"}"</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          Scope: {h.scope} | Result Count: {h.resultCount} | {new Date(h.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setSearchText(h.query || "");
                          setFilters(h.filters);
                          setSearchScope(h.scope);
                          setShowHistoryModal(false);
                        }}
                        style={{ padding: "3px 8px", cursor: "pointer" }}
                      >
                        Load
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Saved Searches Overlay */}
          {showSavedModal && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#fff", zIndex: 10, display: "flex", flexDirection: "column", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "10px", marginBottom: "15px" }}>
                <h3 style={{ margin: 0 }}>Saved Searches</h3>
                <button onClick={() => setShowSavedModal(false)} style={{ padding: "5px 10px", cursor: "pointer" }}>Close</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {savedSearches.length === 0 ? (
                  <p style={{ color: "#666", textAlign: "center" }}>No saved searches.</p>
                ) : (
                  savedSearches.map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderBottom: "1px solid #eee" }}>
                      <div>
                        <div style={{ fontWeight: "bold" }}>{s.name}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          Query: "{s.query}" | Scope: {s.scope} | {new Date(s.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <button 
                          onClick={() => {
                            setSearchText(s.query || "");
                            setFilters(s.filters);
                            setSearchScope(s.scope);
                            setShowSavedModal(false);
                          }}
                          style={{ padding: "3px 8px", marginRight: "5px", cursor: "pointer" }}
                        >
                          Load
                        </button>
                        <button 
                          onClick={() => handleDeleteSaved(s.name)}
                          style={{ padding: "3px 8px", cursor: "pointer", color: "red" }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="advanced-search-footer">
        <div className="search-footer-left">
          <button className="history-btn" onClick={() => setShowHistoryModal(true)}>◷ Search History</button>

          <button className="saved-search-btn" onClick={() => setShowSavedModal(true)}>☆ Saved Searches</button>
        </div>

        <div className="search-footer-right">
          <span>Search scope:</span>

          <strong>{searchScope}</strong>
        </div>
      </div>
    </div>
  );
}

export default AdvancedSearch;
