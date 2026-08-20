/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import "./CloudIntegration.css";

function CloudIntegration({ onClose }) {
  const [activeTab, setActiveTab] = useState("providers");
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  
  // Connection Form modal states
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [formProviderId, setFormProviderId] = useState("");
  const [s3Config, setS3Config] = useState({
    accessKey: "",
    secretKey: "",
    bucket: "",
    region: "us-east-1",
    endpoint: ""
  });
  const [nasConfig, setNasConfig] = useState({
    path: ""
  });

  // Active files states
  const [currentProvider, setCurrentProvider] = useState("google");
  const [remotePath, setRemotePath] = useState("");
  const [cloudFiles, setCloudFiles] = useState([]);

  // Sync Engine states
  const [syncJobs] = useState({
    google: { localPath: "C:\\Users\\Public\\GoogleDriveSync", syncMode: "two-way", progress: 0, statusText: "Ready" },
    onedrive: { localPath: "C:\\Users\\Public\\OneDriveSync", syncMode: "two-way", progress: 0, statusText: "Ready" },
    dropbox: { localPath: "C:\\Users\\Public\\DropboxSync", syncMode: "two-way", progress: 0, statusText: "Ready" },
    s3: { localPath: "C:\\Users\\Public\\S3Sync", syncMode: "one-way", progress: 0, statusText: "Ready" },
    "s3-compatible": { localPath: "C:\\Users\\Public\\S3CompSync", syncMode: "one-way", progress: 0, statusText: "Ready" },
    nas: { localPath: "C:\\Users\\Public\\NasSync", syncMode: "two-way", progress: 0, statusText: "Ready" }
  });
  const [activeSyncingJob, setActiveSyncingJob] = useState(null);
  const [syncProgress, setSyncProgress] = useState({ progress: 0, filesProcessed: 0, totalFiles: 0, statusText: "" });

  // Conflict states
  const [conflicts, setConflicts] = useState([]);
  const [showConflictCompare, setShowConflictCompare] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState(null);

  // Offline cache states
  const [offlineFiles, setOfflineFiles] = useState([]);

  // Notification overlays
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper: Format bytes
  const formatBytes = (bytes) => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return "—";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const loadProviders = async () => {
    try {
      const list = await window.electronFeatures.cloudGetProviders();
      setProviders(list || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadOfflineFiles = async () => {
    try {
      const list = await window.electronFeatures.cloudGetOfflineFiles();
      setOfflineFiles(list || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadConflicts = async () => {
    try {
      const list = await window.electronFeatures.cloudGetConflicts();
      setConflicts(list || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadProviders();
    loadOfflineFiles();
    loadConflicts();

    // Subscribe to sync progress callbacks
    const unsubProgress = window.electronFeatures.onCloudSyncProgress((data) => {
      setSyncProgress(data);
    });

    const unsubComplete = window.electronFeatures.onCloudSyncComplete(() => {
      setStatus("Sync cycle completed successfully!");
      setLoading(false);
      setActiveSyncingJob(null);
      loadConflicts();
      loadProviders();
    });

    const unsubFailed = (data) => {
      setError(`Sync failed: ${data.error}`);
      setLoading(false);
      setActiveSyncingJob(null);
    };
    const unsubFailedReg = window.electronFeatures.onCloudSyncFailed(unsubFailed);

    return () => {
      unsubProgress();
      unsubComplete();
      unsubFailedReg();
    };
  }, []);

  // ----------------------------------------------------------
  // File operations
  // ----------------------------------------------------------
  const handleListFiles = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await window.electronFeatures.cloudList(currentProvider, remotePath);
      if (res.success) {
        setCloudFiles(res.files || []);
      } else {
        setError(res.error || `Failed to list files. Check if ${currentProvider} is connected.`);
        setCloudFiles([]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Reload file browser when tab changes to "files" or provider changes
  useEffect(() => {
    if (activeTab === "files" && currentProvider) {
      handleListFiles();
    }
  }, [activeTab, currentProvider, remotePath]);

  // ----------------------------------------------------------
  // Connect / Disconnect operations
  // ----------------------------------------------------------
  const handleConnectProvider = (providerId) => {
    setFormProviderId(providerId);
    if (providerId === "s3" || providerId === "s3-compatible") {
      setShowConnectForm(true);
    } else if (providerId === "nas") {
      setShowConnectForm(true);
    } else {
      // Google / OneDrive / Dropbox (OAuth callback window)
      setLoading(true);
      setStatus(`Connecting to ${providerId} (opening browser callback)...`);
      window.electronFeatures.cloudConnect(providerId, {})
        .then((res) => {
          if (res.success) {
            setStatus(`${providerId} connected successfully!`);
            loadProviders();
          } else {
            setError(res.error || `Failed to authenticate ${providerId}.`);
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  };

  const handleSubmitConnectForm = async () => {
    setLoading(true);
    setError("");
    try {
      let res;
      if (formProviderId === "nas") {
        res = await window.electronFeatures.cloudConnect(formProviderId, nasConfig);
      } else {
        res = await window.electronFeatures.cloudConnect(formProviderId, s3Config);
      }

      if (res && res.success) {
        setStatus(`${formProviderId} configured and connected!`);
        setShowConnectForm(false);
        loadProviders();
      } else {
        setError(res.error || "Connection failed.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectProvider = async (providerId) => {
    if (!confirm(`Are you sure you want to disconnect ${providerId}?`)) return;
    setLoading(true);
    try {
      const res = await window.electronFeatures.cloudDisconnect(providerId);
      if (res.success) {
        setStatus(`${providerId} disconnected.`);
        loadProviders();
        setCloudFiles([]);
      } else {
        setError(res.error || "Failed to disconnect.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    const res = await window.electronFeatures.chooseFile();
    if (res.success && !res.canceled && res.path) {
      setLoading(true);
      setStatus(`Uploading file to ${currentProvider}...`);
      try {
        const filename = res.path.split(/[/\\]/).pop();
        const dest = remotePath ? `${remotePath}/${filename}` : filename;
        const uploadRes = await window.electronFeatures.cloudUpload(currentProvider, res.path, dest);
        if (uploadRes.success) {
          setStatus("Upload completed successfully!");
          handleListFiles();
        } else {
          setError(uploadRes.error || "Upload failed.");
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDownload = async (file) => {
    const res = await window.electronFeatures.chooseFolder();
    if (res.success && !res.canceled && res.path) {
      setLoading(true);
      setStatus(`Downloading file from ${currentProvider}...`);
      try {
        const dest = res.path + "\\" + file.name;
        const downloadRes = await window.electronFeatures.cloudDownload(currentProvider, file.relativePath || file.path, dest);
        if (downloadRes.success) {
          setStatus(`Download saved to: ${dest}`);
        } else {
          setError(downloadRes.error || "Download failed.");
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDelete = async (file) => {
    if (!confirm(`Are you sure you want to delete ${file.name} permanently from the cloud?`)) return;
    setLoading(true);
    try {
      const res = await window.electronFeatures.cloudDelete(currentProvider, file.relativePath || file.path);
      if (res.success) {
        setStatus("Item deleted successfully.");
        handleListFiles();
      } else {
        setError(res.error || "Deletion failed.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (file) => {
    const newName = prompt(`Rename ${file.name} to:`, file.name);
    if (!newName || newName === file.name) return;
    setLoading(true);
    try {
      const res = await window.electronFeatures.cloudRename(currentProvider, file.relativePath || file.path, newName);
      if (res.success) {
        setStatus("Rename succeeded.");
        handleListFiles();
      } else {
        setError(res.error || "Rename failed.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;
    setLoading(true);
    try {
      const res = await window.electronFeatures.cloudCreateFolder(currentProvider, remotePath, folderName);
      if (res.success) {
        setStatus("Folder created.");
        handleListFiles();
      } else {
        setError(res.error || "Failed to create folder.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder) => {
    const cleanPath = folder.relativePath || folder.path;
    setRemotePath(cleanPath.startsWith("/") ? cleanPath.slice(1) : cleanPath);
  };

  const handleNavigateUp = () => {
    if (!remotePath) return;
    const parts = remotePath.split("/");
    parts.pop();
    setRemotePath(parts.join("/"));
  };

  // ----------------------------------------------------------
  // Offline caching
  // ----------------------------------------------------------
  const handleToggleOffline = async (file) => {
    const isOffline = offlineFiles.some(f => f.path === file.relativePath && f.provider === currentProvider);
    setLoading(true);
    try {
      if (isOffline) {
        await window.electronFeatures.cloudRemoveOffline(currentProvider, file.relativePath || file.path);
        setStatus("Removed from offline availability cache.");
      } else {
        await window.electronFeatures.cloudMarkOffline(currentProvider, file.relativePath || file.path);
        setStatus("Saved to local offline availability cache.");
      }
      loadOfflineFiles();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------------
  // Sync routines
  // ----------------------------------------------------------
  const handleStartSync = async (jobId) => {
    setLoading(true);
    setActiveSyncingJob(jobId);
    setStatus(`Executing sync cycle for ${jobId}...`);
    try {
      // Standard local job configuration map in backend
      await window.electronFeatures.cloudSync(jobId);
    } catch (e) {
      setError(e.message);
      setLoading(false);
      setActiveSyncingJob(null);
    }
  };

  // ----------------------------------------------------------
  // Conflict resolution
  // ----------------------------------------------------------
  const handleResolveConflict = async (conflict, resolution) => {
    setLoading(true);
    try {
      const res = await window.electronFeatures.cloudResolveConflict(conflict.jobId, conflict.relativePath, resolution);
      if (res.success) {
        setStatus(`Conflict resolved with resolution: ${resolution}`);
        loadConflicts();
      } else {
        setError(res.error || "Conflict resolution failed.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cloud-integration">

      {/* Header */}
      <div className="cloud-header">
        <div className="cloud-title-section">
          <div className="cloud-main-icon">☁</div>
          <div>
            <h2>Cloud Storage Manager</h2>
            <p>Manage real accounts, synchronizations, offline file structures, and credentials</p>
          </div>
        </div>

        <button className="cloud-close-btn" onClick={onClose}>×</button>
      </div>

      {/* Tabs */}
      <div className="cloud-navigation">
        <button
          className={activeTab === "providers" ? "cloud-nav-item active" : "cloud-nav-item"}
          onClick={() => setActiveTab("providers")}
        >
          ☁ Providers
        </button>
        <button
          className={activeTab === "files" ? "cloud-nav-item active" : "cloud-nav-item"}
          onClick={() => setActiveTab("files")}
        >
          ▦ Files
        </button>
        <button
          className={activeTab === "sync" ? "cloud-nav-item active" : "cloud-nav-item"}
          onClick={() => setActiveTab("sync")}
        >
          ↻ Sync
        </button>
        <button
          className={activeTab === "offline" ? "cloud-nav-item active" : "cloud-nav-item"}
          onClick={() => setActiveTab("offline")}
        >
          ◉ Offline Cache
        </button>
        <button
          className={activeTab === "conflicts" ? "cloud-nav-item active" : "cloud-nav-item"}
          onClick={() => { setActiveTab("conflicts"); loadConflicts(); }}
        >
          ⚠ Conflicts ({conflicts.length})
        </button>
        <button
          className={activeTab === "security" ? "cloud-nav-item active" : "cloud-nav-item"}
          onClick={() => setActiveTab("security")}
        >
          🔐 Security
        </button>
      </div>

      {/* Body */}
      <div className="cloud-body">

        {/* ================= A. PROVIDERS ================= */}
        {activeTab === "providers" && (
          <div className="cloud-page">
            <div className="cloud-page-header">
              <div>
                <h3>Storage Providers</h3>
                <p>Verify connection status and secure links to cloud files.</p>
              </div>
            </div>

            <div className="cloud-provider-grid">
              {providers.map((p) => (
                <div className={`cloud-provider-card ${selectedProvider === p.id ? "selected" : ""}`} key={p.id} onClick={() => setSelectedProvider(p.id)}>
                  <div className="cloud-provider-top">
                    <div className="cloud-provider-icon">{p.name[0]}</div>
                    <div className={p.status === "Connected" ? "cloud-connected" : "cloud-disconnected"}>
                      <span></span>
                      {p.status}
                    </div>
                  </div>
                  <strong>{p.name}</strong>
                  <p>{p.status === "Connected" ? "Storage adapter online and verified." : "Requires authentication keys."}</p>
                  
                  <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                    {p.status !== "Connected" ? (
                      <button className="cloud-primary-btn" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleConnectProvider(p.id)}>
                        Connect
                      </button>
                    ) : (
                      <>
                        <button className="cloud-secondary-btn" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => { setCurrentProvider(p.id); setRemotePath(""); setActiveTab("files"); }}>
                          Browse Files
                        </button>
                        <button className="cloud-danger-btn" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={() => handleDisconnectProvider(p.id)}>
                          Disconnect
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Config Forms Modal Overlay */}
            {showConnectForm && (
              <div className="security-alert-overlay" style={{ display: "flex" }}>
                <div className="security-alert-box" style={{ maxWidth: "450px" }}>
                  <h3>Configure {formProviderId.toUpperCase()} Settings</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "15px 0", textAlign: "left" }}>
                    {formProviderId === "nas" ? (
                      <div>
                        <label style={{ fontSize: "11px", display: "block", marginBottom: "4px" }}>Local or Network (UNC) Path</label>
                        <input
                          type="text"
                          value={nasConfig.path}
                          onChange={(e) => setNasConfig({ path: e.target.value })}
                          placeholder="e.g. \\192.168.1.50\PublicShare"
                          style={{ width: "100%", padding: "5px", fontSize: "12px" }}
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <label style={{ fontSize: "11px", display: "block", marginBottom: "2px" }}>Access Key ID</label>
                          <input
                            type="text"
                            value={s3Config.accessKey}
                            onChange={(e) => setS3Config({ ...s3Config, accessKey: e.target.value })}
                            placeholder="AWS Access Key"
                            style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "11px", display: "block", marginBottom: "2px" }}>Secret Access Key</label>
                          <input
                            type="password"
                            value={s3Config.secretKey}
                            onChange={(e) => setS3Config({ ...s3Config, secretKey: e.target.value })}
                            placeholder="AWS Secret Key"
                            style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "11px", display: "block", marginBottom: "2px" }}>Bucket Name</label>
                          <input
                            type="text"
                            value={s3Config.bucket}
                            onChange={(e) => setS3Config({ ...s3Config, bucket: e.target.value })}
                            placeholder="my-bucket-name"
                            style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: "11px", display: "block", marginBottom: "2px" }}>Region</label>
                          <input
                            type="text"
                            value={s3Config.region}
                            onChange={(e) => setS3Config({ ...s3Config, region: e.target.value })}
                            placeholder="us-east-1"
                            style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                          />
                        </div>
                        {formProviderId === "s3-compatible" && (
                          <div>
                            <label style={{ fontSize: "11px", display: "block", marginBottom: "2px" }}>Endpoint URL</label>
                            <input
                              type="text"
                              value={s3Config.endpoint}
                              onChange={(e) => setS3Config({ ...s3Config, endpoint: e.target.value })}
                              placeholder="https://minio.local:9000"
                              style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="security-alert-buttons">
                    <button className="security-secondary-btn" onClick={() => setShowConnectForm(false)}>Cancel</button>
                    <button className="security-primary-btn" onClick={handleSubmitConnectForm}>Connect</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= B. FILES ================= */}
        {activeTab === "files" && (
          <div className="cloud-page">
            <div className="cloud-page-header">
              <div>
                <h3>File Explorer</h3>
                <p>Browse directories, upload files, copy schemas, and toggle offline states.</p>
              </div>
              <select className="cloud-select" value={currentProvider} onChange={(e) => { setCurrentProvider(e.target.value); setRemotePath(""); }}>
                {providers.filter(p => p.status === "Connected").map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="cloud-breadcrumb" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button className="security-small-btn" onClick={handleNavigateUp} disabled={!remotePath}>
                ↰ Up
              </button>
              <span>{currentProvider.toUpperCase()}</span>
              <span>/</span>
              <strong>{remotePath || "root"}</strong>
            </div>

            <div className="cloud-file-table" style={{ maxHeight: "250px", overflowY: "auto" }}>
              <div className="cloud-table-header" style={{ display: "grid", gridTemplateColumns: "3fr 1.5fr 1fr 1.5fr 1.5fr" }}>
                <span>Name</span>
                <span>Type</span>
                <span>Size</span>
                <span>Availability</span>
                <span>Actions</span>
              </div>

              {cloudFiles.length === 0 ? (
                <div className="cloud-table-empty">Directory is empty or provider is unauthorized.</div>
              ) : (
                cloudFiles.map((file) => {
                  const isCached = offlineFiles.some(f => f.path === file.relativePath && f.provider === currentProvider);
                  return (
                    <div className="cloud-file-row" key={file.name} style={{ display: "grid", gridTemplateColumns: "3fr 1.5fr 1fr 1.5fr 1.5fr", fontSize: "11px", padding: "6px" }}>
                      <div className="cloud-file-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.type === "Folder" ? (
                          <span style={{ cursor: "pointer", color: "#0284c7" }} onClick={() => handleFolderClick(file)}>
                            📁 {file.name}
                          </span>
                        ) : (
                          <span>📄 {file.name}</span>
                        )}
                      </div>
                      <span>{file.type}</span>
                      <span>{file.type === "Folder" ? "—" : formatBytes(file.size)}</span>
                      <span>{isCached ? "🟢 Offline" : "☁ Cloud-Only"}</span>
                      <div className="cloud-file-actions" style={{ display: "flex", gap: "4px" }}>
                        {file.type !== "Folder" && (
                          <>
                            <button className="security-small-btn" title="Download" onClick={() => handleDownload(file)}>↓</button>
                            <button className="security-small-btn" title="Toggle Offline Availability" onClick={() => handleToggleOffline(file)}>
                              {isCached ? "Remove Cache" : "Make Offline"}
                            </button>
                          </>
                        )}
                        <button className="security-small-btn" onClick={() => handleRename(file)}>✏️</button>
                        <button className="security-small-btn" style={{ color: "#c62828" }} onClick={() => handleDelete(file)}>×</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="cloud-operation-bar" style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button className="cloud-primary-btn" onClick={handleUpload}>↑ Upload File</button>
              <button className="cloud-secondary-btn" onClick={handleCreateFolder}>+ New Folder</button>
              <button className="cloud-secondary-btn" onClick={handleListFiles}>↻ Refresh</button>
            </div>
          </div>
        )}

        {/* ================= C. SYNC ================= */}
        {activeTab === "sync" && (
          <div className="cloud-page">
            <div className="cloud-page-header">
              <div>
                <h3>Synchronizations</h3>
                <p>Run synchronized processes, configure modes, and track file transfer speeds.</p>
              </div>
            </div>

            <div className="cloud-sync-card">
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.keys(syncJobs).map((jobId) => {
                  const job = syncJobs[jobId];
                  const providerConnected = providers.some(p => p.id === jobId && p.status === "Connected");
                  const isSyncing = activeSyncingJob === jobId;

                  return (
                    <div key={jobId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}>
                      <div>
                        <strong>{jobId.toUpperCase()} Job</strong>
                        <div style={{ fontSize: "10px", color: "#6b7280" }}>Local: {job.localPath}</div>
                        <div style={{ fontSize: "10px", color: "#0284c7" }}>Mode: {job.syncMode}</div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="cloud-primary-btn"
                          disabled={!providerConnected || loading}
                          onClick={() => handleStartSync(jobId)}
                          style={{ padding: "4px 8px", fontSize: "10px" }}
                        >
                          {isSyncing ? "Syncing..." : "Sync Now"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeSyncingJob && (
                <div className="cloud-sync-progress" style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f9fafb", borderRadius: "6px" }}>
                  <div className="cloud-sync-progress-header" style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span>Running Sync: {activeSyncingJob.toUpperCase()}</span>
                    <span>{syncProgress.progress}%</span>
                  </div>
                  <div className="cloud-progress-track" style={{ height: "6px", margin: "4px 0" }}>
                    <div style={{ width: `${syncProgress.progress}%`, height: "100%", backgroundColor: "#0284c7" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "#4b5563" }}>
                    {syncProgress.filesProcessed} / {syncProgress.totalFiles} files processed ({syncProgress.statusText})
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= D. OFFLINE CACHE ================= */}
        {activeTab === "offline" && (
          <div className="cloud-page">
            <div className="cloud-page-header">
              <div>
                <h3>Offline Caches</h3>
                <p>Monitor directories, check cache byte volumes, and manage local assets.</p>
              </div>
            </div>

            <div className="cloud-offline-summary" style={{ display: "flex", gap: "20px", marginBottom: "15px" }}>
              <div style={{ padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px", flex: 1 }}>
                <span>Cached Files count</span>
                <strong style={{ display: "block", fontSize: "18px" }}>{offlineFiles.length}</strong>
              </div>
              <div style={{ padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px", flex: 1 }}>
                <span>Total Local Cache Size</span>
                <strong style={{ display: "block", fontSize: "18px" }}>
                  {formatBytes(offlineFiles.reduce((acc, cur) => acc + (cur.size || 0), 0))}
                </strong>
              </div>
            </div>

            <div className="cloud-section-card">
              <div className="cloud-section-title">Available Offline Files</div>
              <div className="cloud-availability-list" style={{ maxHeight: "180px", overflowY: "auto" }}>
                {offlineFiles.length === 0 ? (
                  <div style={{ fontSize: "11px", padding: "10px", color: "#6b7280" }}>No files cached offline.</div>
                ) : (
                  offlineFiles.map((file, idx) => (
                    <div className="cloud-availability-row" key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <div>
                        <strong>{file.name}</strong>
                        <div style={{ fontSize: "9px", color: "#9ca3af" }}>[{file.provider.toUpperCase()}] {file.path}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span>{formatBytes(file.size)}</span>
                        <button className="security-small-btn" style={{ color: "#c62828" }} onClick={() => { setCurrentProvider(file.provider); handleToggleOffline(file); }}>
                          Remove Offline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= E. CONFLICTS ================= */}
        {activeTab === "conflicts" && (
          <div className="cloud-page">
            <div className="cloud-page-header">
              <div>
                <h3>Sync Conflicts</h3>
                <p>Handle data overrides manually. Keep local, remote, or both versions.</p>
              </div>
            </div>

            <div className="cloud-conflict-list" style={{ maxHeight: "250px", overflowY: "auto" }}>
              {conflicts.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>✓ No conflicts detected.</div>
              ) : (
                conflicts.map((conflict, idx) => (
                  <div className="cloud-conflict-card" key={idx} style={{ border: "1px solid #fca5a5", backgroundColor: "#fff5f5", padding: "10px", borderRadius: "6px", marginBottom: "10px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ color: "#dc2626", fontWeight: "bold" }}>⚠</div>
                      <div>
                        <strong>{conflict.relativePath}</strong>
                        <div style={{ fontSize: "10px", color: "#4b5563" }}>Job: {conflict.jobId.toUpperCase()} | Size: {formatBytes(conflict.size)}</div>
                      </div>
                    </div>

                    <div className="cloud-conflict-actions" style={{ display: "flex", gap: "6px" }}>
                      <button className="security-small-btn" onClick={() => handleResolveConflict(conflict, "keep-local")}>Keep Local</button>
                      <button className="security-small-btn" onClick={() => handleResolveConflict(conflict, "keep-cloud")}>Keep Cloud</button>
                      <button className="security-small-btn" onClick={() => handleResolveConflict(conflict, "keep-both")}>Keep Both</button>
                      <button className="security-primary-btn" style={{ padding: "2px 8px", fontSize: "10px" }} onClick={() => { setSelectedConflict(conflict); setShowConflictCompare(true); }}>
                        Compare Versions
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Compare Modal */}
            {showConflictCompare && selectedConflict && (
              <div className="security-alert-overlay" style={{ display: "flex" }}>
                <div className="security-alert-box" style={{ maxWidth: "600px" }}>
                  <h3>Compare File Versions</h3>
                  <p style={{ fontSize: "11px" }}>{selectedConflict.relativePath}</p>
                  
                  <div className="cloud-compare-columns" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", margin: "15px 0" }}>
                    <div style={{ border: "1px solid #e5e7eb", padding: "8px", borderRadius: "4px" }}>
                      <strong>Local Version</strong>
                      <div style={{ fontSize: "10px", color: "#6b7280", margin: "4px 0" }}>
                        Modified: {new Date(selectedConflict.localMtime).toLocaleTimeString()}
                      </div>
                      <div style={{ fontStyle: "italic", fontSize: "10px" }}>Logical file content...</div>
                    </div>
                    <div style={{ border: "1px solid #e5e7eb", padding: "8px", borderRadius: "4px" }}>
                      <strong>Cloud Version</strong>
                      <div style={{ fontSize: "10px", color: "#6b7280", margin: "4px 0" }}>
                        Modified: {new Date(selectedConflict.remoteMtime).toLocaleTimeString()}
                      </div>
                      <div style={{ fontStyle: "italic", fontSize: "10px" }}>Cloud metadata reference...</div>
                    </div>
                  </div>

                  <div className="security-alert-buttons">
                    <button className="security-secondary-btn" onClick={() => { setShowConflictCompare(false); setSelectedConflict(null); }}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= F. SECURITY ================= */}
        {activeTab === "security" && (
          <div className="cloud-page">
            <div className="cloud-page-header">
              <div>
                <h3>Secure Token Store</h3>
                <p>Monitor OAuth links and active credentials storage.</p>
              </div>
            </div>

            <div className="cloud-security-grid">
              <div className="cloud-security-card">
                <div className="cloud-security-icon">OAuth</div>
                <strong>OAuth 2.0 Flow</strong>
                <p>Authenticates to providers without exposing passwords.</p>
                <span className="cloud-security-enabled">Enabled</span>
              </div>

              <div className="cloud-security-card">
                <div className="cloud-security-icon">🔑</div>
                <strong>Windows DPAPI Vault</strong>
                <p>Saves OAuth tokens and S3 keys using machine crypt credentials.</p>
                <span className="cloud-security-enabled">Protected</span>
              </div>
            </div>

            <div className="cloud-section-card" style={{ marginTop: "15px" }}>
              <div className="cloud-section-title">Encryption Status</div>
              <p style={{ fontSize: "11px", color: "#4b5563" }}>
                All authorization tokens are encrypted natively using the Windows Data Protection API (DPAPI) and saved locally inside the secure appData directory.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Notifications */}
      {status && <div className="cloud-status-msg" style={{ padding: "8px 12px", margin: "5px 10px", backgroundColor: "#f0fdf4", color: "#166534", fontSize: "11px", borderRadius: "4px" }}>✓ {status}</div>}
      {error && <div className="cloud-error-msg" style={{ padding: "8px 12px", margin: "5px 10px", backgroundColor: "#fef2f2", color: "#991b1b", fontSize: "11px", borderRadius: "4px" }}>⚠️ {error}</div>}
      {loading && <div className="cloud-loading-msg" style={{ padding: "8px 12px", margin: "5px 10px", color: "#6b7280", fontSize: "11px" }}>Transferring payload data, please wait...</div>}

      {/* Footer */}
      <div className="cloud-footer">
        <div>
          <span>Cloud Integration</span>
          <span>•</span>
          <strong>{activeTab.toUpperCase()}</strong>
        </div>
        <div>
          <span className="cloud-footer-dot"></span>
          Cloud Sync Engine Online
        </div>
      </div>

    </div>
  );
}

export default CloudIntegration;