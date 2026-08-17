import { useState } from "react";
import "./NetworkFeatures.css";

function NetworkFeatures({ onClose }) {
  const [activeTab, setActiveTab] = useState("discovery");
  const [connectionType, setConnectionType] = useState("SMB");
  const [showConnectPanel, setShowConnectPanel] = useState(false);

  const tabs = [
    {
      id: "discovery",
      label: "Network Discovery",
      icon: "⌁",
    },
    {
      id: "smb",
      label: "SMB",
      icon: "▦",
    },
    {
      id: "ftp",
      label: "FTP / SFTP",
      icon: "⇄",
    },
    {
      id: "webdav",
      label: "WebDAV",
      icon: "◈",
    },
    {
      id: "nas",
      label: "NAS",
      icon: "▤",
    },
    {
      id: "drives",
      label: "Network Drives",
      icon: "▣",
    },
  ];

  const devices = [
    {
      name: "DESKTOP-PC",
      type: "Computer",
      address: "192.168.1.10",
      status: "Online",
      shares: 4,
    },
    {
      name: "OFFICE-PC",
      type: "Computer",
      address: "192.168.1.12",
      status: "Online",
      shares: 2,
    },
    {
      name: "NAS-SERVER",
      type: "NAS",
      address: "192.168.1.20",
      status: "Online",
      shares: 8,
    },
    {
      name: "MEDIA-SERVER",
      type: "Server",
      address: "192.168.1.25",
      status: "Offline",
      shares: 3,
    },
  ];

  const networkDrives = [
    {
      letter: "Z:",
      name: "Shared Documents",
      path: "\\\\SERVER\\Documents",
      status: "Connected",
      persistent: true,
    },
    {
      letter: "Y:",
      name: "Media Storage",
      path: "\\\\NAS\\Media",
      status: "Connected",
      persistent: true,
    },
  ];

  return (
    <div className="network-features">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="network-header">

        <div className="network-title-section">

          <div className="network-main-icon">
            🌐
          </div>

          <div>

            <h2>
              Network
            </h2>

            <p>
              Discover and manage network locations,
              computers and remote storage
            </p>

          </div>

        </div>


        <div className="network-status">

          <span className="network-status-dot"></span>

          <span>
            Network
          </span>

          <strong>
            Connected
          </strong>

        </div>


        <button
          className="network-close-btn"
          onClick={onClose}
        >
          ×
        </button>

      </div>


      {/* =====================================================
          NAVIGATION
          ===================================================== */}

      <div className="network-navigation">

        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={
              activeTab === tab.id
                ? "network-nav-item active"
                : "network-nav-item"
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

      <div className="network-body">


        {/* =================================================
            A. NETWORK DISCOVERY
            ================================================= */}

        {activeTab === "discovery" && (
          <div className="network-page">

            <div className="network-page-header">

              <div>

                <h3>
                  Network Discovery
                </h3>

                <p>
                  Discover computers, shared folders and
                  network devices.
                </p>

              </div>

              <button
                className="network-primary-btn"
                onClick={() =>
                  console.log("Refreshing network")
                }
              >
                ↻ Refresh Network
              </button>

            </div>


            {/* Network Summary */}

            <div className="network-summary-grid">

              <div className="network-summary-card">

                <span>
                  Computers
                </span>

                <strong>
                  2
                </strong>

                <small>
                  Online
                </small>

              </div>

              <div className="network-summary-card">

                <span>
                  Network Devices
                </span>

                <strong>
                  4
                </strong>

                <small>
                  Detected
                </small>

              </div>

              <div className="network-summary-card">

                <span>
                  Shared Folders
                </span>

                <strong>
                  14
                </strong>

                <small>
                  Available
                </small>

              </div>

              <div className="network-summary-card">

                <span>
                  Network Drives
                </span>

                <strong>
                  2
                </strong>

                <small>
                  Connected
                </small>

              </div>

            </div>


            {/* Devices */}

            <div className="network-section-card">

              <div className="network-section-header">

                <div>

                  <strong>
                    Network Devices
                  </strong>

                  <p>
                    Devices currently detected on the network
                  </p>

                </div>

                <button>
                  Scan Again
                </button>

              </div>


              <div className="network-device-list">

                {devices.map((device) => (
                  <div
                    className="network-device-row"
                    key={device.name}
                  >

                    <div className="network-device-icon">
                      {device.type === "NAS"
                        ? "▤"
                        : "▣"}
                    </div>


                    <div className="network-device-info">

                      <strong>
                        {device.name}
                      </strong>

                      <span>
                        {device.type}
                      </span>

                    </div>


                    <div className="network-device-address">
                      {device.address}
                    </div>


                    <div className="network-device-shares">
                      {device.shares} shares
                    </div>


                    <div
                      className={
                        device.status === "Online"
                          ? "network-online"
                          : "network-offline"
                      }
                    >
                      <span></span>
                      {device.status}
                    </div>


                    <button className="network-small-btn">
                      Browse
                    </button>

                  </div>
                ))}

              </div>

            </div>


            {/* Network Locations */}

            <div className="network-section-card">

              <div className="network-section-title">
                Network Locations
              </div>

              <div className="network-location-grid">

                <div className="network-location-card">

                  <div className="network-location-icon">
                    ▦
                  </div>

                  <strong>
                    Shared Folders
                  </strong>

                  <span>
                    Browse available SMB shares
                  </span>

                </div>

                <div className="network-location-card">

                  <div className="network-location-icon">
                    ▤
                  </div>

                  <strong>
                    Network Drives
                  </strong>

                  <span>
                    View mapped network drives
                  </span>

                </div>

                <div className="network-location-card">

                  <div className="network-location-icon">
                    ◈
                  </div>

                  <strong>
                    Remote Servers
                  </strong>

                  <span>
                    Connect to remote locations
                  </span>

                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            B. SMB
            ================================================= */}

        {activeTab === "smb" && (
          <div className="network-page">

            <div className="network-page-header">

              <div>

                <h3>
                  SMB Shares
                </h3>

                <p>
                  Browse Windows and SMB network shares.
                </p>

              </div>

              <button
                className="network-primary-btn"
                onClick={() =>
                  setShowConnectPanel(true)
                }
              >
                + Connect SMB Share
              </button>

            </div>


            {/* Connect Panel */}

            {showConnectPanel && (
              <div className="network-connect-card">

                <div className="network-connect-header">

                  <div>

                    <strong>
                      Connect SMB Share
                    </strong>

                    <p>
                      Enter the network share location.
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setShowConnectPanel(false)
                    }
                  >
                    ×
                  </button>

                </div>


                <div className="network-form-grid">

                  <label>

                    <span>
                      Network Path
                    </span>

                    <input
                      placeholder="\\\\SERVER\\SharedFolder"
                    />

                  </label>


                  <label>

                    <span>
                      Username
                    </span>

                    <input
                      placeholder="Username"
                    />

                  </label>


                  <label>

                    <span>
                      Password
                    </span>

                    <input
                      type="password"
                      placeholder="Password"
                    />

                  </label>

                </div>


                <div className="network-form-actions">

                  <button
                    className="network-secondary-btn"
                    onClick={() =>
                      setShowConnectPanel(false)
                    }
                  >
                    Cancel
                  </button>

                  <button className="network-primary-btn">
                    Connect
                  </button>

                </div>

              </div>
            )}


            {/* SMB Shares */}

            <div className="network-section-card">

              <div className="network-section-title">
                Available SMB Shares
              </div>

              <div className="network-share-list">

                <div className="network-share-row">

                  <div className="network-share-icon">
                    ▰
                  </div>

                  <div>

                    <strong>
                      Documents
                    </strong>

                    <span>
                      \\DESKTOP-PC\Documents
                    </span>

                  </div>

                  <span>
                    42 GB
                  </span>

                  <button>
                    Browse
                  </button>

                </div>


                <div className="network-share-row">

                  <div className="network-share-icon">
                    ▰
                  </div>

                  <div>

                    <strong>
                      Media
                    </strong>

                    <span>
                      \\NAS-SERVER\Media
                    </span>

                  </div>

                  <span>
                    820 GB
                  </span>

                  <button>
                    Browse
                  </button>

                </div>

              </div>

            </div>


            {/* Saved Locations */}

            <div className="network-section-card">

              <div className="network-section-title">
                Saved Network Locations
              </div>

              <div className="network-saved-location">

                <div>

                  <strong>
                    Office Documents
                  </strong>

                  <span>
                    \\SERVER\Documents
                  </span>

                </div>

                <button>
                  Connect
                </button>

                <button>
                  Remove
                </button>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            C. FTP / SFTP
            ================================================= */}

        {activeTab === "ftp" && (
          <div className="network-page">

            <div className="network-page-header">

              <div>

                <h3>
                  FTP / SFTP
                </h3>

                <p>
                  Connect to remote FTP and SFTP servers.
                </p>

              </div>

              <div className="network-toggle">

                <button
                  className={
                    connectionType === "FTP"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setConnectionType("FTP")
                  }
                >
                  FTP
                </button>

                <button
                  className={
                    connectionType === "SFTP"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setConnectionType("SFTP")
                  }
                >
                  SFTP
                </button>

              </div>

            </div>


            <div className="network-remote-layout">

              <div className="network-connection-card">

                <div className="network-section-title">
                  {connectionType} Connection
                </div>


                <div className="network-form-grid">

                  <label>

                    <span>
                      Host
                    </span>

                    <input
                      placeholder="example.com"
                    />

                  </label>


                  <label>

                    <span>
                      Port
                    </span>

                    <input
                      placeholder={
                        connectionType === "FTP"
                          ? "21"
                          : "22"
                      }
                    />

                  </label>


                  <label>

                    <span>
                      Username
                    </span>

                    <input
                      placeholder="Username"
                    />

                  </label>


                  <label>

                    <span>
                      Authentication
                    </span>

                    <select>

                      <option>
                        Password
                      </option>

                      <option>
                        SSH Key
                      </option>

                    </select>

                  </label>


                  <label className="network-full-field">

                    <span>
                      Password / SSH Key
                    </span>

                    <input
                      type="password"
                      placeholder="Authentication credential"
                    />

                  </label>

                </div>


                <div className="network-form-actions">

                  <button className="network-secondary-btn">
                    Test Connection
                  </button>

                  <button className="network-primary-btn">
                    Connect
                  </button>

                </div>

              </div>


              <div className="network-remote-status">

                <div className="network-remote-icon">
                  ⇄
                </div>

                <strong>
                  Remote Server
                </strong>

                <span>
                  Not connected
                </span>

                <div className="network-remote-stat">

                  <div>
                    <span>
                      Status
                    </span>

                    <strong>
                      Offline
                    </strong>
                  </div>

                  <div>
                    <span>
                      Speed
                    </span>

                    <strong>
                      —
                    </strong>
                  </div>

                </div>

              </div>

            </div>


            <div className="network-section-card">

              <div className="network-section-title">
                Remote Operations
              </div>

              <div className="network-operation-grid">

                <button>
                  ↑ Upload
                </button>

                <button>
                  ↓ Download
                </button>

                <button>
                  Rename
                </button>

                <button>
                  Delete
                </button>

                <button>
                  + New Folder
                </button>

                <button>
                  Refresh
                </button>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            D. WEBDAV
            ================================================= */}

        {activeTab === "webdav" && (
          <div className="network-page">

            <div className="network-page-header">

              <div>

                <h3>
                  WebDAV
                </h3>

                <p>
                  Connect and browse WebDAV remote storage.
                </p>

              </div>

              <button className="network-primary-btn">
                + New WebDAV Connection
              </button>

            </div>


            <div className="network-webdav-card">

              <div className="network-webdav-icon">
                ◈
              </div>

              <div>

                <strong>
                  WebDAV Connection
                </strong>

                <span>
                  https://server.example.com/remote.php
                </span>

              </div>

              <div className="network-connection-status">
                Not connected
              </div>

              <button className="network-secondary-btn">
                Connect
              </button>

            </div>


            <div className="network-section-card">

              <div className="network-section-title">
                WebDAV Operations
              </div>

              <div className="network-operation-grid">

                <button>
                  Browse
                </button>

                <button>
                  ↑ Upload
                </button>

                <button>
                  ↓ Download
                </button>

                <button>
                  Rename
                </button>

                <button>
                  Delete
                </button>

                <button>
                  Disconnect
                </button>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            E. NAS
            ================================================= */}

        {activeTab === "nas" && (
          <div className="network-page">

            <div className="network-page-header">

              <div>

                <h3>
                  NAS
                </h3>

                <p>
                  Discover and manage Network Attached Storage.
                </p>

              </div>

              <button className="network-primary-btn">
                Scan for NAS
              </button>

            </div>


            <div className="network-nas-card">

              <div className="network-nas-icon">
                ▤
              </div>


              <div className="network-nas-info">

                <strong>
                  NAS-SERVER
                </strong>

                <span>
                  192.168.1.20
                </span>

                <small>
                  Network Attached Storage
                </small>

              </div>


              <div className="network-nas-storage">

                <strong>
                  4.2 TB
                </strong>

                <span>
                  8 TB total
                </span>

                <div className="network-nas-progress">

                  <div
                    style={{
                      width: "52%",
                    }}
                  />

                </div>

              </div>


              <div className="network-nas-status">

                <span></span>

                Connected

              </div>


              <button className="network-small-btn">
                Browse
              </button>

            </div>


            <div className="network-section-card">

              <div className="network-section-title">
                NAS Details
              </div>

              <div className="network-nas-details">

                <div>
                  <span>
                    Connection
                  </span>

                  <strong>
                    SMB
                  </strong>
                </div>

                <div>
                  <span>
                    Network Speed
                  </span>

                  <strong>
                    1 Gbps
                  </strong>
                </div>

                <div>
                  <span>
                    Storage
                  </span>

                  <strong>
                    8 TB
                  </strong>
                </div>

                <div>
                  <span>
                    Used
                  </span>

                  <strong>
                    4.2 TB
                  </strong>
                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            F. NETWORK DRIVES
            ================================================= */}

        {activeTab === "drives" && (
          <div className="network-page">

            <div className="network-page-header">

              <div>

                <h3>
                  Network Drives
                </h3>

                <p>
                  Map, manage and reconnect network drives.
                </p>

              </div>

              <button className="network-primary-btn">
                + Map Network Drive
              </button>

            </div>


            <div className="network-section-card">

              <div className="network-section-title">
                Connected Drives
              </div>

              <div className="network-drive-list">

                {networkDrives.map((drive) => (
                  <div
                    className="network-drive-row"
                    key={drive.letter}
                  >

                    <div className="network-drive-letter">
                      {drive.letter}
                    </div>


                    <div className="network-drive-info">

                      <strong>
                        {drive.name}
                      </strong>

                      <span>
                        {drive.path}
                      </span>

                    </div>


                    <div className="network-drive-persistent">

                      {drive.persistent
                        ? "Persistent"
                        : "Temporary"}

                    </div>


                    <div className="network-online">

                      <span></span>

                      {drive.status}

                    </div>


                    <button className="network-small-btn">
                      Open
                    </button>


                    <button className="network-danger-btn">
                      Unmap
                    </button>

                  </div>
                ))}

              </div>

            </div>


            {/* Mapping Form */}

            <div className="network-section-card">

              <div className="network-section-title">
                Map Network Drive
              </div>

              <div className="network-form-grid">

                <label>

                  <span>
                    Drive Letter
                  </span>

                  <select>

                    <option>
                      Z:
                    </option>

                    <option>
                      Y:
                    </option>

                    <option>
                      X:
                    </option>

                  </select>

                </label>


                <label className="network-full-field">

                  <span>
                    Network Folder
                  </span>

                  <input
                    placeholder="\\\\SERVER\\SharedFolder"
                  />

                </label>

              </div>


              <label className="network-check-option">

                <input
                  type="checkbox"
                  defaultChecked
                />

                Reconnect at sign-in

              </label>


              <button className="network-primary-btn">
                Map Drive
              </button>

            </div>

          </div>
        )}

      </div>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <div className="network-footer">

        <div>

          <span>
            Network
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

        <div>

          <span className="network-footer-dot"></span>

          Network ready

        </div>

      </div>

    </div>
  );
}

export default NetworkFeatures;