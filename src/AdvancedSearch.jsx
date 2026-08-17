import { useState } from "react";

import "./AdvancedSearch.css";

function AdvancedSearch({ currentPath, onNavigate, onClose }) {
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchScope, setSearchScope] = useState("Current Folder");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    name: "",
    type: "All",
    extension: "",
    sizeOperator: ">",
    sizeValue: "",
    sizeUnit: "MB",
    dateType: "Modified",
    dateValue: "",
  });

  const [sortBy, setSortBy] = useState("Relevance");
  const [groupBy, setGroupBy] = useState("None");

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

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setLoading(true);
    setError("");
    try {
      const scopePath =
        currentPath && !currentPath.startsWith("tool:") ? currentPath : "C:\\";
      const filterType =
        filters.type === "All" ? "all" : filters.type.toLowerCase();
      const res = await window.fileExplorer.searchDirectory(
        scopePath,
        searchText,
        filterType,
        true,
      );
      setResults(res || []);
    } catch (err) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchText("");
    setResults([]);
    setError("");

    setFilters({
      name: "",
      type: "All",
      extension: "",
      sizeOperator: ">",
      sizeValue: "",
      sizeUnit: "MB",
      dateType: "Modified",
      dateValue: "",
    });

    setActiveFilter("All");
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
        <div className="search-input-wrapper">
          <span className="search-input-icon">⌕</span>

          <input
            type="text"
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
            <div className="filter-section-title">Date</div>

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
              <button>Today</button>
              <button>Yesterday</button>
              <button>7 days</button>
              <button>30 days</button>
            </div>
          </div>

          {/* Location */}
          <div className="filter-section">
            <div className="filter-section-title">Search Location</div>

            <select
              className="filter-select"
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value)}
            >
              {scopes.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>

            <label className="checkbox-row">
              <input type="checkbox" />
              <span>Include hidden folders</span>
            </label>

            <label className="checkbox-row">
              <input type="checkbox" />
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
                <input type="checkbox" />
                <span>Regex search</span>
              </label>

              <label className="checkbox-row">
                <input type="checkbox" />
                <span>Search file content</span>
              </label>

              <label className="checkbox-row">
                <input type="checkbox" />
                <span>Search metadata</span>
              </label>

              <label className="checkbox-row">
                <input type="checkbox" />
                <span>Exact phrase</span>
              </label>
            </div>
          )}
        </aside>

        {/* Right Results Area */}
        <section className="search-results-panel">
          {/* Results Header */}
          <div className="results-header">
            <div className="results-info">
              <div className="results-title">Search Results</div>

              <div className="results-count">{results.length} results</div>
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

          {loading && (
            <div
              className="search-loading-state"
              style={{ padding: "40px", textAlign: "center", color: "#666" }}
            >
              <div
                className="spinner"
                style={{
                  margin: "0 auto 15px",
                  width: "30px",
                  height: "30px",
                  border: "3px solid #ccc",
                  borderTopColor: "#0078d4",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              ></div>
              <div>Searching the filesystem...</div>
            </div>
          )}

          {error && (
            <div
              className="search-error-state"
              style={{ padding: "20px", color: "#ff4343", textAlign: "center" }}
            >
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div
              className="search-results-list"
              style={{ flex: 1, overflowY: "auto", padding: "10px" }}
            >
              {results.map((item) => (
                <div
                  key={item.path}
                  className="search-result-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px",
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                    borderRadius: "5px",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f5f5f5")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  onDoubleClick={() =>
                    onNavigate(
                      item.isDirectory
                        ? item.path
                        : item.path.substring(0, item.path.lastIndexOf("\\")),
                    )
                  }
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: "500", color: "#333" }}>
                      {item.isDirectory ? "📁" : "📄"} {item.name}
                    </span>
                    <span style={{ fontSize: "12px", color: "#888" }}>
                      {item.path}
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    {item.isDirectory ? "Folder" : "File"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && results.length === 0 && (
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
        </section>
      </div>

      {/* Footer */}
      <div className="advanced-search-footer">
        <div className="search-footer-left">
          <button className="history-btn">◷ Search History</button>

          <button className="saved-search-btn">☆ Saved Searches</button>
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
