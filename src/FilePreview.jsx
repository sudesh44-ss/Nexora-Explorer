/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from "react";
import "./FilePreview.css";

function FilePreview({ selectedItem, onClose }) {
  const [activeType, setActiveType] = useState("image");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState("1x");
  const [currentPage, setCurrentPage] = useState(1);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Media playback & layout refs and states
  const mediaRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [imageDimensions, setImageDimensions] = useState(null);

  // Sync isPlaying state changes to actual media element
  useEffect(() => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.play().catch((err) => {
        console.error("Playback failed:", err);
        setIsPlaying(false);
      });
    } else {
      mediaRef.current.pause();
    }
  }, [isPlaying]);

  // Sync volume and muted state changes
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = volume;
      mediaRef.current.muted = isMuted;
    }
  }, [selectedItem, activeType, volume, isMuted]);

  // Reset states on item or tab type change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setImageDimensions(null);
    setPlaybackSpeed("1x");
    if (mediaRef.current) {
      mediaRef.current.currentTime = 0;
      mediaRef.current.playbackRate = 1.0;
    }
  }, [selectedItem, activeType]);

  // Reset zoom and rotation on selected item change
  useEffect(() => {
    setZoom(100);
    setRotation(0);
  }, [selectedItem]);

  // Formatting utility helpers
  const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return "—";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === Infinity || secs === null) return "00:00";
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Media control click handlers
  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newPercentage = clickX / width;
    if (mediaRef.current && duration) {
      const newTime = newPercentage * duration;
      mediaRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newVolume = Math.max(0, Math.min(1, clickX / width));
    setVolume(newVolume);
    setIsMuted(false);
    if (mediaRef.current) {
      mediaRef.current.volume = newVolume;
      mediaRef.current.muted = false;
    }
  };

  const toggleFullScreen = () => {
    if (mediaRef.current) {
      if (mediaRef.current.requestFullscreen) {
        mediaRef.current.requestFullscreen();
      } else if (mediaRef.current.webkitRequestFullscreen) {
        mediaRef.current.webkitRequestFullscreen();
      } else if (mediaRef.current.msRequestFullscreen) {
        mediaRef.current.msRequestFullscreen();
      }
    }
  };

  useEffect(() => {
    if (!selectedItem) {
      setPreviewData(null);
      setError("");
      return;
    }

    const ext = selectedItem.name.split(".").pop().toLowerCase();
    const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "bmp"].includes(ext);
    const isVideo = ["mp4", "mkv", "avi", "mov", "webm", "m4v"].includes(ext);
    const isAudio = ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"].includes(ext);
    const isDoc = ["txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "json", "md", "js", "jsx", "ts", "tsx", "css", "py", "java", "c", "cpp"].includes(ext);

    if (isImage) setActiveType("image");
    else if (isVideo) setActiveType("video");
    else if (isAudio) setActiveType("audio");
    else if (isDoc) setActiveType("document");

    setLoading(true);
    setError("");
    setPreviewData(null);

    window.fileExplorer
      .getPreview(selectedItem.path)
      .then((res) => {
        if (res && res.success) {
          setPreviewData(res);
        } else {
          setError(res?.error || "Preview not available for this file.");
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load preview.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedItem]);
  const previewTypes = [
    {
      id: "image",
      label: "Image",
      icon: "▧",
    },
    {
      id: "video",
      label: "Video",
      icon: "▶",
    },
    {
      id: "audio",
      label: "Audio",
      icon: "♫",
    },
    {
      id: "document",
      label: "Document",
      icon: "▤",
    },
  ];

  const handleZoomIn = () => {
    setZoom((value) => Math.min(value + 10, 300));
  };

  const handleZoomOut = () => {
    setZoom((value) => Math.max(value - 10, 25));
  };

  const resetZoom = () => {
    setZoom(100);
  };

  const rotateLeft = () => {
    setRotation((value) => value - 90);
  };

  const rotateRight = () => {
    setRotation((value) => value + 90);
  };

  return (
    <div className="file-preview">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="preview-header">

        <div className="preview-title-section">

          <div className="preview-main-icon">
            ◫
          </div>

          <div>
            <h2>File Preview</h2>

            <p>
              Preview images, videos, audio and documents
            </p>
          </div>

        </div>

        <button
          className="preview-close-btn"
          onClick={onClose}
        >
          ×
        </button>

      </div>


      {/* =====================================================
          PREVIEW TYPE NAVIGATION
          ===================================================== */}

      <div className="preview-type-tabs">

        {previewTypes.map((type) => (
          <button
            key={type.id}
            className={
              activeType === type.id
                ? "preview-type-tab active"
                : "preview-type-tab"
            }
            onClick={() => setActiveType(type.id)}
          >
            <span>
              {type.icon}
            </span>

            {type.label}
          </button>
        ))}

      </div>


      {/* =====================================================
          MAIN BODY
          ===================================================== */}

      <div className="preview-body">

        {/* =================================================
            LEFT PREVIEW AREA
            ================================================= */}

        <div className="preview-main-area">

          {/* IMAGE */}
          {activeType === "image" && (
            <>

              <div className="preview-toolbar">

                <div className="toolbar-group">

                  <button
                    onClick={handleZoomOut}
                    title="Zoom out"
                  >
                    −
                  </button>

                  <span className="zoom-value">
                    {zoom}%
                  </span>

                  <button
                    onClick={handleZoomIn}
                    title="Zoom in"
                  >
                    +
                  </button>

                  <button
                    onClick={resetZoom}
                    title="Actual size"
                  >
                    1:1
                  </button>

                  <button
                    onClick={resetZoom}
                    title="Fit to screen"
                  >
                    ⛶
                  </button>

                </div>


                <div className="toolbar-group">

                  <button
                    onClick={rotateLeft}
                    title="Rotate left"
                  >
                    ↶
                  </button>

                  <button
                    onClick={rotateRight}
                    title="Rotate right"
                  >
                    ↷
                  </button>

                  <button
                    title="Full screen"
                  >
                    ⛶
                  </button>

                </div>

              </div>


              <div className="image-preview-area" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", width: "100%", overflow: "hidden" }}>
                {loading && <div style={{ color: "#666" }}>Loading image preview...</div>}
                {error && <div style={{ color: "#ff4343" }}>⚠️ {error}</div>}
                {!loading && !error && selectedItem && (
                  <img
                    src={`local-media://preview?path=${encodeURIComponent(selectedItem.path)}`}
                    alt={selectedItem?.name}
                    onLoad={(e) => {
                      setImageDimensions({
                        width: e.target.naturalWidth,
                        height: e.target.naturalHeight
                      });
                    }}
                    style={{
                      transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      transition: "transform 0.2s"
                    }}
                  />
                )}
                {!selectedItem && <div style={{ color: "#888" }}>No image selected to preview</div>}
              </div>


              <div className="preview-navigation">

                <button disabled>
                  ← Previous
                </button>

                <span>
                  {selectedItem ? "1 / 1" : "0 / 0"}
                </span>

                <button disabled>
                  Next →
                </button>

              </div>

            </>
          )}


          {/* VIDEO */}
          {activeType === "video" && (
            <>

              <div className="preview-toolbar">

                <div className="toolbar-group">

                  <button
                    onClick={() =>
                      setIsPlaying(!isPlaying)
                    }
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? "❚❚" : "▶"}
                  </button>

                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      if (mediaRef.current) mediaRef.current.currentTime = 0;
                    }}
                    title="Stop"
                  >
                    ■
                  </button>

                </div>


                <div className="toolbar-group">

                  <button
                    onClick={() =>
                      setIsMuted(!isMuted)
                    }
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? "🔇" : "🔊"}
                  </button>

                  <select
                    value={playbackSpeed}
                    onChange={(e) => {
                      const speedStr = e.target.value;
                      setPlaybackSpeed(speedStr);
                      const speedVal = parseFloat(speedStr.replace("x", ""));
                      if (mediaRef.current) mediaRef.current.playbackRate = speedVal;
                    }}
                  >
                    <option value="0.5x">0.5x</option>
                    <option value="1x">1x</option>
                    <option value="1.25x">1.25x</option>
                    <option value="1.5x">1.5x</option>
                    <option value="2x">2x</option>
                  </select>

                  <button onClick={toggleFullScreen} title="Fullscreen">
                    ⛶
                  </button>

                </div>

              </div>


              <div className="video-preview-area" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", width: "100%", overflow: "hidden", backgroundColor: "#000" }}>
                {loading && <div style={{ color: "#666" }}>Loading video preview...</div>}
                {error && <div style={{ color: "#ff4343" }}>⚠️ {error}</div>}
                {!loading && !error && selectedItem && (
                  <video
                    ref={mediaRef}
                    src={`local-media://preview?path=${encodeURIComponent(selectedItem.path)}`}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                    onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.target.duration)}
                    onEnded={() => setIsPlaying(false)}
                    onClick={() => setIsPlaying(!isPlaying)}
                  />
                )}
                {!selectedItem && (
                  <div className="video-placeholder">
                    <div className="video-play-icon">▶</div>
                    <strong>No Video Selected</strong>
                    <span>MP4, MKV, AVI, MOV, WebM</span>
                  </div>
                )}
              </div>


              <div className="video-progress">

                <div className="progress-track" onClick={handleProgressClick}>
                  <div className="progress-value" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}></div>
                </div>

                <div className="video-time">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>

              </div>

            </>
          )}


          {/* AUDIO */}
          {activeType === "audio" && (
            <>
              {selectedItem && (
                <audio
                  ref={mediaRef}
                  src={`local-media://preview?path=${encodeURIComponent(selectedItem.path)}`}
                  onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                  onLoadedMetadata={(e) => setDuration(e.target.duration)}
                  onEnded={() => setIsPlaying(false)}
                />
              )}

              <div className="audio-preview-area">

                <div className="audio-cover">
                  ♫
                </div>

                <div className="audio-title">
                  {selectedItem?.name || "No Audio Selected"}
                </div>

                <div className="audio-format">
                  {selectedItem ? selectedItem.name.split(".").pop().toUpperCase() : "MP3, WAV, FLAC, AAC, OGG, M4A"}
                </div>


                <div className="audio-progress">

                  <div className="progress-track" onClick={handleProgressClick}>
                    <div className="progress-value" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}></div>
                  </div>

                  <div className="audio-time">
                    <span>
                      {formatTime(currentTime)}
                    </span>

                    <span>
                      {formatTime(duration)}
                    </span>
                  </div>

                </div>


                <div className="audio-controls">

                  <button onClick={() => { if (mediaRef.current) mediaRef.current.currentTime = 0; }} title="Restart">
                    ⏮
                  </button>

                  <button
                    className="audio-play-btn"
                    onClick={() =>
                      setIsPlaying(!isPlaying)
                    }
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? "❚❚" : "▶"}
                  </button>

                  <button onClick={() => { if (mediaRef.current) mediaRef.current.currentTime = duration; }} title="End">
                    ⏭
                  </button>

                </div>


                <div className="audio-volume">

                  <button
                    onClick={() =>
                      setIsMuted(!isMuted)
                    }
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? "🔇" : "🔊"}
                  </button>

                  <div className="volume-track" onClick={handleVolumeClick}>
                    <div className="volume-value" style={{ width: `${isMuted ? 0 : volume * 100}%` }}></div>
                  </div>

                </div>

              </div>

            </>
          )}


          {/* DOCUMENT */}
          {activeType === "document" && (
            <>

              <div className="document-toolbar">

                <div className="toolbar-group">

                  <button onClick={() => setZoom((z) => Math.max(25, z - 10))} title="Zoom out">
                    −
                  </button>

                  <span>
                    {zoom}%
                  </span>

                  <button onClick={() => setZoom((z) => Math.min(300, z + 10))} title="Zoom in">
                    +
                  </button>

                  <button onClick={() => setZoom(100)} title="Reset zoom">
                    ⛶
                  </button>

                </div>


                <div className="document-page-control">

                  <button
                    onClick={() =>
                      setCurrentPage(
                        Math.max(currentPage - 1, 1)
                      )
                    }
                    disabled={previewData?.type !== "pdf"}
                  >
                    ←
                  </button>

                  <span>
                    Page {currentPage} / {previewData?.type === "pdf" ? "—" : "1"}
                  </span>

                  <button
                    onClick={() =>
                      setCurrentPage(
                        currentPage + 1
                      )
                    }
                    disabled={previewData?.type !== "pdf"}
                  >
                    →
                  </button>

                </div>


                <button onClick={() => window.fileExplorer.openItem(selectedItem.path)}>
                  Open externally
                </button>

              </div>


              <div className="document-preview-area" style={{ width: "100%", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {loading && <div style={{ color: "#666", padding: "20px", textAlign: "center" }}>Loading document preview...</div>}
                {error && <div style={{ color: "#ff4343", padding: "20px", textAlign: "center" }}>⚠️ {error}</div>}
                {!loading && !error && selectedItem && previewData && (
                  previewData.type === "text" ? (
                    <pre style={{
                      fontSize: `${zoom * 0.14}rem`,
                      width: "100%",
                      height: "100%",
                      overflow: "auto",
                      textAlign: "left",
                      margin: 0,
                      padding: "15px",
                      backgroundColor: "#1e1e1e",
                      color: "#d4d4d4",
                      fontFamily: "Consolas, 'Courier New', monospace",
                      whiteSpace: "pre-wrap",
                      boxSizing: "border-box"
                    }}>
                      {previewData.preview}
                    </pre>
                  ) : previewData.type === "pdf" ? (
                    <iframe
                      src={`local-media://preview?path=${encodeURIComponent(selectedItem.path)}`}
                      style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#fff" }}
                      title="PDF Preview"
                    />
                  ) : (
                    <div className="document-placeholder">
                      <div className="document-icon">▤</div>
                      <strong>{selectedItem?.name}</strong>
                      <span>Preview not supported directly. You can open this file in the default application.</span>
                      <button onClick={() => window.fileExplorer.openItem(selectedItem.path)}>
                        Open Externally
                      </button>
                    </div>
                  )
                )}
                {!selectedItem && (
                  <div className="document-placeholder">
                    <div className="document-icon">▤</div>
                    <strong>No Document Selected</strong>
                    <span>TXT, JSON, CSV, XML, HTML, Markdown, JS, JSX, CSS, TS, TSX, Python, Java, C/C++, PDF, DOCX, XLSX, PPTX</span>
                  </div>
                )}
              </div>

            </>
          )}

        </div>


        {/* =================================================
            INFORMATION PANEL
            ================================================= */}

        <aside className="preview-info-panel">

          <div className="preview-info-header">
            File Information
          </div>


          {/* Basic Information */}

          <div className="info-section">

            <div className="info-section-title">
              General
            </div>

            <div className="info-row">
              <span>Name</span>
              <strong>{selectedItem?.name || "—"}</strong>
            </div>

            <div className="info-row">
              <span>Type</span>
              <strong>{selectedItem?.isDirectory ? "Folder" : (selectedItem?.name.split(".").pop().toUpperCase() + " File")}</strong>
            </div>

            <div className="info-row">
              <span>Size</span>
              <strong>{formatSize(selectedItem?.size)}</strong>
            </div>

            <div className="info-row">
              <span>Location</span>
              <strong style={{ wordBreak: "break-all" }}>{selectedItem?.path || "—"}</strong>
            </div>

            <div className="info-row">
              <span>Created</span>
              <strong>{formatDate(previewData?.created)}</strong>
            </div>

            <div className="info-row">
              <span>Modified</span>
              <strong>{formatDate(selectedItem?.modified || previewData?.modified)}</strong>
            </div>

          </div>


          {/* Image Information */}

          {activeType === "image" && (
            <div className="info-section">

              <div className="info-section-title">
                Image Information
              </div>

              <div className="info-row">
                <span>Resolution</span>
                <strong>{imageDimensions ? `${imageDimensions.width} x ${imageDimensions.height}` : "—"}</strong>
              </div>

              <div className="info-row">
                <span>Dimensions</span>
                <strong>{imageDimensions ? `${imageDimensions.width}px x ${imageDimensions.height}px` : "—"}</strong>
              </div>

              <div className="info-row">
                <span>Format</span>
                <strong>{selectedItem?.name.split(".").pop().toUpperCase() || "—"}</strong>
              </div>

            </div>
          )}


          {/* Video Information */}

          {activeType === "video" && (
            <div className="info-section">

              <div className="info-section-title">
                Video Information
              </div>

              <div className="info-row">
                <span>Duration</span>
                <strong>{formatTime(duration)}</strong>
              </div>

              <div className="info-row">
                <span>Format</span>
                <strong>{selectedItem?.name.split(".").pop().toUpperCase() || "—"}</strong>
              </div>

            </div>
          )}


          {/* Audio Information */}

          {activeType === "audio" && (
            <div className="info-section">

              <div className="info-section-title">
                Audio Information
              </div>

              <div className="info-row">
                <span>Title</span>
                <strong>{selectedItem?.name || "—"}</strong>
              </div>

              <div className="info-row">
                <span>Duration</span>
                <strong>{formatTime(duration)}</strong>
              </div>

              <div className="info-row">
                <span>Format</span>
                <strong>{selectedItem?.name.split(".").pop().toUpperCase() || "—"}</strong>
              </div>

            </div>
          )}


          {/* Document Information */}

          {activeType === "document" && (
            <div className="info-section">

              <div className="info-section-title">
                Document Information
              </div>

              <div className="info-row">
                <span>Format</span>
                <strong>{selectedItem?.name.split(".").pop().toUpperCase() || "—"}</strong>
              </div>

            </div>
          )}


          {/* Metadata */}

          <div className="info-section">

            <div className="info-section-title">
              Metadata
            </div>

            <div className="metadata-empty">
              {selectedItem ? `Previewing ${selectedItem.name}` : "Metadata will appear when a file is selected."}
            </div>

          </div>

        </aside>

      </div>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <div className="preview-footer">

        <div className="preview-footer-left">

          <span>
            Preview
          </span>

          <span>
            •
          </span>

          <strong>
            {previewTypes.find(
              (item) => item.id === activeType
            )?.label}
          </strong>

        </div>


        <div className="preview-footer-right">

          <span className="preview-ready-dot"></span>

          <span>
            Preview system ready
          </span>

        </div>

      </div>

    </div>
  );
}

export default FilePreview;
