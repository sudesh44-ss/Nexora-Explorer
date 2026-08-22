import { useState, useEffect } from "react";
import "./AISearchSetupModal.css";

export default function AISearchSetupModal({
  isOpen,
  mode = "initial_setup", // 'initial_setup' | 'lazy_capability'
  lazyTask = null, // { task: 'image' | 'audio' | 'ocr', title: 'Image Search', modelName: 'CLIP Vision Model', size: '~150 MB' }
  onClose,
  onComplete,
  onDismiss,
}) {
  const [hardwareInfo, setHardwareInfo] = useState(null);
  const [recommendedPack, setRecommendedPack] = useState(null);
  const [downloadState, setDownloadState] = useState("idle"); // 'idle' | 'downloading' | 'verifying' | 'ready' | 'error'
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentModelName, setCurrentModelName] = useState("");
  const [currentModelProgress, setCurrentModelProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  // Load hardware & recommendation on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadInfo() {
      try {
        if (window.electronFeatures?.aiDetectHardware) {
          const hw = await window.electronFeatures.aiDetectHardware();
          if (isMounted && hw) setHardwareInfo(hw);
        }
        if (window.electronFeatures?.aiSelectRecommendedModels) {
          const rec = await window.electronFeatures.aiSelectRecommendedModels();
          if (isMounted && rec) setRecommendedPack(rec);
        }
      } catch (err) {
        console.warn("Failed loading setup recommendation:", err);
      }
    }
    loadInfo();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Listen to real-time download progress events
  useEffect(() => {
    if (!isOpen || downloadState !== "downloading") return;

    if (window.electronFeatures?.onAiProgress) {
      const unsubscribe = window.electronFeatures.onAiProgress((data) => {
        if (data.stage === "downloading") {
          setCurrentModelName(data.modelName || "AI Model");
          setCurrentModelProgress(data.progress || 0);
          if (data.packProgress !== undefined) {
            setOverallProgress(data.packProgress);
          } else {
            setOverallProgress(data.progress || 0);
          }
        } else if (data.stage === "completed") {
          setDownloadState("verifying");
        } else if (data.stage === "error") {
          setDownloadState("error");
          setErrorMessage(data.error || "Download encountered an error");
        }
      });
      return unsubscribe;
    }
  }, [isOpen, downloadState]);

  if (!isOpen) return null;

  // Handle download trigger
  const handleStartDownload = async () => {
    setDownloadState("downloading");
    setErrorMessage("");
    setOverallProgress(0);

    try {
      if (mode === "lazy_capability" && lazyTask?.modelId) {
        const res = await window.electronFeatures.aiDownloadModel(lazyTask.modelId);
        if (res?.success) {
          setDownloadState("ready");
          setTimeout(() => {
            if (onComplete) onComplete();
            onClose();
          }, 1200);
        } else {
          setDownloadState("error");
          setErrorMessage(res?.error || "Download failed");
        }
      } else {
        const res = await window.electronFeatures.aiDownloadRecommendedPack();
        if (res?.success) {
          setDownloadState("ready");
          setTimeout(() => {
            if (onComplete) onComplete();
            onClose();
          }, 1200);
        } else {
          setDownloadState("error");
          setErrorMessage(res?.error || "Download failed");
        }
      }
    } catch (err) {
      setDownloadState("error");
      setErrorMessage(err.message || "Failed to download AI models");
    }
  };

  // Handle cancellation
  const handleCancelDownload = async () => {
    try {
      if (window.electronFeatures?.aiCancelModelDownload) {
        await window.electronFeatures.aiCancelModelDownload();
      }
    } catch (err) {
      console.warn("Cancel download error:", err);
    }
    setDownloadState("idle");
  };

  // Handle "Not Now"
  const handleNotNow = async () => {
    try {
      if (window.electronFeatures?.aiSaveSettings) {
        await window.electronFeatures.aiSaveSettings({ aiSetupDismissed: true });
      }
    } catch (err) {
      console.warn("Save settings error:", err);
    }
    if (onDismiss) onDismiss();
    onClose();
  };

  return (
    <div className="ai-setup-modal-backdrop" onClick={(e) => e.stopPropagation()}>
      <div className="ai-setup-modal-card">
        {/* =========================================================
            HEADER
            ========================================================= */}
        <div className="ai-setup-header">
          <div className="ai-setup-sparkle-badge">✦</div>
          <div className="ai-setup-title-block">
            {mode === "lazy_capability" ? (
              <>
                <h2>{lazyTask?.title || "AI Feature"} Required</h2>
                <p>Download the local neural model to enable {lazyTask?.title?.toLowerCase() || "this capability"}.</p>
              </>
            ) : (
              <>
                <h2>AI Search Setup</h2>
                <p>Nexora uses local AI models to understand your files and search them using natural language.</p>
              </>
            )}
          </div>
        </div>

        {/* =========================================================
            HARDWARE COMPATIBILITY BADGE
            ========================================================= */}
        {hardwareInfo && (
          <div className="ai-setup-hw-badge">
            <span className="ai-setup-hw-icon">💻</span>
            <span>
              Detected: <strong className="ai-setup-hw-strong">{hardwareInfo.summary}</strong>
            </span>
          </div>
        )}

        {/* =========================================================
            BODY VIEW: IDLE / CONFIRMATION
            ========================================================= */}
        {downloadState === "idle" && (
          <>
            {mode === "lazy_capability" ? (
              <div className="ai-setup-capabilities-box">
                <div className="ai-setup-cap-item">
                  <div className="ai-setup-cap-left">
                    <span className="ai-setup-check-icon">✓</span>
                    <span>{lazyTask?.modelName || "Neural Model Package"}</span>
                  </div>
                  <span className="ai-setup-cap-size">{lazyTask?.size || "~150 MB"}</span>
                </div>
              </div>
            ) : (
              <div className="ai-setup-capabilities-box">
                <div className="ai-setup-cap-title">Recommended Setup For This PC</div>
                <div className="ai-setup-cap-list">
                  <div className="ai-setup-cap-item">
                    <div className="ai-setup-cap-left">
                      <span className="ai-setup-check-icon">✓</span>
                      <span>Text &amp; Document Search</span>
                    </div>
                    <span className="ai-setup-cap-size">PDF, DOCX, TXT, Code</span>
                  </div>

                  <div className="ai-setup-cap-item">
                    <div className="ai-setup-cap-left">
                      <span className="ai-setup-check-icon">✓</span>
                      <span>Image Search</span>
                    </div>
                    <span className="ai-setup-cap-size">Scenes, Objects, Photos</span>
                  </div>

                  <div className="ai-setup-cap-item">
                    <div className="ai-setup-cap-left">
                      <span className="ai-setup-check-icon">✓</span>
                      <span>Scanned Document Search</span>
                    </div>
                    <span className="ai-setup-cap-size">Receipts, Invoices, OCR</span>
                  </div>

                  <div className="ai-setup-cap-item">
                    <div className="ai-setup-cap-left">
                      <span className="ai-setup-check-icon">✓</span>
                      <span>Audio &amp; Video Search</span>
                    </div>
                    <span className="ai-setup-cap-size">Speech Transcripts</span>
                  </div>
                </div>
              </div>
            )}

            <div className="ai-setup-stats-row">
              <span className="ai-setup-stat-label">Estimated download:</span>
              <span className="ai-setup-stat-val">
                {mode === "lazy_capability" ? (lazyTask?.size || "~150 MB") : (recommendedPack?.estimatedDownloadFormatted || "~280 MB")}
              </span>
            </div>

            <p className="ai-setup-privacy-note">
              <span>🛡️</span>
              <span>Models will be stored locally on your computer and run 100% offline.</span>
            </p>

            <div className="ai-setup-actions">
              <button className="ai-btn-setup-secondary" onClick={handleNotNow}>
                Not Now
              </button>
              <button className="ai-btn-setup-primary" onClick={handleStartDownload}>
                <span>Download &amp; Continue</span>
                <span>→</span>
              </button>
            </div>
          </>
        )}

        {/* =========================================================
            BODY VIEW: DOWNLOADING / VERIFYING / ERROR / READY
            ========================================================= */}
        {downloadState !== "idle" && (
          <div className="ai-download-progress-box">
            {downloadState === "downloading" && (
              <>
                <div className="ai-download-overall-bar-container">
                  <div className="ai-download-overall-header">
                    <span>Downloading AI Models...</span>
                    <span>{overallProgress}%</span>
                  </div>
                  <div className="ai-progress-track">
                    <div className="ai-progress-fill" style={{ width: `${overallProgress}%` }}></div>
                  </div>
                </div>

                <div className="ai-download-models-list">
                  <div className="ai-download-model-row">
                    <div className="ai-download-model-meta">
                      <span className="ai-download-model-title">{currentModelName || "Preparing Model Pack"}</span>
                      <span className="ai-download-model-status active">{currentModelProgress}%</span>
                    </div>
                  </div>
                </div>

                <div className="ai-setup-actions" style={{ justifyContent: "flex-end" }}>
                  <button className="ai-btn-setup-secondary" onClick={handleCancelDownload}>
                    Cancel
                  </button>
                </div>
              </>
            )}

            {downloadState === "verifying" && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: "28px", marginBottom: "10px" }}>⚡</div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#f8fafc" }}>Verifying Local AI Models...</h3>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
                  Running local validation and runtime test inference.
                </p>
              </div>
            )}

            {downloadState === "ready" && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: "32px", marginBottom: "10px", color: "#22c55e" }}>✓</div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#f8fafc" }}>AI Search is Ready!</h3>
                <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>
                  All neural models are installed, verified, and ready to search.
                </p>
              </div>
            )}

            {downloadState === "error" && (
              <div style={{ padding: "10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#ef4444", marginBottom: "8px" }}>
                  <span style={{ fontSize: "20px" }}>⚠️</span>
                  <strong>Download Failed</strong>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5" }}>{errorMessage}</p>

                <div className="ai-setup-actions" style={{ marginTop: "16px" }}>
                  <button className="ai-btn-setup-secondary" onClick={() => setDownloadState("idle")}>
                    Try Again
                  </button>
                  <button className="ai-btn-setup-secondary" onClick={handleNotNow}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
