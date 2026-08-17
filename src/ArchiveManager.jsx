/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import "./ArchiveManager.css";

function ArchiveManager({ currentPath, selectedItem, onClose }) {
  const [activeTab, setActiveTab] = useState("create");
  const [archiveFormat, setArchiveFormat] = useState("ZIP");
  const [compressionLevel, setCompressionLevel] = useState("Normal");
  const [archiveName, setArchiveName] = useState("");
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedItem) {
      const parts = selectedItem.split("\\");
      const name = parts[parts.length - 1];
      setArchiveName(name + ".zip");
      const dir = selectedItem.substring(0, selectedItem.lastIndexOf("\\"));
      setDestination(dir || "C:\\");
    } else {
      const dir = currentPath && !currentPath.startsWith("tool:") ? currentPath : "C:\\";
      setArchiveName("archive.zip");
      setDestination(dir);
    }
  }, [selectedItem, currentPath]);
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const archiveFormats = [
    "ZIP",
    "7Z",
    "TAR",
    "GZ",
    "TAR.GZ",
    "RAR",
  ];

  const compressionLevels = [
    "Store / No Compression",
    "Fast",
    "Normal",
    "High",
    "Maximum",
  ];

  const handleCreateArchive = async () => {
    if (!selectedItem) {
      setError("Please select a file or folder in the Explorer first.");
      return;
    }
    setLoading(true);
    setStatus("Compressing file/folder to ZIP...");
    setError("");
    try {
      const destZip = destination + "\\" + archiveName;
      const res = await window.fileExplorer.createZip(selectedItem, destZip);
      if (res && res.success) {
        setStatus("Archive created successfully at: " + destZip);
      } else {
        throw new Error(res?.error || "Compression failed");
      }
    } catch (err) {
      setError(err.message || "Archive creation failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!selectedItem) {
      setError("Please select a ZIP file in the Explorer first.");
      return;
    }
    setLoading(true);
    setStatus("Extracting archive...");
    setError("");
    try {
      const targetDir = currentPath && !currentPath.startsWith("tool:") ? currentPath : "C:\\";
      const res = await window.fileExplorer.extractZip(selectedItem, targetDir);
      if (res && res.success) {
        setStatus("Archive extracted successfully to: " + targetDir);
      } else {
        throw new Error(res?.error || "Extraction failed");
      }
    } catch (err) {
      setError(err.message || "Extraction failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="archive-manager">

      {/* Header */}
      <div className="archive-header">
        <div className="archive-title-section">
          <div className="archive-icon">
            ▱
          </div>

          <div>
            <h2>Archive Manager</h2>
            <p>
              Create, extract and manage compressed files
            </p>
          </div>
        </div>

        <button
          className="archive-close-btn"
          onClick={onClose}
        >
          ×
        </button>
      </div>


      {/* Tabs */}
      <div className="archive-tabs">

        <button
          className={
            activeTab === "create"
              ? "archive-tab active"
              : "archive-tab"
          }
          onClick={() => setActiveTab("create")}
        >
          <span>＋</span>
          Create Archive
        </button>

        <button
          className={
            activeTab === "extract"
              ? "archive-tab active"
              : "archive-tab"
          }
          onClick={() => setActiveTab("extract")}
        >
          <span>↗</span>
          Extract
        </button>

        <button
          className={
            activeTab === "manage"
              ? "archive-tab active"
              : "archive-tab"
          }
          onClick={() => setActiveTab("manage")}
        >
          <span>▤</span>
          Manage Archive
        </button>

      </div>


      {/* Main Content */}
      <div className="archive-body">

        {/* ================= CREATE ================= */}

        {activeTab === "create" && (
          <div className="archive-create-layout">

            {/* Left */}
            <div className="archive-create-main">

              <div className="archive-section">

                <div className="archive-section-title">
                  Select Files & Folders
                </div>

                <div className="archive-drop-zone">

                  <div className="archive-drop-icon">
                    ⇧
                  </div>

                  <div className="archive-drop-title">
                    Select files or folders
                  </div>

                  <div className="archive-drop-description">
                    Add multiple files and folders to your archive
                  </div>

                  <div className="archive-select-buttons">

                    <button
                      className="archive-secondary-btn"
                      onClick={() => console.log("Select files")}
                    >
                      Select Files
                    </button>

                    <button
                      className="archive-secondary-btn"
                      onClick={() => console.log("Select folder")}
                    >
                      Select Folder
                    </button>

                  </div>

                </div>

              </div>


              {/* Selected Items */}
              <div className="archive-section">

                <div className="archive-section-header">

                  <div className="archive-section-title">
                    Selected Items
                  </div>

                  <span className="archive-item-count">
                    0 items
                  </span>

                </div>

                <div className="archive-items-empty">

                  <div className="archive-empty-icon">
                    ▱
                  </div>

                  <span>
                    No files or folders selected
                  </span>

                </div>

              </div>


              {/* Archive Information */}
              <div className="archive-section">

                <div className="archive-section-title">
                  Archive Information
                </div>

                <div className="archive-form-grid">

                  <div className="archive-form-group">

                    <label>
                      Archive Name
                    </label>

                    <input
                      type="text"
                      value={archiveName}
                      onChange={(e) =>
                        setArchiveName(e.target.value)
                      }
                      placeholder="MyArchive"
                    />

                  </div>


                  <div className="archive-form-group">

                    <label>
                      Format
                    </label>

                    <select
                      value={archiveFormat}
                      onChange={(e) =>
                        setArchiveFormat(e.target.value)
                      }
                    >
                      {archiveFormats.map((format) => (
                        <option
                          key={format}
                          value={format}
                        >
                          {format}
                          {format === "RAR"
                            ? " (Library dependent)"
                            : ""}
                        </option>
                      ))}
                    </select>

                  </div>


                  <div className="archive-form-group full">

                    <label>
                      Destination
                    </label>

                    <div className="archive-destination">

                      <input
                        type="text"
                        value={destination}
                        onChange={(e) =>
                          setDestination(e.target.value)
                        }
                        placeholder="Choose destination folder..."
                      />

                      <button
                        onClick={() =>
                          console.log("Browse destination")
                        }
                      >
                        Browse
                      </button>

                    </div>

                  </div>

                </div>

              </div>

            </div>


            {/* Right Settings */}
            <div className="archive-settings">

              <div className="archive-settings-title">
                Compression
              </div>

              <div className="archive-form-group">

                <label>
                  Compression Level
                </label>

                <select
                  value={compressionLevel}
                  onChange={(e) =>
                    setCompressionLevel(e.target.value)
                  }
                >
                  {compressionLevels.map((level) => (
                    <option
                      key={level}
                      value={level}
                    >
                      {level}
                    </option>
                  ))}
                </select>

              </div>


              <div className="compression-info">

                <div>
                  <span>Speed</span>
                  <strong>—</strong>
                </div>

                <div>
                  <span>Estimated Size</span>
                  <strong>—</strong>
                </div>

              </div>


              {/* Password */}
              <div className="archive-settings-divider" />

              <div className="archive-settings-title">
                Security
              </div>

              <label className="archive-checkbox">

                <input
                  type="checkbox"
                  checked={passwordEnabled}
                  onChange={(e) =>
                    setPasswordEnabled(e.target.checked)
                  }
                />

                <span>
                  Password-protect archive
                </span>

              </label>


              {passwordEnabled && (
                <div className="password-fields">

                  <div className="archive-form-group">

                    <label>
                      Password
                    </label>

                    <input
                      type="password"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      placeholder="Enter password"
                    />

                  </div>

                  <div className="archive-form-group">

                    <label>
                      Confirm Password
                    </label>

                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) =>
                        setConfirmPassword(e.target.value)
                      }
                      placeholder="Confirm password"
                    />

                  </div>

                </div>
              )}


              <div className="archive-security-note">
                🔒 Passwords will be handled securely when
                encryption is implemented.
              </div>

            </div>

          </div>
        )}


        {/* ================= EXTRACT ================= */}

        {activeTab === "extract" && (
          <div className="archive-operation-page">

            <div className="operation-icon">
              ↗
            </div>

            <h3>Extract Archive</h3>

            <p>
              Select an archive to extract its contents.
            </p>

            <button
              className="archive-primary-btn"
              onClick={() => console.log("Select archive")}
            >
              Select Archive
            </button>

            <div className="extract-options">

              <label className="archive-radio">

                <input
                  type="radio"
                  name="extract-location"
                  defaultChecked
                />

                <span>
                  Extract here
                </span>

              </label>

              <label className="archive-radio">

                <input
                  type="radio"
                  name="extract-location"
                />

                <span>
                  Extract to a new folder
                </span>

              </label>

              <label className="archive-radio">

                <input
                  type="radio"
                  name="extract-location"
                />

                <span>
                  Choose destination
                </span>

              </label>

            </div>

          </div>
        )}


        {/* ================= MANAGE ================= */}

        {activeTab === "manage" && (
          <div className="archive-manage-page">

            <div className="manage-header">

              <div>
                <h3>Archive Contents</h3>
                <p>
                  Open an archive to browse and manage its contents.
                </p>
              </div>

              <button
                className="archive-secondary-btn"
                onClick={() => console.log("Open archive")}
              >
                Open Archive
              </button>

            </div>


            <div className="archive-content-table">

              <div className="archive-table-header">

                <span>Name</span>
                <span>Type</span>
                <span>Size</span>
                <span>Modified</span>

              </div>


              <div className="archive-table-empty">

                <div>
                  ▱
                </div>

                <span>
                  No archive opened
                </span>

              </div>

            </div>


            <div className="archive-manage-actions">

              <button
                className="archive-secondary-btn"
              >
                ＋ Add Files
              </button>

              <button
                className="archive-secondary-btn"
              >
                − Remove
              </button>

              <button
                className="archive-secondary-btn"
              >
                Test Integrity
              </button>

            </div>

          </div>
        )}

      </div>


      {/* Footer */}
      {status && <div className="archive-status-msg" style={{ padding: "10px", margin: "10px", backgroundColor: "#e1f5fe", color: "#01579b", borderRadius: "4px" }}>ℹ️ {status}</div>}
      {error && <div className="archive-error-msg" style={{ padding: "10px", margin: "10px", backgroundColor: "#ffebee", color: "#c62828", borderRadius: "4px" }}>⚠️ {error}</div>}
      {loading && <div className="archive-loading-msg" style={{ padding: "10px", margin: "10px", color: "#666" }}>Processing archive, please wait...</div>}
      
      <div className="archive-footer">

        <div className="archive-footer-info">

          <span>
            Format:
          </span>

          <strong>
            {archiveFormat}
          </strong>

          <span className="footer-separator">
            •
          </span>

          <span>
            Compression:
          </span>

          <strong>
            {compressionLevel}
          </strong>

        </div>


        <div className="archive-footer-actions">

          <button
            className="archive-cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>

          {activeTab === "create" && (
            <button
              className="archive-primary-btn"
              onClick={handleCreateArchive}
            >
              Create Archive
            </button>
          )}

          {activeTab === "extract" && (
            <button
              className="archive-primary-btn"
              onClick={handleExtract}
            >
              Extract
            </button>
          )}

        </div>

      </div>

    </div>
  );
}

export default ArchiveManager;