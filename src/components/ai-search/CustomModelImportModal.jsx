import { useState } from "react";
import "./CustomModelImportModal.css";

export default function CustomModelImportModal({ isOpen, onClose, onImportSuccess }) {
  const [sourcePath, setSourcePath] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [selectedTask, setSelectedTask] = useState("TEXT_EMBEDDING");
  const [customName, setCustomName] = useState("");
  const [customDims, setCustomDims] = useState(384);
  const [importing, setImporting] = useState(false);
  const [importCompleted, setImportCompleted] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleBrowseFolder = async () => {
    try {
      if (window.electronFeatures?.chooseFolder) {
        const folder = await window.electronFeatures.chooseFolder();
        if (folder && folder.path) {
          setSourcePath(folder.path);
          validateModel(folder.path);
        }
      }
    } catch (err) {
      setErrorMessage(`Folder selection error: ${err.message}`);
    }
  };

  const validateModel = async (pathToCheck) => {
    const p = pathToCheck || sourcePath;
    if (!p.trim()) return;

    setValidating(true);
    setValidationResult(null);
    setErrorMessage("");
    setImportCompleted(null);

    try {
      if (window.electronFeatures?.aiValidateCustomModel) {
        const res = await window.electronFeatures.aiValidateCustomModel(p);
        setValidationResult(res);
        if (res.valid && res.compatible) {
          setSelectedTask(res.task || "TEXT_EMBEDDING");
          setCustomName(res.name || "");
          setCustomDims(res.dimensions || 384);
        }
      }
    } catch (err) {
      setErrorMessage(`Validation failed: ${err.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!validationResult || !validationResult.compatible) return;

    setImporting(true);
    setErrorMessage("");

    try {
      if (window.electronFeatures?.aiImportCustomModel) {
        const res = await window.electronFeatures.aiImportCustomModel(validationResult, {
          name: customName || validationResult.name,
          task: selectedTask,
          dimensions: parseInt(customDims, 10) || 384,
        });

        if (res?.success) {
          setImportCompleted(res.model);
          if (onImportSuccess) onImportSuccess(res.model);
        } else {
          setErrorMessage(res?.error || "Import failed");
        }
      }
    } catch (err) {
      setErrorMessage(`Import execution error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleActivateImported = async () => {
    if (!importCompleted) return;
    try {
      if (window.electronFeatures?.aiSetActiveModel) {
        const taskType = importCompleted.task === "IMAGE_UNDERSTANDING" ? "vision" : (importCompleted.task === "AUDIO_TRANSCRIPTION" ? "audio" : "embedding");
        await window.electronFeatures.aiSetActiveModel(taskType, importCompleted.id);
      }
    } catch (err) {
      console.warn("Model activation error:", err);
    }
    onClose();
  };

  return (
    <div className="ai-import-modal-backdrop" onClick={onClose}>
      <div className="ai-import-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="ai-import-header">
          <h3>
            <span>📦</span>
            <span>Import Local AI Model</span>
          </h3>
          <button className="ai-import-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {!importCompleted ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12.5px", color: "#94a3b8" }}>Model Source Directory or ONNX File:</label>
              <div className="ai-import-source-box">
                <input
                  type="text"
                  placeholder="C:\Models\my-custom-model"
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  onBlur={() => validateModel(sourcePath)}
                  className="ai-import-path-input"
                />
                <button className="ai-btn-browse" onClick={handleBrowseFolder}>
                  Browse...
                </button>
              </div>
            </div>

            {validating && (
              <div style={{ padding: "16px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                <span>🔍 Inspecting model architecture and format...</span>
              </div>
            )}

            {validationResult && (
              <div className="ai-import-details-card">
                <div className="ai-import-row">
                  <span className="ai-import-row-label">Model Name:</span>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      background: "#090e1a",
                      border: "1px solid #334155",
                      borderRadius: "6px",
                      color: "#fff",
                      fontSize: "12.5px",
                    }}
                  />
                </div>

                <div className="ai-import-row">
                  <span className="ai-import-row-label">Detected Format:</span>
                  <span className="ai-import-row-val">{validationResult.format || "ONNX"}</span>
                </div>

                <div className="ai-import-row">
                  <span className="ai-import-row-label">Target Task:</span>
                  <select
                    value={selectedTask}
                    onChange={(e) => setSelectedTask(e.target.value)}
                    className="ai-import-select"
                  >
                    <option value="TEXT_EMBEDDING">Text Embedding / Semantic Search</option>
                    <option value="IMAGE_UNDERSTANDING">Image Understanding / Vision</option>
                    <option value="OCR">OCR / Scanned Documents</option>
                    <option value="AUDIO_TRANSCRIPTION">Audio Transcription</option>
                  </select>
                </div>

                <div className="ai-import-row">
                  <span className="ai-import-row-label">Embedding Dimensions:</span>
                  <input
                    type="number"
                    value={customDims}
                    onChange={(e) => setCustomDims(e.target.value)}
                    style={{
                      width: "80px",
                      padding: "4px 8px",
                      background: "#090e1a",
                      border: "1px solid #334155",
                      borderRadius: "6px",
                      color: "#fff",
                      fontSize: "12.5px",
                    }}
                  />
                </div>

                <div className="ai-import-row">
                  <span className="ai-import-row-label">Target Runtime:</span>
                  <span className="ai-import-row-val">{validationResult.runtime || "Local ONNX Runtime"}</span>
                </div>

                <div
                  className={`ai-import-compat-status ${validationResult.compatible ? "compatible" : "incompatible"}`}
                >
                  <span>{validationResult.compatible ? "✓" : "⚠️"}</span>
                  <span>
                    {validationResult.compatible
                      ? "Compatible with Nexora Local Runtime"
                      : validationResult.error || "Incompatible model format"}
                  </span>
                </div>
              </div>
            )}

            {errorMessage && (
              <p style={{ margin: 0, fontSize: "12.5px", color: "#ef4444" }}>{errorMessage}</p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <button className="ai-btn-browse" onClick={onClose}>
                Cancel
              </button>
              <button
                className="ai-btn-browse"
                onClick={handleExecuteImport}
                disabled={!validationResult?.compatible || importing}
                style={{
                  background: validationResult?.compatible ? "#2563eb" : "#334155",
                  borderColor: validationResult?.compatible ? "#3b82f6" : "#475569",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {importing ? "Importing & Verifying..." : "Import Model"}
              </button>
            </div>
          </>
        ) : (
          /* Success Screen */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#4ade80" }}>
              <span style={{ fontSize: "24px" }}>✓</span>
              <strong style={{ fontSize: "16px" }}>Model Imported Successfully!</strong>
            </div>

            <div className="ai-import-details-card">
              <div className="ai-import-row">
                <span className="ai-import-row-label">Model:</span>
                <span className="ai-import-row-val">{importCompleted.name}</span>
              </div>
              <div className="ai-import-row">
                <span className="ai-import-row-label">Task:</span>
                <span className="ai-import-row-val">{importCompleted.task}</span>
              </div>
              <div className="ai-import-row">
                <span className="ai-import-row-label">Status:</span>
                <span className="ai-import-row-val" style={{ color: "#4ade80" }}>
                  Ready
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <button className="ai-btn-browse" onClick={onClose}>
                Keep as Available
              </button>
              <button
                className="ai-btn-browse"
                onClick={handleActivateImported}
                style={{ background: "#2563eb", color: "#fff", borderColor: "#3b82f6", fontWeight: 600 }}
              >
                Use This Model
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
