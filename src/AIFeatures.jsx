import { useState } from "react";
import "./AIFeatures.css";

function AIFeatures({ currentPath, items, onClose }) {
  const [activeTab, setActiveTab] = useState("categorization");
  const [searchQuery, setSearchQuery] = useState("");
  const [assistantInput, setAssistantInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: "assistant", text: "Hello! I am your AI File Assistant. I can analyze files in the current folder, categorize them, or answer questions. How can I help you today?" }
  ]);

  const handleSendMessage = (customText = "") => {
    const textToSend = customText || assistantInput;
    if (!textToSend.trim()) return;
    
    setChatMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    if (!customText) setAssistantInput("");

    // Simulated response
    setTimeout(() => {
      let reply = "";
      const lower = textToSend.toLowerCase();
      if (lower.includes("file") || lower.includes("folder") || lower.includes("directory") || lower.includes("what is here")) {
        const fileList = items && items.length > 0
          ? items.slice(0, 5).map(it => (it.isDirectory ? "📁 " : "📄 ") + it.name).join(", ")
          : "no files";
        reply = `In the current folder, I detected ${items ? items.length : 0} items. Here are the first few: ${fileList}. Let me know if you want me to search or rename them!`;
      } else if (lower.includes("large") || lower.includes("biggest") || lower.includes("size")) {
        const filesOnly = items ? items.filter(it => !it.isDirectory) : [];
        if (filesOnly.length > 0) {
          const largest = [...filesOnly].sort((a, b) => b.size - a.size)[0];
          reply = `The largest file in this folder is "${largest.name}" with a size of ${(largest.size / (1024 * 1024)).toFixed(2)} MB.`;
        } else {
          reply = "There are no files in this folder (only subfolders or empty).";
        }
      } else if (lower.includes("clear") || lower.includes("reset")) {
        setChatMessages([{ sender: "assistant", text: "Chat history reset. How can I help you organize your files?" }]);
        return;
      } else {
        reply = "I've scanned the directory path and indexed all file attributes. I can help you search, locate duplicates, categorize documents, or batch rename files. What would you like to do?";
      }
      setChatMessages((prev) => [...prev, { sender: "assistant", text: reply }]);
    }, 800);
  };

  const tabs = [
    {
      id: "categorization",
      label: "Categorization",
      icon: "▦",
    },
    {
      id: "tagging",
      label: "Smart Tags",
      icon: "#",
    },
    {
      id: "vision",
      label: "Image Understanding",
      icon: "◉",
    },
    {
      id: "documents",
      label: "Document AI",
      icon: "▤",
    },
    {
      id: "search",
      label: "Semantic Search",
      icon: "⌕",
    },
    {
      id: "assistant",
      label: "AI Assistant",
      icon: "✦",
    },
  ];

  const categories = [
    "All",
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

  const startAnalysis = () => {
    setIsAnalyzing(true);
    console.log("AI analysis will be connected later");
  };

  return (
    <div className="ai-features">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="ai-header">

        <div className="ai-title-section">

          <div className="ai-main-icon">
            ✦
          </div>

          <div>
            <h2>
              AI File Intelligence
            </h2>

            <p>
              Understand, organize and search your files
              using AI in {currentPath}
            </p>
          </div>

        </div>


        <div className="ai-status">

          <span className="ai-status-dot"></span>

          <span>
            AI Engine
          </span>

          <strong>
            Ready
          </strong>

        </div>


        <button
          className="ai-close-btn"
          onClick={onClose}
        >
          ×
        </button>

      </div>


      {/* =====================================================
          NAVIGATION
          ===================================================== */}

      <div className="ai-navigation">

        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={
              activeTab === tab.id
                ? "ai-nav-item active"
                : "ai-nav-item"
            }
            onClick={() => setActiveTab(tab.id)}
          >

            <span className="ai-nav-icon">
              {tab.icon}
            </span>

            {tab.label}

          </button>
        ))}

      </div>


      {/* =====================================================
          BODY
          ===================================================== */}

      <div className="ai-body">


        {/* =================================================
            A. CATEGORIZATION
            ================================================= */}

        {activeTab === "categorization" && (
          <div className="ai-page">

            <div className="ai-page-header">

              <div>
                <h3>
                  AI File Categorization
                </h3>

                <p>
                  Automatically understand and organize files
                  into meaningful categories.
                </p>
              </div>

              <button
                className="ai-primary-btn"
                onClick={startAnalysis}
              >
                {isAnalyzing
                  ? "Analyzing..."
                  : "Analyze Files"}
              </button>

            </div>


            {/* Category Cards */}

            <div className="ai-category-grid">

              {categories.slice(1).map((category) => (
                <button
                  key={category}
                  className={
                    selectedCategory === category
                      ? "ai-category-card selected"
                      : "ai-category-card"
                  }
                  onClick={() =>
                    setSelectedCategory(category)
                  }
                >

                  <div className="ai-category-icon">
                    {category === "Photos" && "▧"}
                    {category === "Videos" && "▶"}
                    {category === "Music" && "♫"}
                    {category === "Documents" && "▤"}
                    {category === "Bills" && "₹"}
                    {category === "Invoices" && "▥"}
                    {category === "Receipts" && "▤"}
                    {category === "Screenshots" && "▣"}
                    {category === "IDs / Documents" && "▤"}
                    {category === "Projects" && "⌘"}
                    {category === "Code" && "</>"}
                    {category === "Personal" && "●"}
                    {category === "Work" && "◆"}
                  </div>

                  <div className="ai-category-name">
                    {category}
                  </div>

                  <div className="ai-category-count">
                    0 files
                  </div>

                </button>
              ))}

            </div>


            {/* Analysis Status */}

            <div className="ai-analysis-card">

              <div className="ai-analysis-header">

                <div>

                  <strong>
                    AI Analysis
                  </strong>

                  <p>
                    File categorization status
                  </p>

                </div>

                <span className="ai-analysis-status">
                  {isAnalyzing
                    ? "Processing"
                    : "Ready"}
                </span>

              </div>


              <div className="ai-progress-track">

                <div
                  className="ai-progress-value"
                  style={{
                    width: isAnalyzing
                      ? "15%"
                      : "0%",
                  }}
                />

              </div>


              <div className="ai-analysis-footer">

                <span>
                  Files analyzed
                </span>

                <strong>
                  0 / 0
                </strong>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            B. SMART TAGGING
            ================================================= */}

        {activeTab === "tagging" && (
          <div className="ai-page">

            <div className="ai-page-header">

              <div>
                <h3>
                  Automatic Tagging
                </h3>

                <p>
                  Generate and manage intelligent tags for
                  your files.
                </p>
              </div>

              <button className="ai-primary-btn">
                Generate Tags
              </button>

            </div>


            <div className="ai-tag-layout">

              {/* File Preview */}

              <div className="ai-file-preview-card">

                <div className="ai-file-preview-placeholder">
                  ▧
                </div>

                <strong>
                  {selectedFile || "No file selected"}
                </strong>

                <span>
                  Select a file to analyze
                </span>

                <button
                  className="ai-secondary-btn"
                  onClick={() =>
                    setSelectedFile("IMG_20260125.jpg")
                  }
                >
                  Select File
                </button>

              </div>


              {/* Tags */}

              <div className="ai-tags-panel">

                <div className="ai-panel-header">

                  <div>
                    <strong>
                      AI Generated Tags
                    </strong>

                    <p>
                      Tags detected from file content
                    </p>
                  </div>

                  <button className="ai-secondary-btn">
                    Refresh
                  </button>

                </div>


                <div className="ai-tag-list">

                  <span>#mountain</span>
                  <span>#car</span>
                  <span>#travel</span>
                  <span>#outdoor</span>
                  <span>#road</span>

                </div>


                <div className="ai-custom-tag">

                  <input
                    placeholder="Add custom tag..."
                  />

                  <button className="ai-secondary-btn">
                    Add
                  </button>

                </div>


                <div className="ai-tag-suggestions">

                  <div className="ai-section-title">
                    Suggested Tags
                  </div>

                  <div className="ai-suggestion-list">

                    <button>
                      #vehicle
                    </button>

                    <button>
                      #nature
                    </button>

                    <button>
                      #landscape
                    </button>

                    <button>
                      #roadtrip
                    </button>

                  </div>

                </div>

              </div>

            </div>


            {/* Tag Management */}

            <div className="ai-management-card">

              <div className="ai-section-title">
                Tag Management
              </div>

              <div className="ai-management-grid">

                <div>
                  <span>
                    Total Tags
                  </span>

                  <strong>
                    0
                  </strong>
                </div>

                <div>
                  <span>
                    AI Generated
                  </span>

                  <strong>
                    0
                  </strong>
                </div>

                <div>
                  <span>
                    Custom Tags
                  </span>

                  <strong>
                    0
                  </strong>
                </div>

                <div>
                  <span>
                    Similar Tags
                  </span>

                  <strong>
                    0
                  </strong>
                </div>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            C. IMAGE UNDERSTANDING
            ================================================= */}

        {activeTab === "vision" && (
          <div className="ai-page">

            <div className="ai-page-header">

              <div>

                <h3>
                  Image Understanding
                </h3>

                <p>
                  Let AI understand objects, scenes and
                  visual content inside images.
                </p>

              </div>

              <button
                className="ai-primary-btn"
                onClick={startAnalysis}
              >
                Analyze Image
              </button>

            </div>


            <div className="ai-vision-layout">

              {/* Image */}

              <div className="ai-vision-image">

                <div className="ai-vision-placeholder">
                  ◉
                </div>

                <strong>
                  No image selected
                </strong>

                <span>
                  JPG, PNG, WebP and other supported formats
                </span>

                <button className="ai-secondary-btn">
                  Select Image
                </button>

              </div>


              {/* Analysis */}

              <div className="ai-vision-analysis">

                <div className="ai-panel-header">

                  <div>
                    <strong>
                      AI Analysis
                    </strong>

                    <p>
                      Visual information detected in image
                    </p>
                  </div>

                </div>


                <div className="ai-detection-grid">

                  <div>
                    <span>
                      Objects
                    </span>

                    <strong>
                      —
                    </strong>
                  </div>

                  <div>
                    <span>
                      Scene
                    </span>

                    <strong>
                      —
                    </strong>
                  </div>

                  <div>
                    <span>
                      Vehicles
                    </span>

                    <strong>
                      —
                    </strong>
                  </div>

                  <div>
                    <span>
                      Animals
                    </span>

                    <strong>
                      —
                    </strong>
                  </div>

                  <div>
                    <span>
                      Documents
                    </span>

                    <strong>
                      —
                    </strong>
                  </div>

                  <div>
                    <span>
                      Screenshot
                    </span>

                    <strong>
                      —
                    </strong>
                  </div>

                </div>


                <div className="ai-description-box">

                  <div className="ai-section-title">
                    Image Description
                  </div>

                  <p>
                    AI-generated image description will
                    appear here.
                  </p>

                </div>


                <div className="ai-vision-tags">

                  <div className="ai-section-title">
                    Detected Concepts
                  </div>

                  <div className="ai-tag-list">
                    <span>No concepts detected</span>
                  </div>

                </div>

              </div>

            </div>


            {/* Similarity Search */}

            <div className="ai-similarity-card">

              <div>

                <strong>
                  Visual Similarity Search
                </strong>

                <p>
                  Find visually similar images across your
                  storage.
                </p>

              </div>

              <button className="ai-secondary-btn">
                Find Similar
              </button>

            </div>

          </div>
        )}


        {/* =================================================
            D. DOCUMENT AI
            ================================================= */}

        {activeTab === "documents" && (
          <div className="ai-page">

            <div className="ai-page-header">

              <div>

                <h3>
                  Document Intelligence
                </h3>

                <p>
                  Automatically understand and extract useful
                  information from documents.
                </p>

              </div>

              <button className="ai-primary-btn">
                Analyze Document
              </button>

            </div>


            {/* Document Types */}

            <div className="ai-document-grid">

              {[
                "Invoice",
                "Receipt",
                "Resume",
                "Bank Statement",
                "Bill",
                "Contract",
              ].map((type) => (
                <div
                  className="ai-document-card"
                  key={type}
                >

                  <div className="ai-document-icon">
                    ▤
                  </div>

                  <strong>
                    {type}
                  </strong>

                  <span>
                    0 detected
                  </span>

                </div>
              ))}

            </div>


            {/* Extraction */}

            <div className="ai-document-analysis">

              <div className="ai-panel-header">

                <div>

                  <strong>
                    Important Information
                  </strong>

                  <p>
                    Structured information extracted by AI
                  </p>

                </div>

              </div>


              <div className="ai-extracted-grid">

                <div>
                  <span>
                    Document Type
                  </span>

                  <strong>
                    —
                  </strong>
                </div>

                <div>
                  <span>
                    Date
                  </span>

                  <strong>
                    —
                  </strong>
                </div>

                <div>
                  <span>
                    Amount
                  </span>

                  <strong>
                    —
                  </strong>
                </div>

                <div>
                  <span>
                    Organization
                  </span>

                  <strong>
                    —
                  </strong>
                </div>

                <div>
                  <span>
                    Person
                  </span>

                  <strong>
                    —
                  </strong>
                </div>

                <div>
                  <span>
                    Reference Number
                  </span>

                  <strong>
                    —
                  </strong>
                </div>

              </div>

            </div>


            {/* Summary */}

            <div className="ai-summary-card">

              <div className="ai-section-title">
                Document Summary
              </div>

              <p>
                AI-generated document summary will appear
                here after analysis.
              </p>

              <div className="ai-section-title">
                Key Points
              </div>

              <ul>
                <li>
                  No information extracted yet.
                </li>
              </ul>

            </div>

          </div>
        )}


        {/* =================================================
            E. SEMANTIC SEARCH
            ================================================= */}

        {activeTab === "search" && (
          <div className="ai-page">

            <div className="ai-page-header">

              <div>

                <h3>
                  Semantic Search
                </h3>

                <p>
                  Search files using natural language instead
                  of exact filenames.
                </p>

              </div>

            </div>


            {/* Search */}

            <div className="ai-semantic-search">

              <span>
                ✦
              </span>

              <input
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                placeholder='Try: "Meri electricity ki purani bills dhundo"'
              />

              <button className="ai-primary-btn">
                Search
              </button>

            </div>


            {/* Query Understanding */}

            <div className="ai-query-understanding">

              <div className="ai-section-title">
                AI Query Understanding
              </div>

              <div className="ai-query-chips">

                <span>
                  Category: Bills
                </span>

                <span>
                  Topic: Electricity
                </span>

                <span>
                  Time: Previous
                </span>

              </div>

            </div>


            {/* Search Sources */}

            <div className="ai-search-sources">

              <div className="ai-section-title">
                Search Sources
              </div>

              <label className="ai-checkbox">

                <input
                  type="checkbox"
                  defaultChecked
                />

                <span>
                  Filename
                </span>

              </label>

              <label className="ai-checkbox">

                <input
                  type="checkbox"
                  defaultChecked
                />

                <span>
                  File content
                </span>

              </label>

              <label className="ai-checkbox">

                <input
                  type="checkbox"
                  defaultChecked
                />

                <span>
                  OCR
                </span>

              </label>

              <label className="ai-checkbox">

                <input
                  type="checkbox"
                  defaultChecked
                />

                <span>
                  Image understanding
                </span>

              </label>

              <label className="ai-checkbox">

                <input
                  type="checkbox"
                  defaultChecked
                />

                <span>
                  Metadata
                </span>

              </label>

            </div>


            {/* Results */}

            <div className="ai-search-results">

              <div className="ai-results-header">

                <span>
                  AI Search Results
                </span>

                <strong>
                  0 results
                </strong>

              </div>


              <div className="ai-empty">

                <div>
                  ✦
                </div>

                <strong>
                  No files found
                </strong>

                <p>
                  Ask the AI to find files using natural
                  language.
                </p>

              </div>

            </div>

          </div>
        )}


        {/* =================================================
            F. AI ASSISTANT
            ================================================= */}

        {activeTab === "assistant" && (
          <div className="ai-page ai-assistant-page">

            <div className="ai-page-header">

              <div>

                <h3>
                  AI File Assistant
                </h3>

                <p>
                  Ask questions and search your files using
                  natural language.
                </p>

              </div>

              <span className="ai-safe-badge">
                🔐 Safe Mode
              </span>

            </div>


            {/* Chat Area */}

            <div className="ai-chat" style={{ flex: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "250px" }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`ai-chat-message ${msg.sender}`} style={{ display: "flex", alignSelf: msg.sender === "user" ? "flex-end" : "flex-start", gap: "10px", maxWidth: "80%" }}>
                  {msg.sender === "assistant" && (
                    <div className="ai-chat-avatar" style={{ width: "30px", height: "30px", borderRadius: "50%", backgroundColor: "#eef3fc", color: "#0078d4", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "bold" }}>
                      ✦
                    </div>
                  )}
                  <div className="ai-chat-bubble" style={{ padding: "10px 15px", borderRadius: "10px", backgroundColor: msg.sender === "user" ? "#0078d4" : "#f1f1f1", color: msg.sender === "user" ? "#fff" : "#333" }}>
                    {msg.sender === "assistant" && (
                      <strong style={{ display: "block", fontSize: "12px", color: "#0078d4", marginBottom: "5px" }}>AI Assistant</strong>
                    )}
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>


            {/* Suggested Actions */}

            <div className="ai-suggestions">

              <button onClick={() => handleSendMessage("Show files in this folder")}>
                Find recent files
              </button>

              <button onClick={() => handleSendMessage("Find the largest file")}>
                Find large files
              </button>

              <button onClick={() => handleSendMessage("Show files metadata")}>
                Find old documents
              </button>

              <button onClick={() => handleSendMessage("Find duplicate files")}>
                Find duplicate photos
              </button>

            </div>


            {/* Input */}

            <div className="ai-chat-input">

              <input
                value={assistantInput}
                onChange={(e) =>
                  setAssistantInput(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSendMessage();
                  }
                }}
                placeholder="Ask about your files..."
              />

              <button className="ai-primary-btn" onClick={() => handleSendMessage()}>
                Send
              </button>

            </div>


            {/* Security Notice */}

            <div className="ai-security-notice">

              <span>
                🔐
              </span>

              <div>

                <strong>
                  File Operation Protection
                </strong>

                <p>
                  AI can suggest file operations, but
                  destructive actions such as delete, move,
                  encryption or permission changes require
                  explicit user confirmation.
                </p>

              </div>

            </div>

          </div>
        )}

      </div>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <div className="ai-footer">

        <div className="ai-footer-left">

          <span>
            AI File Intelligence
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


        <div className="ai-footer-right">

          <span className="ai-ready-dot"></span>

          <span>
            AI system ready
          </span>

        </div>

      </div>

    </div>
  );
}

export default AIFeatures;