import { useState, useEffect, useCallback } from "react";
import "./AIFeatures.css";

function AIFeatures({ currentPath, items, onClose }) {
  const [activeTab, setActiveTab] = useState("categorization");
  const [searchQuery, setSearchQuery] = useState("");
  const [assistantInput, setAssistantInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Documents");
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Statuses
  const [engineStatus, setEngineStatus] = useState("Unavailable");
  const [activeModel, setActiveModel] = useState("None");
  const [activeProvider, setActiveProvider] = useState("local");
  
  // Settings Config Modal
  const [showSettings, setShowSettings] = useState(false);
  const [providersList, setProvidersList] = useState([]);
  const [configProvider, setConfigProvider] = useState("local");
  const [configModel, setConfigModel] = useState("local-rules");
  const [configUrl, setConfigUrl] = useState("http://127.0.0.1:11434");
  const [configKey, setConfigKey] = useState("");

  // Analysis & Indexing
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [analyzedItems, setAnalyzedItems] = useState([]);

  // Smart Tags
  const [fileTags, setFileTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState("");

  // Vision Analysis
  const [visionResult, setVisionResult] = useState(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  // Document AI
  const [docResult, setDocResult] = useState(null);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);

  // Semantic Search
  const [semanticResults, setSemanticResults] = useState([]);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);
  const [searchSources, setSearchSources] = useState({
    filename: true,
    content: true,
    ocr: true,
    vision: true,
    metadata: true
  });

  // Assistant
  const [chatMessages, setChatMessages] = useState([
    { sender: "assistant", text: "Hello! I am your AI File Assistant. I can analyze files in the current folder, extract metadata, or answer questions. How can I help you today?" }
  ]);
  const [isAssistantTyping, setIsAssistantTyping] = useState(false);

  const categories = [
    "Documents",
    "Bills",
    "Invoices",
    "Receipts",
    "Photos",
    "Screenshots",
    "IDs / Documents",
    "Videos",
    "Music",
    "Projects",
    "Code",
    "Personal",
    "Work",
  ];

  const tabs = [
    { id: "categorization", label: "Categorization", icon: "▦" },
    { id: "tagging", label: "Smart Tags", icon: "#" },
    { id: "vision", label: "Image Understanding", icon: "◉" },
    { id: "documents", label: "Document AI", icon: "▤" },
    { id: "search", label: "Semantic Search", icon: "⌕" },
    { id: "assistant", label: "AI Assistant", icon: "✦" },
  ];

  const loadStatus = useCallback(async () => {
    try {
      const status = await window.electronFeatures.aiGetStatus();
      if (status.available) {
        setEngineStatus("Ready");
        setActiveModel(status.model);
        setActiveProvider(status.provider);
      } else {
        setEngineStatus("Unavailable");
        setActiveModel("None");
        setActiveProvider("local");
      }
    } catch (err) {
      console.warn(err);
      setEngineStatus("Error");
    }
  }, []);

  const loadFolderAnalysis = useCallback(async () => {
    const list = [];
    for (const item of items) {
      if (!item.isDirectory) {
        try {
          const res = await window.electronFeatures.aiGetAnalysis(item.path);
          if (res) {
            list.push({ ...item, analysis: res });
          }
        } catch (err) {
          console.warn(err);
        }
      }
    }
    setAnalyzedItems(list);
  }, [items]);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadStatus();
      loadFolderAnalysis();
    });

    // Progress updates subscription
    const unsubProgress = window.electronFeatures.onAiProgress((data) => {
      setProgress(data.percent || 0);
      setAnalyzedCount(data.completed || 0);
      setFailedCount(data.failed || 0);
    });

    return () => {
      unsubProgress();
    };
  }, [loadStatus, loadFolderAnalysis]);

  const handleOpenSettings = async () => {
    setShowSettings(true);
    try {
      const list = await window.electronFeatures.aiGetProviders();
      setProvidersList(list || []);
      const active = await window.electronFeatures.aiGetConfig();
      setConfigProvider(active.provider);
      setConfigModel(active.model);
      setConfigUrl(active.ollamaUrl || "http://127.0.0.1:11434");
    } catch (err) {
      console.warn(err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await window.electronFeatures.aiSetProvider(configProvider, configModel, configUrl, configKey);
      setConfigKey("");
      setShowSettings(false);
      await loadStatus();
      alert("AI Configuration saved successfully!");
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  // Batch analysis
  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setProgress(0);
    try {
      const filesOnly = items.filter(it => !it.isDirectory).map(it => ({ name: it.name, path: it.path, isDirectory: false }));
      await window.electronFeatures.aiAnalyzeFiles(filesOnly, {});
      await loadFolderAnalysis();
    } catch (err) {
      console.warn(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const cancelAnalysis = async () => {
    await window.electronFeatures.aiCancel();
    setIsAnalyzing(false);
  };

  // Smart tags
  const handleSelectFileForTags = (file) => {
    setSelectedFile(file);
    if (file.analysis) {
      setFileTags(file.analysis.tags || []);
    } else {
      setFileTags([]);
    }
  };

  const handleGenerateTags = async () => {
    if (!selectedFile) return;
    try {
      const res = await window.electronFeatures.aiGenerateTags(selectedFile, {});
      setFileTags(res.tags);
      await window.electronFeatures.aiSaveTags(selectedFile.path, res.tags);
      await loadFolderAnalysis();
    } catch (err) {
      console.warn(err);
      alert("Failed to generate tags");
    }
  };

  const handleAddCustomTag = async () => {
    if (!selectedFile || !customTagInput.trim()) return;
    const tag = customTagInput.trim().startsWith("#") ? customTagInput.trim() : `#${customTagInput.trim()}`;
    if (!fileTags.includes(tag)) {
      const updated = [...fileTags, tag];
      setFileTags(updated);
      await window.electronFeatures.aiSaveTags(selectedFile.path, updated);
      setCustomTagInput("");
      await loadFolderAnalysis();
    }
  };

  const handleDeleteTag = async (tagToDelete) => {
    if (!selectedFile) return;
    const updated = fileTags.filter(t => t !== tagToDelete);
    setFileTags(updated);
    await window.electronFeatures.aiSaveTags(selectedFile.path, updated);
    await loadFolderAnalysis();
  };

  // Image Understanding
  const handleAnalyzeImage = async (file) => {
    setIsAnalyzingImage(true);
    try {
      const res = await window.electronFeatures.aiAnalyzeImage(file.path);
      setVisionResult(res);
    } catch (err) {
      console.warn(err);
      alert("Image analysis failed.");
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // Document AI
  const handleAnalyzeDoc = async (file) => {
    setIsAnalyzingDoc(true);
    try {
      const res = await window.electronFeatures.aiAnalyzeDocument(file.path);
      setDocResult(res);
    } catch (err) {
      console.warn(err);
      alert("Document analysis failed.");
    } finally {
      setIsAnalyzingDoc(false);
    }
  };

  // Semantic Search
  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearchingSemantic(true);
    try {
      const res = await window.electronFeatures.aiSemanticSearch(searchQuery, searchSources);
      setSemanticResults(res || []);
    } catch (err) {
      console.warn(err);
      alert("Semantic search failed.");
    } finally {
      setIsSearchingSemantic(false);
    }
  };

  // Assistant Chat
  const handleSendMessage = async (customText = "") => {
    const textToSend = customText || assistantInput;
    if (!textToSend.trim()) return;

    setChatMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    if (!customText) setAssistantInput("");
    setIsAssistantTyping(true);

    try {
      const response = await window.electronFeatures.aiAssistant(currentPath, items, textToSend);
      setChatMessages((prev) => [...prev, { sender: "assistant", text: response.reply }]);
    } catch (err) {
      console.warn(err);
      setChatMessages((prev) => [...prev, { sender: "assistant", text: "Error communicating with AI Assistant backend." }]);
    } finally {
      setIsAssistantTyping(false);
    }
  };

  // Filter items in UI for Categorization tab
  const getCategorizedFiles = (catName) => {
    return analyzedItems.filter(item => item.analysis && item.analysis.category === catName);
  };

  return (
    <div className="ai-features">

      {/* HEADER */}
      <div className="ai-header">
        <div className="ai-title-section">
          <div className="ai-main-icon">✦</div>
          <div>
            <h2>AI File Intelligence</h2>
            <p>Understand, organize and search files in {currentPath}</p>
          </div>
        </div>

        <div className="ai-status" style={{ cursor: "pointer" }} onClick={handleOpenSettings} title="Click to configure AI settings">
          <span className="ai-status-dot" style={{ backgroundColor: engineStatus === "Ready" ? "#2ea44f" : "#d73a49" }}></span>
          <span>AI Engine ({activeProvider})</span>
          <strong>{engineStatus}</strong>
        </div>

        <button className="ai-close-btn" onClick={onClose}>×</button>
      </div>

      {/* SETTINGS OVERLAY */}
      {showSettings && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", width: "400px", display: "flex", flexDirection: "column", gap: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: 0, borderBottom: "1px solid #ddd", paddingBottom: "10px" }}>AI Settings</h3>
            
            <label style={{ display: "flex", flexDirection: "column", fontSize: "12px", gap: "3px" }}>
              <strong>Provider</strong>
              <select value={configProvider} onChange={(e) => setConfigProvider(e.target.value)} style={{ padding: "5px" }}>
                {providersList.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name.toUpperCase()} ({p.available ? "Ready" : "Unavailable"})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", fontSize: "12px", gap: "3px" }}>
              <strong>Model Name</strong>
              <input type="text" value={configModel} onChange={(e) => setConfigModel(e.target.value)} style={{ padding: "5px" }} />
            </label>

            {configProvider === "ollama" && (
              <label style={{ display: "flex", flexDirection: "column", fontSize: "12px", gap: "3px" }}>
                <strong>Ollama API URL</strong>
                <input type="text" value={configUrl} onChange={(e) => setConfigUrl(e.target.value)} style={{ padding: "5px" }} />
              </label>
            )}

            {(configProvider === "openai" || configProvider === "gemini") && (
              <label style={{ display: "flex", flexDirection: "column", fontSize: "12px", gap: "3px" }}>
                <strong>API Key (Saves securely using DPAPI)</strong>
                <input type="password" placeholder="••••••••••••••••" value={configKey} onChange={(e) => setConfigKey(e.target.value)} style={{ padding: "5px" }} />
              </label>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "15px" }}>
              <button className="ai-secondary-btn" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="ai-primary-btn" onClick={handleSaveSettings}>Save Config</button>
            </div>
          </div>
        </div>
      )}

      {/* NAVIGATION */}
      <div className="ai-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "ai-nav-item active" : "ai-nav-item"}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="ai-nav-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* BODY */}
      <div className="ai-body" style={{ display: "flex", flex: 1, flexDirection: "column", overflow: "hidden" }}>

        {/* A. CATEGORIZATION */}
        {activeTab === "categorization" && (
          <div className="ai-page" style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
            <div className="ai-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3>AI File Categorization</h3>
                <p>Understand and group files in this folder automatically.</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                {isAnalyzing && (
                  <button className="ai-secondary-btn" style={{ backgroundColor: "#d73a49", color: "#fff" }} onClick={cancelAnalysis}>Cancel</button>
                )}
                <button className="ai-primary-btn" onClick={startAnalysis} disabled={isAnalyzing}>
                  {isAnalyzing ? "Analyzing..." : "Analyze Files"}
                </button>
              </div>
            </div>

            <div className="ai-category-grid">
              {categories.map((category) => (
                <button
                  key={category}
                  className={selectedCategory === category ? "ai-category-card selected" : "ai-category-card"}
                  onClick={() => setSelectedCategory(category)}
                >
                  <div className="ai-category-name">{category}</div>
                  <div className="ai-category-count">{getCategorizedFiles(category).length} files</div>
                </button>
              ))}
            </div>

            {/* Progress status */}
            <div className="ai-analysis-card" style={{ marginTop: "15px" }}>
              <div className="ai-analysis-header" style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>AI Batch Analysis Status</strong>
                <span className="ai-analysis-status">{isAnalyzing ? "Processing" : "Ready"}</span>
              </div>
              <div className="ai-progress-track" style={{ height: "10px", backgroundColor: "#eee", borderRadius: "5px", overflow: "hidden", margin: "10px 0" }}>
                <div className="ai-progress-value" style={{ width: `${progress}%`, height: "100%", backgroundColor: "#0078d4", transition: "width 0.2s" }} />
              </div>
              <div className="ai-analysis-footer" style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666" }}>
                <span>Analyzed: {analyzedCount} | Failed: {failedCount}</span>
                <strong>{progress}%</strong>
              </div>
            </div>

            {/* List files under selected category */}
            <div style={{ marginTop: "20px" }}>
              <h4>Files in "{selectedCategory}"</h4>
              {getCategorizedFiles(selectedCategory).length === 0 ? (
                <p style={{ fontStyle: "italic", color: "#888", fontSize: "13px" }}>No analyzed files in this category. Click "Analyze Files" to scan.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {getCategorizedFiles(selectedCategory).map(f => (
                    <div key={f.path} style={{ padding: "8px", borderBottom: "1px solid #eee", fontSize: "13px", display: "flex", justifyContent: "space-between" }}>
                      <span>📄 {f.name}</span>
                      <span style={{ color: "#2ea44f", fontWeight: "bold" }}>Conf: {Math.round(f.analysis.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* B. SMART TAGS */}
        {activeTab === "tagging" && (
          <div className="ai-page" style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
            <div className="ai-page-header">
              <h3>Automatic Smart Tagging</h3>
              <p>Extract and update keywords describing your document or image content.</p>
            </div>

            <div className="ai-tag-layout" style={{ display: "flex", gap: "20px" }}>
              <div className="ai-file-preview-card" style={{ flex: 1, border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
                <strong>Select a file to Tag</strong>
                <div style={{ maxHeight: "200px", overflowY: "auto", marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {items.filter(it => !it.isDirectory).map(it => (
                    <button key={it.path} onClick={() => handleSelectFileForTags(it)} style={{ padding: "5px 10px", textAlign: "left", cursor: "pointer", border: "1px solid #eee", background: selectedFile && selectedFile.path === it.path ? "#eef3fc" : "#fff", borderRadius: "4px", fontSize: "12px" }}>
                      📄 {it.name}
                    </button>
                  ))}
                </div>

                {selectedFile && (
                  <div style={{ marginTop: "15px" }}>
                    <strong>Selected:</strong> {selectedFile.name}
                    <button className="ai-primary-btn" style={{ width: "100%", marginTop: "10px" }} onClick={handleGenerateTags}>Generate Smart Tags</button>
                  </div>
                )}
              </div>

              <div className="ai-tags-panel" style={{ flex: 2, border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
                <strong>Tags List</strong>
                <div className="ai-tag-list" style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "15px 0" }}>
                  {fileTags.length === 0 ? (
                    <span style={{ color: "#888", fontStyle: "italic", fontSize: "13px" }}>No tags found. Add custom tag or click Generate.</span>
                  ) : (
                    fileTags.map(tag => (
                      <span key={tag} style={{ backgroundColor: "#eef3fc", color: "#0078d4", padding: "3px 8px", borderRadius: "4px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        {tag}
                        <button onClick={() => handleDeleteTag(tag)} style={{ border: "none", background: "none", color: "#d73a49", cursor: "pointer", fontWeight: "bold" }}>×</button>
                      </span>
                    ))
                  )}
                </div>

                {selectedFile && (
                  <div className="ai-custom-tag" style={{ display: "flex", gap: "5px" }}>
                    <input type="text" placeholder="Add custom tag..." value={customTagInput} onChange={(e) => setCustomTagInput(e.target.value)} style={{ flex: 1, padding: "5px" }} />
                    <button className="ai-secondary-btn" onClick={handleAddCustomTag}>Add</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* C. IMAGE UNDERSTANDING */}
        {activeTab === "vision" && (
          <div className="ai-page" style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
            <div className="ai-page-header">
              <h3>Image Understanding (Vision)</h3>
              <p>Analyze scene attributes, visual elements, and objects in images.</p>
            </div>

            <div className="ai-vision-layout" style={{ display: "flex", gap: "20px" }}>
              <div className="ai-vision-image" style={{ flex: 1, border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
                <strong>Images in Folder</strong>
                <div style={{ maxHeight: "200px", overflowY: "auto", marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {items.filter(it => it.name.match(/\.(jpg|jpeg|png|webp)$/i)).map(it => (
                    <button key={it.path} onClick={() => handleAnalyzeImage(it)} style={{ padding: "5px 10px", textAlign: "left", cursor: "pointer", border: "1px solid #eee", background: "#fff", borderRadius: "4px", fontSize: "12px" }}>
                      🖼️ {it.name}
                    </button>
                  ))}
                </div>
                {isAnalyzingImage && <p style={{ fontStyle: "italic", fontSize: "12px", marginTop: "10px" }}>Running vision model...</p>}
              </div>

              <div className="ai-vision-analysis" style={{ flex: 2, border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
                <strong>Analysis Output</strong>
                {visionResult ? (
                  <div style={{ marginTop: "10px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div><strong>Scene Type:</strong> {visionResult.scene}</div>
                    <div><strong>Detected Objects:</strong> {visionResult.objects.join(", ") || "None"}</div>
                    <div><strong>Description:</strong> {visionResult.description}</div>
                    <div><strong>Confidence:</strong> {Math.round(visionResult.confidence * 100)}%</div>
                  </div>
                ) : (
                  <p style={{ fontStyle: "italic", color: "#888", fontSize: "13px", marginTop: "10px" }}>Select an image file on the left to analyze.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* D. DOCUMENT AI */}
        {activeTab === "documents" && (
          <div className="ai-page" style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
            <div className="ai-page-header">
              <h3>Document Intelligence AI</h3>
              <p>Extract fields (date, amount, company) and build text summaries.</p>
            </div>

            <div style={{ display: "flex", gap: "20px" }}>
              <div style={{ flex: 1, border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
                <strong>Documents List</strong>
                <div style={{ maxHeight: "200px", overflowY: "auto", marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
                  {items.filter(it => it.name.match(/\.(pdf|txt|md)$/i)).map(it => (
                    <button key={it.path} onClick={() => handleAnalyzeDoc(it)} style={{ padding: "5px 10px", textAlign: "left", cursor: "pointer", border: "1px solid #eee", background: "#fff", borderRadius: "4px", fontSize: "12px" }}>
                      📄 {it.name}
                    </button>
                  ))}
                </div>
                {isAnalyzingDoc && <p style={{ fontStyle: "italic", fontSize: "12px", marginTop: "10px" }}>Analyzing document text...</p>}
              </div>

              <div style={{ flex: 2, border: "1px solid #ddd", padding: "15px", borderRadius: "8px" }}>
                <strong>Extracted Information</strong>
                {docResult ? (
                  <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                    <div><strong>Document Type:</strong> {docResult.documentType}</div>
                    <div><strong>Date:</strong> {docResult.date || "—"}</div>
                    <div><strong>Amount:</strong> {docResult.amount || "—"}</div>
                    <div><strong>Organization:</strong> {docResult.organization || "—"}</div>
                    <div><strong>Person:</strong> {docResult.person || "—"}</div>
                    <div><strong>Reference/Invoice No:</strong> {docResult.referenceNumber || "—"}</div>
                    <div><strong>Summary:</strong> {docResult.summary}</div>
                  </div>
                ) : (
                  <p style={{ fontStyle: "italic", color: "#888", fontSize: "13px", marginTop: "10px" }}>Select a document file to analyze.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* E. SEMANTIC SEARCH */}
        {activeTab === "search" && (
          <div className="ai-page" style={{ display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
            <div className="ai-page-header">
              <h3>Semantic Concept Search</h3>
              <p>Search storage conceptual meanings instead of exact filenames.</p>
            </div>

            <div className="ai-semantic-search" style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSemanticSearch(); }}
                placeholder='Search meanings... e.g. "finance receipt from last month"'
                style={{ flex: 1, padding: "8px" }}
              />
              <button className="ai-primary-btn" onClick={handleSemanticSearch} disabled={isSearchingSemantic}>
                {isSearchingSemantic ? "Searching..." : "Search"}
              </button>
            </div>

            {/* Source checkboxes */}
            <div className="ai-search-sources" style={{ display: "flex", gap: "15px", marginBottom: "15px", fontSize: "12px", color: "#555" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <input type="checkbox" checked={searchSources.filename} onChange={(e) => setSearchSources(prev => ({ ...prev, filename: e.target.checked }))} />
                <span>Filename</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <input type="checkbox" checked={searchSources.content} onChange={(e) => setSearchSources(prev => ({ ...prev, content: e.target.checked }))} />
                <span>File content</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <input type="checkbox" checked={searchSources.ocr} onChange={(e) => setSearchSources(prev => ({ ...prev, ocr: e.target.checked }))} />
                <span>OCR</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <input type="checkbox" checked={searchSources.vision} onChange={(e) => setSearchSources(prev => ({ ...prev, vision: e.target.checked }))} />
                <span>Image understanding</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <input type="checkbox" checked={searchSources.metadata} onChange={(e) => setSearchSources(prev => ({ ...prev, metadata: e.target.checked }))} />
                <span>Metadata</span>
              </label>
            </div>

            {/* Results */}
            <div>
              <h4>Results Ranked by AI Relevance</h4>
              {semanticResults.length === 0 ? (
                <p style={{ fontStyle: "italic", color: "#888", fontSize: "13px" }}>No semantic results. Index files in Categorization first.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {semanticResults.map((res, i) => (
                    <div key={i} style={{ padding: "10px", border: "1px solid #eee", borderRadius: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: "13px" }}>📄 {res.name}</div>
                        <div style={{ fontSize: "11px", color: "#888" }}>{res.path}</div>
                      </div>
                      <span style={{ fontSize: "12px", backgroundColor: "#eef3fc", color: "#0078d4", padding: "3px 8px", borderRadius: "4px", fontWeight: "bold" }}>
                        Relevance: {Math.round(res.relevance * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* F. AI ASSISTANT */}
        {activeTab === "assistant" && (
          <div className="ai-page ai-assistant-page" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <div className="ai-page-header" style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <h3>AI Assistant Chat</h3>
                <p>Interact with files and trigger safe automated queries.</p>
              </div>
              <span className="ai-safe-badge" style={{ backgroundColor: "#eef3fc", color: "#0078d4", padding: "3px 8px", borderRadius: "4px", fontSize: "12px" }}>🔐 Safe Mode</span>
            </div>

            <div className="ai-chat" style={{ flex: 1, overflowY: "auto", padding: "10px", border: "1px solid #eee", borderRadius: "5px", display: "flex", flexDirection: "column", gap: "8px", margin: "10px 0" }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`ai-chat-message ${msg.sender}`} style={{ display: "flex", alignSelf: msg.sender === "user" ? "flex-end" : "flex-start", gap: "8px", maxWidth: "80%" }}>
                  <div className="ai-chat-bubble" style={{ padding: "8px 12px", borderRadius: "8px", backgroundColor: msg.sender === "user" ? "#0078d4" : "#f1f1f1", color: msg.sender === "user" ? "#fff" : "#333", fontSize: "13px" }}>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.text}</p>
                  </div>
                </div>
              ))}
              {isAssistantTyping && (
                <div style={{ fontStyle: "italic", fontSize: "11px", color: "#888" }}>Assistant is thinking...</div>
              )}
            </div>

            <div style={{ display: "flex", gap: "5px" }}>
              <input
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                placeholder="Ask about files... e.g. Which is the largest file?"
                style={{ flex: 1, padding: "8px" }}
              />
              <button className="ai-primary-btn" onClick={() => handleSendMessage()}>Send</button>
            </div>
          </div>
        )}

      </div>

      {/* FOOTER */}
      <div className="ai-footer">
        <div className="ai-footer-left">
          <span>AI File Intelligence</span>
          <span>•</span>
          <strong>{tabs.find((tab) => tab.id === activeTab)?.label}</strong>
        </div>

        <div className="ai-footer-right">
          <span className="ai-ready-dot"></span>
          <span>AI system active ({activeModel})</span>
        </div>
      </div>

    </div>
  );
}

export default AIFeatures;