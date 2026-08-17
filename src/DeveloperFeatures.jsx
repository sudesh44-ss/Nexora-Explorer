/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import "./DeveloperFeatures.css";

function DeveloperFeatures({ selectedItem, onClose }) {
  const [activeTab, setActiveTab] = useState("terminal");
  const [terminalType, setTerminalType] = useState("PowerShell");
  const [gitBranch, setGitBranch] = useState("main");
  const [jsonMode, setJsonMode] = useState("formatted");
  const [hashType, setHashType] = useState("SHA-256");
  const [hashValue, setHashValue] = useState("");
  

  useEffect(() => {
    if (selectedItem && !selectedItem.isDirectory) {
      
      setHashValue("Calculating...");
      const algo = hashType.toLowerCase().replace("-", "");
      window.electronFeatures
        .getFileHash(selectedItem.path, [algo])
        .then((res) => {
          if (res && res.success && res.data && res.data.hashes) {
            setHashValue(res.data.hashes[algo] || "Failed to calculate");
          } else {
            setHashValue(res?.error || "Error calculating hash");
          }
        })
        .catch((err) => {
          setHashValue(err.message || "Failed to calculate");
        })
        .finally(() => {
          
        });
    } else {
      setHashValue("Please select a file to calculate its hash.");
    }
  }, [selectedItem, hashType]);

  const tabs = [
    { id: "terminal", icon: "›_", label: "Terminal" },
    { id: "git", icon: "⑂", label: "Git" },
    { id: "encoding", icon: "Aa", label: "Encoding" },
    { id: "hex", icon: "#", label: "Hex Viewer" },
    { id: "json", icon: "{}", label: "JSON" },
    { id: "code", icon: "</>", label: "Code Preview" },
    { id: "hash", icon: "#", label: "File Hash" },
    { id: "metadata", icon: "ⓘ", label: "Metadata" },
    { id: "context", icon: "☷", label: "Context Menu" },
  ];

  const gitFiles = [
    {
      name: "App.jsx",
      status: "Modified",
      type: "modified",
    },
    {
      name: "index.css",
      status: "Modified",
      type: "modified",
    },
    {
      name: "DeveloperFeatures.jsx",
      status: "Staged",
      type: "staged",
    },
    {
      name: "README.md",
      status: "Untracked",
      type: "untracked",
    },
  ];

  const metadata = [
    ["File Name", "DeveloperFeatures.jsx"],
    ["Extension", ".jsx"],
    ["MIME Type", "text/javascript"],
    ["Size", "18.4 KB"],
    ["Location", "C:\\Projects\\my-file-explorer\\src"],
    ["Created", "14 Aug 2026, 09:42"],
    ["Modified", "14 Aug 2026, 12:05"],
    ["Accessed", "14 Aug 2026, 12:06"],
  ];

  return (
    <div className="developer-features">

      {/* HEADER */}

      <div className="developer-header">

        <div className="developer-title">

          <div className="developer-main-icon">
          {"</>"}
          </div>

          <div>
            <h2>Developer Tools</h2>

            <p>
              Development utilities for files, code and Git
            </p>
          </div>

        </div>

        <div className="developer-status">
          <span></span>
          Developer Mode
        </div>

        <button className="developer-close" onClick={onClose}>
          ×
        </button>

      </div>


      {/* NAVIGATION */}

      <div className="developer-navigation">

        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={
              activeTab === tab.id
                ? "developer-nav-item active"
                : "developer-nav-item"
            }
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}

      </div>


      {/* BODY */}

      <div className="developer-body">


        {/* =====================================================
            TERMINAL
        ===================================================== */}

        {activeTab === "terminal" && (
          <div className="developer-page">

            <div className="developer-page-header">

              <div>
                <h3>Integrated Terminal</h3>

                <p>
                  Open a terminal directly in the current folder.
                </p>
              </div>

              <button className="developer-primary-btn">
                + New Terminal
              </button>

            </div>


            <div className="terminal-toolbar">

              <div className="terminal-type">

                {["CMD", "PowerShell", "Windows Terminal"].map(
                  (type) => (
                    <button
                      key={type}
                      className={
                        terminalType === type
                          ? "active"
                          : ""
                      }
                      onClick={() => setTerminalType(type)}
                    >
                      {type}
                    </button>
                  )
                )}

              </div>


              <div className="terminal-actions">

                <button>
                  + Tab
                </button>

                <button>
                  Clear
                </button>

                <button>
                  Copy
                </button>

              </div>

            </div>


            <div className="terminal-window">

              <div className="terminal-topbar">

                <span>
                  {terminalType}
                </span>

                <span>
                  C:\Projects\my-file-explorer
                </span>

                <span>
                  ●
                </span>

              </div>


              <div className="terminal-content">

                <div>
                  Microsoft Windows [Version 11]
                </div>

                <div>
                  Working directory:
                </div>

                <div>
                  C:\Projects\my-file-explorer
                </div>

                <br />

                <div>
                  C:\Projects\my-file-explorer&gt;_
                </div>

              </div>

            </div>


            <div className="terminal-info-grid">

              <div>
                <span>Working Directory</span>
                <strong>
                  C:\Projects\my-file-explorer
                </strong>
              </div>

              <div>
                <span>Shell</span>
                <strong>{terminalType}</strong>
              </div>

              <div>
                <span>Tabs</span>
                <strong>1</strong>
              </div>

            </div>

          </div>
        )}


        {/* =====================================================
            GIT
        ===================================================== */}

        {activeTab === "git" && (
          <div className="developer-page">

            <div className="developer-page-header">

              <div>

                <h3>Git Integration</h3>

                <p>
                  Git repository status for the current folder.
                </p>

              </div>

              <div className="git-repository-status">
                ✓ Git Repository
              </div>

            </div>


            <div className="git-overview">

              <div className="git-project">

                <div className="git-folder-icon">
                  ⑂
                </div>

                <div>
                  <strong>my-file-explorer</strong>

                  <span>
                    C:\Projects\my-file-explorer
                  </span>
                </div>

              </div>


              <div className="git-stat">

                <span>Branch</span>

                <strong>{gitBranch}</strong>

              </div>


              <div className="git-stat">

                <span>Modified</span>

                <strong>2</strong>

              </div>


              <div className="git-stat">

                <span>Staged</span>

                <strong>1</strong>

              </div>


              <div className="git-stat">

                <span>Untracked</span>

                <strong>1</strong>

              </div>

            </div>


            <div className="git-branch-section">

              <div className="developer-section-title">
                Current Branch
              </div>

              <div className="git-branch-row">

                <select
                  value={gitBranch}
                  onChange={(e) =>
                    setGitBranch(e.target.value)
                  }
                >
                  <option value="main">main</option>
                  <option value="develop">develop</option>
                  <option value="feature/search">
                    feature/search
                  </option>
                </select>

                <button>
                  + Create Branch
                </button>

                <button>
                  Switch Branch
                </button>

              </div>

            </div>


            <div className="developer-section-card">

              <div className="developer-section-header">

                <div>
                  <strong>Repository Changes</strong>

                  <span>
                    Working tree status
                  </span>
                </div>

                <button>
                  Refresh
                </button>

              </div>


              <div className="git-file-list">

                {gitFiles.map((file) => (
                  <div
                    className="git-file-row"
                    key={file.name}
                  >

                    <span className={`git-status ${file.type}`}>
                      {file.type === "modified"
                        ? "M"
                        : file.type === "staged"
                        ? "S"
                        : "U"}
                    </span>

                    <strong>
                      {file.name}
                    </strong>

                    <span>
                      {file.status}
                    </span>

                    <button>
                      View Changes
                    </button>

                  </div>
                ))}

              </div>

            </div>


            <div className="git-actions">

              <button>
                Git Status
              </button>

              <button>
                View History
              </button>

              <button>
                Open Remote
              </button>

              <button>
                Open .gitignore
              </button>

              <button className="developer-warning-btn">
                Commit Changes
              </button>

              <button className="developer-warning-btn">
                Push
              </button>

              <button className="developer-warning-btn">
                Pull
              </button>

            </div>

          </div>
        )}


        {/* =====================================================
            ENCODING
        ===================================================== */}

        {activeTab === "encoding" && (
          <div className="developer-page">

            <div className="developer-page-header">

              <div>

                <h3>File Encoding</h3>

                <p>
                  Detect and manage text-file encoding.
                </p>

              </div>

              <button className="developer-secondary-btn">
                Re-detect
              </button>

            </div>


            <div className="encoding-summary">

              <div className="encoding-file-icon">
                Aa
              </div>

              <div>
                <strong>notes.txt</strong>

                <span>
                  Text document
                </span>
              </div>

            </div>


            <div className="encoding-grid">

              <div>
                <span>Detected Encoding</span>

                <strong>UTF-8</strong>
              </div>

              <div>
                <span>BOM</span>

                <strong>Not Present</strong>
              </div>

              <div>
                <span>Line Endings</span>

                <strong>LF</strong>
              </div>

              <div>
                <span>File Size</span>

                <strong>24 KB</strong>
              </div>

            </div>


            <div className="developer-section-card">

              <div className="developer-section-title">
                Encoding Options
              </div>

              <div className="encoding-options">

                <label>
                  <span>Encoding</span>

                  <select>
                    <option>UTF-8</option>
                    <option>UTF-8 BOM</option>
                    <option>UTF-16</option>
                    <option>ASCII</option>
                    <option>Windows-1252</option>
                  </select>
                </label>


                <label>
                  <span>Line Endings</span>

                  <select>
                    <option>LF</option>
                    <option>CRLF</option>
                    <option>CR</option>
                  </select>
                </label>

              </div>


              <div className="encoding-actions">

                <button>
                  Reopen with Encoding
                </button>

                <button className="developer-primary-btn">
                  Convert Encoding
                </button>

              </div>

            </div>

          </div>
        )}


        {/* =====================================================
            HEX VIEWER
        ===================================================== */}

        {activeTab === "hex" && (
          <div className="developer-page">

            <div className="developer-page-header">

              <div>

                <h3>Hex Viewer</h3>

                <p>
                  Low-level read-only file inspection.
                </p>

              </div>

              <div className="hex-readonly">
                🔐 Read Only
              </div>

            </div>


            <div className="hex-toolbar">

              <button>
                Search Bytes
              </button>

              <button>
                Search Pattern
              </button>

              <button>
                Copy Hex
              </button>

              <button>
                Copy ASCII
              </button>

            </div>


            <div className="hex-viewer">

              <div className="hex-header">
                OFFSET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                HEX BYTES
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                ASCII
              </div>


              <div className="hex-lines">

                <div>
                  <span>00000000</span>

                  <code>
                    48 65 6C 6C 6F 20 57 6F 72 6C 64
                  </code>

                  <em>
                    Hello World
                  </em>
                </div>


                <div>
                  <span>00000010</span>

                  <code>
                    FF D8 FF E0 00 10 4A 46 49 46
                  </code>

                  <em>
                    .........JFIF
                  </em>
                </div>


                <div>
                  <span>00000020</span>

                  <code>
                    00 01 02 03 04 05 06 07 08 09
                  </code>

                  <em>
                    ..........
                  </em>
                </div>


                <div>
                  <span>00000030</span>

                  <code>
                    7B 22 6E 61 6D 65 22 3A 22 53
                  </code>

                  <em>
                    {"{\"name\":\"S"}
                  </em>
                </div>

              </div>

            </div>

          </div>
        )}


        {/* =====================================================
            JSON
        ===================================================== */}

        {activeTab === "json" && (
          <div className="developer-page">

            <div className="developer-page-header">

              <div>

                <h3>JSON Formatter</h3>

                <p>
                  Format, validate and inspect JSON files.
                </p>

              </div>

              <div className="json-mode-buttons">

                <button
                  className={
                    jsonMode === "formatted"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setJsonMode("formatted")
                  }
                >
                  Format
                </button>

                <button
                  className={
                    jsonMode === "tree"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setJsonMode("tree")
                  }
                >
                  Tree
                </button>

              </div>

            </div>


            <div className="json-toolbar">

              <button>
                Validate
              </button>

              <button>
                Minify
              </button>

              <button>
                Search
              </button>

              <button>
                Copy
              </button>

            </div>


            <div className="json-editor">

              <div className="json-line">
                <span>1</span>
                <code>{"{"}</code>
              </div>

              <div className="json-line">
                <span>2</span>
                <code>
                  <b>"name"</b>: "Sudesh",
                </code>
              </div>

              <div className="json-line">
                <span>3</span>
                <code>
                  <b>"skills"</b>: [
                </code>
              </div>

              <div className="json-line">
                <span>4</span>
                <code>
                  &nbsp;&nbsp;"JavaScript",
                </code>
              </div>

              <div className="json-line">
                <span>5</span>
                <code>
                  &nbsp;&nbsp;"React"
                </code>
              </div>

              <div className="json-line">
                <span>6</span>
                <code>
                  ]
                </code>
              </div>

              <div className="json-line">
                <span>7</span>
                <code>{"}"}</code>
              </div>

            </div>


            <div className="json-valid">
              ✓ Valid JSON
            </div>

          </div>
        )}


        {/* =====================================================
            CODE PREVIEW
        ===================================================== */}

        {activeTab === "code" && (
          <div className="developer-page">

            <div className="developer-page-header">

              <div>

                <h3>Code Preview</h3>

                <p>
                  Syntax-highlighted read-only source preview.
                </p>

              </div>

              <div className="code-language">
                JSX
              </div>

            </div>


            <div className="code-toolbar">

              <span>
                App.jsx
              </span>

              <button>
                Search
              </button>

              <button>
                Go to Line
              </button>

              <button>
                Copy
              </button>

              <button>
                Open External
              </button>

            </div>


            <div className="code-editor">

              <div>
                <span>1</span>
                <code>
                  import React from "react";
                </code>
              </div>

              <div>
                <span>2</span>
                <code></code>
              </div>

              <div>
                <span>3</span>
                <code>
                  function App() {"{"}
                </code>
              </div>

              <div>
                <span>4</span>
                <code>
                  &nbsp;&nbsp;return (
                </code>
              </div>

              <div>
                <span>5</span>
                <code>
                  &nbsp;&nbsp;&nbsp;&nbsp;&lt;div&gt;
                </code>
              </div>

              <div>
                <span>6</span>
                <code>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Hello World
                </code>
              </div>

              <div>
                <span>7</span>
                <code>
                  &nbsp;&nbsp;&nbsp;&nbsp;&lt;/div&gt;
                </code>
              </div>

              <div>
                <span>8</span>
                <code>
                  &nbsp;&nbsp;);
                </code>
              </div>

              <div>
                <span>9</span>
                <code>
                  {"}"}
                </code>
              </div>

              <div>
                <span>10</span>
                <code>
                  export default App;
                </code>
              </div>

            </div>


            <div className="code-footer">

              <span>
                UTF-8
              </span>

              <span>
                LF
              </span>

              <span>
                Read Only
              </span>

              <span>
                10 lines
              </span>

            </div>

          </div>
        )}


        {/* =====================================================
            HASH
        ===================================================== */}

        {activeTab === "hash" && (
          <div className="developer-page">

            <div className="developer-page-header">

              <div>

                <h3>File Hash Calculator</h3>

                <p>
                  Calculate cryptographic hashes for files.
                </p>

              </div>

              <div className="hash-secure">
                🔐 Read Only
              </div>

            </div>


            <div className="hash-file">

              <div className="hash-file-icon">
                #
              </div>

              <div>

                <strong>
                  {selectedItem ? selectedItem.name : "No file selected"}
                </strong>

                <span>
                  {selectedItem && selectedItem.size ? (selectedItem.size / (1024 * 1024)).toFixed(2) + " MB" : "—"}
                </span>

              </div>

              <button>
                Choose File
              </button>

            </div>


            <div className="hash-algorithms">

              {[
                "MD5",
                "SHA-1",
                "SHA-256",
                "SHA-512",
              ].map((hash) => (
                <button
                  key={hash}
                  className={
                    hashType === hash
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setHashType(hash)
                  }
                >
                  {hash}
                </button>
              ))}

            </div>


            <div className="hash-result">

              <div className="hash-result-header">

                <span>
                  {hashType}
                </span>

                <span>
                  Completed
                </span>

              </div>


              <div className="hash-value" style={{ wordBreak: "break-all", fontFamily: "monospace", fontSize: "14px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
                {hashValue}
              </div>


              <div className="hash-actions">

                <button onClick={() => { if (hashValue) navigator.clipboard.writeText(hashValue); }}>
                  Copy Hash
                </button>

                <button>
                  Compare Hash
                </button>

              </div>

            </div>


            <div className="hash-progress">

              <div>
                <span>Hash Progress</span>
                <strong>100%</strong>
              </div>

              <div className="hash-progress-track">
                <div />
              </div>

              <span>
                {selectedItem && selectedItem.size ? (selectedItem.size / (1024 * 1024)).toFixed(2) + " MB" : "—"} processed
              </span>

            </div>

          </div>
        )}


        {/* =====================================================
            METADATA
        ===================================================== */}

        {activeTab === "metadata" && (
          <div className="developer-page">

            <div className="developer-page-header">

              <div>

                <h3>File Metadata</h3>

                <p>
                  Detailed information about the selected file.
                </p>

              </div>

              <button className="developer-secondary-btn">
                Refresh
              </button>

            </div>


            <div className="metadata-file">

              <div className="metadata-icon">
                 {"</>"}
              </div>

              <div>

                <strong>
                  DeveloperFeatures.jsx
                </strong>

                <span>
                  JavaScript React source file
                </span>

              </div>

            </div>


            <div className="metadata-section">

              <div className="developer-section-title">
                General
              </div>

              <div className="metadata-grid">

                {metadata.map(([label, value]) => (
                  <div key={label}>

                    <span>
                      {label}
                    </span>

                    <strong>
                      {value}
                    </strong>

                  </div>
                ))}

              </div>

            </div>


            <div className="metadata-section">

              <div className="developer-section-title">
                System
              </div>

              <div className="metadata-grid">

                <div>
                  <span>Owner</span>
                  <strong>Current User</strong>
                </div>

                <div>
                  <span>Permissions</span>
                  <strong>Read / Write</strong>
                </div>

                <div>
                  <span>Hidden</span>
                  <strong>No</strong>
                </div>

                <div>
                  <span>Read Only</span>
                  <strong>No</strong>
                </div>

              </div>

            </div>

          </div>
        )}


        {/* =====================================================
            CONTEXT MENU
        ===================================================== */}

        {activeTab === "context" && (
          <div className="developer-page">

            <div className="developer-page-header">

              <div>

                <h3>Developer Context Menu</h3>

                <p>
                  Developer tools available from the file
                  right-click menu.
                </p>

              </div>

              <button className="developer-primary-btn">
                Preview Menu
              </button>

            </div>


            <div className="context-menu-layout">

              <div className="context-file">

                <div className="context-file-icon">
                  JS
                </div>

                <strong>
                  App.jsx
                </strong>

                <span>
                  Right click to open menu
                </span>

              </div>


              <div className="context-menu">

                <div className="context-item">
                  <span>↗</span>
                  Open
                </div>

                <div className="context-item">
                  <span>◉</span>
                  Preview
                </div>

                <div className="context-item">
                  <span>⊞</span>
                  Open With
                  <b>›</b>
                </div>

                <div className="context-divider" />

                <div className="context-submenu-title">
                  Developer Tools
                </div>

                <div className="context-item">
                  <span>›_</span>
                  Open Terminal Here
                </div>

                <div className="context-item">
                  <span>›_</span>
                  Open PowerShell
                </div>

                <div className="context-item">
                  <span>⑂</span>
                  Git Status
                </div>

                <div className="context-item">
                  <span>&lt;/&gt;</span>
                  View Source
                </div>

                <div className="context-item">
                  <span>{"{}"}</span>
                  JSON Formatter
                </div>

                <div className="context-item">
                  <span>#</span>
                  Hex Viewer
                </div>

                <div className="context-item">
                  <span>#</span>
                  Calculate Hash
                </div>

                <div className="context-item">
                  <span>ⓘ</span>
                  View Metadata
                </div>

                <div className="context-divider" />

                <div className="context-item">
                  <span>⧉</span>
                  Copy
                </div>

                <div className="context-item">
                  <span>✎</span>
                  Rename
                </div>

                <div className="context-item danger">
                  <span>⌫</span>
                  Delete
                </div>

                <div className="context-item">
                  <span>⚙</span>
                  Properties
                </div>

              </div>

            </div>


            <div className="context-note">

              <strong>
                Security
              </strong>

              <span>
                Git commit, push, pull, file modification and
                other potentially destructive developer
                operations should require confirmation.
              </span>

            </div>

          </div>
        )}

      </div>


      {/* FOOTER */}

      <div className="developer-footer">

        <div>
          Developer Tools
          <span>•</span>
          {tabs.find(
            (tab) => tab.id === activeTab
          )?.label}
        </div>

        <div>
          <span className="developer-footer-dot"></span>
          Ready
        </div>

      </div>

    </div>
  );
}

export default DeveloperFeatures;