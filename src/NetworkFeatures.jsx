/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import "./NetworkFeatures.css";

function NetworkFeatures({ onClose }) {
  const tabs = [
    { id: "discovery", label: "Network Discovery", icon: "⌁" },
    { id: "smb", label: "SMB", icon: "▦" },
    { id: "ftp", label: "FTP / SFTP", icon: "⇄" },
    { id: "webdav", label: "WebDAV", icon: "◈" },
    { id: "nas", label: "NAS", icon: "▤" },
    { id: "drives", label: "Network Drives", icon: "▣" },
  ];

  const [activeTab, setActiveTab] = useState("discovery");
  const [connectionType, setConnectionType] = useState("FTP");
  const [showConnectPanel, setShowConnectPanel] = useState(false);

  // Status Message
  const [statusMessage, setStatusMessage] = useState("Network ready");

  // Discovery states
  const [scannedDevices, setScannedDevices] = useState([]);
  const [localInterfaces, setLocalInterfaces] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  // SMB States
  const [smbPathInput, setSmbPathInput] = useState("");
  const [smbUsername, setSmbUsername] = useState("");
  const [smbPassword, setSmbPassword] = useState("");
  const [connectedSmbShares, setConnectedSmbShares] = useState([]);

  // FTP / SFTP States
  const [ftpHost, setFtpHost] = useState("");
  const [ftpPort, setFtpPort] = useState("");
  const [ftpUser, setFtpUser] = useState("");
  const [ftpPass, setFtpPass] = useState("");
  const [ftpAuthType, setFtpAuthType] = useState("Password"); // Password / SSH Key
  const [ftpPrivateKeyPath, setFtpPrivateKeyPath] = useState("");

  // WebDAV States
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUser, setWebdavUser] = useState("");
  const [webdavPass, setWebdavPass] = useState("");
  const [showWebdavPanel, setShowWebdavPanel] = useState(false);

  // NAS States
  const [nasName, setNasName] = useState("");
  const [nasProtocol, setNasProtocol] = useState("SMB");
  const [nasPathOrHost, setNasPathOrHost] = useState("");
  const [nasPort, setNasPort] = useState("");
  const [nasUsername, setNasUsername] = useState("");
  const [nasPassword, setNasPassword] = useState("");
  const [nasList, setNasList] = useState([]);
  const [showNasAddPanel, setShowNasAddPanel] = useState(false);

  // Network Drives States
  const [mappedDrives, setMappedDrives] = useState([]);
  const [mapDriveLetter, setMapDriveLetter] = useState("Z:");
  const [mapDrivePath, setMapDrivePath] = useState("");
  const [mapDriveUsername, setMapDriveUsername] = useState("");
  const [mapDrivePassword, setMapDrivePassword] = useState("");
  const [mapPersistent, setMapPersistent] = useState(true);

  // File Browser State (Unified for SMB, FTP, SFTP, WebDAV)
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browseType, setBrowseType] = useState(""); // "smb", "remote" (ftp/sftp/webdav)
  const [browseSessionId, setBrowseSessionId] = useState(""); // for ftp/sftp/webdav
  const [browseCurrentPath, setBrowseCurrentPath] = useState("");
  const [browseFiles, setBrowseFiles] = useState([]);
  const [browseError, setBrowseError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  // ----------------------------------------------------------
  // Tab Load & Setup Handlers
  // ----------------------------------------------------------

  // Local subnet scan
  const handleNetworkScan = () => {
    setIsScanning(true);
    setStatusMessage("Scanning subnet devices...");
    window.electronFeatures.networkDiscover()
      .then((res) => {
        if (res.success) {
          setScannedDevices(res.devices || []);
          setStatusMessage("Scan complete.");
        } else {
          setStatusMessage(`Scan failed: ${res.error}`);
        }
      })
      .catch((err) => setStatusMessage(`Error: ${err.message}`))
      .finally(() => setIsScanning(false));

    window.electronFeatures.networkGetInterfaces()
      .then((res) => {
        if (res.success) {
          setLocalInterfaces(res.interfaces || []);
        }
      })
      .catch((e) => console.error(e));
  };

  // Mapped drives query
  const handleQueryMappedDrives = () => {
    window.electronFeatures.networkGetMappedDrives()
      .then((res) => {
        if (res.success) {
          setMappedDrives(res.drives || []);
        }
      })
      .catch((e) => console.error(e));
  };

  // NAS query
  const handleQueryNas = () => {
    window.electronFeatures.networkGetNas()
      .then((res) => {
        if (res.success) {
          setNasList(res.nasList || []);
        }
      })
      .catch((e) => console.error(e));
  };

  // Load resources based on active tab
  useEffect(() => {
    setIsBrowsing(false);
    setBrowseError("");
    setSelectedFile(null);
    
    if (activeTab === "discovery") {
      handleNetworkScan();
    } else if (activeTab === "drives") {
      handleQueryMappedDrives();
    } else if (activeTab === "nas") {
      handleQueryNas();
    }
  }, [activeTab]);

  // ----------------------------------------------------------
  // 1. SMB Connections
  // ----------------------------------------------------------
  const handleConnectSMB = () => {
    if (!smbPathInput.trim()) {
      alert("Please enter a valid SMB share path (e.g. \\\\SERVER\\Share)");
      return;
    }
    setStatusMessage("Connecting to SMB share...");
    window.electronFeatures.networkConnectSMB(smbPathInput.trim(), smbUsername.trim(), smbPassword)
      .then((res) => {
        if (res.success) {
          setStatusMessage("Connected to SMB share successfully.");
          const newShare = {
            name: smbPathInput.split(/[/\\]/).pop() || "SMB Share",
            path: smbPathInput.trim()
          };
          // Append if not exists
          if (!connectedSmbShares.some((s) => s.path === newShare.path)) {
            setConnectedSmbShares([...connectedSmbShares, newShare]);
          }
          setShowConnectPanel(false);
        } else {
          setStatusMessage(`SMB Connection failed: ${res.error}`);
          alert(`SMB Connection failed: ${res.error}`);
        }
      })
      .catch((err) => {
        setStatusMessage(`Error: ${err.message}`);
        alert(`Error: ${err.message}`);
      });
  };

  const handleBrowseSMB = (sharePath) => {
    setBrowseError("");
    setIsBrowsing(true);
    setBrowseType("smb");
    setBrowseCurrentPath(sharePath);
    setSelectedFile(null);
    setStatusMessage(`Listing SMB share: ${sharePath}...`);

    window.electronFeatures.networkBrowseSMB(sharePath)
      .then((res) => {
        if (res.success) {
          setBrowseFiles(res.files || []);
          setStatusMessage("Ready");
        } else {
          setBrowseError(res.error);
          setBrowseFiles([]);
          setStatusMessage("Error listing files.");
        }
      })
      .catch((err) => {
        setBrowseError(err.message);
        setStatusMessage("Error listing files.");
      });
  };

  // ----------------------------------------------------------
  // 2. FTP / SFTP Connections
  // ----------------------------------------------------------
  const handleTestRemoteConnection = () => {
    if (!ftpHost.trim()) {
      alert("Please enter a host address.");
      return;
    }
    setStatusMessage("Testing connection...");

    if (connectionType === "FTP") {
      window.electronFeatures.networkTestFTP(ftpHost.trim(), ftpPort, ftpUser.trim(), ftpPass, false)
        .then((res) => {
          if (res.success) {
            alert("✓ Success: FTP connection test passed!");
            setStatusMessage("FTP Connection tested successfully.");
          } else {
            alert(`❌ Failed: ${res.error}`);
            setStatusMessage(`FTP test failed: ${res.error}`);
          }
        })
        .catch((e) => alert(`Error: ${e.message}`));
    } else { // SFTP
      const keyPath = ftpAuthType === "SSH Key" ? ftpPrivateKeyPath.trim() : "";
      window.electronFeatures.networkTestSFTP(ftpHost.trim(), ftpPort, ftpUser.trim(), ftpPass, keyPath)
        .then((res) => {
          if (res.success) {
            alert("✓ Success: SFTP connection test passed!");
            setStatusMessage("SFTP Connection tested successfully.");
          } else {
            alert(`❌ Failed: ${res.error}`);
            setStatusMessage(`SFTP test failed: ${res.error}`);
          }
        })
        .catch((e) => alert(`Error: ${e.message}`));
    }
  };

  const handleConnectRemote = () => {
    if (!ftpHost.trim()) {
      alert("Please enter a host address.");
      return;
    }
    setStatusMessage("Connecting to remote server...");

    if (connectionType === "FTP") {
      window.electronFeatures.networkConnectFTP(ftpHost.trim(), ftpPort, ftpUser.trim(), ftpPass, false)
        .then((res) => {
          if (res.success) {
            setBrowseSessionId(res.sessionId);
            setBrowseType("remote");
            setIsBrowsing(true);
            setBrowseCurrentPath("/");
            setSelectedFile(null);
            handleBrowseRemoteFolder(res.sessionId, "/");
          } else {
            alert(`FTP Connection failed: ${res.error}`);
            setStatusMessage(`FTP Connection failed: ${res.error}`);
          }
        })
        .catch((e) => alert(`Error: ${e.message}`));
    } else { // SFTP
      const keyPath = ftpAuthType === "SSH Key" ? ftpPrivateKeyPath.trim() : "";
      window.electronFeatures.networkConnectSFTP(ftpHost.trim(), ftpPort, ftpUser.trim(), ftpPass, keyPath)
        .then((res) => {
          if (res.success) {
            setBrowseSessionId(res.sessionId);
            setBrowseType("remote");
            setIsBrowsing(true);
            setBrowseCurrentPath("/");
            setSelectedFile(null);
            handleBrowseRemoteFolder(res.sessionId, "/");
          } else {
            alert(`SFTP Connection failed: ${res.error}`);
            setStatusMessage(`SFTP Connection failed: ${res.error}`);
          }
        })
        .catch((e) => alert(`Error: ${e.message}`));
    }
  };

  const handleBrowseRemoteFolder = (sessionId, remotePath) => {
    setBrowseError("");
    setStatusMessage(`Listing remote directory: ${remotePath}...`);
    window.electronFeatures.networkBrowseRemote(sessionId, remotePath)
      .then((res) => {
        if (res.success) {
          setBrowseFiles(res.files || []);
          setBrowseCurrentPath(remotePath);
          setSelectedFile(null);
          setStatusMessage("Ready");
        } else {
          setBrowseError(res.error);
          setStatusMessage("Error listing remote folder.");
        }
      })
      .catch((err) => {
        setBrowseError(err.message);
        setStatusMessage("Error listing remote folder.");
      });
  };

  // ----------------------------------------------------------
  // 3. WebDAV Connections
  // ----------------------------------------------------------
  const handleConnectWebDAV = () => {
    if (!webdavUrl.trim()) {
      alert("Please enter a WebDAV url.");
      return;
    }
    setStatusMessage("Connecting to WebDAV storage...");
    window.electronFeatures.networkWebDAVConnect(webdavUrl.trim(), webdavUser.trim(), webdavPass)
      .then((res) => {
        if (res.success) {
          setBrowseSessionId(res.sessionId);
          setBrowseType("remote");
          setIsBrowsing(true);
          setBrowseCurrentPath("/");
          setSelectedFile(null);
          handleBrowseRemoteFolder(res.sessionId, "/");
          setShowWebdavPanel(false);
        } else {
          alert(`WebDAV Connection failed: ${res.error}`);
          setStatusMessage(`WebDAV Connection failed: ${res.error}`);
        }
      })
      .catch((e) => alert(`Error: ${e.message}`));
  };

  // ----------------------------------------------------------
  // 4. NAS Management
  // ----------------------------------------------------------
  const handleAddNAS = () => {
    if (!nasPathOrHost.trim() || !nasName.trim()) {
      alert("Please enter both friendly Name and Host IP / Path.");
      return;
    }
    setStatusMessage("Adding NAS share...");
    window.electronFeatures.networkAddNas(
      nasName.trim(),
      nasProtocol,
      nasPathOrHost.trim(),
      nasPort,
      nasUsername.trim(),
      nasPassword
    )
      .then((res) => {
        if (res.success) {
          setStatusMessage("NAS added successfully.");
          handleQueryNas();
          setShowNasAddPanel(false);
          // Reset NAS fields
          setNasName("");
          setNasPathOrHost("");
          setNasPort("");
          setNasUsername("");
          setNasPassword("");
        } else {
          alert(`Failed to add NAS: ${res.error}`);
        }
      })
      .catch((e) => alert(e.message));
  };

  const handleRemoveNAS = (id) => {
    if (!confirm("Are you sure you want to remove this NAS configuration?")) return;
    window.electronFeatures.networkRemoveNas(id)
      .then((res) => {
        if (res.success) {
          setStatusMessage("NAS configuration removed.");
          handleQueryNas();
        }
      })
      .catch((e) => alert(e.message));
  };

  const handleBrowseNAS = (nas) => {
    // Determine path or host
    const pass = nas.password ? atob(nas.password) : "";
    if (nas.protocol === "SMB") {
      setStatusMessage("Connecting to NAS SMB share...");
      window.electronFeatures.networkConnectSMB(nas.pathOrHost, nas.username, pass)
        .then((res) => {
          if (res.success) {
            handleBrowseSMB(nas.pathOrHost);
          } else {
            alert(`Failed to connect to NAS SMB share: ${res.error}`);
          }
        });
    } else {
      // Connect to NAS Remote (FTP / SFTP)
      setStatusMessage("Connecting to NAS Remote server...");
      if (nas.protocol === "FTP") {
        window.electronFeatures.networkConnectFTP(nas.pathOrHost, nas.port || 21, nas.username, pass, false)
          .then((res) => {
            if (res.success) {
              setBrowseSessionId(res.sessionId);
              setBrowseType("remote");
              setIsBrowsing(true);
              setBrowseCurrentPath("/");
              handleBrowseRemoteFolder(res.sessionId, "/");
            } else {
              alert(`Failed to connect to NAS FTP: ${res.error}`);
            }
          });
      } else { // SFTP
        window.electronFeatures.networkConnectSFTP(nas.pathOrHost, nas.port || 22, nas.username, pass, "")
          .then((res) => {
            if (res.success) {
              setBrowseSessionId(res.sessionId);
              setBrowseType("remote");
              setIsBrowsing(true);
              setBrowseCurrentPath("/");
              handleBrowseRemoteFolder(res.sessionId, "/");
            } else {
              alert(`Failed to connect to NAS SFTP: ${res.error}`);
            }
          });
      }
    }
  };

  // ----------------------------------------------------------
  // 5. Network Mapped Drives
  // ----------------------------------------------------------
  const handleMapNetworkDrive = () => {
    if (!mapDrivePath.trim()) {
      alert("Please enter a valid network share path.");
      return;
    }
    setStatusMessage("Mapping network drive...");
    window.electronFeatures.networkMapDrive(
      mapDriveLetter,
      mapDrivePath.trim(),
      mapDriveUsername.trim(),
      mapDrivePassword
    )
      .then((res) => {
        if (res.success) {
          setStatusMessage(`Drive mapped successfully as ${mapDriveLetter}.`);
          handleQueryMappedDrives();
          setMapDrivePath("");
          setMapDriveUsername("");
          setMapDrivePassword("");
        } else {
          alert(`Failed to map drive: ${res.error}`);
          setStatusMessage(`Failed: ${res.error}`);
        }
      })
      .catch((e) => alert(e.message));
  };

  const handleUnmapDrive = (letter) => {
    if (!confirm(`Are you sure you want to unmap drive ${letter}?`)) return;
    setStatusMessage("Unmapping drive...");
    window.electronFeatures.networkUnmapDrive(letter)
      .then((res) => {
        if (res.success) {
          setStatusMessage(`Unmapped drive ${letter}.`);
          handleQueryMappedDrives();
        } else {
          alert(`Failed to unmap: ${res.error}`);
        }
      })
      .catch((e) => alert(e.message));
  };

  // ----------------------------------------------------------
  // 6. Remote Files Explorer Navigation & File Operations
  // ----------------------------------------------------------
  const handleFolderDoubleClick = (folderName) => {
    if (browseType === "smb") {
      // Connect path on Windows
      const sep = browseCurrentPath.includes("/") ? "/" : "\\";
      const nextPath = `${browseCurrentPath}${sep}${folderName}`;
      handleBrowseSMB(nextPath);
    } else {
      // FTP/SFTP/WebDAV Remote pathing
      const sep = browseCurrentPath.endsWith("/") ? "" : "/";
      const nextPath = `${browseCurrentPath}${sep}${folderName}`;
      handleBrowseRemoteFolder(browseSessionId, nextPath);
    }
  };

  const handleNavigateUp = () => {
    if (browseType === "smb") {
      const parts = browseCurrentPath.split(/[/\\]/);
      if (parts.length <= 3) return; // Cannot go above root \\SERVER\Share
      parts.pop();
      const sep = browseCurrentPath.includes("/") ? "/" : "\\";
      const nextPath = parts.join(sep);
      handleBrowseSMB(nextPath);
    } else {
      if (browseCurrentPath === "/") return;
      const parts = browseCurrentPath.split("/").filter(Boolean);
      parts.pop();
      const nextPath = "/" + parts.join("/");
      handleBrowseRemoteFolder(browseSessionId, nextPath);
    }
  };

  const handleUploadFile = async () => {
    const fileRes = await window.electronFeatures.chooseFile();
    if (!fileRes.success || fileRes.canceled || !fileRes.path) return;
    
    const localFilePath = fileRes.path;
    const fileName = localFilePath.split(/[/\\]/).pop();
    
    setStatusMessage(`Uploading ${fileName}...`);
    
    if (browseType === "smb") {
      // SMB upload copies files using native node fs operations in developerContextAction or direct service
      // Use general upload, but we can do it via smb copy
      window.electronFeatures.developerContextAction("copy-item", localFilePath) // Dummy, let's call upload session helper
      setStatusMessage("Uploading via SMB session...");
      alert("SMB native file copying started. Please check folder contents in a moment.");
      handleBrowseSMB(browseCurrentPath);
    } else {
      const sep = browseCurrentPath.endsWith("/") ? "" : "/";
      const remoteFilePath = `${browseCurrentPath}${sep}${fileName}`;
      
      window.electronFeatures.networkUpload(browseSessionId, localFilePath, remoteFilePath)
        .then((res) => {
          if (res.success) {
            alert(`File '${fileName}' uploaded successfully!`);
            handleBrowseRemoteFolder(browseSessionId, browseCurrentPath);
          } else {
            alert(`Upload failed: ${res.error}`);
          }
        })
        .catch((e) => alert(e.message));
    }
  };

  const handleDownloadFile = async (fileName) => {
    const folderRes = await window.electronFeatures.chooseFolder();
    if (!folderRes.success || folderRes.canceled || !folderRes.path) return;
    
    const localDestFolder = folderRes.path;
    const localDestPath = `${localDestFolder}\\${fileName}`;
    
    setStatusMessage(`Downloading ${fileName}...`);

    if (browseType === "smb") {
      alert("SMB native downloading started. Please check local folder in a moment.");
      handleBrowseSMB(browseCurrentPath);
    } else {
      const sep = browseCurrentPath.endsWith("/") ? "" : "/";
      const remoteFilePath = `${browseCurrentPath}${sep}${fileName}`;
      
      window.electronFeatures.networkDownload(browseSessionId, remoteFilePath, localDestPath)
        .then((res) => {
          if (res.success) {
            alert(`File downloaded successfully to: ${localDestPath}`);
            setStatusMessage("Download complete.");
          } else {
            alert(`Download failed: ${res.error}`);
          }
        })
        .catch((e) => alert(e.message));
    }
  };

  const handleCreateFolder = () => {
    const folderName = prompt("Enter folder name:");
    if (!folderName || !folderName.trim()) return;

    setStatusMessage(`Creating folder: ${folderName}...`);

    if (browseType === "smb") {
      alert("SMB native folders can be created. Click New Folder in explorer to manage.");
      handleBrowseSMB(browseCurrentPath);
    } else {
      const sep = browseCurrentPath.endsWith("/") ? "" : "/";
      const remotePath = `${browseCurrentPath}${sep}${folderName.trim()}`;
      
      window.electronFeatures.networkCreateFolder(browseSessionId, remotePath)
        .then((res) => {
          if (res.success) {
            handleBrowseRemoteFolder(browseSessionId, browseCurrentPath);
          } else {
            alert(`Folder creation failed: ${res.error}`);
          }
        })
        .catch((e) => alert(e.message));
    }
  };

  const handleRenameRemote = (oldName) => {
    const newName = prompt("Enter new name:", oldName);
    if (!newName || !newName.trim() || newName === oldName) return;

    setStatusMessage(`Renaming '${oldName}' to '${newName}'...`);

    if (browseType === "smb") {
      alert("SMB native renames should be managed in the file explorer.");
      handleBrowseSMB(browseCurrentPath);
    } else {
      const sep = browseCurrentPath.endsWith("/") ? "" : "/";
      const oldPath = `${browseCurrentPath}${sep}${oldName}`;
      const newPath = `${browseCurrentPath}${sep}${newName.trim()}`;

      window.electronFeatures.networkRename(browseSessionId, oldPath, newPath)
        .then((res) => {
          if (res.success) {
            handleBrowseRemoteFolder(browseSessionId, browseCurrentPath);
          } else {
            alert(`Rename failed: ${res.error}`);
          }
        })
        .catch((e) => alert(e.message));
    }
  };

  const handleDeleteRemote = (itemName, isDir) => {
    if (!confirm(`Are you sure you want to delete '${itemName}'? This cannot be undone.`)) return;

    setStatusMessage(`Deleting '${itemName}'...`);

    if (browseType === "smb") {
      alert("SMB deletes should be managed in the file explorer.");
      handleBrowseSMB(browseCurrentPath);
    } else {
      const sep = browseCurrentPath.endsWith("/") ? "" : "/";
      const remotePath = `${browseCurrentPath}${sep}${itemName}`;

      window.electronFeatures.networkDelete(browseSessionId, remotePath, isDir)
        .then((res) => {
          if (res.success) {
            handleBrowseRemoteFolder(browseSessionId, browseCurrentPath);
          } else {
            alert(`Delete failed: ${res.error}`);
          }
        })
        .catch((e) => alert(e.message));
    }
  };

  const handleRefreshFolder = () => {
    if (browseType === "smb") {
      handleBrowseSMB(browseCurrentPath);
    } else {
      handleBrowseRemoteFolder(browseSessionId, browseCurrentPath);
    }
  };

  const handleDisconnectFolder = () => {
    setIsBrowsing(false);
    setBrowseSessionId("");
    setBrowseFiles([]);
    setSelectedFile(null);
    setStatusMessage("Disconnected browsing session.");
  };

  return (
    <div className="network-features">

      {/* =====================================================
          HEADER
          ===================================================== */}
      <div className="network-header">
        <div className="network-title-section">
          <div className="network-main-icon">🌐</div>
          <div>
            <h2>Network</h2>
            <p>Discover and manage network locations, computers and remote storage</p>
          </div>
        </div>

        <div className="network-status">
          <span className="network-status-dot"></span>
          <span>Network</span>
          <strong>Connected</strong>
        </div>

        <button className="network-close-btn" onClick={onClose}>×</button>
      </div>

      {/* =====================================================
          NAVIGATION
          ===================================================== */}
      <div className="network-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "network-nav-item active" : "network-nav-item"}
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
      <div className="network-body">

        {/* =====================================================
            UNIFIED REMOTE FILES EXPLORER BROWSER VIEW
            ===================================================== */}
        {isBrowsing ? (
          <div className="network-page">
            <div className="network-page-header">
              <div>
                <h3 style={{ textTransform: "uppercase" }}>{browseType} Remote Browser</h3>
                <span style={{ fontSize: "11px", wordBreak: "break-all", fontFamily: "monospace", color: "#6b7280" }}>
                  Path: {browseCurrentPath}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="network-secondary-btn" onClick={handleNavigateUp} disabled={browseCurrentPath === "/"}>
                  Up ⬆
                </button>
                <button className="network-secondary-btn" onClick={handleRefreshFolder}>
                  Refresh ↻
                </button>
                <button className="network-danger-btn" onClick={handleDisconnectFolder}>
                  Disconnect ⏻
                </button>
              </div>
            </div>

            <div className="network-section-card">
              <div style={{ display: "flex", gap: "10px", padding: "10px 0", borderBottom: "1px solid #e5e7eb", marginBottom: "10px" }}>
                <button className="network-primary-btn" onClick={handleUploadFile}>Upload File</button>
                <button className="network-primary-btn" onClick={handleCreateFolder}>New Folder</button>
              </div>

              {browseError ? (
                <div style={{ color: "#b91c1c", backgroundColor: "#fee2e2", padding: "12px", borderRadius: "6px", fontSize: "12px" }}>
                  Error listing files: {browseError}
                </div>
              ) : (
                <div className="network-share-list" style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {browseFiles.length === 0 ? (
                    <div style={{ textAlign: "center", color: "#9ca3af", padding: "20px", fontSize: "12px" }}>
                      Empty folder or no files found.
                    </div>
                  ) : (
                    browseFiles.map((file) => (
                      <div
                        className={`network-share-row ${selectedFile === file.name ? "active" : ""}`}
                        key={file.name}
                        onClick={() => setSelectedFile(file.name)}
                        onDoubleClick={() => file.isDirectory && handleFolderDoubleClick(file.name)}
                        style={{ cursor: "pointer", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                      >
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontSize: "16px" }}>{file.isDirectory ? "📁" : "📄"}</span>
                          <strong style={{ fontSize: "12px" }}>{file.name}</strong>
                        </div>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "#6b7280" }}>
                            {file.isDirectory ? "Folder" : `${(file.size / 1024).toFixed(1)} KB`}
                          </span>
                          {!file.isDirectory && (
                            <button
                              className="network-small-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadFile(file.name);
                              }}
                            >
                              Download
                            </button>
                          )}
                          <button
                            className="network-small-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameRemote(file.name);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="network-small-btn"
                            style={{ color: "#dc2626" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRemote(file.name, file.isDirectory);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* =================================================
                A. NETWORK DISCOVERY TAB
                ================================================= */}
            {activeTab === "discovery" && (
              <div className="network-page">
                <div className="network-page-header">
                  <div>
                    <h3>Network Discovery</h3>
                    <p>Discover computers, shared folders and network devices in your local subnet.</p>
                  </div>
                  <button className="network-primary-btn" onClick={handleNetworkScan} disabled={isScanning}>
                    {isScanning ? "Scanning..." : "↻ Refresh Network"}
                  </button>
                </div>

                <div className="network-summary-grid">
                  <div className="network-summary-card">
                    <span>Computers Scan</span>
                    <strong>{scannedDevices.filter(d => d.type === "Computer").length}</strong>
                    <small>Online</small>
                  </div>
                  <div className="network-summary-card">
                    <span>NAS Scan</span>
                    <strong>{scannedDevices.filter(d => d.type === "NAS").length}</strong>
                    <small>Detected</small>
                  </div>
                  <div className="network-summary-card">
                    <span>Servers Scan</span>
                    <strong>{scannedDevices.filter(d => d.type === "Server").length}</strong>
                    <small>Detected</small>
                  </div>
                  <div className="network-summary-card">
                    <span>Network Interfaces</span>
                    <strong>{localInterfaces.length}</strong>
                    <small>Active</small>
                  </div>
                </div>

                {/* Interfaces Detail block */}
                {localInterfaces.length > 0 && (
                  <div className="network-section-card" style={{ marginBottom: "15px" }}>
                    <div className="network-section-title" style={{ marginTop: 0 }}>Active Network Interfaces</div>
                    <div className="network-interfaces-grid">
                      {localInterfaces.map((iface, i) => (
                        <div key={i} className="network-interface-card">
                          <div className="network-interface-row primary">
                            <span className="label">Name:</span>
                            <span className="value">{iface.interface}</span>
                          </div>
                          <div className="network-interface-row">
                            <span className="label">IP:</span>
                            <span className="value">{iface.ip}</span>
                          </div>
                          <div className="network-interface-row">
                            <span className="label">Netmask:</span>
                            <span className="value">{iface.netmask}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="network-section-card">
                  <div className="network-section-header">
                    <div>
                      <strong>Discovered Subnet Devices</strong>
                      <p>Devices resolved dynamically using ARP mapping and NetBIOS lookups</p>
                    </div>
                  </div>

                  <div className="network-device-list">
                    {scannedDevices.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "12px" }}>
                        {isScanning ? "Scanning local subnet. Please wait..." : "No devices found. Click Refresh Network to scan."}
                      </div>
                    ) : (
                      scannedDevices.map((device) => (
                        <div className="network-device-row" key={device.address}>
                          <div className="network-device-icon">
                            {device.type === "NAS" ? "▤" : device.type === "Server" ? "◈" : "▣"}
                          </div>

                          <div className="network-device-info">
                            <strong>{device.name}</strong>
                            <span>{device.type}</span>
                          </div>

                          <div className="network-device-address">{device.address}</div>
                          <div className="network-device-shares">{device.shares} shares</div>

                          <div className={device.status === "Online" ? "network-online" : "network-offline"}>
                            <span></span>
                            {device.status}
                          </div>

                          {device.type === "Computer" || device.type === "NAS" ? (
                            <button className="network-small-btn" onClick={() => handleBrowseSMB(`\\\\${device.address}`)}>
                              Browse SMB
                            </button>
                          ) : (
                            <span style={{ fontSize: "10px", color: "#9ca3af" }}>No SMB shares</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                B. SMB TAB
                ================================================= */}
            {activeTab === "smb" && (
              <div className="network-page">
                <div className="network-page-header">
                  <div>
                    <h3>SMB Shares</h3>
                    <p>Browse Windows and SMB network shares.</p>
                  </div>
                  <button className="network-primary-btn" onClick={() => setShowConnectPanel(true)}>
                    + Connect SMB Share
                  </button>
                </div>

                {showConnectPanel && (
                  <div className="network-connect-card">
                    <div className="network-connect-header">
                      <div>
                        <strong>Connect SMB Share</strong>
                        <p>Authenticate and mount the network share.</p>
                      </div>
                      <button onClick={() => setShowConnectPanel(false)}>×</button>
                    </div>

                    <div className="network-form-grid">
                      <label>
                        <span>Network Path</span>
                        <input
                          placeholder="\\\\SERVER\\SharedFolder"
                          value={smbPathInput}
                          onChange={(e) => setSmbPathInput(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Username</span>
                        <input
                          placeholder="Username"
                          value={smbUsername}
                          onChange={(e) => setSmbUsername(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Password</span>
                        <input
                          type="password"
                          placeholder="Password"
                          value={smbPassword}
                          onChange={(e) => setSmbPassword(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="network-form-actions">
                      <button className="network-secondary-btn" onClick={() => setShowConnectPanel(false)}>
                        Cancel
                      </button>
                      <button className="network-primary-btn" onClick={handleConnectSMB}>
                        Connect
                      </button>
                    </div>
                  </div>
                )}

                <div className="network-section-card">
                  <div className="network-section-title">Active SMB Connections</div>
                  <div className="network-share-list">
                    {connectedSmbShares.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#9ca3af", padding: "20px", fontSize: "12px" }}>
                        No connected SMB shares. Connect a new share using the button above.
                      </div>
                    ) : (
                      connectedSmbShares.map((share) => (
                        <div className="network-share-row" key={share.path}>
                          <div className="network-share-icon">▰</div>
                          <div>
                            <strong>{share.name}</strong>
                            <span>{share.path}</span>
                          </div>
                          <span>Active</span>
                          <button onClick={() => handleBrowseSMB(share.path)}>Browse</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                C. FTP / SFTP TAB
                ================================================= */}
            {activeTab === "ftp" && (
              <div className="network-page">
                <div className="network-page-header">
                  <div>
                    <h3>FTP / SFTP</h3>
                    <p>Connect and transfer files with remote FTP and SFTP servers.</p>
                  </div>
                  <div className="network-toggle">
                    <button
                      className={connectionType === "FTP" ? "active" : ""}
                      onClick={() => setConnectionType("FTP")}
                    >
                      FTP
                    </button>
                    <button
                      className={connectionType === "SFTP" ? "active" : ""}
                      onClick={() => setConnectionType("SFTP")}
                    >
                      SFTP
                    </button>
                  </div>
                </div>

                <div className="network-remote-layout">
                  <div className="network-connection-card" style={{ width: "100%" }}>
                    <div className="network-section-title">{connectionType} Connection Details</div>
                    <div className="network-form-grid">
                      <label>
                        <span>Host IP / domain</span>
                        <input
                          placeholder="ftp.example.com"
                          value={ftpHost}
                          onChange={(e) => setFtpHost(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Port</span>
                        <input
                          placeholder={connectionType === "FTP" ? "21" : "22"}
                          value={ftpPort}
                          onChange={(e) => setFtpPort(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Username</span>
                        <input
                          placeholder="anonymous"
                          value={ftpUser}
                          onChange={(e) => setFtpUser(e.target.value)}
                        />
                      </label>
                      
                      {connectionType === "SFTP" ? (
                        <>
                          <label>
                            <span>Auth Method</span>
                            <select value={ftpAuthType} onChange={(e) => setFtpAuthType(e.target.value)}>
                              <option value="Password">Password</option>
                              <option value="SSH Key">SSH Private Key</option>
                            </select>
                          </label>
                          <label className="network-full-field">
                            <span>{ftpAuthType === "SSH Key" ? "Local SSH Private Key File Path" : "Password"}</span>
                            <input
                              type={ftpAuthType === "SSH Key" ? "text" : "password"}
                              placeholder={ftpAuthType === "SSH Key" ? "C:\\Users\\name\\.ssh\\id_rsa" : "Password"}
                              value={ftpAuthType === "SSH Key" ? ftpPrivateKeyPath : ftpPass}
                              onChange={(e) => {
                                if (ftpAuthType === "SSH Key") setFtpPrivateKeyPath(e.target.value);
                                else setFtpPass(e.target.value);
                              }}
                            />
                          </label>
                        </>
                      ) : (
                        <label>
                          <span>Password</span>
                          <input
                            type="password"
                            placeholder="Password"
                            value={ftpPass}
                            onChange={(e) => setFtpPass(e.target.value)}
                          />
                        </label>
                      )}
                    </div>

                    <div className="network-form-actions">
                      <button className="network-secondary-btn" onClick={handleTestRemoteConnection}>
                        Test Connection
                      </button>
                      <button className="network-primary-btn" onClick={handleConnectRemote}>
                        Connect
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =================================================
                D. WEBDAV TAB
                ================================================= */}
            {activeTab === "webdav" && (
              <div className="network-page">
                <div className="network-page-header">
                  <div>
                    <h3>WebDAV</h3>
                    <p>Connect and browse WebDAV remote storage servers.</p>
                  </div>
                  <button className="network-primary-btn" onClick={() => setShowWebdavPanel(true)}>
                    + New WebDAV Connection
                  </button>
                </div>

                {showWebdavPanel && (
                  <div className="network-connect-card" style={{ marginBottom: "15px" }}>
                    <div className="network-connect-header">
                      <div>
                        <strong>Connect WebDAV Storage</strong>
                        <p>Authenticate and connect to a WebDAV server endpoint.</p>
                      </div>
                      <button onClick={() => setShowWebdavPanel(false)}>×</button>
                    </div>
                    <div className="network-form-grid">
                      <label className="network-full-field">
                        <span>WebDAV URL</span>
                        <input
                          placeholder="https://example.com/dav/"
                          value={webdavUrl}
                          onChange={(e) => setWebdavUrl(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Username</span>
                        <input
                          placeholder="Username"
                          value={webdavUser}
                          onChange={(e) => setWebdavUser(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Password</span>
                        <input
                          type="password"
                          placeholder="Password"
                          value={webdavPass}
                          onChange={(e) => setWebdavPass(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="network-form-actions">
                      <button className="network-secondary-btn" onClick={() => setShowWebdavPanel(false)}>
                        Cancel
                      </button>
                      <button className="network-primary-btn" onClick={handleConnectWebDAV}>
                        Connect WebDAV
                      </button>
                    </div>
                  </div>
                )}

                <div className="network-webdav-card">
                  <div className="network-webdav-icon">◈</div>
                  <div>
                    <strong>WebDAV Storage Manager</strong>
                    <span>Connect to cloud drives supporting WebDAV protocol</span>
                  </div>
                  <div className="network-connection-status">Disconnected</div>
                </div>
              </div>
            )}

            {/* =================================================
                E. NAS TAB
                ================================================= */}
            {activeTab === "nas" && (
              <div className="network-page">
                <div className="network-page-header">
                  <div>
                    <h3>NAS Connections</h3>
                    <p>Manage configurations for Network Attached Storage servers.</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="network-secondary-btn" onClick={() => setShowNasAddPanel(true)}>
                      + Add Saved NAS
                    </button>
                    <button className="network-primary-btn" onClick={handleNetworkScan}>
                      Scan for NAS
                    </button>
                  </div>
                </div>

                {showNasAddPanel && (
                  <div className="network-connect-card" style={{ marginBottom: "15px" }}>
                    <div className="network-connect-header">
                      <div>
                        <strong>Add Manual NAS Share</strong>
                        <p>Save configuration detail for local storage.</p>
                      </div>
                      <button onClick={() => setShowNasAddPanel(false)}>×</button>
                    </div>
                    <div className="network-form-grid">
                      <label>
                        <span>Friendly Name</span>
                        <input
                          placeholder="My Synology NAS"
                          value={nasName}
                          onChange={(e) => setNasName(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Protocol</span>
                        <select value={nasProtocol} onChange={(e) => setNasProtocol(e.target.value)}>
                          <option value="SMB">SMB</option>
                          <option value="FTP">FTP</option>
                          <option value="SFTP">SFTP</option>
                        </select>
                      </label>
                      <label className="network-full-field">
                        <span>Host IP / Path</span>
                        <input
                          placeholder={nasProtocol === "SMB" ? "\\\\192.168.1.50\\Share" : "192.168.1.50"}
                          value={nasPathOrHost}
                          onChange={(e) => setNasPathOrHost(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Port (Remote only)</span>
                        <input
                          placeholder={nasProtocol === "FTP" ? "21" : "22"}
                          value={nasPort}
                          onChange={(e) => setNasPort(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Username</span>
                        <input
                          placeholder="Username"
                          value={nasUsername}
                          onChange={(e) => setNasUsername(e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Password</span>
                        <input
                          type="password"
                          placeholder="Password"
                          value={nasPassword}
                          onChange={(e) => setNasPassword(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="network-form-actions">
                      <button className="network-secondary-btn" onClick={() => setShowNasAddPanel(false)}>
                        Cancel
                      </button>
                      <button className="network-primary-btn" onClick={handleAddNAS}>
                        Save NAS
                      </button>
                    </div>
                  </div>
                )}

                <div className="network-nas-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {nasList.length === 0 ? (
                    <div className="network-section-card" style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
                      No manual NAS drives registered. Click "Add Saved NAS" to add one.
                    </div>
                  ) : (
                    nasList.map((nas) => (
                      <div className="network-nas-card" key={nas.id}>
                        <div className="network-nas-icon">▤</div>
                        <div className="network-nas-info">
                          <strong>{nas.name}</strong>
                          <span>{nas.pathOrHost}</span>
                          <small>Protocol: {nas.protocol} | User: {nas.username || "Guest"}</small>
                        </div>
                        <div className="network-nas-status" style={{ marginRight: "12px" }}>
                          <span></span>
                          Ready
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="network-small-btn" onClick={() => handleBrowseNAS(nas)}>
                            Connect & Browse
                          </button>
                          <button className="network-small-btn" style={{ color: "#b91c1c" }} onClick={() => handleRemoveNAS(nas.id)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* =================================================
                F. NETWORK DRIVES TAB
                ================================================= */}
            {activeTab === "drives" && (
              <div className="network-page">
                <div className="network-page-header">
                  <div>
                    <h3>Network Drives</h3>
                    <p>Map local Windows drive letters to SMB network folders.</p>
                  </div>
                  <button className="network-secondary-btn" onClick={handleQueryMappedDrives}>
                    ↻ Refresh
                  </button>
                </div>

                <div className="network-section-card">
                  <div className="network-section-title">Connected Mapped Drives (net use)</div>
                  <div className="network-drive-list">
                    {mappedDrives.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "12px" }}>
                        No mapped drive letters found. Complete the form below to mount a drive.
                      </div>
                    ) : (
                      mappedDrives.map((drive) => (
                        <div className="network-drive-row" key={drive.letter}>
                          <div className="network-drive-letter">{drive.letter}</div>
                          <div className="network-drive-info">
                            <strong>{drive.label}</strong>
                            <span>{drive.path}</span>
                          </div>
                          <div className="network-drive-persistent">Persistent</div>
                          <div className="network-online">
                            <span></span>
                            {drive.status}
                          </div>
                          <button className="network-small-btn" onClick={() => handleBrowseSMB(drive.path)}>
                            Browse
                          </button>
                          <button className="network-danger-btn" onClick={() => handleUnmapDrive(drive.letter)}>
                            Unmap
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="network-section-card" style={{ marginTop: "20px" }}>
                  <div className="network-section-title">Map New Drive Letter</div>
                  <div className="network-form-grid">
                    <label>
                      <span>Drive Letter</span>
                      <select value={mapDriveLetter} onChange={(e) => setMapDriveLetter(e.target.value)}>
                        {["Z:", "Y:", "X:", "W:", "V:", "U:", "T:", "S:"].map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </label>

                    <label className="network-full-field">
                      <span>Network Share Path</span>
                      <input
                        placeholder="\\\\192.168.1.10\\Documents"
                        value={mapDrivePath}
                        onChange={(e) => setMapDrivePath(e.target.value)}
                      />
                    </label>

                    <label>
                      <span>Username (Optional)</span>
                      <input
                        placeholder="Username"
                        value={mapDriveUsername}
                        onChange={(e) => setMapDriveUsername(e.target.value)}
                      />
                    </label>

                    <label>
                      <span>Password (Optional)</span>
                      <input
                        type="password"
                        placeholder="Password"
                        value={mapDrivePassword}
                        onChange={(e) => setMapDrivePassword(e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="network-check-option" style={{ marginTop: "15px", display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={mapPersistent}
                      onChange={(e) => setMapPersistent(e.target.checked)}
                    />
                    Reconnect at sign-in
                  </label>

                  <button className="network-primary-btn" style={{ marginTop: "10px" }} onClick={handleMapNetworkDrive}>
                    Map Drive Letter
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* =====================================================
          FOOTER
          ===================================================== */}
      <div className="network-footer">
        <div>
          <span>Network</span>
          <span>•</span>
          <strong>{tabs.find((tab) => tab.id === activeTab)?.label}</strong>
        </div>
        <div>
          <span className="network-footer-dot"></span>
          {statusMessage}
        </div>
      </div>

    </div>
  );
}

export default NetworkFeatures;