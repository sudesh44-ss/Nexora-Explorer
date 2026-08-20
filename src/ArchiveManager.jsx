/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
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

  const [selectedItems, setSelectedItems] = useState([]);
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Extraction states
  const [extractPath, setExtractPath] = useState("");
  const [extractLocationMode, setExtractLocationMode] = useState("here"); // here, new-folder, custom
  const [customExtractDir, setCustomExtractDir] = useState("");
  const [extractPassword, setExtractPassword] = useState("");

  // Listing / Manage states
  const [manageArchivePath, setManageArchivePath] = useState("");
  const [manageArchiveFiles, setManageArchiveFiles] = useState([]);
  const [manageArchivePassword, setManageArchivePassword] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);

  // Supported format maps from backend
  const [supportedFormats, setSupportedFormats] = useState({
    ZIP: { create: true, extract: true, encrypt: false },
    "7Z": { create: false, extract: false, encrypt: false },
    TAR: { create: true, extract: true, encrypt: false },
    GZ: { create: true, extract: true, encrypt: false },
    "TAR.GZ": { create: true, extract: true, encrypt: false },
    RAR: { create: false, extract: false, encrypt: false }
  });

  // Progress tracking
  const [operationProgress, setOperationProgress] = useState(0);

  const archiveFormats = ["ZIP", "7Z", "TAR", "GZ", "TAR.GZ", "RAR"];
  const compressionLevels = [
    "Store / No Compression",
    "Fast",
    "Normal",
    "High",
    "Maximum",
  ];

  // Helper to format file sizes
  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return "—";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const loadSupportedFormats = async () => {
    const res = await window.electronFeatures.archiveGetSupportedFormats();
    if (res.success && res.formats) {
      setSupportedFormats(res.formats);
    }
  };

  useEffect(() => {
    loadSupportedFormats();

    // Subscribe to progress events
    const unsub = window.electronFeatures.onArchiveProgress((data) => {
      setOperationProgress(data.progress);
    });

    return () => {
      unsub();
    };
  }, []);

  const handleListArchive = async (filePath = manageArchivePath, pwd = manageArchivePassword) => {
    if (!filePath) return;
    setLoading(true);
    setStatus("Reading archive directory tree...");
    setError("");
    setPasswordRequired(false);

    try {
      const res = await window.electronFeatures.archiveList(filePath, pwd);
      if (res && res.success) {
        setManageArchiveFiles(res.files || []);
        setStatus(`Archive directory parsed. Found ${res.files?.length || 0} entries.`);
      } else {
        if (res.error === "Password Required") {
          setPasswordRequired(true);
          setError("This archive is password-protected. Please enter password.");
        } else {
          setError(res.error || "Failed to list archive contents.");
        }
        setManageArchiveFiles([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update selection on prop change
  useEffect(() => {
    if (selectedItem) {
      // selectedItem can be string path
      setSelectedItems([selectedItem]);
      
      const parts = selectedItem.split("\\");
      const name = parts[parts.length - 1];
      const isArchive = name.toLowerCase().endsWith(".zip") ||
                        name.toLowerCase().endsWith(".7z") ||
                        name.toLowerCase().endsWith(".rar") ||
                        name.toLowerCase().endsWith(".tar") ||
                        name.toLowerCase().endsWith(".gz") ||
                        name.toLowerCase().endsWith(".tar.gz");

      if (isArchive) {
        setExtractPath(selectedItem);
        setManageArchivePath(selectedItem);
        // Automatically list contents
        handleListArchive(selectedItem);
      }

      // Default archive create name
      const cleanName = name.replace(/\.[^/.]+$/, ""); // strip extension
      setArchiveName(cleanName + ".zip");
      const dir = selectedItem.substring(0, selectedItem.lastIndexOf("\\"));
      setDestination(dir || "C:\\");
    } else {
      setSelectedItems([]);
      const dir = currentPath && !currentPath.startsWith("tool:") ? currentPath : "C:\\";
      setArchiveName("archive.zip");
      setDestination(dir);
    }
  }, [selectedItem, currentPath]);

  // Adjust output extension based on format
  useEffect(() => {
    if (!archiveName) return;
    const cleanName = archiveName.replace(/\.(zip|7z|tar|gz|rar|tar\.gz)$/i, "");
    let ext = ".zip";
    if (archiveFormat === "7Z") ext = ".7z";
    else if (archiveFormat === "TAR") ext = ".tar";
    else if (archiveFormat === "GZ") ext = ".gz";
    else if (archiveFormat === "TAR.GZ") ext = ".tar.gz";
    else if (archiveFormat === "RAR") ext = ".rar";

    setArchiveName(cleanName + ext);
  }, [archiveFormat]);

  // ----------------------------------------------------------
  // Selection Selectors
  // ----------------------------------------------------------
  const handleAddFile = async () => {
    const res = await window.electronFeatures.chooseFile();
    if (res.success && !res.canceled && res.path) {
      setSelectedItems(prev => [...new Set([...prev, res.path])]);
    }
  };

  const handleAddFolder = async () => {
    const res = await window.electronFeatures.chooseFolder();
    if (res.success && !res.canceled && res.path) {
      setSelectedItems(prev => [...new Set([...prev, res.path])]);
    }
  };

  const handleRemoveItem = (index) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectDestination = async () => {
    const res = await window.electronFeatures.chooseFolder();
    if (res.success && !res.canceled && res.path) {
      setDestination(res.path);
    }
  };

  // ----------------------------------------------------------
  // 1. Create Archive
  // ----------------------------------------------------------
  const handleCreateArchive = async () => {
    if (selectedItems.length === 0) {
      setError("Please select files or folders to compress.");
      return;
    }
    if (!archiveName.trim()) {
      setError("Please enter a name for the archive.");
      return;
    }
    if (passwordEnabled && !password) {
      setError("Please enter an archive password.");
      return;
    }
    if (passwordEnabled && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Verify format capabilities
    const formatInfo = supportedFormats[archiveFormat];
    if (!formatInfo.create) {
      setError(`Format ${archiveFormat} creation is unsupported. Check if the required utility (e.g. 7-Zip/WinRAR) is installed.`);
      return;
    }

    setLoading(true);
    setStatus(`Compressing items into ${archiveFormat} archive...`);
    setError("");
    setOperationProgress(0);

    const destPath = destination + "\\" + archiveName;

    try {
      const res = await window.electronFeatures.archiveCreate(selectedItems, destPath, archiveFormat, {
        password: passwordEnabled ? password : "",
        compressionLevel
      });

      if (res && res.success) {
        setStatus(`Archive created successfully at: ${destPath}`);
        setPassword("");
        setConfirmPassword("");
      } else {
        setError(res?.error || "Compression operation failed.");
      }
    } catch (err) {
      setError(err.message || "Archive creation failed.");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------
  // 2. Extract Archive
  // ----------------------------------------------------------
  const handleSelectExtractArchive = async () => {
    const res = await window.electronFeatures.chooseFile();
    if (res.success && !res.canceled && res.path) {
      setExtractPath(res.path);
    }
  };

  const handleSelectCustomExtractDir = async () => {
    const res = await window.electronFeatures.chooseFolder();
    if (res.success && !res.canceled && res.path) {
      setCustomExtractDir(res.path);
    }
  };

  const handleExtract = async () => {
    if (!extractPath) {
      setError("Please select an archive file to extract.");
      return;
    }

    const ext = extractPath.includes(".") ? extractPath.slice(extractPath.lastIndexOf(".")).toLowerCase() : "";
    const cleanExt = ext === ".gz" && extractPath.toLowerCase().endsWith(".tar.gz") ? ".tar.gz" : ext;
    
    // Check format compatibility
    let formatKey = "ZIP";
    if (cleanExt === ".7z") formatKey = "7Z";
    else if (cleanExt === ".tar") formatKey = "TAR";
    else if (cleanExt === ".gz") formatKey = "GZ";
    else if (cleanExt === ".tar.gz") formatKey = "TAR.GZ";
    else if (cleanExt === ".rar") formatKey = "RAR";

    const formatInfo = supportedFormats[formatKey];
    if (!formatInfo || !formatInfo.extract) {
      setError(`Extraction of format ${formatKey} is currently unavailable. Install the appropriate extractor (e.g. 7-Zip).`);
      return;
    }

    // Determine target location
    let targetDir;
    const parentDir = extractPath.substring(0, extractPath.lastIndexOf("\\")) || "C:\\";
    const archiveBaseName = extractPath.split(/[/\\]/).pop().replace(/\.[^/.]+$/, ""); // strip extension

    if (extractLocationMode === "here") {
      targetDir = parentDir;
    } else if (extractLocationMode === "new-folder") {
      targetDir = parentDir + "\\" + archiveBaseName;
    } else {
      if (!customExtractDir) {
        setError("Please choose a custom extraction folder.");
        return;
      }
      targetDir = customExtractDir;
    }

    setLoading(true);
    setStatus("Extracting files from archive...");
    setError("");
    setOperationProgress(0);

    try {
      const res = await window.electronFeatures.archiveExtract(extractPath, targetDir, {
        password: extractPassword
      });

      if (res && res.success) {
        setStatus(`Extraction completed successfully to:\n${targetDir}`);
        setExtractPassword("");
      } else {
        setError(res?.error || "Extraction failed. If encrypted, verify you entered the correct password.");
      }
    } catch (err) {
      setError(err.message || "Archive extraction failed.");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------
  // 3. Direct Listing
  // ----------------------------------------------------------
  const handleSelectManageArchive = async () => {
    const res = await window.electronFeatures.chooseFile();
    if (res.success && !res.canceled && res.path) {
      setManageArchivePath(res.path);
      handleListArchive(res.path);
    }
  };

  // ----------------------------------------------------------
  // 4. Test Archive
  // ----------------------------------------------------------
  const handleTestArchive = () => {
    const target = manageArchivePath || extractPath;
    if (!target) {
      alert("Please select or open an archive to test first.");
      return;
    }

    setLoading(true);
    setStatus("Running integrity validation...");
    setError("");

    window.electronFeatures.archiveTest(target)
      .then((res) => {
        if (res.valid) {
          alert("✓ Archive Valid: No corruption or CRC errors detected!");
        } else {
          alert(`❌ Validation Failed: ${res.error}`);
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="archive-manager">

      {/* Header */}
      <div className="archive-header">
        <div className="archive-title-section">
          <div className="archive-icon">▱</div>
          <div>
            <h2>Archive Manager</h2>
            <p>Create, extract and browse compressed formats (ZIP, 7Z, TAR, GZ, RAR)</p>
          </div>
        </div>

        <button className="archive-close-btn" onClick={onClose}>×</button>
      </div>

      {/* Tabs */}
      <div className="archive-tabs">
        <button
          className={activeTab === "create" ? "archive-tab active" : "archive-tab"}
          onClick={() => setActiveTab("create")}
        >
          <span>＋</span>
          Create Archive
        </button>

        <button
          className={activeTab === "extract" ? "archive-tab active" : "archive-tab"}
          onClick={() => setActiveTab("extract")}
        >
          <span>↗</span>
          Extract
        </button>

        <button
          className={activeTab === "manage" ? "archive-tab active" : "archive-tab"}
          onClick={() => setActiveTab("manage")}
        >
          <span>▤</span>
          Browse Archive
        </button>
      </div>

      {/* Main Body */}
      <div className="archive-body">

        {/* ================= CREATE TAB ================= */}
        {activeTab === "create" && (
          <div className="archive-create-layout">

            {/* Left inputs */}
            <div className="archive-create-main">
              <div className="archive-section">
                <div className="archive-section-title">Add Items to Compress</div>
                
                <div className="archive-drop-zone" style={{ padding: "15px" }}>
                  <div className="archive-select-buttons" style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                    <button className="archive-secondary-btn" onClick={handleAddFile}>
                      + Add File
                    </button>
                    <button className="archive-secondary-btn" onClick={handleAddFolder}>
                      + Add Folder
                    </button>
                  </div>
                </div>
              </div>

              {/* Selected Files/Folders List */}
              <div className="archive-section">
                <div className="archive-section-header">
                  <div className="archive-section-title">Queue list</div>
                  <span className="archive-item-count">{selectedItems.length} items</span>
                </div>

                <div className="archive-items-list" style={{ maxHeight: "120px", overflowY: "auto", border: "1px solid #e5e7eb", padding: "5px" }}>
                  {selectedItems.length === 0 ? (
                    <div className="archive-items-empty">No files or folders selected.</div>
                  ) : (
                    selectedItems.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "3px 0", borderBottom: "1px solid #f3f4f6" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item}>{item}</span>
                        <button className="security-small-btn" style={{ padding: "1px 4px", fontSize: "9px" }} onClick={() => handleRemoveItem(idx)}>
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Configuration */}
              <div className="archive-section">
                <div className="archive-section-title">Archive Info</div>
                <div className="archive-form-grid">
                  <div className="archive-form-group">
                    <label>Archive Name</label>
                    <input
                      type="text"
                      value={archiveName}
                      onChange={(e) => setArchiveName(e.target.value)}
                    />
                  </div>

                  <div className="archive-form-group">
                    <label>Format</label>
                    <select value={archiveFormat} onChange={(e) => setArchiveFormat(e.target.value)}>
                      {archiveFormats.map((f) => (
                        <option key={f} value={f} disabled={f !== "ZIP" && f !== "TAR" && f !== "GZ" && f !== "TAR.GZ" && !supportedFormats[f]?.create}>
                          {f} {!supportedFormats[f]?.create && (f === "7Z" || f === "RAR") ? " (Not installed)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="archive-form-group full">
                    <label>Destination Location</label>
                    <div className="archive-destination">
                      <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                      />
                      <button onClick={handleSelectDestination}>Browse</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Compression and Security Settings */}
            <div className="archive-settings">
              <div className="archive-settings-title">Options</div>
              <div className="archive-form-group">
                <label>Compression Level</label>
                <select value={compressionLevel} onChange={(e) => setCompressionLevel(e.target.value)}>
                  {compressionLevels.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>

              <div className="archive-settings-divider" />
              <div className="archive-settings-title">Security (Encryption)</div>
              
              <label className="archive-checkbox">
                <input
                  type="checkbox"
                  checked={passwordEnabled}
                  onChange={(e) => setPasswordEnabled(e.target.checked)}
                  disabled={!supportedFormats[archiveFormat]?.encrypt}
                />
                <span>Password-protect archive</span>
              </label>

              {!supportedFormats[archiveFormat]?.encrypt && (
                <div style={{ fontSize: "10px", color: "#dc2626", marginTop: "3px" }}>
                  ⚠️ Encryption is unavailable for format {archiveFormat}. (For ZIP/7Z, ensure 7-Zip is installed).
                </div>
              )}

              {passwordEnabled && supportedFormats[archiveFormat]?.encrypt && (
                <div className="password-fields">
                  <div className="archive-form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                  </div>
                  <div className="archive-form-group">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================= EXTRACT TAB ================= */}
        {activeTab === "extract" && (
          <div className="archive-create-layout" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr" }}>
            <div className="archive-create-main">
              <div className="archive-section">
                <div className="archive-section-title">Select Source Archive</div>
                <div className="archive-destination">
                  <input
                    type="text"
                    value={extractPath}
                    onChange={(e) => setExtractPath(e.target.value)}
                    placeholder="Select compressed archive file..."
                  />
                  <button onClick={handleSelectExtractArchive}>Browse</button>
                </div>
              </div>

              <div className="archive-section">
                <div className="archive-section-title">Destination Options</div>
                <div className="extract-options" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label className="archive-radio">
                    <input
                      type="radio"
                      name="extract-location"
                      checked={extractLocationMode === "here"}
                      onChange={() => setExtractLocationMode("here")}
                    />
                    <span>Extract into the parent folder (Here)</span>
                  </label>

                  <label className="archive-radio">
                    <input
                      type="radio"
                      name="extract-location"
                      checked={extractLocationMode === "new-folder"}
                      onChange={() => setExtractLocationMode("new-folder")}
                    />
                    <span>Extract into a new subfolder (named after archive)</span>
                  </label>

                  <label className="archive-radio">
                    <input
                      type="radio"
                      name="extract-location"
                      checked={extractLocationMode === "custom"}
                      onChange={() => setExtractLocationMode("custom")}
                    />
                    <span>Choose custom destination directory</span>
                  </label>
                </div>

                {extractLocationMode === "custom" && (
                  <div className="archive-destination" style={{ marginTop: "12px" }}>
                    <input
                      type="text"
                      value={customExtractDir}
                      onChange={(e) => setCustomExtractDir(e.target.value)}
                      placeholder="Choose extract folder..."
                    />
                    <button onClick={handleSelectCustomExtractDir}>Select Folder</button>
                  </div>
                )}
              </div>
            </div>

            <div className="archive-settings">
              <div className="archive-settings-title">Decryption</div>
              <div className="archive-form-group">
                <label>Password (If encrypted)</label>
                <input
                  type="password"
                  value={extractPassword}
                  onChange={(e) => setExtractPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= BROWSE TAB ================= */}
        {activeTab === "manage" && (
          <div className="archive-manage-page">
            <div className="manage-header" style={{ display: "flex", gap: "15px", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div className="archive-destination">
                  <input
                    type="text"
                    value={manageArchivePath}
                    onChange={(e) => setManageArchivePath(e.target.value)}
                    placeholder="Select archive to inspect..."
                  />
                  <button onClick={handleSelectManageArchive}>Open Archive</button>
                </div>
              </div>

              {passwordRequired && (
                <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={manageArchivePassword}
                    onChange={(e) => setManageArchivePassword(e.target.value)}
                    style={{ fontSize: "11px", padding: "4px" }}
                  />
                  <button className="security-primary-btn" style={{ padding: "4px" }} onClick={() => handleListArchive(manageArchivePath, manageArchivePassword)}>
                    Submit
                  </button>
                </div>
              )}
            </div>

            <div className="archive-content-table" style={{ maxHeight: "200px", overflowY: "auto" }}>
              <div className="archive-table-header" style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1.5fr", fontWeight: "bold", borderBottom: "1px solid #e5e7eb", padding: "6px" }}>
                <span>Item Name</span>
                <span>Type</span>
                <span>Uncompressed Size</span>
              </div>

              {manageArchiveFiles.length === 0 ? (
                <div className="archive-table-empty">
                  <span>No archive opened, or password incorrect.</span>
                </div>
              ) : (
                manageArchiveFiles.map((file, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1.5fr", padding: "5px 6px", borderBottom: "1px solid #f3f4f6", fontSize: "11px" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.path}>
                      {file.type === "Folder" ? "📁" : "📄"} {file.path}
                    </span>
                    <span>{file.type}</span>
                    <strong>{formatBytes(file.size)}</strong>
                  </div>
                ))
              )}
            </div>

            <div className="archive-manage-actions" style={{ marginTop: "10px" }}>
              <button className="archive-secondary-btn" onClick={handleTestArchive} disabled={!manageArchivePath}>
                Test Integrity
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Progress feedback */}
      {loading && operationProgress > 0 && (
        <div style={{ padding: "5px 15px", backgroundColor: "#f9fafb", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
            <span>Progress</span>
            <span>{operationProgress}%</span>
          </div>
          <div className="ocr-progress-track" style={{ height: "6px" }}>
            <div className="ocr-progress-value" style={{ width: `${operationProgress}%` }} />
          </div>
        </div>
      )}

      {/* Statuses */}
      {status && <div className="archive-status-msg" style={{ padding: "8px 12px", margin: "5px 10px", backgroundColor: "#f0fdf4", color: "#166534", fontSize: "11px", borderRadius: "4px" }}>✓ {status}</div>}
      {error && <div className="archive-error-msg" style={{ padding: "8px 12px", margin: "5px 10px", backgroundColor: "#fef2f2", color: "#991b1b", fontSize: "11px", borderRadius: "4px" }}>⚠️ {error}</div>}
      {loading && <div className="archive-loading-msg" style={{ padding: "8px 12px", margin: "5px 10px", color: "#6b7280", fontSize: "11px" }}>Working, please wait...</div>}

      {/* Footer */}
      <div className="archive-footer">
        <div className="archive-footer-info">
          <span>Format:</span>
          <strong>{archiveFormat}</strong>
          <span className="footer-separator">•</span>
          <span>Compression:</span>
          <strong>{compressionLevel}</strong>
        </div>

        <div className="archive-footer-actions">
          <button className="archive-cancel-btn" onClick={onClose}>
            Close
          </button>

          {activeTab === "create" && (
            <button className="archive-primary-btn" onClick={handleCreateArchive} disabled={loading}>
              Create Archive
            </button>
          )}

          {activeTab === "extract" && (
            <button className="archive-primary-btn" onClick={handleExtract} disabled={loading}>
              Extract Archive
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

export default ArchiveManager;