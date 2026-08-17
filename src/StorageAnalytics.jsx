import { useState } from "react";
import "./StorageAnalytics.css";

function StorageAnalytics({ currentPath, items, onClose }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDrive, setSelectedDrive] = useState("C:");
  const [cleanupType, setCleanupType] = useState("old");
  const [chartType, setChartType] = useState("donut");

  const tabs = [
    { id: "overview", label: "Overview", icon: "◉" },
    { id: "types", label: "File Types", icon: "▦" },
    { id: "files", label: "Largest Files", icon: "▤" },
    { id: "folders", label: "Largest Folders", icon: "▰" },
    { id: "cleanup", label: "Storage Cleanup", icon: "⌫" },
    { id: "visualization", label: "Visualization", icon: "◒" },
  ];

  const drives = [
    {
      name: "C:",
      label: "System",
      total: "1 TB",
      used: "720 GB",
      free: "280 GB",
      percentage: 72,
    },
    {
      name: "D:",
      label: "Data",
      total: "2 TB",
      used: "1.1 TB",
      free: "900 GB",
      percentage: 55,
    },
  ];

  const fileTypes = [
    { name: "Videos", size: "420 GB", percentage: 58 },
    { name: "Games", size: "180 GB", percentage: 25 },
    { name: "Pictures", size: "80 GB", percentage: 11 },
    { name: "Documents", size: "25 GB", percentage: 4 },
    { name: "Others", size: "15 GB", percentage: 2 },
  ];

  const largestFiles = [
    {
      name: "Project_Backup.zip",
      path: "C:\\Backups",
      size: "42.8 GB",
      type: "Archive",
    },
    {
      name: "video_project.mp4",
      path: "D:\\Videos",
      size: "18.4 GB",
      type: "Video",
    },
    {
      name: "Windows_Backup.iso",
      path: "D:\\ISO",
      size: "12.6 GB",
      type: "ISO",
    },
    {
      name: "Adobe_Project.aep",
      path: "D:\\Projects",
      size: "8.9 GB",
      type: "Project",
    },
    {
      name: "Database_Backup.sql",
      path: "C:\\Database",
      size: "6.4 GB",
      type: "Database",
    },
  ];

  const largestFolders = [
    {
      name: "Videos",
      path: "D:\\Videos",
      size: "420 GB",
      items: "12,420",
    },
    {
      name: "Games",
      path: "D:\\Games",
      size: "180 GB",
      items: "48,210",
    },
    {
      name: "Projects",
      path: "D:\\Projects",
      size: "72 GB",
      items: "8,420",
    },
    {
      name: "Pictures",
      path: "C:\\Users\\Pictures",
      size: "80 GB",
      items: "16,850",
    },
  ];

  const cleanupOptions = [
    {
      id: "old",
      title: "Old Files",
      description: "Files that have not been modified for a long time.",
      count: 1284,
      size: "18.2 GB",
    },
    {
      id: "temporary",
      title: "Temporary Files",
      description: "Temporary files that may no longer be required.",
      count: 642,
      size: "6.8 GB",
    },
    {
      id: "large",
      title: "Large Files",
      description: "Files consuming unusually large amounts of storage.",
      count: 86,
      size: "72.4 GB",
    },
    {
      id: "duplicate",
      title: "Duplicate Files",
      description: "Potential duplicate files using unnecessary storage.",
      count: 342,
      size: "12.7 GB",
    },
    {
      id: "empty",
      title: "Empty Folders",
      description: "Folders containing no files or subfolders.",
      count: 218,
      size: "0 GB",
    },
    {
      id: "unused",
      title: "Unused Files",
      description: "Files that appear to be rarely or never accessed.",
      count: 928,
      size: "24.6 GB",
    },
  ];

  const selectedCleanup = cleanupOptions.find(
    (item) => item.id === cleanupType
  );

    const filesOnly = items ? items.filter(it => !it.isDirectory) : [];
  const foldersOnly = items ? items.filter(it => it.isDirectory) : [];

  const dynamicLargestFiles = filesOnly.length > 0
    ? [...filesOnly]
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .map(it => ({
          name: it.name,
          path: it.path,
          size: (it.size / (1024 * 1024)).toFixed(2) + " MB",
          type: it.name.split(".").pop().toUpperCase()
        }))
    : largestFiles;

  const dynamicLargestFolders = foldersOnly.length > 0
    ? foldersOnly.slice(0, 5).map(it => ({
        name: it.name,
        path: it.path,
        size: "—",
        items: "Click to scan"
      }))
    : largestFolders;

