import { useState } from "react";
import { SAMPLE_QUERIES } from "./mockData";

export default function SearchResultsArea({
  searchState,
  query,
  results,
  tookMs = 0,
  loadingStep,
  onSelectSampleQuery,
  onClearQuery,
  onRetry,
  onOpenSettings,
}) {
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState("relevance");
  const [previewItem, setPreviewItem] = useState(null);
  const [actionNotice, setActionNotice] = useState("");

  const showToast = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(""), 3000);
  };

  const handleOpenFile = async (item) => {
    const target = item.fullPath || item.path;
    try {
      if (window.fileExplorer?.openItem) {
        await window.fileExplorer.openItem(target);
      } else if (window.electronFeatures?.openItem) {
        await window.electronFeatures.openItem(target);
      }
      showToast(`Opening ${item.name}`);
    } catch (err) {
      showToast(`Error opening file: ${err.message}`);
    }
  };

  const handleOpenFolder = async (item) => {
    const targetFolder = item.path || (item.fullPath ? item.fullPath.substring(0, item.fullPath.lastIndexOf("\\")) : "");
    try {
      if (window.electronFeatures?.openItem) {
        await window.electronFeatures.openItem(targetFolder);
      } else if (window.fileExplorer?.openItem) {
        await window.fileExplorer.openItem(targetFolder);
      }
      showToast(`Revealed folder: ${targetFolder}`);
    } catch (err) {
      showToast(`Error opening folder: ${err.message}`);
    }
  };

  const getFileIcon = (item) => {
    if (item.type === "images") return "🖼️";
    if (item.type === "videos") return "🎬";
    if (item.type === "audio") return "🎵";
    if (item.ext === "PDF") return "📕";
    if (item.ext === "DOCX" || item.ext === "DOC") return "📘";
    if (item.ext === "XLSX" || item.ext === "XLS") return "📊";
    if (item.ext === "ZIP" || item.ext === "RAR") return "🗜️";
    return "📄";
  };

  // Sort results
  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
    if (sortBy === "date") return new Date(b.date) - new Date(a.date);
    if (sortBy === "size") return (b.sizeBytes || 0) - (a.sizeBytes || 0);
    return (b.scoreValue || 0) - (a.scoreValue || 0); // relevance (default)
  });

  return (
    <div className="ai-results-wrapper">
      {actionNotice && <div className="ai-toast-notification">{actionNotice}</div>}

      {/* =========================================================
          1. EMPTY STATE (DEFAULT)
          ========================================================= */}
      {searchState === "empty" && (
        <div className="ai-empty-state">
          <div className="ai-empty-icon-wrapper">
            <div className="ai-empty-icon-glow"></div>
            <span className="ai-empty-icon">🔎</span>
          </div>
          <h2 className="ai-empty-title">Search your files using natural language</h2>
          <p className="ai-empty-subtitle">
            Ask in plain English or any natural phrasing to instantly discover documents, photos, videos, and code across your system.
          </p>

          <div className="ai-sample-queries-box">
            <span className="ai-sample-heading">Try asking:</span>
            <div className="ai-sample-queries-grid">
              {SAMPLE_QUERIES.map((sample, idx) => (
                <button
                  key={idx}
                  className="ai-sample-query-chip"
                  onClick={() => onSelectSampleQuery(sample.text)}
                >
                  <span className="ai-sample-quote">“</span>
                  {sample.text}
                  <span className="ai-sample-quote">”</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          2. SEARCHING / LOADING STATE
          ========================================================= */}
      {searchState === "loading" && (
        <div className="ai-loading-state">
          <div className="ai-loading-icon-spinner">
            <div className="ai-spinner-ring"></div>
            <span className="ai-spinner-icon">🔎</span>
          </div>
          <h2 className="ai-loading-title">Searching your files...</h2>
          <p className="ai-loading-subtitle">
            Nexora is analyzing your query and finding the best matches.
          </p>

          <div className="ai-loading-steps-card">
            <div className={`ai-loading-step ${loadingStep >= 1 ? "completed" : "active"}`}>
              <span className="ai-step-indicator">{loadingStep > 1 ? "✓" : "●"}</span>
              <span className="ai-step-text">Checking file names</span>
            </div>

            <div className={`ai-loading-step ${loadingStep >= 2 ? (loadingStep > 2 ? "completed" : "active") : "pending"}`}>
              <span className="ai-step-indicator">{loadingStep > 2 ? "✓" : "●"}</span>
              <span className="ai-step-text">Scanning indexed content</span>
            </div>

            <div className={`ai-loading-step ${loadingStep >= 3 ? (loadingStep > 3 ? "completed" : "active") : "pending"}`}>
              <span className="ai-step-indicator">{loadingStep > 3 ? "✓" : "●"}</span>
              <span className="ai-step-text">Analyzing neural embeddings & OCR</span>
            </div>

            <div className={`ai-loading-step ${loadingStep >= 4 ? "completed" : (loadingStep === 3 ? "active" : "pending")}`}>
              <span className="ai-step-indicator">{loadingStep >= 4 ? "✓" : "●"}</span>
              <span className="ai-step-text">Executing hybrid search ranking</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          3. SEARCH RESULTS STATE
          ========================================================= */}
      {searchState === "results" && (
        <div className="ai-results-container">
          {/* Results Toolbar */}
          <div className="ai-results-toolbar">
            <div className="ai-results-info">
              <span className="ai-results-query-label">Search results for:</span>
              <span className="ai-results-query-text">"{query}"</span>
              <span className="ai-results-count-badge">{results.length} results</span>
              {tookMs > 0 && <span className="ai-took-ms" style={{ color: "#94a3b8", fontSize: "12px", marginLeft: "8px" }}>({tookMs}ms)</span>}
            </div>

            <div className="ai-results-controls">
              <div className="ai-sort-dropdown">
                <span>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="ai-select-compact"
                >
                  <option value="relevance">Relevance</option>
                  <option value="name">Name</option>
                  <option value="date">Date Modified</option>
                  <option value="size">Size</option>
                </select>
              </div>

              <div className="ai-view-toggle">
                <button
                  className={`ai-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                >
                  ▦
                </button>
                <button
                  className={`ai-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="List View"
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          {/* Results List / Grid */}
          <div className={`ai-results-grid ${viewMode === "list" ? "list-mode" : ""}`}>
            {sortedResults.map((item) => (
              <div key={item.id} className="ai-result-card">
                <div className="ai-card-top">
                  <div className="ai-file-thumb">
                    <span className="ai-thumb-icon">{getFileIcon(item)}</span>
                    <span className="ai-thumb-ext">{item.ext}</span>
                  </div>

                  <div className="ai-file-meta-header">
                    <div className="ai-file-name" title={item.name}>
                      {item.name}
                    </div>
                    <div className="ai-file-path" title={item.path}>
                      {item.path}
                    </div>
                    <div className="ai-file-stats">
                      <span className="ai-stat-badge">{item.ext}</span>
                      <span className="ai-stat-dot">•</span>
                      <span>{item.size}</span>
                      <span className="ai-stat-dot">•</span>
                      <span>{item.date}</span>
                      {item.score && (
                        <>
                          <span className="ai-stat-dot">•</span>
                          <span className="ai-score-badge">{item.score}</span>
                        </>
                      )}
                      {(item.evidence?.timestamp || item.timestamp) && (
                        <>
                          <span className="ai-stat-dot">•</span>
                          <span className="ai-timestamp-badge" style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", padding: "2px 6px", borderRadius: "4px", fontSize: "11px" }}>
                            ⏱ {item.evidence?.timestamp || item.timestamp}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Tag badges */}
                <div className="ai-tags-section">
                  <span className="ai-tags-label">AI:</span>
                  <div className="ai-tags-list">
                    {(item.tags || []).map((tag, tIdx) => (
                      <span key={tIdx} className="ai-tag-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* AI Summary / Context snippet */}
                {item.summary && (
                  <p className="ai-result-summary" title={item.summary}>
                    {item.summary}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="ai-result-actions">
                  <button
                    className="ai-action-btn primary"
                    onClick={() => handleOpenFile(item)}
                  >
                    Open
                  </button>
                  <button
                    className="ai-action-btn secondary"
                    onClick={() => handleOpenFolder(item)}
                  >
                    Open folder
                  </button>
                  <button
                    className="ai-action-btn secondary"
                    onClick={() => setPreviewItem(item)}
                  >
                    Preview
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================
          4. NO RESULTS STATE
          ========================================================= */}
      {searchState === "no-results" && (
        <div className="ai-no-results-state">
          <div className="ai-empty-icon-wrapper">
            <span className="ai-empty-icon">🔎</span>
          </div>
          <h2 className="ai-no-results-title">No matching files found</h2>
          <p className="ai-no-results-subtitle">
            We couldn't find any items matching "{query}".
          </p>

          <div className="ai-tips-card">
            <strong>Try:</strong>
            <ul>
              <li>Using fewer or more general keywords</li>
              <li>Checking for spelling mistakes or typos</li>
              <li>Switching file type filter to <em>"All"</em></li>
              <li>Expanding disk location to <em>"All Drives"</em></li>
            </ul>
          </div>

          <div style={{ marginTop: "24px" }}>
            <button className="ai-btn-primary" onClick={onClearQuery}>
              ✕ Clear Query
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          5. ERROR STATE
          ========================================================= */}
      {searchState === "error" && (
        <div className="ai-error-state">
          <div className="ai-error-icon-wrapper">
            <span className="ai-error-icon">⚠️</span>
          </div>
          <h2 className="ai-error-title">Something went wrong</h2>
          <p className="ai-error-subtitle">
            AI Search is currently unavailable. Please check your AI Search setup or configuration.
          </p>

          <div className="ai-btn-group" style={{ marginTop: "20px" }}>
            <button className="ai-btn-primary" onClick={onRetry}>
              ⟳ Retry
            </button>
            <button className="ai-btn-secondary" onClick={onOpenSettings}>
              ⚙ Open Settings
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: QUICK PREVIEW DIALOG
          ========================================================= */}
      {previewItem && (
        <div className="ai-preview-modal-overlay" onClick={() => setPreviewItem(null)}>
          <div className="ai-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-preview-modal-header">
              <div className="ai-preview-title-group">
                <span style={{ fontSize: "20px" }}>{getFileIcon(previewItem)}</span>
                <div>
                  <h3 style={{ margin: 0, color: "#f8fafc" }}>{previewItem.name}</h3>
                  <small style={{ color: "#94a3b8" }}>{previewItem.fullPath}</small>
                </div>
              </div>
              <button
                className="ai-modal-close-btn"
                onClick={() => setPreviewItem(null)}
              >
                ✕
              </button>
            </div>

            <div className="ai-preview-modal-body">
              <div className="ai-preview-visual-box">
                <div className="ai-preview-placeholder-graphic">
                  <span style={{ fontSize: "48px" }}>{getFileIcon(previewItem)}</span>
                  <p>{previewItem.name}</p>
                  <span className="ai-badge-local">{previewItem.ext} Preview Ready</span>
                </div>
              </div>

              <div className="ai-preview-details">
                <div className="ai-preview-meta-row">
                  <strong>Location:</strong>
                  <span className="path-font">{previewItem.path}</span>
                </div>
                <div className="ai-preview-meta-row">
                  <strong>Size:</strong>
                  <span>{previewItem.size}</span>
                </div>
                <div className="ai-preview-meta-row">
                  <strong>Date:</strong>
                  <span>{previewItem.date}</span>
                </div>
                <div className="ai-preview-meta-row">
                  <strong>AI Match Score:</strong>
                  <span className="text-blue">{previewItem.score}</span>
                </div>
                {(previewItem.evidence?.timestamp || previewItem.timestamp) && (
                  <div className="ai-preview-meta-row">
                    <strong>Relevant Timestamp:</strong>
                    <span style={{ color: "#60a5fa", fontWeight: 600 }}>
                      ⏱ {previewItem.evidence?.timestamp || previewItem.timestamp}
                    </span>
                  </div>
                )}
                <div className="ai-preview-meta-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                  <strong>AI Semantic Tags:</strong>
                  <div className="ai-tags-list">
                    {(previewItem.tags || []).map((t, idx) => (
                      <span key={idx} className="ai-tag-chip">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                {previewItem.summary && (
                  <div className="ai-preview-meta-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                    <strong>Content Summary:</strong>
                    <p style={{ margin: 0, color: "#cbd5e1", fontSize: "12px", lineHeight: "1.5" }}>
                      {previewItem.summary}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="ai-preview-modal-footer">
              <button
                className="ai-btn-primary"
                onClick={() => {
                  handleOpenFile(previewItem);
                  setPreviewItem(null);
                }}
              >
                Open File
              </button>
              <button
                className="ai-btn-secondary"
                onClick={() => {
                  handleOpenFolder(previewItem);
                  setPreviewItem(null);
                }}
              >
                Open Containing Folder
              </button>
              <button
                className="ai-btn-secondary"
                onClick={() => setPreviewItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
