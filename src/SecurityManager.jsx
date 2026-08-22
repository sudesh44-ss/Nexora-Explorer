/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import "./SecurityManager.css";

function SecurityManager({ selectedItem, onClose }) {
  const [activeTab, setActiveTab] = useState("permissions");
  const [selectedPath, setSelectedPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Permissions & Owner details
  const [permissions, setPermissions] = useState([]);
  const [owner, setOwner] = useState("—");
  const [currentUser, setCurrentUser] = useState({ username: "Detecting...", isAdmin: false });

  // Add permission form
  const [permUsername, setPermUsername] = useState("");
  const [permRight, setPermRight] = useState("read"); // read, write, execute, full
  const [permType, setPermType] = useState("grant"); // grant, deny

  // Change Owner form
  const [newOwnerName, setNewOwnerName] = useState("");

  // Protection Attributes
  const [attrReadonly, setAttrReadonly] = useState(false);
  const [attrHidden, setAttrHidden] = useState(false);
  const [attrSystem, setAttrSystem] = useState(false);

  // Secure Delete states
  const [deleteConfirmCheckbox, setDeleteConfirmCheckbox] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStatusText, setDeleteStatusText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Encryption states
  const [encPassword, setEncPassword] = useState("");
  const [encConfirmPassword, setEncConfirmPassword] = useState("");
  const [encryptionStatus, setEncryptionStatus] = useState("Not Encrypted");

  // Vault states
  const [vaultPath, setVaultPath] = useState("");
  const [vaultPassword, setVaultPassword] = useState("");
  const [vaultLocked, setVaultLocked] = useState(true);
  const [vaultFiles, setVaultFiles] = useState([]);
  const [autoLock, setAutoLock] = useState(true);
  const [vaultCountdown, setVaultCountdown] = useState(300); // 5 minutes in seconds

  // Audit Logs states
  const [logs, setLogs] = useState([]);
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logFilterOp, setLogFilterOp] = useState("All Operations");

  // Threat Protection states
  const [threatStatus, setThreatStatus] = useState("Unknown");
  const [threatScore, setThreatScore] = useState(0);
  const [threatReasons, setThreatReasons] = useState([]);
  const [defenderStatus, setDefenderStatus] = useState("Scan unavailable");

  // Tabs layout
  const tabs = [
    { id: "permissions", label: "Permissions", icon: "◈" },
    { id: "ownership", label: "Ownership", icon: "♙" },
    { id: "protected", label: "Protection", icon: "⬢" },
    { id: "delete", label: "Secure Delete", icon: "⌫" },
    { id: "encryption", label: "Encryption", icon: "▣" },
    { id: "vault", label: "Vault", icon: "▰" },
    { id: "logs", label: "Logs", icon: "☷" },
    { id: "threats", label: "Threat Protection", icon: "△" }
  ];

  // ----------------------------------------------------------
  // Core Data Fetchers
  // ----------------------------------------------------------
  const loadPathDetails = (filePath) => {
    if (!filePath) return;
    setLoading(true);
    setError("");

    // Get Permissions
    window.electronFeatures.securityGetPermissions(filePath)
      .then((res) => {
        if (res.success) {
          setPermissions(res.permissions || []);
        } else {
          setPermissions([]);
          setError(res.error || "Failed to load permissions");
        }
      })
      .catch((err) => setError(err.message));

    // Get Owner
    window.electronFeatures.securityGetOwner(filePath)
      .then((res) => {
        if (res.success) {
          setOwner(res.owner || "—");
        }
      });

    // Get Protection Attributes
    window.electronFeatures.securityGetAttributes(filePath)
      .then((res) => {
        if (res.success) {
          setAttrReadonly(res.readonly);
          setAttrHidden(res.hidden);
          setAttrSystem(res.system);
        }
      });

    // Run Threat risk scan
    window.electronFeatures.securityScanFile(filePath)
      .then((res) => {
        if (res.success) {
          setThreatStatus(res.status);
          setThreatScore(res.riskScore);
          setThreatReasons(res.reasons || []);
          setDefenderStatus(res.defenderStatus);
        }
      });

    setLoading(false);
  };

  const loadAuditLogs = () => {
    window.electronFeatures.securityGetLogs()
      .then((res) => {
        if (res.success) {
          setLogs(res.logs || []);
        }
      });
  };

  const loadCurrentUser = () => {
    window.electronFeatures.securityGetCurrentUser()
      .then((res) => {
        if (res.success) {
          setCurrentUser(res);
          setNewOwnerName(res.username);
        }
      });
  };

  // Load details on file path changes
  useEffect(() => {
    if (selectedItem) {
      setSelectedPath(selectedItem.path);
      loadPathDetails(selectedItem.path);
      // Determine if file is encrypted (.enc)
      if (selectedItem.path.endsWith(".enc")) {
        setEncryptionStatus("AES-256 Encrypted File");
      } else {
        setEncryptionStatus("Not Encrypted");
      }
    } else {
      setSelectedPath("");
      setPermissions([]);
      setOwner("—");
    }
  }, [selectedItem]);

  // General tab load triggers
  useEffect(() => {
    loadCurrentUser();
    loadAuditLogs();

    // Subscribe to secure delete progress events
    const unsubDelete = window.electronFeatures.onSecurityDeleteProgress((data) => {
      setDeleteProgress(data.progress);
      setDeleteStatusText(`Deleted file ${data.deleted} of ${data.total}: ${data.currentFile}`);
    });

    return () => {
      unsubDelete();
    };
  }, []);

  // Vault Idle Countdown Lock Timer
  useEffect(() => {
    let interval = null;
    if (!vaultLocked && autoLock) {
      interval = setInterval(() => {
        setVaultCountdown((prev) => {
          if (prev <= 1) {
            handleVaultLock();
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setVaultCountdown(300);
    }
    return () => clearInterval(interval);
  }, [vaultLocked, autoLock]);

  // Helper file selector
  const selectPath = async () => {
    const res = await window.electronFeatures.chooseFile();
    if (res.success && !res.canceled && res.path) {
      setSelectedPath(res.path);
      loadPathDetails(res.path);
      if (res.path.endsWith(".enc")) {
        setEncryptionStatus("AES-256 Encrypted File");
      } else {
        setEncryptionStatus("Not Encrypted");
      }
    }
  };

  // ----------------------------------------------------------
  // 1. Permission Changers
  // ----------------------------------------------------------
  const handleAddPermission = () => {
    if (!selectedPath) return;
    if (!permUsername.trim()) {
      alert("Please enter a username or group.");
      return;
    }

    if (!confirm(`Are you sure you want to alter permissions for user '${permUsername}' on this file?`)) return;

    setLoading(true);
    window.electronFeatures.securitySetPermissions(selectedPath, permUsername.trim(), permRight, permType)
      .then((res) => {
        if (res.success) {
          alert("✓ Permissions set successfully.");
          loadPathDetails(selectedPath);
          loadAuditLogs();
        } else {
          alert(`❌ Failed to set permissions: ${res.error}`);
        }
      })
      .catch((err) => alert(`Error: ${err.message}`))
      .finally(() => setLoading(false));
  };

  const handleResetPermissions = () => {
    if (!selectedPath) return;
    if (!confirm("Are you sure you want to reset inheritance and standard access control levels on this path?")) return;

    setLoading(true);
    // Running taking ownership / resetting inheritance
    window.electronFeatures.securitySetOwner(selectedPath, "current-user")
      .then((res) => {
        if (res.success) {
          alert("✓ Permissions reset successfully.");
          loadPathDetails(selectedPath);
          loadAuditLogs();
        } else {
          alert(`Failed: ${res.error}`);
        }
      })
      .finally(() => setLoading(false));
  };

  // ----------------------------------------------------------
  // 2. Ownership Changers
  // ----------------------------------------------------------
  const handleTakeOwnership = () => {
    if (!selectedPath) return;
    if (!newOwnerName.trim()) {
      alert("Please enter a username to set as owner.");
      return;
    }

    if (!confirm(`Are you sure you want to change the owner of this item to '${newOwnerName}'?`)) return;

    setLoading(true);
    window.electronFeatures.securitySetOwner(selectedPath, newOwnerName.trim())
      .then((res) => {
        if (res.success) {
          alert("✓ Ownership changed successfully.");
          loadPathDetails(selectedPath);
          loadAuditLogs();
        } else {
          alert(`❌ Failed to change owner: ${res.error}\n\nNote: Ownership changes typically require Administrator elevation.`);
        }
      })
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  // ----------------------------------------------------------
  // 3. Attributes Changers
  // ----------------------------------------------------------
  const handleApplyAttributes = () => {
    if (!selectedPath) return;
    if (!confirm("Are you sure you want to modify protection attributes of this file?")) return;

    setLoading(true);
    window.electronFeatures.securitySetAttributes(selectedPath, {
      readonly: attrReadonly,
      hidden: attrHidden,
      system: attrSystem
    })
      .then((res) => {
        if (res.success) {
          alert("✓ File protection attributes applied.");
          loadPathDetails(selectedPath);
          loadAuditLogs();
        } else {
          alert(`Failed: ${res.error}`);
        }
      })
      .finally(() => setLoading(false));
  };

  // ----------------------------------------------------------
  // 4. Secure Delete
  // ----------------------------------------------------------
  const handleSecureDelete = () => {
    if (!selectedPath) {
      alert("Please select a file to securely delete first.");
      return;
    }
    if (!deleteConfirmCheckbox) {
      alert("You must check the confirmation checkbox acknowledging SSD limitations before secure deletion.");
      return;
    }

    if (!confirm("⚠️ WARNING: You are about to SECURELY DELETE this file/folder. Overwritten data cannot be forensically recovered. Do you wish to proceed?")) return;

    setIsDeleting(true);
    setDeleteProgress(0);
    setDeleteStatusText("Initializing byte overwriting sequence...");

    window.electronFeatures.securitySecureDelete(selectedPath)
      .then((res) => {
        setIsDeleting(false);
        if (res.success) {
          setDeleteProgress(100);
          setDeleteStatusText("Item securely destroyed.");
          setSelectedPath("");
          setPermissions([]);
          setOwner("—");
          alert("✓ File securely overwritten and destroyed.");
          loadAuditLogs();
        } else {
          setDeleteProgress(0);
          setDeleteStatusText(`Error: ${res.error}`);
          alert(`❌ Secure delete failed: ${res.error}`);
        }
      })
      .catch((e) => {
        setIsDeleting(false);
        setDeleteProgress(0);
        setDeleteStatusText(`Error: ${e.message}`);
      });
  };

  // ----------------------------------------------------------
  // 5. File Encryption / Decryption
  // ----------------------------------------------------------
  const handleEncryptFile = () => {
    if (!selectedPath) return;
    if (!encPassword) {
      alert("Please enter an encryption password.");
      return;
    }
    if (encPassword !== encConfirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    if (!confirm("Are you sure you want to encrypt this file? The original plaintext file will be securely overwritten and deleted.")) return;

    setLoading(true);
    window.electronFeatures.securityEncrypt(selectedPath, encPassword)
      .then((res) => {
        setLoading(false);
        if (res.success) {
          alert(`✓ File encrypted successfully. Created: ${res.encPath}`);
          setSelectedPath(res.encPath);
          setEncPassword("");
          setEncConfirmPassword("");
          loadPathDetails(res.encPath);
          loadAuditLogs();
        } else {
          alert(`❌ Encryption failed: ${res.error}`);
        }
      })
      .catch((e) => {
        setLoading(false);
        alert(e.message);
      });
  };

  const handleDecryptFile = () => {
    if (!selectedPath) return;
    if (!encPassword) {
      alert("Please enter the decryption password.");
      return;
    }

    if (!confirm("Are you sure you want to decrypt this file?")) return;

    setLoading(true);
    window.electronFeatures.securityDecrypt(selectedPath, encPassword)
      .then((res) => {
        setLoading(false);
        if (res.success) {
          alert(`✓ File decrypted successfully! Restored: ${res.decPath}`);
          setSelectedPath(res.decPath);
          setEncPassword("");
          setEncConfirmPassword("");
          loadPathDetails(res.decPath);
          loadAuditLogs();
        } else {
          alert(`❌ Decryption failed: ${res.error}\n\nEither the password is incorrect or the file has been corrupted.`);
        }
      })
      .catch((e) => {
        setLoading(false);
        alert(e.message);
      });
  };

  // ----------------------------------------------------------
  // 6. Encrypted Vault
  // ----------------------------------------------------------
  const handleSelectVaultPath = async () => {
    const res = await window.electronFeatures.chooseFile();
    if (res.success && !res.canceled && res.path) {
      setVaultPath(res.path);
    }
  };

  const handleCreateVault = async () => {
    if (!vaultPath) {
      alert("Please choose a file path to save your vault (e.g. C:\\Vaults\\private.vault)");
      return;
    }
    if (!vaultPassword) {
      alert("Please enter a vault password.");
      return;
    }

    if (!confirm("Create a new encrypted vault at the selected path?")) return;

    window.electronFeatures.securityVaultCreate(vaultPath, vaultPassword)
      .then((res) => {
        if (res.success) {
          alert(`✓ New encrypted vault created at: ${vaultPath}`);
          loadAuditLogs();
        } else {
          alert(`Failed to create vault: ${res.error}`);
        }
      });
  };

  const handleVaultUnlock = () => {
    if (!vaultPath) {
      alert("Please select a vault container file first.");
      return;
    }
    if (!vaultPassword) {
      alert("Please enter the vault password.");
      return;
    }

    window.electronFeatures.securityVaultUnlock(vaultPath, vaultPassword)
      .then((res) => {
        if (res.success) {
          setVaultLocked(false);
          setVaultFiles(res.files || []);
          setVaultPassword("");
          alert("✓ Vault unlocked in memory!");
          loadAuditLogs();
        } else {
          alert(`❌ Failed to unlock vault: ${res.error}`);
        }
      });
  };

  const handleVaultLock = () => {
    window.electronFeatures.securityVaultLock(vaultPath)
      .then(() => {
        setVaultLocked(true);
        setVaultFiles([]);
        alert("Vault locked. Memory references cleared.");
        loadAuditLogs();
      });
  };

  const handleAddFileToVault = async () => {
    if (vaultLocked) return;
    const res = await window.electronFeatures.chooseFile();
    if (res.success && !res.canceled && res.path) {
      const fileName = res.path.split(/[/\\]/).pop();
      if (!confirm(`Are you sure you want to add file '${fileName}' to the encrypted vault? The original file on disk will be securely overwritten and deleted.`)) return;

      window.electronFeatures.securityVaultAdd(vaultPath, res.path)
        .then((addRes) => {
          if (addRes.success) {
            setVaultFiles(addRes.files || []);
            alert("✓ File added to vault and securely purged from disk.");
            loadAuditLogs();
          } else {
            alert(`Failed: ${addRes.error}`);
          }
        });
    }
  };

  const handleExtractFileFromVault = async (fileName) => {
    if (vaultLocked) return;
    const dest = await window.electronFeatures.chooseFolder();
    if (dest.success && !dest.canceled && dest.path) {
      window.electronFeatures.securityVaultExtract(vaultPath, fileName, dest.path)
        .then((extRes) => {
          if (extRes.success) {
            alert(`✓ File extracted successfully to:\n${extRes.destPath}`);
            loadAuditLogs();
          } else {
            alert(`Failed: ${extRes.error}`);
          }
        });
    }
  };

  // ----------------------------------------------------------
  // 7. Audit Logs Toolbar
  // ----------------------------------------------------------
  const handleClearLogs = () => {
    if (!confirm("Are you sure you want to permanently clear the security audit log database?")) return;
    window.electronFeatures.securityClearLogs()
      .then((res) => {
        if (res.success) {
          loadAuditLogs();
          alert("✓ Security audit logs cleared.");
        }
      });
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.operation.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.path.toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      log.result.toLowerCase().includes(logSearchQuery.toLowerCase());

    if (logFilterOp === "All Operations") return matchesSearch;
    return log.operation.toLowerCase().includes(logFilterOp.toLowerCase()) && matchesSearch;
  });

  return (
    <div className="security-manager">

      {/* =====================================================
          HEADER
          ===================================================== */}
      <div className="security-header">
        <div className="security-title-section">
          <div className="security-main-icon">🔐</div>
          <div>
            <h2>Security Center</h2>
            <p>Manage permissions, protection, encryption and security settings</p>
          </div>
        </div>

        <div className="security-status">
          <span className="security-status-dot"></span>
          <span>Security Status</span>
          <strong>Protected</strong>
        </div>

        <button className="security-close-btn" onClick={onClose}>×</button>
      </div>

      {/* =====================================================
          NAVIGATION
          ===================================================== */}
      <div className="security-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "security-nav-item active" : "security-nav-item"}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="security-nav-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* =====================================================
          MAIN BODY
          ===================================================== */}
      <div className="security-body">

        {/* =================================================
            1. PERMISSIONS
            ================================================= */}
        {activeTab === "permissions" && (
          <div className="security-page">
            <div className="security-page-header">
              <div>
                <h3>Permission System</h3>
                <p>View and manage Windows access control levels (ACLs) dynamically.</p>
              </div>
              <button className="security-secondary-btn" onClick={selectPath}>
                Select File / Folder
              </button>
            </div>

            <div className="security-path-box">
              <span>Selected Path:</span>
              <strong>{selectedPath || "No file or folder selected"}</strong>
            </div>

            <div className="security-card">
              <div className="security-card-header">
                <span>Access Control Rights (ACL)</span>
                <span className={`security-badge ${permissions.length > 0 ? "success" : "neutral"}`}>
                  {permissions.length > 0 ? `${permissions.length} Entries` : "No Entries"}
                </span>
              </div>

              <div className="permission-table" style={{ maxHeight: "180px", overflowY: "auto" }}>
                <div className="permission-row permission-header" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1fr", padding: "8px", fontWeight: "bold" }}>
                  <span>User / Identity</span>
                  <span>Access Type</span>
                  <span>Rights</span>
                  <span>Inherited</span>
                </div>

                {loading ? (
                  <div style={{ padding: "15px", color: "#666", textAlign: "center" }}>Loading permissions...</div>
                ) : error ? (
                  <div style={{ padding: "15px", color: "#ff4343", textAlign: "center" }}>⚠️ {error}</div>
                ) : permissions.length === 0 ? (
                  <div style={{ padding: "20px", color: "#888", textAlign: "center" }}>
                    {selectedPath ? "No access rules found or Access Denied." : "Select an item to inspect rules."}
                  </div>
                ) : (
                  permissions.map((rule, i) => (
                    <div className="permission-row" key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr 1fr", padding: "8px", borderBottom: "1px solid #f3f4f6", fontSize: "11px" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }} title={rule.Identity}>{rule.Identity.split("\\").pop()}</span>
                      <span style={{ color: rule.Type === "Allow" ? "#10b981" : "#ef4444", fontWeight: "bold" }}>{rule.Type}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }} title={rule.Rights}>{rule.Rights}</span>
                      <span>{rule.Inherited ? "Yes" : "No"}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Edit Permission Form */}
              {selectedPath && (
                <div style={{ marginTop: "15px", borderTop: "1px solid #e5e7eb", paddingTop: "15px" }}>
                  <h4 style={{ fontSize: "12px", marginBottom: "8px" }}>Alter ACL Entry</h4>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      style={{ fontSize: "11px", padding: "4px", flex: 1 }}
                      placeholder="Username (e.g. Users, Administrators)"
                      value={permUsername}
                      onChange={(e) => setPermUsername(e.target.value)}
                    />
                    <select style={{ fontSize: "11px", padding: "4px" }} value={permRight} onChange={(e) => setPermRight(e.target.value)}>
                      <option value="read">Read (R)</option>
                      <option value="write">Write (W)</option>
                      <option value="execute">Execute (RX)</option>
                      <option value="full">Full Control (F)</option>
                    </select>
                    <select style={{ fontSize: "11px", padding: "4px" }} value={permType} onChange={(e) => setPermType(e.target.value)}>
                      <option value="grant">Grant</option>
                      <option value="deny">Deny</option>
                    </select>
                    <button className="security-primary-btn" style={{ padding: "4px 8px", fontSize: "11px" }} onClick={handleAddPermission}>
                      Apply ACL
                    </button>
                  </div>
                </div>
              )}

              <div className="permission-actions" style={{ marginTop: "12px" }}>
                <button className="security-secondary-btn" onClick={() => loadPathDetails(selectedPath)} disabled={!selectedPath}>
                  Refresh
                </button>
                <button className="security-secondary-btn danger-outline" onClick={handleResetPermissions} disabled={!selectedPath}>
                  Reset to Inherited
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            2. OWNERSHIP
            ================================================= */}
        {activeTab === "ownership" && (
          <div className="security-page">
            <div className="security-page-header">
              <div>
                <h3>Ownership Details</h3>
                <p>Verify current owner details and change ownership.</p>
              </div>
              <button className="security-secondary-btn" onClick={selectPath}>
                Select File / Folder
              </button>
            </div>

            <div className="security-path-box">
              <span>Selected Path:</span>
              <strong>{selectedPath || "No file or folder selected"}</strong>
            </div>

            <div className="ownership-card">
              <div className="ownership-item">
                <span>Current Owner</span>
                <strong>{owner}</strong>
              </div>

              <div className="ownership-item">
                <span>Logged In User</span>
                <strong>{currentUser.username}</strong>
              </div>

              <div className="ownership-item">
                <span>Process Rights</span>
                <span className={`security-badge ${currentUser.isAdmin ? "critical" : "neutral"}`}>
                  {currentUser.isAdmin ? "Administrator (Elevated)" : "Standard User"}
                </span>
              </div>
            </div>

            {selectedPath && (
              <div className="security-card" style={{ marginTop: "15px", padding: "12px" }}>
                <div className="security-card-title">Change Ownership</div>
                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  <input
                    style={{ flex: 1, fontSize: "12px", padding: "4px" }}
                    placeholder="New Owner Username (e.g. Administrators)"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                  />
                  <button className="security-primary-btn" onClick={handleTakeOwnership}>
                    Apply Owner
                  </button>
                </div>
              </div>
            )}

            <div className="security-warning-card">
              <span>⚠</span>
              <div>
                <strong>Ownership modifications require elevation</strong>
                <p>Changing ownership of folders or files requires corresponding permissions. Administrator console elevation notices will prompt if required.</p>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            3. PROTECTION ATTRIBUTES
            ================================================= */}
        {activeTab === "protected" && (
          <div className="security-page">
            <div className="security-page-header">
              <div>
                <h3>Protection Attributes</h3>
                <p>Read and modify file protection flags (ReadOnly, Hidden, System) on the disk.</p>
              </div>
              <button className="security-secondary-btn" onClick={selectPath}>
                Select File
              </button>
            </div>

            <div className="security-path-box">
              <span>Selected Path:</span>
              <strong>{selectedPath || "No file selected"}</strong>
            </div>

            <div className="security-card" style={{ padding: "15px" }}>
              <div className="security-card-title" style={{ marginTop: 0 }}>Active Attributes Status</div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "15px 0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={attrReadonly}
                    onChange={(e) => setAttrReadonly(e.target.checked)}
                    disabled={!selectedPath}
                  />
                  <span><strong>Read-Only Attribute</strong> (Prevents accidental write/modification)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={attrHidden}
                    onChange={(e) => setAttrHidden(e.target.checked)}
                    disabled={!selectedPath}
                  />
                  <span><strong>Hidden Attribute</strong> (Hides item from normal explorer view lists)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={attrSystem}
                    onChange={(e) => setAttrSystem(e.target.checked)}
                    disabled={!selectedPath}
                  />
                  <span><strong>System Attribute</strong> (Flags item as critical operating system file)</span>
                </label>
              </div>

              <button
                className="security-primary-btn"
                disabled={!selectedPath}
                onClick={handleApplyAttributes}
              >
                Apply Attributes
              </button>
            </div>

            <div className="security-warning-card">
              <span>🛡️</span>
              <div>
                <strong>Natively Verified Attributes</strong>
                <p>These checkboxes display the exact binary headers set on the NTFS filesystem. They are updated dynamically when a path is selected.</p>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            4. SECURE DELETE
            ================================================= */}
        {activeTab === "delete" && (
          <div className="security-page">
            <div className="security-page-header">
              <div>
                <h3>Secure Delete</h3>
                <p>Securely overwrite and destroy files from storage.</p>
              </div>
              <button className="security-secondary-btn" onClick={selectPath}>
                Select File
              </button>
            </div>

            <div className="security-path-box">
              <span>Target:</span>
              <strong>{selectedPath || "No file selected"}</strong>
            </div>

            <div className="security-card" style={{ padding: "15px" }}>
              <div className="security-card-title" style={{ marginTop: 0 }}>Secure Erasure Confirmation</div>
              
              <label className="security-checkbox-row" style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "10px" }}>
                <input
                  type="checkbox"
                  checked={deleteConfirmCheckbox}
                  onChange={(e) => setDeleteConfirmCheckbox(e.target.checked)}
                />
                <span style={{ fontSize: "11px", color: "#4b5563" }}>
                  I confirm that I want to destroy the selected item. I acknowledge that traditional file-level overwriting cannot guarantee physical sector erasure on flash-based Solid State Drives (SSDs/NVMe) due to internal Wear Leveling controllers.
                </span>
              </label>

              <div style={{ marginTop: "15px" }}>
                <button
                  className="security-danger-btn"
                  onClick={handleSecureDelete}
                  disabled={isDeleting || !selectedPath || !deleteConfirmCheckbox}
                  style={{ width: "100%", padding: "10px" }}
                >
                  {isDeleting ? "Shredding..." : "Overwrite & Secure Delete File"}
                </button>
              </div>

              {isDeleting && (
                <div style={{ marginTop: "15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                    <span>Shred Progress</span>
                    <span>{deleteProgress}%</span>
                  </div>
                  <div className="ocr-progress-track">
                    <div className="ocr-progress-value" style={{ width: `${deleteProgress}%`, backgroundColor: "#dc2626" }} />
                  </div>
                  <span style={{ fontSize: "10px", color: "#6b7280", marginTop: "4px", display: "block" }}>{deleteStatusText}</span>
                </div>
              )}
            </div>

            <div className="security-warning-card">
              <span>⚠</span>
              <div>
                <strong>Flash Storage / SSD Limitation Notice</strong>
                <p>Modern flash storage devices write files to varying sectors dynamically. Sector-level logical overwriting destroys file references and path headers, but physical fragments may remain in blocks due to leveling algorithms.</p>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            5. ENCRYPTION
            ================================================= */}
        {activeTab === "encryption" && (
          <div className="security-page">
            <div className="security-page-header">
              <div>
                <h3>AES-256 Authenticated Encryption</h3>
                <p>Encrypt and decrypt files locally using scrypt key derivation and AES-GCM tags.</p>
              </div>
              <button className="security-secondary-btn" onClick={selectPath}>
                Select File
              </button>
            </div>

            <div className="security-path-box">
              <span>File:</span>
              <strong>{selectedPath || "No file selected"}</strong>
            </div>

            <div className="encryption-status-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "10px" }}>
              <div>
                <span>Status</span>
                <strong>{encryptionStatus}</strong>
              </div>
              <div>
                <span>Algorithm</span>
                <strong>{selectedPath ? "AES-256-GCM" : "—"}</strong>
              </div>
            </div>

            {selectedPath && (
              <div className="security-card" style={{ marginTop: "15px", padding: "12px" }}>
                <div className="security-card-title">Credentials</div>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                  <input
                    type="password"
                    placeholder="Enter Encryption/Decryption Password"
                    value={encPassword}
                    onChange={(e) => setEncPassword(e.target.value)}
                    style={{ padding: "6px", fontSize: "12px" }}
                  />
                  
                  {!selectedPath.endsWith(".enc") && (
                    <input
                      type="password"
                      placeholder="Confirm Encryption Password"
                      value={encConfirmPassword}
                      onChange={(e) => setEncConfirmPassword(e.target.value)}
                      style={{ padding: "6px", fontSize: "12px" }}
                    />
                  )}

                  <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                    {selectedPath.endsWith(".enc") ? (
                      <button className="security-primary-btn" onClick={handleDecryptFile}>
                        🔓 Decrypt & Restore File
                      </button>
                    ) : (
                      <button className="security-primary-btn" onClick={handleEncryptFile}>
                        🔒 Encrypt File (Shred original)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================
            6. SECURE VAULT
            ================================================= */}
        {activeTab === "vault" && (
          <div className="security-page">
            <div className="vault-header">
              <div>
                <h3>Secure Vault</h3>
                <p>Browse and store files within encrypted `.vault` archives loaded in memory.</p>
              </div>
              <div className="vault-status">
                <span className={vaultLocked ? "vault-lock-icon locked" : "vault-lock-icon unlocked"}>
                  {vaultLocked ? "🔒" : "🔓"}
                </span>
                <span>{vaultLocked ? "Locked" : "Unlocked"}</span>
                {!vaultLocked && autoLock && (
                  <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "5px" }}>
                    ({Math.floor(vaultCountdown / 60)}:{(vaultCountdown % 60).toString().padStart(2, "0")})
                  </span>
                )}
              </div>
            </div>

            <div className="security-card" style={{ padding: "12px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input className="vault"
                  style={{ flex: 1, fontSize: "11px", padding: "4px" }}
                  placeholder="Vault path (e.g. C:\\MyVault.vault)"
                  value={vaultPath}
                  onChange={(e) => setVaultPath(e.target.value)}
                />
                <button className="security-secondary-btn" onClick={handleSelectVaultPath}>
                  Choose Vault
                </button>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "10px" }}>
                <input className="vault"
                  type="password"
                  style={{ flex: 1, fontSize: "11px", padding: "4px" }}
                  placeholder="Vault Password"
                  value={vaultPassword}
                  onChange={(e) => setVaultPassword(e.target.value)}
                />
                {vaultLocked ? (
                  <>
                    <button className="security-primary-btn" onClick={handleVaultUnlock}>Unlock Vault</button>
                    <button className="security-secondary-btn" onClick={handleCreateVault}>Create New</button>
                  </>
                ) : (
                  <button className="ocr-danger-btn" onClick={handleVaultLock}>Lock Vault</button>
                )}
              </div>
              <div style={{ marginTop: "10px" }}>
                <label className="security-checkbox-row" style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={autoLock}
                    onChange={(e) => setAutoLock(e.target.checked)}
                  />
                  <span style={{ fontSize: "11px" }}>Enable automatic lock (5 min idle)</span>
                </label>
              </div>
            </div>

            {!vaultLocked && (
              <div className="security-card" style={{ marginTop: "15px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", marginBottom: "8px" }}>
                  <strong>Vault File Contents</strong>
                  <button className="security-primary-btn" style={{ fontSize: "11px", padding: "2px 8px" }} onClick={handleAddFileToVault}>
                    + Import File to Vault
                  </button>
                </div>

                <div className="ocr-share-list" style={{ maxHeight: "150px", overflowY: "auto" }}>
                  {vaultFiles.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#9ca3af", fontSize: "11px" }}>
                      Vault is empty. Click Import File to add.
                    </div>
                  ) : (
                    vaultFiles.map((file) => (
                      <div className="ocr-share-row" key={file.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px", borderBottom: "1px solid #f3f4f6", fontSize: "12px" }}>
                        <span>📁 {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                        <button className="security-small-btn" onClick={() => handleExtractFileFromVault(file.name)}>
                          Extract File
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =================================================
            7. LOGS
            ================================================= */}
        {activeTab === "logs" && (
          <div className="security-page">
            <div className="security-page-header">
              <div>
                <h3>Security Audit Logs</h3>
                <p>Browse audit-logged security file events. Logs survive app restarts.</p>
              </div>
              <button className="ocr-danger-btn" onClick={handleClearLogs}>
                Clear Logs
              </button>
            </div>

            <div className="log-toolbar" style={{ display: "flex", gap: "10px", margin: "10px 0" }}>
              <select value={logFilterOp} onChange={(e) => setLogFilterOp(e.target.value)}>
                <option value="All Operations">All Operations</option>
                <option value="change-ownership">Ownership Change</option>
                <option value="change-permissions">Permissions Change</option>
                <option value="set-attributes">Attributes Change</option>
                <option value="secure-delete">Secure Delete</option>
                <option value="file-encryption">Encryption</option>
                <option value="file-decryption">Decryption</option>
                <option value="vault">Vault Actions</option>
              </select>

              <input
                type="text"
                placeholder="Search logs..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                style={{ flex: 1, padding: "4px", fontSize: "12px" }}
              />
            </div>

            <div className="logs-table" style={{ maxHeight: "200px", overflowY: "auto" }}>
              <div className="logs-table-header" style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 3fr 1fr 1fr", fontWeight: "bold", padding: "6px", borderBottom: "1px solid #e5e7eb", fontSize: "11px" }}>
                <span>Time</span>
                <span>Operation</span>
                <span>Path</span>
                <span>User</span>
                <span>Status</span>
              </div>

              {filteredLogs.length === 0 ? (
                <div style={{ padding: "30px", color: "#9ca3af", textAlign: "center", fontSize: "11px" }}>
                  No security logs match filters.
                </div>
              ) : (
                filteredLogs.map((log, i) => (
                  <div
                    key={i}
                    style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 3fr 1fr 1fr", padding: "6px", borderBottom: "1px solid #f3f4f6", fontSize: "10px", alignItems: "center" }}
                  >
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                    <strong>{log.operation}</strong>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.path}>
                      {log.path}
                    </span>
                    <span>{log.user}</span>
                    <span style={{ fontWeight: "bold", color: log.result === "Success" ? "#10b981" : "#ef4444" }}>
                      {log.result}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =================================================
            8. THREAT PROTECTION
            ================================================= */}
        {activeTab === "threats" && (
          <div className="security-page">
            <div className="security-page-header">
              <div>
                <h3>Threat Risk Analysis</h3>
                <p>Inspect file structural risks and query Windows Defender signatures locally.</p>
              </div>
              <button className="security-secondary-btn" onClick={selectPath}>
                Select File to Scan
              </button>
            </div>

            <div className="security-path-box">
              <span>Scanning:</span>
              <strong>{selectedPath || "No file selected"}</strong>
            </div>

            {selectedPath && (
              <div className="security-card" style={{ padding: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                  <div>
                    <span>Analysis Result Status:</span>
                    <strong style={{
                      display: "block",
                      fontSize: "18px",
                      color: threatStatus === "Safe" ? "#10b981" : threatStatus === "Suspicious" ? "#dc2626" : "#6b7280"
                    }}>
                      {threatStatus}
                    </strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span>Threat Risk Score:</span>
                    <strong style={{ display: "block", fontSize: "18px" }}>{threatScore} / 100</strong>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "10px" }}>
                  <strong>Defender Signature Scan</strong>
                  <div style={{ fontSize: "12px", marginTop: "4px", padding: "6px", backgroundColor: "#f9fafb", borderRadius: "4px" }}>
                    Result: <strong>{defenderStatus}</strong>
                  </div>
                </div>

                {threatReasons.length > 0 && (
                  <div style={{ marginTop: "15px" }}>
                    <strong>Detected Risk Anomalies:</strong>
                    <ul style={{ paddingLeft: "15px", fontSize: "11px", color: "#b91c1c", marginTop: "5px" }}>
                      {threatReasons.map((r, idx) => (
                        <li key={idx} style={{ marginBottom: "3px" }}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="security-warning-card">
              <span>🛡️</span>
              <div>
                <strong>Local Static Rules Notice</strong>
                <p>This is a warning detection system designed to alert you about suspicious extensions (like double extensions) and binary risks. It does not replace a full security suite.</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* =====================================================
          FOOTER
          ===================================================== */}
      <div className="security-footer">
        <div className="security-footer-left">
          <span>Security Center</span>
          <span>•</span>
          <strong>{tabs.find((tab) => tab.id === activeTab)?.label}</strong>
        </div>
        <div className="security-footer-right">
          <span className="security-footer-dot"></span>
          <span>Protection monitoring ready</span>
        </div>
      </div>

    </div>
  );
}

export default SecurityManager;