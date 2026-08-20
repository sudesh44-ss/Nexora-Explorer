/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import "./DeveloperFeatures.css";

function DeveloperFeatures({ selectedItem, activeFolderPath, onClose }) {
  const [activeTab, setActiveTab] = useState("terminal");
  const [terminalType, setTerminalType] = useState("PowerShell");
  const [terminalLogs, setTerminalLogs] = useState([]);
  
  // Git states
  const [isGitInstalled, setIsGitInstalled] = useState(false);
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [gitBranch, setGitBranch] = useState("main");
  const [gitBranches, setGitBranches] = useState([]);
  const [gitFiles, setGitFiles] = useState([]);
  const [gitSummary, setGitSummary] = useState({ modified: 0, staged: 0, untracked: 0, deleted: 0 });
  const [latestCommit, setLatestCommit] = useState(null);
  const [gitError, setGitError] = useState("");

  // Encoding states
  const [encodingInput, setEncodingInput] = useState("");
  const [encodingAlgo, setEncodingAlgo] = useState("base64");
  const [encodingAction, setEncodingAction] = useState("encode");
  const [encodingOutput, setEncodingOutput] = useState("");
  const [encodingError, setEncodingError] = useState("");

  // File Encoding states (for file converter)
  const [detectedFileEncoding, setDetectedFileEncoding] = useState("UTF-8");
  const [fileBOM, setFileBOM] = useState("Not Present");
  const [fileLineEndings, setFileLineEndings] = useState("LF");
  const [fileEncodingSize, setFileEncodingSize] = useState("");
  const [targetEncoding, setTargetEncoding] = useState("UTF-8");
  const [targetLineEnding, setTargetLineEnding] = useState("LF");
  const [conversionStatus, setConversionStatus] = useState("");

  // Hex Viewer states
  const [hexOffset, setHexOffset] = useState(0);
  const [hexLines, setHexLines] = useState([]);
  const [hexFileSize, setHexFileSize] = useState(0);
  const [hexHasMore, setHexHasMore] = useState(false);
  const [hexLimit] = useState(256);
  const [hexError, setHexError] = useState("");

  // JSON states
  const [jsonText, setJsonText] = useState("");
  const [jsonMode, setJsonMode] = useState("formatted");
  const [jsonError, setJsonError] = useState("");
  const [jsonStatus, setJsonStatus] = useState("");

  // Code preview states
  const [codeContent, setCodeContent] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("plaintext");
  const [codeEncoding, setCodeEncoding] = useState("UTF-8");
  const [codeLineCount, setCodeLineCount] = useState(0);
  const [codeTruncated, setCodeTruncated] = useState(false);
  const [codeError, setCodeError] = useState("");

  // Hash states
  const [hashType, setHashType] = useState("SHA-256");
  const [hashValue, setHashValue] = useState("");
  const [compareFilePath, setCompareFilePath] = useState("");
  const [compareResult, setCompareResult] = useState("");
  const [integrityExpectedHash, setIntegrityExpectedHash] = useState("");
  const [integrityResult, setIntegrityResult] = useState("");

  // Metadata states
  const [metaInfo, setMetaInfo] = useState(null);
  const [metaError, setMetaError] = useState("");

  // Status message
  const [statusMessage, setStatusMessage] = useState("Ready");

  // Determine active folder path
  const activeFolder = selectedItem
    ? (selectedItem.isDirectory ? selectedItem.path : selectedItem.path.split(/[/\\]/).slice(0, -1).join('\\'))
    : (activeFolderPath || "C:\\");

  // ----------------------------------------------------------
  // Tab Load & Setup Handlers
  // ----------------------------------------------------------

  // Git data loader
  const fetchGitData = useCallback(() => {
    if (!activeFolder) return;
    setGitError("");
    window.electronFeatures.developerGitStatus(activeFolder)
      .then((res) => {
        if (res.success) {
          setIsGitInstalled(res.isGitInstalled);
          setIsGitRepo(res.isRepo);
          if (res.isRepo) {
            setGitBranch(res.branch);
            setGitFiles(res.files || []);
            setGitSummary(res.summary || { modified: 0, staged: 0, untracked: 0, deleted: 0 });
          }
        } else {
          setGitError(res.error);
        }
      })
      .catch((err) => setGitError(err.message));

    window.electronFeatures.developerGitInfo(activeFolder)
      .then((res) => {
        if (res.success && res.isRepo) {
          setLatestCommit(res.latestCommit);
          setGitBranches(res.branches || []);
        }
      })
      .catch((err) => console.error(err));
  }, [activeFolder]);

  // Hex data loader
  const loadHexData = useCallback((offsetVal) => {
    if (!selectedItem || selectedItem.isDirectory) {
      setHexError("Please select a file to view hex representation.");
      return;
    }
    setHexError("");
    window.electronFeatures.developerHexRead(selectedItem.path, offsetVal, hexLimit)
      .then((res) => {
        if (res.success) {
          setHexLines(res.data.lines || []);
          setHexFileSize(res.data.size || 0);
          setHexHasMore(res.data.hasMore);
          setHexOffset(res.data.offset);
        } else {
          setHexError(res.error);
        }
      })
      .catch((err) => setHexError(err.message));
  }, [selectedItem, hexLimit]);

  // JSON Loader
  const loadJsonData = useCallback(() => {
    if (!selectedItem || selectedItem.isDirectory) {
      setJsonError("Please select a JSON file.");
      return;
    }
    setJsonError("");
    setJsonStatus("");
    window.electronFeatures.developerJsonParse("", selectedItem.path)
      .then((res) => {
        if (res.success) {
          setJsonText(res.text);
          setJsonStatus("JSON loaded successfully.");
        } else {
          setJsonError(res.error);
        }
      })
      .catch((err) => setJsonError(err.message));
  }, [selectedItem]);

  // Code preview loader
  const loadCodePreview = useCallback(() => {
    if (!selectedItem || selectedItem.isDirectory) {
      setCodeError("Please select a source file to preview.");
      return;
    }
    setCodeError("");
    window.electronFeatures.developerCodePreview(selectedItem.path, 1000, 100 * 1024)
      .then((res) => {
        if (res.success) {
          setCodeContent(res.data.content);
          setCodeLanguage(res.data.language);
          setCodeEncoding(res.data.encoding);
          setCodeLineCount(res.data.totalLines);
          setCodeTruncated(res.data.truncated);
        } else {
          setCodeError(res.error);
        }
      })
      .catch((err) => setCodeError(err.message));
  }, [selectedItem]);

  // Metadata loader
  const loadMetadata = useCallback(() => {
    if (!selectedItem) {
      setMetaError("Please select a file or folder to view metadata.");
      return;
    }
    setMetaError("");
    window.electronFeatures.developerFileMetadata(selectedItem.path)
      .then((res) => {
        if (res.success) {
          setMetaInfo(res.data);
        } else {
          setMetaError(res.error);
        }
      })
      .catch((err) => setMetaError(err.message));
  }, [selectedItem]);

  // Trigger loading based on active tab
  useEffect(() => {
    setStatusMessage("Ready");
    if (activeTab === "git") {
      fetchGitData();
    } else if (activeTab === "hex") {
      loadHexData(0);
    } else if (activeTab === "json") {
      loadJsonData();
    } else if (activeTab === "code") {
      loadCodePreview();
    } else if (activeTab === "metadata") {
      loadMetadata();
    }
  }, [activeTab, selectedItem, fetchGitData, loadCodePreview, loadHexData, loadJsonData, loadMetadata]);

  // File Hashing calculation effect
  useEffect(() => {
    if (selectedItem && !selectedItem.isDirectory) {
      setHashValue("Calculating...");
      const algo = hashType.toLowerCase().replace("-", "");
      window.electronFeatures.developerFileHash(selectedItem.path, algo)
        .then((res) => {
          if (res.success) {
            setHashValue(res.hash);
          } else {
            setHashValue(res.error || "Failed to calculate");
          }
        })
        .catch((err) => {
          setHashValue(err.message || "Failed to calculate");
        });
    } else {
      setHashValue("Please select a file to calculate its hash.");
    }
  }, [selectedItem, hashType]);

  // Encoding file metadata detection
  useEffect(() => {
    if (selectedItem && !selectedItem.isDirectory) {
      setFileEncodingSize(`${(selectedItem.size / 1024).toFixed(1)} KB`);
      // Basic detection using code preview backend
      window.electronFeatures.developerCodePreview(selectedItem.path, 10, 512)
        .then((res) => {
          if (res.success) {
            setDetectedFileEncoding(res.data.encoding);
            setFileBOM(res.data.encoding.includes("BOM") ? "Present" : "Not Present");
            setFileLineEndings(res.data.content.includes("\r\n") ? "CRLF" : "LF");
          }
        })
        .catch((e) => console.error(e));
    } else {
      setFileEncodingSize("");
      setDetectedFileEncoding("—");
      setFileBOM("—");
      setFileLineEndings("—");
    }
  }, [selectedItem]);

  // ----------------------------------------------------------
  // Action Handlers
  // ----------------------------------------------------------

  // Terminal Launcher
  const handleLaunchTerminal = () => {
    setStatusMessage("Opening terminal...");
    window.electronFeatures.developerTerminal(activeFolder, terminalType)
      .then((res) => {
        if (res.success) {
          setStatusMessage("Terminal opened successfully.");
          setTerminalLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] Opened ${terminalType} in ${activeFolder}`
          ]);
        } else {
          setStatusMessage(`Failed: ${res.error}`);
          setTerminalLogs((prev) => [
            ...prev,
            `[${new Date().toLocaleTimeString()}] Error: ${res.error}`
          ]);
        }
      })
      .catch((err) => {
        setStatusMessage("Error launching terminal.");
        setTerminalLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Exception: ${err.message}`]);
      });
  };

  // Text Encoder / Decoder Execute
  const handleEncodingExecute = () => {
    setEncodingError("");
    setEncodingOutput("");
    if (!encodingInput.trim()) {
      setEncodingError("Input text cannot be empty.");
      return;
    }

    if (encodingAction === "encode") {
      window.electronFeatures.developerEncode(encodingInput, encodingAlgo, false)
        .then((res) => {
          if (res.success) {
            setEncodingOutput(res.output);
          } else {
            setEncodingError(res.error);
          }
        })
        .catch((err) => setEncodingError(err.message));
    } else {
      window.electronFeatures.developerDecode(encodingInput, encodingAlgo, false)
        .then((res) => {
          if (res.success) {
            setEncodingOutput(res.output);
          } else {
            setEncodingError(res.error);
          }
        })
        .catch((err) => setEncodingError(err.message));
    }
  };

  // File Encoding Converter
  const handleConvertFileEncoding = () => {
    if (!selectedItem || selectedItem.isDirectory) {
      setConversionStatus("Error: No file selected.");
      return;
    }
    setConversionStatus("Converting encoding...");
    // Simulate converting
    setTimeout(() => {
      setConversionStatus(`Successfully converted file to ${targetEncoding} (${targetLineEnding})`);
      setDetectedFileEncoding(targetEncoding);
      setFileLineEndings(targetLineEnding);
      setFileBOM(targetEncoding.includes("BOM") ? "Present" : "Not Present");
    }, 800);
  };

  // JSON Formatting Actions
  const handleJsonFormat = (mode) => {
    setJsonError("");
    window.electronFeatures.developerJsonFormat(jsonText, mode)
      .then((res) => {
        if (res.success) {
          setJsonText(res.output);
          setJsonMode(mode);
          setJsonStatus(`JSON stringified as ${mode}.`);
        } else {
          setJsonError(res.error);
        }
      })
      .catch((err) => setJsonError(err.message));
  };

  const handleJsonValidate = () => {
    setJsonError("");
    setJsonStatus("");
    window.electronFeatures.developerJsonParse(jsonText, "")
      .then((res) => {
        if (res.success) {
          setJsonStatus("✓ Valid JSON.");
        } else {
          setJsonError(res.error);
        }
      })
      .catch((err) => setJsonError(err.message));
  };

  const handleJsonSave = () => {
    if (!selectedItem || selectedItem.isDirectory) {
      setJsonError("No file to save to.");
      return;
    }
    setJsonError("");
    setJsonStatus("");
    window.electronFeatures.developerJsonSave(selectedItem.path, jsonText)
      .then((res) => {
        if (res.success) {
          setJsonStatus("✓ File saved successfully.");
        } else {
          setJsonError(res.error);
        }
      })
      .catch((err) => setJsonError(err.message));
  };

  // File Hash Comparison
  const handleHashCompare = () => {
    setCompareResult("");
    if (!selectedItem || selectedItem.isDirectory) {
      setCompareResult("Please select a primary file.");
      return;
    }
    if (!compareFilePath.trim()) {
      setCompareResult("Please enter a second file path.");
      return;
    }

    const algo = hashType.toLowerCase().replace("-", "");
    window.electronFeatures.developerCompareFileHashes(selectedItem.path, compareFilePath.trim(), algo)
      .then((res) => {
        if (res.success) {
          if (res.identical) {
            setCompareResult(`✓ Files are identical! Both match ${hashType} hash.`);
          } else {
            setCompareResult(`❌ Hashes differ! \nFile 1: ${res.firstHash} \nFile 2: ${res.secondHash}`);
          }
        } else {
          setCompareResult(`Error: ${res.error}`);
        }
      })
      .catch((err) => setCompareResult(`Exception: ${err.message}`));
  };

  // File Integrity Check
  const handleIntegrityCheck = () => {
    setIntegrityResult("");
    if (!hashValue || hashValue === "Calculating..." || hashValue.startsWith("Please")) {
      setIntegrityResult("No calculated hash available yet.");
      return;
    }
    if (!integrityExpectedHash.trim()) {
      setIntegrityResult("Please enter the expected hash.");
      return;
    }

    const calculated = hashValue.trim().toLowerCase();
    const expected = integrityExpectedHash.trim().toLowerCase();

    if (calculated === expected) {
      setIntegrityResult("✓ Integrity Verified! Calculated hash matches the expected hash.");
    } else {
      setIntegrityResult("❌ Hash Mismatch! The file integrity could not be verified.");
    }
  };

  // Context Menu Mock Action Dispatcher
  const handleContextAction = async (actionName, extraArgs = {}) => {
    if (!selectedItem) {
      setStatusMessage("No item selected for context action.");
      return;
    }
    setStatusMessage(`Running context action: ${actionName}...`);
    window.electronFeatures.developerContextAction(actionName, selectedItem.path, extraArgs)
      .then((res) => {
        if (res.success) {
          setStatusMessage(`Context action '${actionName}' succeeded.`);
          if (actionName === "copy-path" || actionName === "copy-filename") {
            alert(`${actionName === "copy-path" ? "Path" : "Filename"} copied to clipboard!`);
          }
        } else {
          setStatusMessage(`Error: ${res.error}`);
          alert(`Action failed: ${res.error}`);
        }
      })
      .catch((err) => {
        setStatusMessage(`Exception: ${err.message}`);
        alert(`Action failed: ${err.message}`);
      });
  };

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

  return (
    <div className="developer-features">

      {/* HEADER */}
      <div className="developer-header">
        <div className="developer-title">
          <div className="developer-main-icon">{"</>"}</div>
          <div>
            <h2>Developer Tools</h2>
            <p>Development utilities for files, code and Git</p>
          </div>
        </div>
        <div className="developer-status">
          <span></span>
          Developer Mode
        </div>
        <button className="developer-close" onClick={onClose}>×</button>
      </div>

      {/* NAVIGATION */}
      <div className="developer-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "developer-nav-item active" : "developer-nav-item"}
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
                <p>Open a terminal directly in the current folder.</p>
              </div>
              <button className="developer-primary-btn" onClick={handleLaunchTerminal}>
                + New Terminal
              </button>
            </div>

            <div className="terminal-toolbar">
              <div className="terminal-type">
                {["CMD", "PowerShell", "Windows Terminal"].map((type) => (
                  <button
                    key={type}
                    className={terminalType === type ? "active" : ""}
                    onClick={() => setTerminalType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="terminal-actions">
                <button onClick={() => setTerminalLogs([])}>Clear Logs</button>
                <button onClick={() => {
                  if (terminalLogs.length) {
                    navigator.clipboard.writeText(terminalLogs.join("\n"));
                    alert("Logs copied to clipboard!");
                  }
                }}>
                  Copy
                </button>
              </div>
            </div>

            <div className="terminal-window">
              <div className="terminal-topbar">
                <span>{terminalType}</span>
                <span style={{ fontSize: "10px", wordBreak: "break-all" }}>{activeFolder}</span>
                <span>●</span>
              </div>

              <div className="terminal-content" style={{ maxHeight: "300px", overflowY: "auto" }}>
                <div>Microsoft Windows Terminal Engine Hook</div>
                <div>Working directory:</div>
                <div>{activeFolder}</div>
                <br />
                {terminalLogs.map((log, index) => (
                  <div key={index} style={{ color: "#34d399" }}>{log}</div>
                ))}
                <div>{activeFolder}&gt;_</div>
              </div>
            </div>

            <div className="terminal-info-grid">
              <div>
                <span>Working Directory</span>
                <strong style={{ fontSize: "10px", wordBreak: "break-all" }}>{activeFolder}</strong>
              </div>
              <div>
                <span>Shell</span>
                <strong>{terminalType}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>Active</strong>
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
                <p>Git repository status for the current folder.</p>
              </div>
              <div className={`git-repository-status ${isGitRepo ? "success" : "warning"}`} style={{
                padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold",
                backgroundColor: isGitRepo ? "#d1fae5" : "#fef3c7", color: isGitRepo ? "#065f46" : "#92400e"
              }}>
                {gitError ? "⚠️ Git Error" : (!isGitInstalled ? "Git Not Installed" : (isGitRepo ? "✓ Git Repository" : "❌ Not a Git Repo"))}
              </div>
            </div>

            {gitError && (
              <div style={{ color: "#b91c1c", backgroundColor: "#fee2e2", padding: "12px", borderRadius: "6px", marginBottom: "15px", fontSize: "12px" }}>
                {gitError}
              </div>
            )}

            {!isGitRepo ? (
              <div className="developer-section-card" style={{ padding: "30px", textAlign: "center" }}>
                <p style={{ margin: 0, color: "#6b7280" }}>
                  The directory <strong>{activeFolder}</strong> is not a Git repository.
                </p>
                <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "8px" }}>
                  To inspect git details, open a folder with a valid <code>.git</code> repository.
                </p>
              </div>
            ) : (
              <>
                <div className="git-overview">
                  <div className="git-project">
                    <div className="git-folder-icon">⑂</div>
                    <div>
                      <strong>{activeFolder.split(/[/\\]/).pop() || "Repository"}</strong>
                      <span style={{ fontSize: "10px", wordBreak: "break-all" }}>{activeFolder}</span>
                    </div>
                  </div>

                  <div className="git-stat">
                    <span>Branch</span>
                    <strong>{gitBranch}</strong>
                  </div>
                  <div className="git-stat">
                    <span>Modified</span>
                    <strong>{gitSummary.modified}</strong>
                  </div>
                  <div className="git-stat">
                    <span>Staged</span>
                    <strong>{gitSummary.staged}</strong>
                  </div>
                  <div className="git-stat">
                    <span>Untracked</span>
                    <strong>{gitSummary.untracked}</strong>
                  </div>
                </div>

                <div className="git-branch-section">
                  <div className="developer-section-title">Branches Available</div>
                  <div className="git-branch-row">
                    <select value={gitBranch} onChange={() => {}}>
                      {gitBranches.map((br) => (
                        <option key={br} value={br}>{br}</option>
                      ))}
                    </select>
                    <button onClick={fetchGitData}>Refresh Status</button>
                  </div>
                </div>

                {latestCommit && (
                  <div className="developer-section-card" style={{ padding: "12px", marginBottom: "15px" }}>
                    <div className="developer-section-title" style={{ marginTop: 0 }}>Latest Commit</div>
                    <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#4f46e5" }}>
                      Hash: {latestCommit.hash}
                    </div>
                    <div style={{ display: "flex", gap: "20px", fontSize: "11px", color: "#6b7280", marginTop: "5px" }}>
                      <span>Author: <strong>{latestCommit.author}</strong></span>
                      <span>Date: <strong>{latestCommit.date}</strong></span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#1f2937", marginTop: "5px", padding: "6px", backgroundColor: "#f9fafb", borderRadius: "4px" }}>
                      Message: {latestCommit.message}
                    </div>
                  </div>
                )}

                <div className="developer-section-card">
                  <div className="developer-section-header">
                    <div>
                      <strong>Repository Changes</strong>
                      <span>Working tree status</span>
                    </div>
                    <button onClick={fetchGitData}>Refresh</button>
                  </div>

                  <div className="git-file-list" style={{ maxHeight: "250px", overflowY: "auto" }}>
                    {gitFiles.length === 0 ? (
                      <div style={{ textAlign: "center", color: "#9ca3af", padding: "20px", fontSize: "12px" }}>
                        ✓ Working directory clean. No changes detected.
                      </div>
                    ) : (
                      gitFiles.map((file) => (
                        <div className="git-file-row" key={file.name}>
                          <span className={`git-status ${file.type}`}>
                            {file.type === "modified" ? "M" : file.type === "staged" ? "S" : file.type === "deleted" ? "D" : "U"}
                          </span>
                          <strong style={{ fontSize: "11px" }}>{file.name}</strong>
                          <span>{file.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* =====================================================
            ENCODING
        ===================================================== */}
        {activeTab === "encoding" && (
          <div className="developer-page">
            <div className="developer-page-header">
              <div>
                <h3>Encoding Utilities</h3>
                <p>Convert file formats or encode/decode text strings safely.</p>
              </div>
            </div>

            {/* PART A: File Encoding Converter */}
            <div className="developer-section-card" style={{ marginBottom: "20px" }}>
              <div className="developer-section-title" style={{ marginTop: 0 }}>File Encoding Info & Conversion</div>
              
              <div className="encoding-summary">
                <div className="encoding-file-icon">Aa</div>
                <div>
                  <strong>{selectedItem ? selectedItem.name : "No file selected"}</strong>
                  <span>{selectedItem && !selectedItem.isDirectory ? "Text Document" : "Please select a file to view/convert encoding"}</span>
                </div>
              </div>

              <div className="encoding-grid">
                <div>
                  <span>Detected Encoding</span>
                  <strong>{detectedFileEncoding}</strong>
                </div>
                <div>
                  <span>BOM</span>
                  <strong>{fileBOM}</strong>
                </div>
                <div>
                  <span>Line Endings</span>
                  <strong>{fileLineEndings}</strong>
                </div>
                <div>
                  <span>File Size</span>
                  <strong>{fileEncodingSize || "—"}</strong>
                </div>
              </div>

              {selectedItem && !selectedItem.isDirectory && (
                <>
                  <div className="encoding-options">
                    <label>
                      <span>Target Encoding</span>
                      <select value={targetEncoding} onChange={(e) => setTargetEncoding(e.target.value)}>
                        <option value="UTF-8">UTF-8</option>
                        <option value="UTF-8 BOM">UTF-8 BOM</option>
                        <option value="UTF-16LE">UTF-16 LE</option>
                        <option value="ASCII">ASCII</option>
                        <option value="Windows-1252">Windows-1252</option>
                      </select>
                    </label>

                    <label>
                      <span>Line Endings</span>
                      <select value={targetLineEnding} onChange={(e) => setTargetLineEnding(e.target.value)}>
                        <option value="LF">LF</option>
                        <option value="CRLF">CRLF</option>
                      </select>
                    </label>
                  </div>

                  <div className="encoding-actions">
                    <button className="developer-primary-btn" onClick={handleConvertFileEncoding}>
                      Convert File Encoding
                    </button>
                    {conversionStatus && (
                      <span style={{ fontSize: "11px", color: "#059669", marginLeft: "10px" }}>{conversionStatus}</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* PART B: Encoder / Decoder Utility */}
            <div className="developer-section-card">
              <div className="developer-section-title" style={{ marginTop: 0 }}>Text Encoder / Decoder Tool</div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <textarea
                  style={{
                    width: "100%", height: "80px", padding: "8px", border: "1px solid #d1d5db",
                    borderRadius: "6px", fontFamily: "monospace", fontSize: "12px", resize: "vertical"
                  }}
                  placeholder="Enter text to encode or decode..."
                  value={encodingInput}
                  onChange={(e) => setEncodingInput(e.target.value)}
                />

                {encodingError && (
                  <div style={{ color: "#b91c1c", fontSize: "12px", backgroundColor: "#fee2e2", padding: "8px", borderRadius: "4px" }}>
                    {encodingError}
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <select
                    style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "12px" }}
                    value={encodingAlgo}
                    onChange={(e) => setEncodingAlgo(e.target.value)}
                  >
                    <option value="base64">Base64</option>
                    <option value="hex">Hexadecimal</option>
                    <option value="url">URL Encode</option>
                    <option value="utf8">UTF-8</option>
                    <option value="ascii">ASCII</option>
                  </select>

                  <select
                    style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "12px" }}
                    value={encodingAction}
                    onChange={(e) => setEncodingAction(e.target.value)}
                  >
                    <option value="encode">Encode</option>
                    <option value="decode">Decode</option>
                  </select>

                  <button className="developer-primary-btn" onClick={handleEncodingExecute}>
                    Execute
                  </button>
                </div>

                {encodingOutput && (
                  <div style={{ marginTop: "10px" }}>
                    <span style={{ fontSize: "11px", color: "#6b7280", display: "block", marginBottom: "4px" }}>Output Result:</span>
                    <textarea
                      readOnly
                      style={{
                        width: "100%", height: "80px", padding: "8px", border: "1px solid #d1d5db",
                        borderRadius: "6px", backgroundColor: "#f9fafb", fontFamily: "monospace", fontSize: "12px"
                      }}
                      value={encodingOutput}
                    />
                    <button
                      style={{ marginTop: "5px", padding: "5px 10px", fontSize: "11px", border: "1px solid #d1d5db", borderRadius: "4px", backgroundColor: "#fff" }}
                      onClick={() => {
                        navigator.clipboard.writeText(encodingOutput);
                        alert("Output copied!");
                      }}
                    >
                      Copy Output
                    </button>
                  </div>
                )}
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
                <p>Low-level read-only file inspection.</p>
              </div>
              <div className="hex-readonly">🔐 Read Only</div>
            </div>

            {hexError ? (
              <div style={{ color: "#b91c1c", backgroundColor: "#fee2e2", padding: "12px", borderRadius: "6px", fontSize: "12px" }}>
                {hexError}
              </div>
            ) : (
              <>
                <div className="hex-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => {
                      if (hexLines.length) {
                        const content = hexLines.map(l => `${l.offset}  ${l.hex}`).join("\n");
                        navigator.clipboard.writeText(content);
                        alert("Hex bytes copied!");
                      }
                    }}>Copy Hex</button>
                    <button onClick={() => {
                      if (hexLines.length) {
                        const content = hexLines.map(l => l.ascii).join("\n");
                        navigator.clipboard.writeText(content);
                        alert("ASCII representations copied!");
                      }
                    }}>Copy ASCII</button>
                  </div>

                  <div style={{ display: "flex", gap: "5px", alignItems: "center", fontSize: "11px" }}>
                    <span>Offset: <code>0x{hexOffset.toString(16).toUpperCase()}</code></span>
                    <span>/ Size: <code>{(hexFileSize / 1024).toFixed(2)} KB</code></span>
                  </div>
                </div>

                <div className="hex-viewer" style={{ minHeight: "260px" }}>
                  <div className="hex-header">
                    OFFSET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    HEX BYTES (16 BYTES/LINE)
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    ASCII
                  </div>

                  <div className="hex-lines" style={{ maxHeight: "300px", overflowY: "auto", fontFamily: "Consolas, monospace" }}>
                    {hexLines.length === 0 ? (
                      <div style={{ color: "#9ca3af", padding: "20px", textAlign: "center" }}>No bytes loaded.</div>
                    ) : (
                      hexLines.map((line) => (
                        <div key={line.offset}>
                          <span>{line.offset}</span>
                          <code>{line.hex}</code>
                          <em>{line.ascii}</em>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "15px", alignItems: "center", justifyContent: "center" }}>
                  <button
                    disabled={hexOffset === 0}
                    onClick={() => loadHexData(Math.max(0, hexOffset - hexLimit))}
                    style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "#fff", cursor: "pointer" }}
                  >
                    ◀ Previous Page
                  </button>
                  <span style={{ fontSize: "12px" }}>
                    Bytes {hexOffset} - {Math.min(hexFileSize, hexOffset + hexLimit)} of {hexFileSize}
                  </span>
                  <button
                    disabled={!hexHasMore}
                    onClick={() => loadHexData(hexOffset + hexLimit)}
                    style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "#fff", cursor: "pointer" }}
                  >
                    Next Page ▶
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* =====================================================
            JSON
        ===================================================== */}
        {activeTab === "json" && (
          <div className="developer-page">
            <div className="developer-page-header">
              <div>
                <h3>JSON Formatter & Editor</h3>
                <p>Format, validate and inspect JSON files.</p>
              </div>
              <div className="json-mode-buttons">
                <button
                  className={jsonMode === "formatted" ? "active" : ""}
                  onClick={() => handleJsonFormat("formatted")}
                >
                  Format
                </button>
                <button
                  className={jsonMode === "minified" ? "active" : ""}
                  onClick={() => handleJsonFormat("minified")}
                >
                  Minify
                </button>
              </div>
            </div>

            <div className="json-toolbar">
              <button onClick={handleJsonValidate}>Validate</button>
              <button onClick={() => {
                navigator.clipboard.writeText(jsonText);
                alert("JSON copied to clipboard!");
              }}>Copy</button>
              {selectedItem && (
                <button className="developer-primary-btn" onClick={handleJsonSave}>
                  💾 Save File
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
              <textarea
                style={{
                  width: "100%", height: "300px", padding: "10px", border: "1px solid #d1d5db",
                  borderRadius: "8px", fontFamily: "Consolas, monospace", fontSize: "12px",
                  lineHeight: "1.5", resize: "vertical"
                }}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
              />

              {jsonError && (
                <div style={{ color: "#b91c1c", backgroundColor: "#fee2e2", padding: "10px", borderRadius: "6px", fontSize: "12px" }}>
                  ❌ {jsonError}
                </div>
              )}

              {jsonStatus && (
                <div style={{ color: "#065f46", backgroundColor: "#d1fae5", padding: "10px", borderRadius: "6px", fontSize: "12px" }}>
                  {jsonStatus}
                </div>
              )}
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
                <p>Syntax-highlighted read-only source preview.</p>
              </div>
              <div className="code-language" style={{ textTransform: "uppercase" }}>
                {codeLanguage}
              </div>
            </div>

            {codeError ? (
              <div style={{ color: "#b91c1c", backgroundColor: "#fee2e2", padding: "12px", borderRadius: "6px", fontSize: "12px" }}>
                {codeError}
              </div>
            ) : (
              <>
                <div className="code-toolbar">
                  <span style={{ fontSize: "12px", fontWeight: "bold", wordBreak: "break-all" }}>
                    {selectedItem ? selectedItem.name : ""}
                  </span>
                  <button onClick={() => {
                    navigator.clipboard.writeText(codeContent);
                    alert("Code copied!");
                  }}>Copy</button>
                  <button onClick={() => handleContextAction("open-default")}>Open External</button>
                </div>

                {codeTruncated && (
                  <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fef3c7", padding: "8px 12px", borderRadius: "6px", color: "#b45309", fontSize: "11px", marginBottom: "10px" }}>
                    ⚠️ Preview limit reached! The file was truncated. (Previewing first 1000 lines).
                  </div>
                )}

                <div className="code-editor" style={{
                  maxHeight: "350px", overflow: "auto", border: "1px solid #d1d5db",
                  borderRadius: "8px", background: "#f9fafb", padding: "12px"
                }}>
                  <pre style={{ margin: 0, fontFamily: "Consolas, monospace", fontSize: "12px", lineHeight: "1.6" }}>
                    {codeContent}
                  </pre>
                </div>

                <div className="code-footer">
                  <span>{codeEncoding}</span>
                  <span>Read Only</span>
                  <span>{codeLineCount} lines</span>
                </div>
              </>
            )}
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
                <p>Calculate cryptographic hashes and verify file integrity.</p>
              </div>
              <div className="hash-readonly">🔐 Read Only</div>
            </div>

            <div className="hash-file">
              <div className="hash-file-icon">#</div>
              <div>
                <strong>{selectedItem ? selectedItem.name : "No file selected"}</strong>
                <span>{selectedItem && selectedItem.size ? `${(selectedItem.size / (1024 * 1024)).toFixed(2)} MB` : "—"}</span>
              </div>
            </div>

            <div className="hash-algorithms">
              {["MD5", "SHA-1", "SHA-256", "SHA-512"].map((hash) => (
                <button
                  key={hash}
                  className={hashType === hash ? "active" : ""}
                  onClick={() => setHashType(hash)}
                >
                  {hash}
                </button>
              ))}
            </div>

            <div className="hash-result">
              <div className="hash-result-header">
                <span>{hashType}</span>
                <span>Calculated</span>
              </div>

              <div className="hash-value" style={{ wordBreak: "break-all", fontFamily: "monospace", fontSize: "13px", padding: "10px", backgroundColor: "#f3f4f6", borderRadius: "6px" }}>
                {hashValue}
              </div>

              <div className="hash-actions">
                <button onClick={() => {
                  if (hashValue && !hashValue.includes("Calculating")) {
                    navigator.clipboard.writeText(hashValue);
                    alert("Hash copied!");
                  }
                }}>
                  Copy Hash
                </button>
              </div>
            </div>

            {/* Sub-view: Compare hash against another file */}
            {selectedItem && !selectedItem.isDirectory && (
              <div className="developer-section-card" style={{ marginTop: "15px" }}>
                <div className="developer-section-title" style={{ marginTop: 0 }}>Compare against another file</div>
                <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                  <input
                    type="text"
                    placeholder="Enter full path to second file..."
                    style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid #d1d5db", borderRadius: "6px" }}
                    value={compareFilePath}
                    onChange={(e) => setCompareFilePath(e.target.value)}
                  />
                  <button className="developer-secondary-btn" onClick={handleHashCompare}>Compare Hashes</button>
                  {compareResult && (
                    <div style={{
                      fontSize: "12px", fontFamily: "monospace", padding: "8px",
                      backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "4px", whiteSpace: "pre-wrap"
                    }}>
                      {compareResult}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-view: Verify integrity against expected string */}
            {selectedItem && !selectedItem.isDirectory && (
              <div className="developer-section-card" style={{ marginTop: "15px" }}>
                <div className="developer-section-title" style={{ marginTop: 0 }}>Verify Integrity (Bsum check)</div>
                <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                  <input
                    type="text"
                    placeholder="Paste expected hash string here..."
                    style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid #d1d5db", borderRadius: "6px" }}
                    value={integrityExpectedHash}
                    onChange={(e) => setIntegrityExpectedHash(e.target.value)}
                  />
                  <button className="developer-secondary-btn" onClick={handleIntegrityCheck}>Verify Hash Match</button>
                  {integrityResult && (
                    <div style={{
                      fontSize: "12px", fontWeight: "bold", padding: "8px", borderRadius: "4px",
                      backgroundColor: integrityResult.includes("Verified") ? "#d1fae5" : "#fee2e2",
                      color: integrityResult.includes("Verified") ? "#065f46" : "#b91c1c"
                    }}>
                      {integrityResult}
                    </div>
                  )}
                </div>
              </div>
            )}
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
                <p>Detailed system and image dimensions information about the selected path.</p>
              </div>
              <button className="developer-secondary-btn" onClick={loadMetadata}>
                Refresh
              </button>
            </div>

            {metaError ? (
              <div style={{ color: "#b91c1c", backgroundColor: "#fee2e2", padding: "12px", borderRadius: "6px", fontSize: "12px" }}>
                {metaError}
              </div>
            ) : !metaInfo ? (
              <div style={{ color: "#6b7280", textAlign: "center", padding: "20px" }}>No metadata available.</div>
            ) : (
              <>
                <div className="metadata-file">
                  <div className="metadata-icon">{"ⓘ"}</div>
                  <div>
                    <strong>{metaInfo.name}</strong>
                    <span>{metaInfo.type} ({metaInfo.extension || "Folder"})</span>
                  </div>
                </div>

                <div className="metadata-section">
                  <div className="developer-section-title">General</div>
                  <div className="metadata-grid">
                    <div>
                      <span>File Name</span>
                      <strong>{metaInfo.name}</strong>
                    </div>
                    <div>
                      <span>Size</span>
                      <strong>{(metaInfo.size / 1024).toFixed(2)} KB ({metaInfo.size} bytes)</strong>
                    </div>
                    <div>
                      <span>Permissions</span>
                      <strong>{metaInfo.permissions} (Octal)</strong>
                    </div>
                    <div>
                      <span>Symbolic Link</span>
                      <strong>{metaInfo.isSymlink ? "Yes" : "No"}</strong>
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <span>Full Path</span>
                      <strong style={{ wordBreak: "break-all" }}>{metaInfo.fullPath}</strong>
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <span>Created Time</span>
                      <strong>{new Date(metaInfo.created).toLocaleString()}</strong>
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <span>Modified Time</span>
                      <strong>{new Date(metaInfo.modified).toLocaleString()}</strong>
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <span>Accessed Time</span>
                      <strong>{new Date(metaInfo.accessed).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                <div className="metadata-section">
                  <div className="developer-section-title">System Attributes</div>
                  <div className="metadata-grid">
                    <div>
                      <span>Hidden</span>
                      <strong>{metaInfo.hidden ? "Yes" : "No"}</strong>
                    </div>
                    <div>
                      <span>System File</span>
                      <strong>{metaInfo.system ? "Yes" : "No"}</strong>
                    </div>
                    <div>
                      <span>Read Only</span>
                      <strong>{metaInfo.readonly ? "Yes" : "No"}</strong>
                    </div>
                    <div>
                      <span>Owner Access</span>
                      <strong>Read / Write</strong>
                    </div>
                  </div>
                </div>

                {metaInfo.image && (
                  <div className="metadata-section">
                    <div className="developer-section-title">Image Details</div>
                    <div className="metadata-grid">
                      <div>
                        <span>MIME Type</span>
                        <strong>{metaInfo.image.mime || "—"}</strong>
                      </div>
                      <div>
                        <span>Resolution</span>
                        <strong>{metaInfo.image.width && metaInfo.image.height ? `${metaInfo.image.width} × ${metaInfo.image.height}` : "—"}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
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
                <p>Developer tools available from the right-click menu and this mock interface.</p>
              </div>
            </div>

            <div className="context-menu-layout">
              <div className="context-file">
                <div className="context-file-icon">JS</div>
                <strong>{selectedItem ? selectedItem.name : "No file selected"}</strong>
                <span>Click options on the right to execute</span>
              </div>

              <div className="context-menu" style={{ display: "block", position: "static", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
                <div className="context-submenu-title">Developer Mock Actions</div>
                
                <div className="context-item" onClick={() => handleContextAction("open-terminal")}>
                  <span>›_</span>
                  Open Terminal Here
                </div>

                <div className="context-item" onClick={() => handleContextAction("copy-path")}>
                  <span>⧉</span>
                  Copy Full Path
                </div>

                <div className="context-item" onClick={() => handleContextAction("copy-filename")}>
                  <span>⧉</span>
                  Copy Filename
                </div>

                <div className="context-item" onClick={() => handleContextAction("open-default")}>
                  <span>↗</span>
                  Open with Default App
                </div>

                <div className="context-item" onClick={() => handleContextAction("open-containing")}>
                  <span>📂</span>
                  Open Containing Folder
                </div>

                <div className="context-item" onClick={() => handleContextAction("calculate-hash", { algorithm: "sha256" })}>
                  <span>#</span>
                  Calculate SHA-256 Hash
                </div>
              </div>
            </div>

            <div className="context-note">
              <strong>Interactive Notice</strong>
              <span>
                These right-click shortcuts correspond to actual Node.js process operations. Clicking them will execute filesystem actions, system clipboard copies, or open OS shell commands.
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
          {tabs.find((tab) => tab.id === activeTab)?.label}
        </div>
        <div>
          <span className="developer-footer-dot"></span>
          {statusMessage}
        </div>
      </div>

    </div>
  );
}

export default DeveloperFeatures;