return (
    <div className="storage-analytics">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="storage-header">

        <div className="storage-title-section">

          <div className="storage-main-icon">
            📊
          </div>

          <div>
            <h2>Storage Analytics</h2>

            <p>
              Analyze disk usage, large files and storage
              consumption in {currentPath}
            </p>
          </div>

        </div>

        <div className="storage-scan-status">

          <span className="storage-status-dot"></span>

          <span>
            Scanner
          </span>

          <strong>
            Ready
          </strong>

        </div>

        <button
          className="storage-close-btn"
          onClick={onClose}
        >
          ×
        </button>

      </div>


      {/* =====================================================
          NAVIGATION
          ===================================================== */}

      <div className="storage-navigation">

        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={
              activeTab === tab.id
                ? "storage-nav-item active"
                : "storage-nav-item"
            }
            onClick={() => setActiveTab(tab.id)}
          >

            <span>
              {tab.icon}
            </span>

            {tab.label}

          </button>
        ))}

      </div>


      {/* =====================================================
          BODY
          ===================================================== */}

      <div className="storage-body">


        {/* =================================================
            OVERVIEW
            ================================================= */}

        {activeTab === "overview" && (
          <div className="storage-page">

            <div className="storage-page-header">

              <div>
                <h3>
                  Storage Overview
                </h3>

                <p>
                  View storage usage across available drives.
                </p>
              </div>

              <div className="storage-header-actions">

                <select
                  value={selectedDrive}
                  onChange={(e) =>
                    setSelectedDrive(e.target.value)
                  }
                >

                  <option>C:</option>
                  <option>D:</option>

                </select>

                <button className="storage-primary-btn">
                  Scan Drive
                </button>

              </div>

            </div>


            {/* Drive Summary */}

            <div className="storage-overview-layout">

              <div className="storage-drive-card">

                <div className="storage-drive-card-header">

                  <div>

                    <span className="storage-drive-letter">
                      {selectedDrive}
                    </span>

                    <div>
                      <strong>
                        Local Disk
                      </strong>

                      <span>
                        System Drive
                      </span>
                    </div>

                  </div>

                  <span className="storage-drive-percent">
                    72%
                  </span>

                </div>


                <div className="storage-ring">

                  <div className="storage-ring-inner">

                    <strong>
                      720 GB
                    </strong>

                    <span>
                      Used
                    </span>

                  </div>

                </div>


                <div className="storage-drive-stats">

                  <div>
                    <span>
                      Total
                    </span>

                    <strong>
                      1 TB
                    </strong>
                  </div>

                  <div>
                    <span>
                      Used
                    </span>

                    <strong>
                      720 GB
                    </strong>
                  </div>

                  <div>
                    <span>
                      Free
                    </span>

                    <strong>
                      280 GB
                    </strong>
                  </div>

                </div>

              </div>


              {/* File Type Breakdown */}

              <div className="storage-breakdown-card">

                <div className="storage-panel-header">

                  <div>
                    <strong>
                      Storage Breakdown
                    </strong>

                    <p>
                      Usage by file category
                    </p>
                  </div>

                  <button>
                    View Details
                  </button>

                </div>


                <div className="storage-horizontal-chart">

                  <div className="storage-chart-segment videos">
                    58%
                  </div>

                  <div className="storage-chart-segment games">
                    25%
                  </div>

                  <div className="storage-chart-segment pictures">
                    11%
                  </div>

                  <div className="storage-chart-segment documents">
                    4%
                  </div>

                  <div className="storage-chart-segment others">
                    2%
                  </div>

                </div>


                <div className="storage-legend">

                  {fileTypes.map((item) => (
                    <div
                      className="storage-legend-item"
                      key={item.name}
                    >

                      <span className="storage-legend-dot"></span>

                      <span>
                        {item.name}
                      </span>

                      <strong>
                        {item.size}
                      </strong>

                    </div>
                  ))}

                </div>

              </div>

            </div>


            {/* All Drives */}

            <div className="storage-section-card">

              <div className="storage-section-title">
                Drive Statistics
              </div>

              <div className="storage-drive-list">

                {drives.map((drive) => (
                  <div
                    className="storage-drive-row"
                    key={drive.name}
                  >

                    <div className="storage-drive-name">

                      <span className="storage-small-drive">
                        {drive.name}
                      </span>

                      <div>
                        <strong>
                          {drive.label}
                        </strong>

                        <span>
                          {drive.total} total
                        </span>
                      </div>

                    </div>


                    <div className="storage-row-progress">

                      <div className="storage-row-track">

                        <div
                          className="storage-row-value"
                          style={{
                            width: `${drive.percentage}%`,
                          }}
                        />

                      </div>

                    </div>


                    <div className="storage-row-size">

                      <strong>
                        {drive.used}
                      </strong>

                      <span>
                        used
                      </span>

                    </div>

                    <div className="storage-row-free">

                      <strong>
                        {drive.free}
                      </strong>

                      <span>
                        free
                      </span>

                    </div>

                  </div>
                ))}

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            FILE TYPES
            ================================================= */}

        {activeTab === "types" && (
          <div className="storage-page">

            <div className="storage-page-header">

              <div>

                <h3>
                  File-Type Analysis
                </h3>

                <p>
                  Understand how different file categories
                  consume storage.
                </p>

              </div>

              <select className="storage-select">

                <option>
                  By Size
                </option>

                <option>
                  By Count
                </option>

                <option>
                  By Extension
                </option>

              </select>

            </div>


            <div className="storage-types-layout">

              {/* Chart */}

              <div className="storage-large-chart-card">

                <div className="storage-panel-header">

                  <div>
                    <strong>
                      File Distribution
                    </strong>

                    <p>
                      Total analyzed storage: 720 GB
                    </p>
                  </div>

                </div>


                <div className="storage-donut">

                  <div className="storage-donut-center">

                    <strong>
                      720 GB
                    </strong>

                    <span>
                      Total Used
                    </span>

                  </div>

                </div>

              </div>


              {/* Categories */}

              <div className="storage-type-list">

                {fileTypes.map((item) => (
                  <div
                    className="storage-type-row"
                    key={item.name}
                  >

                    <div className="storage-type-info">

                      <span className="storage-type-icon">
                        ▧
                      </span>

                      <div>

                        <strong>
                          {item.name}
                        </strong>

                        <span>
                          {item.percentage}% of storage
                        </span>

                      </div>

                    </div>

                    <strong>
                      {item.size}
                    </strong>

                  </div>
                ))}

              </div>

            </div>


            {/* Extensions */}

            <div className="storage-section-card">

              <div className="storage-section-title">
                Extension Distribution
              </div>

              <div className="storage-extension-grid">

                {[
                  ["MP4", "240 GB"],
                  ["MKV", "120 GB"],
                  ["ZIP", "86 GB"],
                  ["JPG", "54 GB"],
                  ["PNG", "21 GB"],
                  ["PDF", "18 GB"],
                  ["EXE", "14 GB"],
                  ["Other", "167 GB"],
                ].map(([ext, size]) => (
                  <div
                    className="storage-extension-card"
                    key={ext}
                  >

                    <strong>
                      .{ext.toLowerCase()}
                    </strong>

                    <span>
                      {size}
                    </span>

                  </div>
                ))}

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            LARGEST FILES
            ================================================= */}

        {activeTab === "files" && (
          <div className="storage-page">

            <div className="storage-page-header">

              <div>

                <h3>
                  Largest Files
                </h3>

                <p>
                  Find the files consuming the most storage.
                </p>

              </div>

              <div className="storage-header-actions">

                <select>

                  <option>
                    Top 10
                  </option>

                  <option>
                    Top 50
                  </option>

                  <option>
                    Top 100
                  </option>

                </select>

                <select>

                  <option>
                    Largest First
                  </option>

                  <option>
                    Smallest First
                  </option>

                </select>

              </div>

            </div>


            <div className="storage-file-table">

              <div className="storage-table-header">

                <span>
                  File
                </span>

                <span>
                  Type
                </span>

                <span>
                  Location
                </span>

                <span>
                  Size
                </span>

                <span>
                  Actions
                </span>

              </div>


              {dynamicLargestFiles.map((file, index) => (
                <div
                  className="storage-file-row"
                  key={file.name}
                >

                  <div className="storage-file-name">

                    <span className="storage-file-number">
                      {index + 1}
                    </span>

                    <div>

                      <strong>
                        {file.name}
                      </strong>

                      <span>
                        File
                      </span>

                    </div>

                  </div>


                  <span className="storage-file-type">
                    {file.type}
                  </span>


                  <span className="storage-file-path">
                    {file.path}
                  </span>


                  <strong className="storage-file-size">
                    {file.size}
                  </strong>


                  <div className="storage-file-actions">

                    <button
                      title="Open Location"
                      onClick={() =>
                        console.log("Open location")
                      }
                    >
                      ↗
                    </button>

                    <button
                      title="Move"
                      onClick={() =>
                        console.log("Move")
                      }
                    >
                      →
                    </button>

                    <button
                      title="Delete"
                      onClick={() =>
                        console.log("Delete")
                      }
                    >
                      ×
                    </button>

                  </div>

                </div>
              ))}

            </div>

          </div>
        )}


        {/* =================================================
            LARGEST FOLDERS
            ================================================= */}

        {activeTab === "folders" && (
          <div className="storage-page">

            <div className="storage-page-header">

              <div>

                <h3>
                  Largest Folders
                </h3>

                <p>
                  Analyze folders and their nested storage
                  consumption.
                </p>

              </div>

              <button className="storage-primary-btn">
                Scan Folders
              </button>

            </div>


            <div className="storage-folder-list">

              {dynamicLargestFolders.map((folder) => (
                <div
                  className="storage-folder-card"
                  key={folder.name}
                >

                  <div className="storage-folder-icon">
                    ▰
                  </div>


                  <div className="storage-folder-info">

                    <strong>
                      {folder.name}
                    </strong>

                    <span>
                      {folder.path}
                    </span>

                    <small>
                      {folder.items} items
                    </small>

                  </div>


                  <div className="storage-folder-size">

                    <strong>
                      {folder.size}
                    </strong>

                    <span>
                      Storage used
                    </span>

                  </div>


                  <div className="storage-folder-actions">

                    <button>
                      Open
                    </button>

                    <button>
                      Analyze
                    </button>

                  </div>

                </div>
              ))}

            </div>


            {/* Folder Hierarchy */}

            <div className="storage-section-card">

              <div className="storage-section-title">
                Folder Hierarchy
              </div>

              <div className="storage-tree">

                <div className="storage-tree-item level-0">
                  <span>▾</span>
                  <strong>D:\</strong>
                  <span>1.1 TB</span>
                </div>

                <div className="storage-tree-item level-1">
                  <span>▾</span>
                  <strong>Videos</strong>
                  <span>420 GB</span>
                </div>

                <div className="storage-tree-item level-2">
                  <span>•</span>
                  <span>Projects</span>
                  <span>180 GB</span>
                </div>

                <div className="storage-tree-item level-2">
                  <span>•</span>
                  <span>Movies</span>
                  <span>140 GB</span>
                </div>

                <div className="storage-tree-item level-1">
                  <span>▸</span>
                  <strong>Games</strong>
                  <span>180 GB</span>
                </div>

                <div className="storage-tree-item level-1">
                  <span>▸</span>
                  <strong>Projects</strong>
                  <span>72 GB</span>
                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            CLEANUP
            ================================================= */}

        {activeTab === "cleanup" && (
          <div className="storage-page">

            <div className="storage-page-header">

              <div>

                <h3>
                  Storage Cleanup
                </h3>

                <p>
                  Find files and folders that may be consuming
                  unnecessary storage.
                </p>

              </div>

              <button className="storage-primary-btn">
                Scan for Cleanup
              </button>

            </div>


            <div className="storage-cleanup-layout">

              <div className="storage-cleanup-options">

                {cleanupOptions.map((item) => (
                  <button
                    key={item.id}
                    className={
                      cleanupType === item.id
                        ? "storage-cleanup-option selected"
                        : "storage-cleanup-option"
                    }
                    onClick={() =>
                      setCleanupType(item.id)
                    }
                  >

                    <div className="storage-cleanup-icon">
                      {item.id === "old" && "◷"}
                      {item.id === "temporary" && "⌫"}
                      {item.id === "large" && "⬆"}
                      {item.id === "duplicate" && "◇"}
                      {item.id === "empty" && "□"}
                      {item.id === "unused" && "○"}
                    </div>

                    <div>

                      <strong>
                        {item.title}
                      </strong>

                      <span>
                        {item.count} items
                      </span>

                    </div>

                    <strong>
                      {item.size}
                    </strong>

                  </button>
                ))}

              </div>


              {/* Selected Cleanup */}

              <div className="storage-cleanup-details">

                <div className="storage-cleanup-detail-icon">
                  ⌫
                </div>

                <h3>
                  {selectedCleanup?.title}
                </h3>

                <p>
                  {selectedCleanup?.description}
                </p>


                <div className="storage-cleanup-summary">

                  <div>
                    <span>
                      Items
                    </span>

                    <strong>
                      {selectedCleanup?.count}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Potential Storage
                    </span>

                    <strong>
                      {selectedCleanup?.size}
                    </strong>
                  </div>

                </div>


                <button className="storage-primary-btn">
                  View Files
                </button>

              </div>

            </div>


            {/* Recent Activity */}

            <div className="storage-section-card">

              <div className="storage-section-title">
                Additional Cleanup Categories
              </div>

              <div className="storage-cleanup-extra">

                <div>
                  <span>
                    Recently Accessed
                  </span>

                  <strong>
                    2,481 files
                  </strong>
                </div>

                <div>
                  <span>
                    Recently Modified
                  </span>

                  <strong>
                    1,842 files
                  </strong>
                </div>

                <div>
                  <span>
                    Empty Folders
                  </span>

                  <strong>
                    218 folders
                  </strong>
                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            VISUALIZATION
            ================================================= */}

        {activeTab === "visualization" && (
          <div className="storage-page">

            <div className="storage-page-header">

              <div>

                <h3>
                  Storage Visualization
                </h3>

                <p>
                  Explore storage usage using different visual
                  representations.
                </p>

              </div>

              <div className="storage-chart-tabs">

                {["donut", "bar", "treemap"].map((type) => (
                  <button
                    key={type}
                    className={
                      chartType === type
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setChartType(type)
                    }
                  >
                    {type}
                  </button>
                ))}

              </div>

            </div>


            {/* Visualization */}

            <div className="storage-visual-card">

              {chartType === "donut" && (
                <div className="storage-visual-donut">

                  <div className="storage-visual-donut-center">

                    <strong>
                      720 GB
                    </strong>

                    <span>
                      Used
                    </span>

                  </div>

                </div>
              )}


              {chartType === "bar" && (
                <div className="storage-bar-chart">

                  {fileTypes.map((item) => (
                    <div
                      className="storage-bar-item"
                      key={item.name}
                    >

                      <div className="storage-bar-label">
                        <span>
                          {item.name}
                        </span>

                        <strong>
                          {item.size}
                        </strong>
                      </div>

                      <div className="storage-bar-track">

                        <div
                          className="storage-bar-value"
                          style={{
                            width: `${item.percentage}%`,
                          }}
                        />

                      </div>

                    </div>
                  ))}

                </div>
              )}


              {chartType === "treemap" && (
                <div className="storage-treemap">

                  <div className="storage-tree-video">
                    Videos
                    <strong>
                      420 GB
                    </strong>
                  </div>

                  <div className="storage-tree-games">
                    Games
                    <strong>
                      180 GB
                    </strong>
                  </div>

                  <div className="storage-tree-pictures">
                    Pictures
                    <strong>
                      80 GB
                    </strong>
                  </div>

                  <div className="storage-tree-documents">
                    Documents
                    <strong>
                      25 GB
                    </strong>
                  </div>

                  <div className="storage-tree-other">
                    Others
                    <strong>
                      15 GB
                    </strong>
                  </div>

                </div>
              )}

            </div>


            {/* Timeline */}

            <div className="storage-section-card">

              <div className="storage-section-title">
                Storage Timeline
              </div>

              <div className="storage-timeline">

                <div className="storage-timeline-line"></div>

                <div>
                  <span>
                    Jan
                  </span>

                  <strong>
                    540 GB
                  </strong>
                </div>

                <div>
                  <span>
                    Mar
                  </span>

                  <strong>
                    580 GB
                  </strong>
                </div>

                <div>
                  <span>
                    May
                  </span>

                  <strong>
                    630 GB
                  </strong>
                </div>

                <div>
                  <span>
                    Jul
                  </span>

                  <strong>
                    680 GB
                  </strong>
                </div>

                <div>
                  <span>
                    Aug
                  </span>

                  <strong>
                    720 GB
                  </strong>
                </div>

              </div>

            </div>


            {/* Drive Comparison */}

            <div className="storage-section-card">

              <div className="storage-section-title">
                Drive Comparison
              </div>

              <div className="storage-comparison">

                {drives.map((drive) => (
                  <div
                    className="storage-comparison-drive"
                    key={drive.name}
                  >

                    <div>

                      <strong>
                        {drive.name}
                      </strong>

                      <span>
                        {drive.total}
                      </span>

                    </div>

                    <div className="storage-comparison-track">

                      <div
                        style={{
                          width: `${drive.percentage}%`,
                        }}
                      />

                    </div>

                    <span>
                      {drive.percentage}% used
                    </span>

                  </div>
                ))}

              </div>

            </div>

          </div>
        )}

      </div>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <div className="storage-footer">

        <div className="storage-footer-left">

          <span>
            Storage Analytics
          </span>

          <span>
            •
          </span>

          <strong>
            {tabs.find(
              (tab) => tab.id === activeTab
            )?.label}
          </strong>

        </div>

        <div className="storage-footer-right">

          <span className="storage-ready-dot"></span>

          <span>
            Scanner ready
          </span>

        </div>

      </div>

    </div>
  );
}

export default StorageAnalytics;