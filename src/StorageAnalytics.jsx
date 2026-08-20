/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import "./StorageAnalytics.css";

function StorageAnalytics({ currentPath, onClose }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [drivesList, setDrivesList] = useState([]);
  const [selectedDrive, setSelectedDrive] = useState("");
  const [scanPath, setScanPath] = useState("");
  
  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanFilesCount, setScanFilesCount] = useState(0);
  const [scanFoldersCount, setScanFoldersCount] = useState(0);
  const [scanBytesCount, setScanBytesCount] = useState(0);
  const [scanCurrentPath, setScanCurrentPath] = useState("");
  
  // Scanned Results
  const [scanResults, setScanResults] = useState(null);
  
  // Sub-filters
  const [cleanupType, setCleanupType] = useState("temp");
  const [chartType, setChartType] = useState("donut");
  const [topFilesLimit, setTopFilesLimit] = useState(10);
  const [topFilesSort, setTopFilesSort] = useState("largest");

  const tabs = [
    { id: "overview", label: "Overview", icon: "◉" },
    { id: "types", label: "File Types", icon: "▦" },
    { id: "files", label: "Largest Files", icon: "▤" },
    { id: "folders", label: "Largest Folders", icon: "▰" },
    { id: "cleanup", label: "Storage Cleanup", icon: "⌫" },
    { id: "visualization", label: "Visualization", icon: "◒" },
  ];

  // Helper: Format bytes
  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return "—";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Load drives inventory
  const loadDrives = async () => {
    const res = await window.electronFeatures.storageGetDrives();
    if (res.success && res.drives.length > 0) {
      setDrivesList(res.drives);
      
      // Auto select C: or first drive
      const defaultDrive = res.drives.find(d => d.driveLetter.startsWith("C")) || res.drives[0];
      setSelectedDrive(defaultDrive.driveLetter);
      setScanPath(defaultDrive.driveLetter + "\\");
      
      // Check cache for default drive
      loadCache(defaultDrive.driveLetter + "\\");
    }
  };

  const loadCache = async (targetPath) => {
    const res = await window.electronFeatures.storageGetCache(targetPath);
    if (res.success && res.data) {
      setScanResults(res.data);
    } else {
      setScanResults(null);
    }
  };

  useEffect(() => {
    loadDrives();

    // Subscribe to scan progress
    const unsubProgress = window.electronFeatures.onStorageProgress((data) => {
      setScanProgress(data.progress);
      setScanFilesCount(data.filesScanned);
      setScanFoldersCount(data.foldersScanned);
      setScanBytesCount(data.bytesAnalyzed);
      setScanCurrentPath(data.currentPath);
    });

    return () => {
      unsubProgress();
    };
  }, []);

  const handleDriveChange = (driveLetter) => {
    setSelectedDrive(driveLetter);
    const fullP = driveLetter + "\\";
    setScanPath(fullP);
    loadCache(fullP);
  };

  const handleChooseCustomFolder = async () => {
    const res = await window.electronFeatures.chooseFolder();
    if (res.success && !res.canceled && res.path) {
      setScanPath(res.path);
      loadCache(res.path);
    }
  };

  // Start Asynchronous Drive/Folder Scan
  const handleStartScan = async () => {
    if (!scanPath) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanFilesCount(0);
    setScanFoldersCount(0);
    setScanBytesCount(0);
    setScanCurrentPath("Initializing scanner queue...");

    const res = await window.electronFeatures.storageScanStart(scanPath);
    setIsScanning(false);
    if (res.success) {
      setScanResults(res);
    } else {
      alert(`Scan failed or aborted: ${res.error}`);
    }
  };

  // Cancel Scan
  const handleCancelScan = async () => {
    await window.electronFeatures.storageScanCancel();
    setIsScanning(false);
  };

  // Clear Storage Cache
  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to clear all cached storage scan results?")) return;
    const res = await window.electronFeatures.storageClearCache();
    if (res.success) {
      setScanResults(null);
      alert("Cache cleared.");
    }
  };

  // Deletion approved cleanup candidates
  const handleDeleteCandidate = async (itemPath) => {
    const fileName = itemPath.split(/[/\\]/).pop();
    if (!confirm(`⚠️ WARNING: Are you sure you want to PERMANENTLY delete:\n\n${fileName}\n\nLocation: ${itemPath}\n\nThis action cannot be undone.`)) return;

    const res = await window.electronFeatures.storageDeleteItem(itemPath);
    if (res.success) {
      alert("✓ Item deleted successfully.");
      // Rescan or remove file from state
      if (scanResults) {
        // Deep copy results and filter out the deleted item from categories
        const copy = JSON.parse(JSON.stringify(scanResults));
        
        // Remove from largest files
        copy.largestFiles = copy.largestFiles.filter(f => f.path !== itemPath);
        
        // Remove from cleanup categories
        if (copy.cleanupCandidates) {
          copy.cleanupCandidates.temp = copy.cleanupCandidates.temp.filter(f => f.path !== itemPath);
          copy.cleanupCandidates.cache = copy.cleanupCandidates.cache.filter(f => f.path !== itemPath);
          copy.cleanupCandidates.empty = copy.cleanupCandidates.empty.filter(f => f.path !== itemPath);
          copy.cleanupCandidates.large = copy.cleanupCandidates.large.filter(f => f.path !== itemPath);
          copy.cleanupCandidates.old = copy.cleanupCandidates.old.filter(f => f.path !== itemPath);
        }
        
        setScanResults(copy);
      }
    } else {
      alert(`❌ Deletion failed: ${res.error}`);
    }
  };

  // ----------------------------------------------------------
  // Process lists for display
  // ----------------------------------------------------------
  const getFileCategoriesList = () => {
    if (!scanResults || !scanResults.categoryStats) return [];
    
    const totalBytes = scanResults.bytesAnalyzed || 1;
    return Object.entries(scanResults.categoryStats).map(([name, stats]) => ({
      name,
      size: stats.size,
      count: stats.count,
      percentage: Math.round((stats.size / totalBytes) * 100)
    })).sort((a, b) => b.size - a.size);
  };

  const getSortedFiles = () => {
    if (!scanResults || !scanResults.largestFiles) return [];
    
    let list = [...scanResults.largestFiles];
    if (topFilesSort === "smallest") {
      list.sort((a, b) => a.size - b.size);
    } else {
      list.sort((a, b) => b.size - a.size);
    }
    return list.slice(0, topFilesLimit);
  };

  const getCleanupList = () => {
    if (!scanResults || !scanResults.cleanupCandidates) return [];
    return scanResults.cleanupCandidates[cleanupType] || [];
  };

  const currentDriveObj = drivesList.find(d => d.driveLetter === selectedDrive);

  return (
    <div className="storage-analytics">

      {/* =====================================================
          HEADER
          ===================================================== */}
      <div className="storage-header">
        <div className="storage-title-section">
          <div className="storage-main-icon">📊</div>
          <div>
            <h2>Storage Analytics</h2>
            <p>Analyze disk usage, categories, and cleanup candidates in {scanPath || currentPath}</p>
          </div>
        </div>

        <div className="storage-scan-status">
          <span className="storage-status-dot"></span>
          <span>Scanner</span>
          <strong>{isScanning ? "Scanning..." : "Ready"}</strong>
        </div>

        <button className="storage-close-btn" onClick={onClose}>×</button>
      </div>

      {/* =====================================================
          NAVIGATION
          ===================================================== */}
      <div className="storage-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "storage-nav-item active" : "storage-nav-item"}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* =====================================================
          BODY
          ===================================================== */}
      <div className="storage-body">

        {/* Scan overlay */}
        {isScanning && (
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "30px",
            textAlign: "center"
          }}>
            <h3 style={{ marginBottom: "15px" }}>Scanning Disk / Directory</h3>
            <p style={{ color: "#666", fontSize: "12px", maxWidth: "450px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Current: {scanCurrentPath}
            </p>

            <div style={{ width: "100%", maxWidth: "400px", margin: "20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                <span>Folders: {scanFoldersCount} | Files: {scanFilesCount}</span>
                <span>{scanProgress > 0 ? `${scanProgress}%` : "Calculating..."}</span>
              </div>
              <div className="ocr-progress-track" style={{ height: "10px", borderRadius: "5px" }}>
                <div className="ocr-progress-value" style={{ width: scanProgress > 0 ? `${scanProgress}%` : "30%" }} />
              </div>
              <span style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px", display: "block" }}>
                Bytes Scanned: {formatBytes(scanBytesCount)}
              </span>
            </div>

            <button className="ocr-danger-btn" onClick={handleCancelScan}>
              Cancel Scan
            </button>
          </div>
        )}

        {/* =================================================
            1. OVERVIEW
            ================================================= */}
        {activeTab === "overview" && (
          <div className="storage-page">
            <div className="storage-page-header">
              <div>
                <h3>Storage Overview</h3>
                <p>View storage usage across drives or custom subdirectories.</p>
              </div>

              <div className="storage-header-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <select
                  value={selectedDrive}
                  onChange={(e) => handleDriveChange(e.target.value)}
                  style={{ padding: "4px", fontSize: "12px" }}
                >
                  {drivesList.map(d => (
                    <option key={d.driveLetter} value={d.driveLetter}>
                      Drive {d.driveLetter} ({d.label})
                    </option>
                  ))}
                </select>

                <button className="storage-secondary-btn" onClick={handleChooseCustomFolder}>
                  Choose Folder
                </button>

                <button className="storage-primary-btn" onClick={handleStartScan}>
                  Scan Target
                </button>
              </div>
            </div>

            <div className="storage-path-box" style={{ marginBottom: "15px" }}>
              <span>Target Path:</span>
              <strong>{scanPath || "None selected"}</strong>
              {scanResults && (
                <span style={{ fontSize: "10px", color: "#9ca3af", marginLeft: "10px" }}>
                  (Scanned: {new Date(scanResults.timestamp).toLocaleString()})
                </span>
              )}
            </div>

            <div className="storage-overview-layout">
              {/* Drive Details Ring */}
              <div className="storage-drive-card">
                <div className="storage-drive-card-header">
                  <div>
                    <span className="storage-drive-letter">
                      {selectedDrive || "—"}
                    </span>
                    <div>
                      <strong>{currentDriveObj?.label || "Local Disk"}</strong>
                      <span>FileSystem: {currentDriveObj?.filesystem || "NTFS"}</span>
                    </div>
                  </div>
                  <span className="storage-drive-percent">
                    {currentDriveObj ? `${currentDriveObj.percentageUsed}%` : "—"}
                  </span>
                </div>

                <div className="storage-ring" style={{ margin: "20px auto" }}>
                  <div className="storage-ring-inner">
                    <strong>
                      {currentDriveObj ? formatBytes(currentDriveObj.usedCapacity) : "—"}
                    </strong>
                    <span>Used</span>
                  </div>
                </div>

                <div className="storage-drive-stats">
                  <div>
                    <span>Total Capacity</span>
                    <strong>{currentDriveObj ? formatBytes(currentDriveObj.totalCapacity) : "—"}</strong>
                  </div>
                  <div>
                    <span>Used Capacity</span>
                    <strong>{currentDriveObj ? formatBytes(currentDriveObj.usedCapacity) : "—"}</strong>
                  </div>
                  <div>
                    <span>Free Capacity</span>
                    <strong>{currentDriveObj ? formatBytes(currentDriveObj.freeCapacity) : "—"}</strong>
                  </div>
                </div>
              </div>

              {/* Breakdown overview panel */}
              <div className="storage-breakdown-card">
                <div className="storage-panel-header">
                  <div>
                    <strong>Folder/Drive Breakdown</strong>
                    <p>{scanResults ? `Analyzed: ${formatBytes(scanResults.bytesAnalyzed)}` : "Target has not been scanned yet."}</p>
                  </div>
                  {scanResults && (
                    <button onClick={() => setActiveTab("types")}>View Details</button>
                  )}
                </div>

                {!scanResults ? (
                  <div style={{ padding: "40px 20px", color: "#9ca3af", textAlign: "center", fontSize: "12px" }}>
                    Click "Scan Target" to analyze this directory's files.
                  </div>
                ) : (
                  <>
                    {/* Visual Segment bar */}
                    <div className="storage-horizontal-chart" style={{ display: "flex", height: "16px", borderRadius: "8px", overflow: "hidden", margin: "15px 0" }}>
                      {getFileCategoriesList().slice(0, 5).map((item, idx) => (
                        <div
                          key={item.name}
                          className={`storage-chart-segment`}
                          style={{
                            width: `${item.percentage || 1}%`,
                            backgroundColor: idx === 0 ? "#3b82f6" : idx === 1 ? "#10b981" : idx === 2 ? "#f59e0b" : idx === 3 ? "#ef4444" : "#8b5cf6",
                            color: "#fff",
                            fontSize: "9px",
                            textAlign: "center",
                            lineHeight: "16px"
                          }}
                        >
                          {item.percentage > 8 ? `${item.percentage}%` : ""}
                        </div>
                      ))}
                    </div>

                    <div className="storage-legend" style={{ maxHeight: "150px", overflowY: "auto" }}>
                      {getFileCategoriesList().map((item, idx) => (
                        <div className="storage-legend-item" key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "12px" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{
                              display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
                              backgroundColor: idx === 0 ? "#3b82f6" : idx === 1 ? "#10b981" : idx === 2 ? "#f59e0b" : idx === 3 ? "#ef4444" : idx === 4 ? "#8b5cf6" : "#6b7280"
                            }} />
                            {item.name} ({item.count} files)
                          </span>
                          <strong>{formatBytes(item.size)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Drives List table */}
            <div className="storage-section-card" style={{ marginTop: "15px" }}>
              <div className="storage-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Physical & Logical Drive Volumes</span>
                <button className="security-small-btn" onClick={handleClearCache}>Clear Analytics Cache</button>
              </div>

              <div className="storage-drive-list">
                {drivesList.map((drive) => (
                  <div
                    className="storage-drive-row"
                    key={drive.driveLetter}
                    style={{ cursor: "pointer", display: "grid", gridTemplateColumns: "2fr 3fr 1fr 1fr 1fr" }}
                    onClick={() => handleDriveChange(drive.driveLetter)}
                  >
                    <div className="storage-drive-name">
                      <span className="storage-small-drive">{drive.driveLetter}</span>
                      <div>
                        <strong>{drive.label || "Local Disk"}</strong>
                        <span>{drive.filesystem} ({drive.driveType})</span>
                      </div>
                    </div>

                    <div className="storage-row-progress" style={{ margin: "auto 0" }}>
                      <div className="storage-row-track">
                        <div
                          className="storage-row-value"
                          style={{
                            width: `${drive.percentageUsed}%`,
                            backgroundColor: drive.percentageUsed > 90 ? "#ef4444" : drive.percentageUsed > 80 ? "#f59e0b" : "#10b981"
                          }}
                        />
                      </div>
                    </div>

                    <div className="storage-row-size" style={{ textAlign: "right" }}>
                      <strong>{formatBytes(drive.usedCapacity)}</strong>
                      <span>used</span>
                    </div>

                    <div className="storage-row-free" style={{ textAlign: "right" }}>
                      <strong>{formatBytes(drive.freeCapacity)}</strong>
                      <span>free</span>
                    </div>

                    <div style={{ textAlign: "center", margin: "auto 0" }}>
                      <span className={`security-badge ${drive.health === "Healthy" ? "success" : "critical"}`}>
                        {drive.health}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            2. FILE TYPES
            ================================================= */}
        {activeTab === "types" && (
          <div className="storage-page">
            <div className="storage-page-header">
              <div>
                <h3>File-Type Distribution</h3>
                <p>Breakdown of files in {scanPath} grouped by general categories.</p>
              </div>
            </div>

            {!scanResults ? (
              <div style={{ padding: "60px", textAlign: "center", color: "#9ca3af" }}>
                Please run a scan in the Overview tab to load data.
              </div>
            ) : (
              <div className="storage-types-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {/* CSS Donut Visualizer */}
                <div className="storage-large-chart-card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div className="storage-panel-header" style={{ width: "100%" }}>
                    <strong>Category Weights</strong>
                  </div>
                  
                  <div className="storage-donut" style={{ margin: "30px 0" }}>
                    <div className="storage-donut-center">
                      <strong>{formatBytes(scanResults.bytesAnalyzed)}</strong>
                      <span>Analyzed</span>
                    </div>
                  </div>
                </div>

                <div className="storage-type-list">
                  {getFileCategoriesList().map((item, idx) => (
                    <div className="storage-type-row" key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #f3f4f6", fontSize: "13px" }}>
                      <div className="storage-type-info" style={{ display: "flex", gap: "8px" }}>
                        <span className="storage-type-icon" style={{
                          color: idx === 0 ? "#3b82f6" : idx === 1 ? "#10b981" : idx === 2 ? "#f59e0b" : idx === 3 ? "#ef4444" : "#8b5cf6"
                        }}>■</span>
                        <div>
                          <strong>{item.name}</strong>
                          <span style={{ fontSize: "11px", display: "block", color: "#6b7280" }}>{item.count} files ({item.percentage}% weight)</span>
                        </div>
                      </div>
                      <strong>{formatBytes(item.size)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================
            3. LARGEST FILES
            ================================================= */}
        {activeTab === "files" && (
          <div className="storage-page">
            <div className="storage-page-header">
              <div>
                <h3>Largest Files</h3>
                <p>Review the largest individual files detected during the scan.</p>
              </div>

              <div className="storage-header-actions" style={{ display: "flex", gap: "10px" }}>
                <select value={topFilesLimit} onChange={(e) => setTopFilesLimit(Number(e.target.value))}>
                  <option value={10}>Top 10</option>
                  <option value={50}>Top 50</option>
                  <option value={100}>Top 100</option>
                </select>
                <select value={topFilesSort} onChange={(e) => setTopFilesSort(e.target.value)}>
                  <option value="largest">Largest First</option>
                  <option value="smallest">Smallest First</option>
                </select>
              </div>
            </div>

            {!scanResults ? (
              <div style={{ padding: "60px", textAlign: "center", color: "#9ca3af" }}>
                Scan this directory in the Overview tab to find large files.
              </div>
            ) : (
              <div className="storage-file-table" style={{ maxHeight: "300px", overflowY: "auto" }}>
                <div className="storage-table-header" style={{ display: "grid", gridTemplateColumns: "3fr 1fr 4fr 2fr 1fr", fontWeight: "bold", borderBottom: "1px solid #e5e7eb", padding: "8px" }}>
                  <span>File Name</span>
                  <span>Extension</span>
                  <span>Full Path</span>
                  <span>File Size</span>
                  <span>Action</span>
                </div>

                {getSortedFiles().map((file, idx) => (
                  <div key={file.path} className="storage-file-row" style={{ display: "grid", gridTemplateColumns: "3fr 1fr 4fr 2fr 1fr", padding: "8px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", alignItems: "center" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <strong>{idx + 1}. {file.name}</strong>
                    </div>
                    <span>{file.ext.toUpperCase()}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.path}>
                      {file.path}
                    </span>
                    <strong>{formatBytes(file.size)}</strong>
                    <div>
                      <button
                        className="ocr-danger-btn"
                        style={{ padding: "2px 6px", fontSize: "10px" }}
                        onClick={() => handleDeleteCandidate(file.path)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================
            4. LARGEST FOLDERS
            ================================================= */}
        {activeTab === "folders" && (
          <div className="storage-page">
            <div className="storage-page-header">
              <div>
                <h3>Largest Folders</h3>
                <p>Inspect subfolders consuming the most storage recursively.</p>
              </div>
            </div>

            {!scanResults ? (
              <div style={{ padding: "60px", textAlign: "center", color: "#9ca3af" }}>
                Scan folders in the Overview tab to calculate folder sizes recursively.
              </div>
            ) : (
              <div className="storage-folder-list" style={{ maxHeight: "350px", overflowY: "auto" }}>
                {scanResults.largestFolders.map((folder, idx) => (
                  <div className="storage-folder-card" key={folder.path} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #f3f4f6", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <span style={{ fontSize: "18px" }}>📁</span>
                      <div>
                        <strong>{idx + 1}. {folder.name}</strong>
                        <span style={{ display: "block", fontSize: "11px", color: "#6b7280" }}>{folder.path}</span>
                        <small style={{ color: "#9ca3af" }}>{folder.fileCount} nested files, {folder.subfolderCount} subfolders</small>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: "14px", display: "block" }}>{formatBytes(folder.size)}</strong>
                      <button
                        className="ocr-danger-btn"
                        style={{ padding: "2px 6px", fontSize: "10px", marginTop: "4px" }}
                        onClick={() => handleDeleteCandidate(folder.path)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================
            5. CLEANUP CANDIDATES
            ================================================= */}
        {activeTab === "cleanup" && (
          <div className="storage-page">
            <div className="storage-page-header">
              <div>
                <h3>Storage Cleanup Center</h3>
                <p>Detect cache files, logs, temp folders, and old data for manual deletion.</p>
              </div>
            </div>

            {!scanResults ? (
              <div style={{ padding: "60px", textAlign: "center", color: "#9ca3af" }}>
                Please run a scan first to populate cleanup suggestions.
              </div>
            ) : (
              <div className="storage-cleanup-layout" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
                
                {/* Left option sidebars */}
                <div className="storage-cleanup-options">
                  {[
                    { id: "temp", title: "Temporary Files", desc: "Files ending in .tmp/.temp or stored in temp folders." },
                    { id: "cache", title: "Cache & Logs", desc: "System or app logs (.log) and local cache files." },
                    { id: "empty", title: "Empty Folders", desc: "Directories holding 0 files and 0 subdirectories." },
                    { id: "large", title: "Large Files (>100MB)", desc: "Very large files consuming storage." },
                    { id: "old", title: "Old Files (>180 Days)", desc: "Files unmodified for over 6 months." }
                  ].map((opt) => {
                    const count = scanResults.cleanupCandidates[opt.id]?.length || 0;
                    const sizeBytes = scanResults.cleanupCandidates[opt.id]?.reduce((acc, curr) => acc + (curr.size || 0), 0) || 0;
                    return (
                      <button
                        key={opt.id}
                        className={cleanupType === opt.id ? "storage-cleanup-option selected" : "storage-cleanup-option"}
                        onClick={() => setCleanupType(opt.id)}
                        style={{ width: "100%", textAlign: "left", padding: "10px", display: "flex", justifyContent: "space-between", border: "1px solid #e5e7eb", borderRadius: "6px", marginBottom: "8px", cursor: "pointer" }}
                      >
                        <div>
                          <strong>{opt.title}</strong>
                          <span style={{ display: "block", fontSize: "11px", color: "#6b7280" }}>{count} items detected</span>
                        </div>
                        <strong style={{ alignSelf: "center" }}>{formatBytes(sizeBytes)}</strong>
                      </button>
                    );
                  })}
                </div>

                {/* Right detail view */}
                <div className="storage-cleanup-details" style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "15px", maxHeight: "350px", overflowY: "auto" }}>
                  <h4 style={{ marginBottom: "10px", borderBottom: "1px solid #e5e7eb", paddingBottom: "5px" }}>
                    Select Deletion Candidates ({getCleanupList().length} items)
                  </h4>
                  
                  {getCleanupList().length === 0 ? (
                    <div style={{ padding: "40px", color: "#9ca3af", textAlign: "center" }}>
                      No items found in this cleanup group.
                    </div>
                  ) : (
                    getCleanupList().map((item) => (
                      <div key={item.path} style={{ display: "flex", justifyContent: "space-between", padding: "6px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", alignItems: "center" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", marginRight: "10px" }}>
                          <strong style={{ display: "block" }}>{item.name}</strong>
                          <span style={{ color: "#6b7280" }}>{item.path}</span>
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <strong>{formatBytes(item.size)}</strong>
                          <button
                            className="ocr-danger-btn"
                            style={{ padding: "2px 6px" }}
                            onClick={() => handleDeleteCandidate(item.path)}
                          >
                            Purge
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* =================================================
            6. VISUALIZATION
            ================================================= */}
        {activeTab === "visualization" && (
          <div className="storage-page">
            <div className="storage-page-header">
              <div>
                <h3>Storage Visualizer</h3>
                <p>Toggle charts representing real scanned folder contents.</p>
              </div>

              <div className="storage-chart-tabs" style={{ display: "flex", gap: "5px" }}>
                {["donut", "bar", "treemap"].map((type) => (
                  <button
                    key={type}
                    className={chartType === type ? "active" : ""}
                    onClick={() => setChartType(type)}
                    style={{ padding: "4px 8px", fontSize: "12px", border: "1px solid #ccc", cursor: "pointer" }}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {!scanResults ? (
              <div style={{ padding: "60px", textAlign: "center", color: "#9ca3af" }}>
                Scan a directory first to render visualizations.
              </div>
            ) : (
              <div className="storage-visual-card" style={{ padding: "20px" }}>
                {chartType === "donut" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div className="storage-visual-donut" style={{ margin: "20px 0" }}>
                      <div className="storage-visual-donut-center">
                        <strong>{formatBytes(scanResults.bytesAnalyzed)}</strong>
                        <span>Total Scanned</span>
                      </div>
                    </div>
                  </div>
                )}

                {chartType === "bar" && (
                  <div className="storage-bar-chart" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {getFileCategoriesList().map((item) => (
                      <div className="storage-bar-item" key={item.name}>
                        <div className="storage-bar-label" style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>{item.name}</span>
                          <strong>{formatBytes(item.size)} ({item.percentage}%)</strong>
                        </div>
                        <div className="storage-bar-track">
                          <div className="storage-bar-value" style={{ width: `${item.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {chartType === "treemap" && (
                  <div className="storage-treemap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
                    {getFileCategoriesList().map((item, idx) => (
                      <div
                        key={item.name}
                        style={{
                          padding: "15px",
                          borderRadius: "6px",
                          backgroundColor: idx === 0 ? "#3b82f6" : idx === 1 ? "#10b981" : idx === 2 ? "#f59e0b" : idx === 3 ? "#ef4444" : "#8b5cf6",
                          color: "#fff",
                          minHeight: "80px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between"
                        }}
                      >
                        <strong>{item.name}</strong>
                        <div>
                          <strong style={{ display: "block" }}>{formatBytes(item.size)}</strong>
                          <span style={{ fontSize: "11px" }}>{item.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* =====================================================
          FOOTER
          ===================================================== */}
      <div className="storage-footer">
        <div className="storage-footer-left">
          <span>Storage Center</span>
          <span>•</span>
          <strong>{tabs.find((t) => t.id === activeTab)?.label}</strong>
        </div>
        <div className="storage-footer-right">
          <span className="storage-ready-dot"></span>
          <span>Scanner ready</span>
        </div>
      </div>

    </div>
  );
}

export default StorageAnalytics;