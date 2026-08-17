import { useState } from "react";
import "./CloudIntegration.css";

function CloudIntegration({ onClose }) {
  const [activeTab, setActiveTab] = useState("providers");
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [syncMode, setSyncMode] = useState("two-way");
  const [showConflict, setShowConflict] = useState(false);

  const providers = [
    {
      id: "google",
      name: "Google Drive",
      icon: "G",
      status: "Not connected",
    },
    {
      id: "onedrive",
      name: "OneDrive",
      icon: "O",
      status: "Connected",
    },
    {
      id: "dropbox",
      name: "Dropbox",
      icon: "D",
      status: "Not connected",
    },
    {
      id: "s3",
      name: "Amazon S3",
      icon: "S3",
      status: "Not connected",
    },
    {
      id: "s3-compatible",
      name: "S3 Compatible",
      icon: "S3",
      status: "Not connected",
    },
    {
      id: "nas",
      name: "NAS / Cloud Storage",
      icon: "▤",
      status: "Connected",
    },
  ];

  const cloudFiles = [
    {
      name: "Documents",
      type: "Folder",
      size: "—",
      modified: "Today",
    },
    {
      name: "Photos",
      type: "Folder",
      size: "—",
      modified: "Yesterday",
    },
    {
      name: "Project.pdf",
      type: "PDF",
      size: "18.4 MB",
      modified: "Aug 12",
    },
    {
      name: "Backup.zip",
      type: "Archive",
      size: "2.4 GB",
      modified: "Aug 10",
    },
  ];

  return (
    <div className="cloud-integration">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="cloud-header">

        <div className="cloud-title-section">

          <div className="cloud-main-icon">
            ☁
          </div>

          <div>

            <h2>
              Cloud Storage
            </h2>

            <p>
              Manage cloud files, synchronization and
              connected storage
            </p>

          </div>

        </div>


        <div className="cloud-status">

          <span className="cloud-status-dot"></span>

          <span>
            Connections
          </span>

          <strong>
            2 Active
          </strong>

        </div>


        <button
          className="cloud-close-btn"
          onClick={onClose}
        >
          ×
        </button>

      </div>


      {/* =====================================================
          NAVIGATION
          ===================================================== */}

      <div className="cloud-navigation">

        <button
          className={
            activeTab === "providers"
              ? "cloud-nav-item active"
              : "cloud-nav-item"
          }
          onClick={() => setActiveTab("providers")}
        >
          ☁ Providers
        </button>

        <button
          className={
            activeTab === "files"
              ? "cloud-nav-item active"
              : "cloud-nav-item"
          }
          onClick={() => setActiveTab("files")}
        >
          ▦ Files
        </button>

        <button
          className={
            activeTab === "sync"
              ? "cloud-nav-item active"
              : "cloud-nav-item"
          }
          onClick={() => setActiveTab("sync")}
        >
          ↻ Sync
        </button>

        <button
          className={
            activeTab === "offline"
              ? "cloud-nav-item active"
              : "cloud-nav-item"
          }
          onClick={() => setActiveTab("offline")}
        >
          ◉ Offline Files
        </button>

        <button
          className={
            activeTab === "conflicts"
              ? "cloud-nav-item active"
              : "cloud-nav-item"
          }
          onClick={() => setActiveTab("conflicts")}
        >
          ⚠ Conflicts
        </button>

        <button
          className={
            activeTab === "security"
              ? "cloud-nav-item active"
              : "cloud-nav-item"
          }
          onClick={() => setActiveTab("security")}
        >
          🔐 Security
        </button>

      </div>


      {/* =====================================================
          BODY
          ===================================================== */}

      <div className="cloud-body">


        {/* =================================================
            A. PROVIDERS
            ================================================= */}

        {activeTab === "providers" && (
          <div className="cloud-page">

            <div className="cloud-page-header">

              <div>

                <h3>
                  Cloud Providers
                </h3>

                <p>
                  Connect your cloud storage accounts.
                </p>

              </div>

              <button className="cloud-primary-btn">
                + Add Cloud
              </button>

            </div>


            <div className="cloud-provider-grid">

              {providers.map((provider) => (
                <div
                  className={
                    selectedProvider === provider.id
                      ? "cloud-provider-card selected"
                      : "cloud-provider-card"
                  }
                  key={provider.id}
                  onClick={() =>
                    setSelectedProvider(provider.id)
                  }
                >

                  <div className="cloud-provider-top">

                    <div className="cloud-provider-icon">
                      {provider.icon}
                    </div>

                    <div
                      className={
                        provider.status === "Connected"
                          ? "cloud-connected"
                          : "cloud-disconnected"
                      }
                    >
                      <span></span>

                      {provider.status}
                    </div>

                  </div>


                  <strong>
                    {provider.name}
                  </strong>


                  <p>
                    {provider.status === "Connected"
                      ? "Ready to browse and sync files."
                      : "Connect this storage provider."}
                  </p>


                  <button
                    className={
                      provider.status === "Connected"
                        ? "cloud-secondary-btn"
                        : "cloud-primary-btn"
                    }
                  >
                    {provider.status === "Connected"
                      ? "Manage"
                      : "Connect"}
                  </button>

                </div>
              ))}

            </div>


            {/* Connection Summary */}

            <div className="cloud-section-card">

              <div className="cloud-section-title">
                Storage Summary
              </div>

              <div className="cloud-summary-grid">

                <div>
                  <span>
                    Connected Providers
                  </span>

                  <strong>
                    2
                  </strong>
                </div>

                <div>
                  <span>
                    Cloud Files
                  </span>

                  <strong>
                    8,420
                  </strong>
                </div>

                <div>
                  <span>
                    Cloud Storage
                  </span>

                  <strong>
                    1.8 TB
                  </strong>
                </div>

                <div>
                  <span>
                    Syncing
                  </span>

                  <strong>
                    1
                  </strong>
                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            B. FILES
            ================================================= */}

        {activeTab === "files" && (
          <div className="cloud-page">

            <div className="cloud-page-header">

              <div>

                <h3>
                  Cloud Files
                </h3>

                <p>
                  Browse and manage files stored in connected
                  cloud providers.
                </p>

              </div>

              <select className="cloud-select">

                <option>
                  OneDrive
                </option>

                <option>
                  NAS
                </option>

                <option>
                  Google Drive
                </option>

              </select>

            </div>


            {/* Breadcrumb */}

            <div className="cloud-breadcrumb">

              <span>
                OneDrive
              </span>

              <span>
                /
              </span>

              <strong>
                My Files
              </strong>

            </div>


            {/* Files */}

            <div className="cloud-file-table">

              <div className="cloud-table-header">

                <span>
                  Name
                </span>

                <span>
                  Type
                </span>

                <span>
                  Size
                </span>

                <span>
                  Modified
                </span>

                <span>
                  Actions
                </span>

              </div>


              {cloudFiles.map((file) => (
                <div
                  className="cloud-file-row"
                  key={file.name}
                >

                  <div className="cloud-file-name">

                    <span>
                      {file.type === "Folder"
                        ? "▰"
                        : "▤"}
                    </span>

                    <strong>
                      {file.name}
                    </strong>

                  </div>

                  <span>
                    {file.type}
                  </span>

                  <span>
                    {file.size}
                  </span>

                  <span>
                    {file.modified}
                  </span>

                  <div className="cloud-file-actions">

                    <button>
                      ↓
                    </button>

                    <button>
                      →
                    </button>

                    <button>
                      ⋮
                    </button>

                  </div>

                </div>
              ))}

            </div>


            {/* Operations */}

            <div className="cloud-operation-bar">

              <button>
                ↑ Upload
              </button>

              <button>
                ↓ Download
              </button>

              <button>
                + New Folder
              </button>

              <button>
                Copy
              </button>

              <button>
                Move
              </button>

              <button>
                Rename
              </button>

              <button>
                Delete
              </button>

            </div>

          </div>
        )}


        {/* =================================================
            C. SYNC
            ================================================= */}

        {activeTab === "sync" && (
          <div className="cloud-page">

            <div className="cloud-page-header">

              <div>

                <h3>
                  Folder Synchronization
                </h3>

                <p>
                  Synchronize local folders with cloud storage.
                </p>

              </div>

              <button className="cloud-primary-btn">
                + New Sync
              </button>

            </div>


            {/* Sync Card */}

            <div className="cloud-sync-card">

              <div className="cloud-sync-header">

                <div className="cloud-sync-folder">
                  <span>
                    ▰
                  </span>

                  <div>

                    <strong>
                      My Documents
                    </strong>

                    <small>
                      C:\Users\Sudesh\Documents
                    </small>

                  </div>
                </div>


                <div className="cloud-sync-arrow">
                  ⇄
                </div>


                <div className="cloud-sync-folder">

                  <span>
                    ☁
                  </span>

                  <div>

                    <strong>
                      OneDrive
                    </strong>

                    <small>
                      /Documents
                    </small>

                  </div>

                </div>

              </div>


              {/* Sync Mode */}

              <div className="cloud-sync-mode">

                <div className="cloud-section-title">
                  Sync Mode
                </div>

                <div className="cloud-sync-mode-grid">

                  <button
                    className={
                      syncMode === "one-way"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setSyncMode("one-way")
                    }
                  >

                    <strong>
                      One-way
                    </strong>

                    <span>
                      Local → Cloud
                    </span>

                  </button>


                  <button
                    className={
                      syncMode === "two-way"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setSyncMode("two-way")
                    }
                  >

                    <strong>
                      Two-way
                    </strong>

                    <span>
                      Local ⇄ Cloud
                    </span>

                  </button>


                  <button
                    className={
                      syncMode === "manual"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setSyncMode("manual")
                    }
                  >

                    <strong>
                      Manual
                    </strong>

                    <span>
                      Sync on demand
                    </span>

                  </button>

                </div>

              </div>


              {/* Progress */}

              <div className="cloud-sync-progress">

                <div className="cloud-sync-progress-header">

                  <span>
                    Sync Status
                  </span>

                  <strong>
                    68%
                  </strong>

                </div>

                <div className="cloud-progress-track">

                  <div
                    style={{
                      width: "68%",
                    }}
                  />

                </div>

                <div className="cloud-sync-progress-info">

                  <span>
                    142 / 208 files synchronized
                  </span>

                  <span>
                    1.2 GB remaining
                  </span>

                </div>

              </div>


              <div className="cloud-sync-actions">

                <button className="cloud-secondary-btn">
                  Pause Sync
                </button>

                <button className="cloud-primary-btn">
                  Sync Now
                </button>

              </div>

            </div>


            {/* Sync Settings */}

            <div className="cloud-section-card">

              <div className="cloud-section-title">
                Sync Settings
              </div>

              <div className="cloud-settings-list">

                <label>

                  <input
                    type="checkbox"
                    defaultChecked
                  />

                  Automatic synchronization

                </label>

                <label>

                  <input
                    type="checkbox"
                    defaultChecked
                  />

                  Sync when connected to Wi-Fi

                </label>

                <label>

                  <input
                    type="checkbox"
                  />

                  Sync only selected folders

                </label>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            D. OFFLINE FILES
            ================================================= */}

        {activeTab === "offline" && (
          <div className="cloud-page">

            <div className="cloud-page-header">

              <div>

                <h3>
                  Offline Files
                </h3>

                <p>
                  Control which cloud files are available
                  without an internet connection.
                </p>

              </div>

              <button className="cloud-primary-btn">
                Manage Cache
              </button>

            </div>


            <div className="cloud-offline-summary">

              <div>
                <span>
                  Offline Files
                </span>

                <strong>
                  428
                </strong>
              </div>

              <div>
                <span>
                  Local Cache
                </span>

                <strong>
                  18.4 GB
                </strong>
              </div>

              <div>
                <span>
                  Online Only
                </span>

                <strong>
                  2,842
                </strong>
              </div>

            </div>


            <div className="cloud-section-card">

              <div className="cloud-section-title">
                File Availability
              </div>

              <div className="cloud-availability-list">

                <div className="cloud-availability-row">

                  <div>
                    <strong>
                      Project.pdf
                    </strong>

                    <span>
                      Available offline
                    </span>
                  </div>

                  <span className="cloud-offline-badge">
                    Offline
                  </span>

                  <button>
                    Remove Offline
                  </button>

                </div>


                <div className="cloud-availability-row">

                  <div>
                    <strong>
                      Photos.zip
                    </strong>

                    <span>
                      Cloud only
                    </span>
                  </div>

                  <span className="cloud-online-badge">
                    Online Only
                  </span>

                  <button>
                    Make Offline
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            E. CONFLICTS
            ================================================= */}

        {activeTab === "conflicts" && (
          <div className="cloud-page">

            <div className="cloud-page-header">

              <div>

                <h3>
                  Sync Conflicts
                </h3>

                <p>
                  Resolve files modified both locally and in
                  the cloud.
                </p>

              </div>

              <span className="cloud-conflict-count">
                1 Conflict
              </span>

            </div>


            <div className="cloud-conflict-card">

              <div className="cloud-conflict-header">

                <div className="cloud-warning-icon">
                  ⚠
                </div>

                <div>

                  <strong>
                    document.txt
                  </strong>

                  <span>
                    Conflict detected
                  </span>

                </div>

              </div>


              <div className="cloud-version-grid">

                <div className="cloud-version">

                  <span>
                    LOCAL VERSION
                  </span>

                  <strong>
                    Modified 10:30
                  </strong>

                  <small>
                    14.2 KB
                  </small>

                  <button>
                    View Local
                  </button>

                </div>


                <div className="cloud-version">

                  <span>
                    CLOUD VERSION
                  </span>

                  <strong>
                    Modified 10:35
                  </strong>

                  <small>
                    15.1 KB
                  </small>

                  <button>
                    View Cloud
                  </button>

                </div>

              </div>


              <div className="cloud-conflict-actions">

                <button>
                  Keep Local
                </button>

                <button>
                  Keep Cloud
                </button>

                <button>
                  Keep Both
                </button>

                <button
                  className="cloud-primary-btn"
                  onClick={() =>
                    setShowConflict(true)
                  }
                >
                  Compare Versions
                </button>

              </div>

            </div>


            {showConflict && (
              <div className="cloud-compare-card">

                <div className="cloud-section-title">
                  Version Comparison
                </div>

                <div className="cloud-compare-columns">

                  <div>

                    <strong>
                      Local
                    </strong>

                    <pre>
{`Invoice Date: 10/08/2026
Amount: ₹12,500
Status: Pending`}
                    </pre>

                  </div>

                  <div>

                    <strong>
                      Cloud
                    </strong>

                    <pre>
{`Invoice Date: 10/08/2026
Amount: ₹13,500
Status: Paid`}
                    </pre>

                  </div>

                </div>

              </div>
            )}

          </div>
        )}


        {/* =================================================
            F. SECURITY
            ================================================= */}

        {activeTab === "security" && (
          <div className="cloud-page">

            <div className="cloud-page-header">

              <div>

                <h3>
                  Cloud Security
                </h3>

                <p>
                  Manage authentication and cloud access.
                </p>

              </div>

              <span className="cloud-secure-badge">
                🔐 Secure
              </span>

            </div>


            <div className="cloud-security-grid">

              <div className="cloud-security-card">

                <div className="cloud-security-icon">
                  OAuth
                </div>

                <strong>
                  OAuth Authentication
                </strong>

                <p>
                  Authenticate with cloud providers without
                  exposing your account password.
                </p>

                <span className="cloud-security-enabled">
                  Enabled
                </span>

              </div>


              <div className="cloud-security-card">

                <div className="cloud-security-icon">
                  🔑
                </div>

                <strong>
                  Secure Token Storage
                </strong>

                <p>
                  Authentication tokens should be stored
                  using the operating system's secure storage.
                </p>

                <span className="cloud-security-enabled">
                  Protected
                </span>

              </div>


              <div className="cloud-security-card">

                <div className="cloud-security-icon">
                  ⛓
                </div>

                <strong>
                  Access Control
                </strong>

                <p>
                  Control connected cloud providers and their
                  permissions.
                </p>

                <button className="cloud-secondary-btn">
                  Manage Access
                </button>

              </div>


              <div className="cloud-security-card">

                <div className="cloud-security-icon">
                  ↪
                </div>

                <strong>
                  Logout / Revoke
                </strong>

                <p>
                  Disconnect the account and revoke stored
                  access credentials.
                </p>

                <button className="cloud-danger-btn">
                  Revoke Access
                </button>

              </div>

            </div>


            <div className="cloud-section-card">

              <div className="cloud-section-title">
                Connected Accounts
              </div>

              <div className="cloud-account-row">

                <div className="cloud-provider-icon">
                  O
                </div>

                <div>

                  <strong>
                    OneDrive
                  </strong>

                  <span>
                    Connected • Secure authentication
                  </span>

                </div>

                <button className="cloud-secondary-btn">
                  Manage
                </button>

                <button className="cloud-danger-btn">
                  Disconnect
                </button>

              </div>

            </div>

          </div>
        )}

      </div>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <div className="cloud-footer">

        <div>

          <span>
            Cloud Integration
          </span>

          <span>
            •
          </span>

          <strong>
            {activeTab}
          </strong>

        </div>

        <div>

          <span className="cloud-footer-dot"></span>

          Cloud services ready

        </div>

      </div>

    </div>
  );
}

export default CloudIntegration;