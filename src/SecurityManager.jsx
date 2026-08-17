/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import "./SecurityManager.css";

function SecurityManager({ selectedItem, onClose }) {
  const [activeTab, setActiveTab] = useState("permissions");
  const [selectedPath, setSelectedPath] = useState("");
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedItem) {
      setSelectedPath(selectedItem.path);
      setLoading(true);
      setError("");
      window.electronFeatures
        .getAdvancedFileInfo(selectedItem.path)
        .then((res) => {
          if (res && res.success) {
            setFileInfo(res.data);
          } else {
            setError(res?.error || "Failed to load permissions");
          }
        })
        .catch((err) => {
          setError(err.message || "Failed to load permissions");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setSelectedPath("");
      setFileInfo(null);
    }
  }, [selectedItem]);

  const [autoLock, setAutoLock] = useState(true);
  const [vaultLocked, setVaultLocked] = useState(true);
  const [showSensitiveLogs, setShowSensitiveLogs] = useState(false);

  const tabs = [
    {
      id: "permissions",
      label: "Permissions",
      icon: "◈",
    },
    {
      id: "ownership",
      label: "Ownership",
      icon: "♙",
    },
    {
      id: "protected",
      label: "Protection",
      icon: "⬢",
    },
    {
      id: "delete",
      label: "Secure Delete",
      icon: "⌫",
    },
    {
      id: "encryption",
      label: "Encryption",
      icon: "▣",
    },
    {
      id: "vault",
      label: "Vault",
      icon: "▰",
    },
    {
      id: "logs",
      label: "Logs",
      icon: "☷",
    },
    {
      id: "threats",
      label: "Threat Protection",
      icon: "△",
    },
  ];

  const selectPath = () => {
    console.log("Path selector will be connected later");
  };

  return (
    <div className="security-manager">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="security-header">

        <div className="security-title-section">

          <div className="security-main-icon">
            🔐
          </div>

          <div>
            <h2>Security Center</h2>

            <p>
              Manage permissions, protection, encryption and
              security settings
            </p>
          </div>

        </div>

        <div className="security-status">

          <span className="security-status-dot"></span>

          <span>
            Security Status
          </span>

          <strong>
            Protected
          </strong>

        </div>

        <button
          className="security-close-btn"
          onClick={onClose}
        >
          ×
        </button>

      </div>


      {/* =====================================================
          NAVIGATION
          ===================================================== */}

      <div className="security-navigation">

        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={
              activeTab === tab.id
                ? "security-nav-item active"
                : "security-nav-item"
            }
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="security-nav-icon">
              {tab.icon}
            </span>

            <span>
              {tab.label}
            </span>
          </button>
        ))}

      </div>


      {/* =====================================================
          MAIN BODY
          ===================================================== */}

      <div className="security-body">

        {/* =================================================
            PERMISSIONS
            ================================================= */}

        {activeTab === "permissions" && (
          <div className="security-page">

            <div className="security-page-header">

              <div>
                <h3>
                  Permission System
                </h3>

                <p>
                  View and manage file and folder permissions.
                </p>
              </div>

              <button
                className="security-secondary-btn"
                onClick={selectPath}
              >
                Select File / Folder
              </button>

            </div>


            <div className="security-path-box">

              <span>
                Selected:
              </span>

              <strong>
                {selectedPath || "No file or folder selected"}
              </strong>

            </div>


            <div className="security-card">

              <div className="security-card-header">
                <span>
                  Permission Details
                </span>

                <span className={`security-badge ${fileInfo ? "success" : "neutral"}`}>
                  {fileInfo ? "Loaded" : "Not Loaded"}
                </span>
              </div>


              <div className="permission-table">

                <div className="permission-row permission-header">
                  <span>User / Group</span>
                  <span>Read</span>
                  <span>Write</span>
                  <span>Execute</span>
                </div>

{loading && (
                  <div style={{ padding: "15px", color: "#666", textAlign: "center" }}>Loading permissions...</div>
                )}
                {error && (
                  <div style={{ padding: "15px", color: "#ff4343", textAlign: "center" }}>⚠️ {error}</div>
                )}
                {!loading && !error && fileInfo && (
                  <>
                    <div className="permission-row">
                      <span>Owner / User</span>
                      <span className="permission-state" style={{ color: (fileInfo.permissions & 0o400) ? "#4caf50" : "#f44336", fontWeight: "bold" }}>
                        {(fileInfo.permissions & 0o400) ? "Read" : "—"}
                      </span>
                      <span className="permission-state" style={{ color: (fileInfo.permissions & 0o200) ? "#4caf50" : "#f44336", fontWeight: "bold" }}>
                        {(fileInfo.permissions & 0o200) ? "Write" : "—"}
                      </span>
                      <span className="permission-state" style={{ color: (fileInfo.permissions & 0o100) ? "#4caf50" : "#f44336", fontWeight: "bold" }}>
                        {(fileInfo.permissions & 0o100) ? "Execute" : "—"}
                      </span>
                    </div>
                    <div className="permission-row">
                      <span>Group Users</span>
                      <span className="permission-state" style={{ color: (fileInfo.permissions & 0o040) ? "#4caf50" : "#f44336", fontWeight: "bold" }}>
                        {(fileInfo.permissions & 0o040) ? "Read" : "—"}
                      </span>
                      <span className="permission-state" style={{ color: (fileInfo.permissions & 0o020) ? "#4caf50" : "#f44336", fontWeight: "bold" }}>
                        {(fileInfo.permissions & 0o020) ? "Write" : "—"}
                      </span>
                      <span className="permission-state" style={{ color: (fileInfo.permissions & 0o010) ? "#4caf50" : "#f44336", fontWeight: "bold" }}>
                        {(fileInfo.permissions & 0o010) ? "Execute" : "—"}
                      </span>
                    </div>
                    <div className="permission-row">
                      <span>Others</span>
                      <span className="permission-state" style={{ color: (fileInfo.permissions & 0o004) ? "#4caf50" : "#f44336", fontWeight: "bold" }}>
                        {(fileInfo.permissions & 0o004) ? "Read" : "—"}
                      </span>
                      <span className="permission-state" style={{ color: (fileInfo.permissions & 0o002) ? "#4caf50" : "#f44336", fontWeight: "bold" }}>
                        {(fileInfo.permissions & 0o002) ? "Write" : "—"}
                      </span>
                      <span className="permission-state" style={{ color: (fileInfo.permissions & 0o001) ? "#4caf50" : "#f44336", fontWeight: "bold" }}>
                        {(fileInfo.permissions & 0o001) ? "Execute" : "—"}
                      </span>
                    </div>
                  </>
                )}
                {!selectedItem && (
                  <div style={{ padding: "20px", color: "#888", textAlign: "center" }}>
                    Select a file or folder in the Explorer to inspect its permissions.
                  </div>
                )}

              </div>


              <div className="permission-actions">

                <button
                  className="security-secondary-btn"
                >
                  View Permissions
                </button>

                <button
                  className="security-secondary-btn"
                >
                  Edit Permissions
                </button>

                <button
                  className="security-secondary-btn danger-outline"
                >
                  Reset Permissions
                </button>

              </div>

            </div>


            <div className="security-info-grid">

              <div className="security-info-card">

                <span className="info-card-icon">
                  ◈
                </span>

                <div>
                  <strong>
                    Read Permission
                  </strong>

                  <p>
                    Check whether the current user can read
                    this file or folder.
                  </p>
                </div>

              </div>


              <div className="security-info-card">

                <span className="info-card-icon">
                  ✎
                </span>

                <div>
                  <strong>
                    Write Permission
                  </strong>

                  <p>
                    Check whether the current user can modify
                    the selected item.
                  </p>
                </div>

              </div>


              <div className="security-info-card">

                <span className="info-card-icon">
                  ▶
                </span>

                <div>
                  <strong>
                    Execute Permission
                  </strong>

                  <p>
                    Detect whether execution is allowed.
                  </p>
                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            OWNERSHIP
            ================================================= */}

        {activeTab === "ownership" && (
          <div className="security-page">

            <div className="security-page-header">

              <div>
                <h3>
                  Ownership
                </h3>

                <p>
                  View ownership and current user information.
                </p>
              </div>

              <button
                className="security-secondary-btn"
                onClick={selectPath}
              >
                Select File / Folder
              </button>

            </div>


            <div className="ownership-card">

              <div className="ownership-item">
                <span>
                  File Owner
                </span>

                <strong>
                  —
                </strong>
              </div>

              <div className="ownership-item">
                <span>
                  Folder Owner
                </span>

                <strong>
                  —
                </strong>
              </div>

              <div className="ownership-item">
                <span>
                  Current User
                </span>

                <strong>
                  Detecting...
                </strong>
              </div>

              <div className="ownership-item">
                <span>
                  Administrator
                </span>

                <span className="security-badge neutral">
                  Detecting...
                </span>
              </div>

            </div>


            <div className="security-warning-card">

              <span>
                ⚠
              </span>

              <div>
                <strong>
                  Ownership changes require caution
                </strong>

                <p>
                  Changing ownership of system files can affect
                  Windows security and system stability.
                </p>
              </div>

            </div>

          </div>
        )}


        {/* =================================================
            PROTECTED LOCATIONS
            ================================================= */}

        {activeTab === "protected" && (
          <div className="security-page">

            <div className="security-page-header">

              <div>
                <h3>
                  Protected Locations
                </h3>

                <p>
                  Detect sensitive Windows locations before
                  performing file operations.
                </p>
              </div>

            </div>


            <div className="protected-location-list">

              <div className="protected-location-item">

                <div>
                  <strong>
                    Windows System Folder
                  </strong>

                  <span>
                    System files and operating system components
                  </span>
                </div>

                <span className="security-badge protected">
                  Protected
                </span>

              </div>


              <div className="protected-location-item">

                <div>
                  <strong>
                    Program Files
                  </strong>

                  <span>
                    Installed applications and program files
                  </span>
                </div>

                <span className="security-badge protected">
                  Protected
                </span>

              </div>


              <div className="protected-location-item">

                <div>
                  <strong>
                    System32
                  </strong>

                  <span>
                    Critical Windows system components
                  </span>
                </div>

                <span className="security-badge critical">
                  Critical
                </span>

              </div>


              <div className="protected-location-item">

                <div>
                  <strong>
                    Registry-related Locations
                  </strong>

                  <span>
                    Sensitive system configuration
                  </span>
                </div>

                <span className="security-badge warning">
                  Warning
                </span>

              </div>

            </div>


            <div className="security-warning-card">

              <span>
                🛡️
              </span>

              <div>

                <strong>
                  Protected file warning
                </strong>

                <p>
                  The application should never blindly modify
                  or delete Windows system files.
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            SECURE DELETE
            ================================================= */}

        {activeTab === "delete" && (
          <div className="security-page">

            <div className="security-page-header">

              <div>
                <h3>
                  Secure Delete
                </h3>

                <p>
                  Configure how files are removed from the system.
                </p>
              </div>

            </div>


            <div className="delete-method-grid">

              <button className="delete-method-card">

                <span>
                  🗑️
                </span>

                <strong>
                  Normal Delete
                </strong>

                <p>
                  Move the file to the Recycle Bin.
                </p>

              </button>


              <button className="delete-method-card">

                <span>
                  ✕
                </span>

                <strong>
                  Permanent Delete
                </strong>

                <p>
                  Delete without using the Recycle Bin.
                </p>

              </button>


              <button className="delete-method-card">

                <span>
                  🔒
                </span>

                <strong>
                  Secure Delete
                </strong>

                <p>
                  Use an appropriate secure-erasure mechanism.
                </p>

              </button>

            </div>


            <div className="delete-settings-card">

              <h4>
                Secure Delete Settings
              </h4>

              <label className="security-radio-row">
                <input
                  type="radio"
                  name="delete-method"
                  defaultChecked
                />

                <span>
                  Recycle Bin
                </span>
              </label>

              <label className="security-radio-row">
                <input
                  type="radio"
                  name="delete-method"
                />

                <span>
                  Permanent Delete
                </span>
              </label>

              <label className="security-radio-row">
                <input
                  type="radio"
                  name="delete-method"
                />

                <span>
                  Secure Erase
                </span>
              </label>

            </div>


            <div className="security-warning-card">

              <span>
                ⚠
              </span>

              <div>

                <strong>
                  SSD / NVMe limitation
                </strong>

                <p>
                  Traditional multi-pass overwriting is not a
                  guaranteed secure-erasure method for SSDs.
                  The appropriate secure-erase mechanism depends
                  on the storage device.
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            ENCRYPTION
            ================================================= */}

        {activeTab === "encryption" && (
          <div className="security-page">

            <div className="security-page-header">

              <div>
                <h3>
                  File Encryption
                </h3>

                <p>
                  Encrypt and decrypt files and folders securely.
                </p>
              </div>

            </div>


            <div className="encryption-actions">

              <button className="encryption-action-card">

                <span>
                  🔒
                </span>

                <strong>
                  Encrypt File
                </strong>

                <p>
                  Protect a selected file.
                </p>

              </button>


              <button className="encryption-action-card">

                <span>
                  🔐
                </span>

                <strong>
                  Encrypt Folder
                </strong>

                <p>
                  Protect a selected folder.
                </p>

              </button>


              <button className="encryption-action-card">

                <span>
                  🔓
                </span>

                <strong>
                  Decrypt
                </strong>

                <p>
                  Unlock an encrypted item.
                </p>

              </button>

            </div>


            <div className="encryption-status-card">

              <div>
                <span>
                  Encryption Status
                </span>

                <strong>
                  Not Available
                </strong>
              </div>

              <div>
                <span>
                  Algorithm
                </span>

                <strong>
                  —
                </strong>
              </div>

              <div>
                <span>
                  Key Status
                </span>

                <strong>
                  —
                </strong>
              </div>

            </div>


            <div className="security-warning-card">

              <span>
                🔐
              </span>

              <div>

                <strong>
                  Key management
                </strong>

                <p>
                  Encryption keys must be handled separately from
                  ordinary file passwords and must never be exposed
                  in logs.
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            VAULT
            ================================================= */}

        {activeTab === "vault" && (
          <div className="security-page">

            <div className="vault-header">

              <div>

                <h3>
                  Secure Vault
                </h3>

                <p>
                  Store protected files inside an encrypted vault.
                </p>

              </div>

              <div className="vault-status">

                <span
                  className={
                    vaultLocked
                      ? "vault-lock-icon locked"
                      : "vault-lock-icon unlocked"
                  }
                >
                  {vaultLocked ? "🔒" : "🔓"}
                </span>

                <span>
                  {vaultLocked
                    ? "Vault Locked"
                    : "Vault Unlocked"}
                </span>

              </div>

            </div>


            <div className="vault-main-card">

              <div className="vault-large-icon">
                {vaultLocked ? "🔒" : "🔓"}
              </div>

              <h3>
                {vaultLocked
                  ? "Your vault is locked"
                  : "Your vault is unlocked"}
              </h3>

              <p>
                {vaultLocked
                  ? "Unlock the vault to access protected files."
                  : "Protected files are currently accessible."}
              </p>


              <button
                className="security-primary-btn"
                onClick={() =>
                  setVaultLocked(!vaultLocked)
                }
              >
                {vaultLocked
                  ? "Unlock Vault"
                  : "Lock Vault"}
              </button>

            </div>


            <div className="vault-settings">

              <h4>
                Vault Settings
              </h4>

              <label className="security-checkbox-row">

                <input
                  type="checkbox"
                  checked={autoLock}
                  onChange={(e) =>
                    setAutoLock(e.target.checked)
                  }
                />

                <span>
                  Enable automatic lock
                </span>

              </label>


              <div className="vault-actions">

                <button className="security-secondary-btn">
                  Create Vault
                </button>

                <button className="security-secondary-btn">
                  Add Files
                </button>

                <button className="security-secondary-btn">
                  Remove Files
                </button>

              </div>

            </div>


            <div className="security-warning-card">

              <span>
                ⚠
              </span>

              <div>

                <strong>
                  Failed-attempt protection
                </strong>

                <p>
                  Repeated failed unlock attempts should be
                  handled carefully when the actual vault system
                  is implemented.
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            LOGS
            ================================================= */}

        {activeTab === "logs" && (
          <div className="security-page">

            <div className="security-page-header">

              <div>

                <h3>
                  Security Logs
                </h3>

                <p>
                  Review security-related file operations.
                </p>

              </div>

              <button className="security-secondary-btn">
                Export Logs
              </button>

            </div>


            <div className="log-toolbar">

              <select>
                <option>
                  All Operations
                </option>

                <option>
                  Copy
                </option>

                <option>
                  Move
                </option>

                <option>
                  Rename
                </option>

                <option>
                  Delete
                </option>

                <option>
                  Permission Change
                </option>

                <option>
                  Encryption
                </option>

                <option>
                  Access
                </option>
              </select>

              <input
                type="text"
                placeholder="Search logs..."
              />

              <button className="security-secondary-btn">
                Clear Logs
              </button>

            </div>


            <div className="logs-table">

              <div className="logs-table-header">
                <span>Time</span>
                <span>Operation</span>
                <span>Path</span>
                <span>User</span>
                <span>Status</span>
              </div>


              <div className="logs-empty">

                <div>
                  ☷
                </div>

                <strong>
                  No logs available
                </strong>

                <p>
                  File operation logs will appear here.
                </p>

              </div>

            </div>


            <label className="security-checkbox-row">

              <input
                type="checkbox"
                checked={showSensitiveLogs}
                onChange={(e) =>
                  setShowSensitiveLogs(e.target.checked)
                }
              />

              <span>
                Show extended log information
              </span>

            </label>


            <div className="security-info-note">

              🔒 Sensitive information such as passwords,
              encryption keys and secret tokens must never
              be written to logs.

            </div>

          </div>
        )}


        {/* =================================================
            THREAT PROTECTION
            ================================================= */}

        {activeTab === "threats" && (
          <div className="security-page">

            <div className="security-page-header">

              <div>

                <h3>
                  Threat & Suspicious File Protection
                </h3>

                <p>
                  Warn users before potentially risky file
                  operations.
                </p>

              </div>

            </div>


            <div className="threat-list">

              <div className="threat-item">

                <div>
                  <strong>
                    Suspicious Extension
                  </strong>

                  <span>
                    Detect potentially dangerous extensions.
                  </span>
                </div>

                <span className="security-badge warning">
                  Warning
                </span>

              </div>


              <div className="threat-item">

                <div>
                  <strong>
                    Executable File
                  </strong>

                  <span>
                    Warn before opening executable files.
                  </span>
                </div>

                <span className="security-badge warning">
                  Warning
                </span>

              </div>


              <div className="threat-item">

                <div>
                  <strong>
                    Script File
                  </strong>

                  <span>
                    Detect script-based files.
                  </span>
                </div>

                <span className="security-badge warning">
                  Warning
                </span>

              </div>


              <div className="threat-item">

                <div>
                  <strong>
                    Double Extension
                  </strong>

                  <span>
                    Example: document.pdf.exe
                  </span>
                </div>

                <span className="security-badge critical">
                  High Risk
                </span>

              </div>


              <div className="threat-item">

                <div>
                  <strong>
                    Dangerous Location
                  </strong>

                  <span>
                    Detect sensitive system locations.
                  </span>
                </div>

                <span className="security-badge protected">
                  Protected
                </span>

              </div>


              <div className="threat-item">

                <div>
                  <strong>
                    Archive Warning
                  </strong>

                  <span>
                    Warn about potentially risky archive contents.
                  </span>
                </div>

                <span className="security-badge warning">
                  Warning
                </span>

              </div>

            </div>


            <div className="security-warning-card">

              <span>
                🛡️
              </span>

              <div>

                <strong>
                  User confirmation
                </strong>

                <p>
                  Warnings should inform the user without
                  pretending to be a complete antivirus system.
                </p>

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

          <span>
            Security Center
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

        <div className="security-footer-right">

          <span className="security-footer-dot"></span>

          <span>
            Protection monitoring ready
          </span>

        </div>

      </div>

    </div>
  );
}

export default SecurityManager;