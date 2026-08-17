/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
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
                {!loading && !error && previewData && previewData.type === "image" && (
                  <img
                    src={previewData.data}
                    alt={selectedItem?.name}
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

                <button>
                  ← Previous
                </button>

                <span>
                  0 / 0
                </span>

                <button>
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
                  >
                    {isPlaying ? "❚❚" : "▶"}
                  </button>

                  <button
                    onClick={() =>
                      setIsPlaying(false)
                    }
                  >
                    ■
                  </button>

                </div>


                <div className="toolbar-group">

                  <button
                    onClick={() =>
                      setIsMuted(!isMuted)
                    }
                  >
                    {isMuted ? "🔇" : "🔊"}
                  </button>

                  <select
                    value={playbackSpeed}
                    onChange={(e) =>
                      setPlaybackSpeed(e.target.value)
                    }
                  >
                    <option value="0.5x">0.5x</option>
                    <option value="1x">1x</option>
                    <option value="1.25x">1.25x</option>
                    <option value="1.5x">1.5x</option>
                    <option value="2x">2x</option>
                  </select>

                  <button>
                    ⛶
                  </button>

                </div>

              </div>


              <div className="video-preview-area">

                <div className="video-placeholder">

                  <div className="video-play-icon">
                    {isPlaying ? "❚❚" : "▶"}
                  </div>

                  <strong>
                    No Video Selected
                  </strong>

                  <span>
                    MP4, MKV, AVI, MOV, WebM
                  </span>

                </div>

              </div>


              <div className="video-progress">

                <div className="progress-track">
                  <div className="progress-value"></div>
                </div>

                <div className="video-time">
                  00:00 / 00:00
                </div>

              </div>

            </>
          )}


          {/* AUDIO */}
          {activeType === "audio" && (
            <>

              <div className="audio-preview-area">

                <div className="audio-cover">
                  ♫
                </div>

                <div className="audio-title">
                  No Audio Selected
                </div>

                <div className="audio-format">
                  MP3, WAV, FLAC, AAC, OGG, M4A
                </div>


                <div className="audio-progress">

                  <div className="progress-track">
                    <div className="progress-value"></div>
                  </div>

                  <div className="audio-time">
                    <span>
                      00:00
                    </span>

                    <span>
                      00:00
                    </span>
                  </div>

                </div>


                <div className="audio-controls">

                  <button>
                    ⏮
                  </button>

                  <button
                    className="audio-play-btn"
                    onClick={() =>
                      setIsPlaying(!isPlaying)
                    }
                  >
                    {isPlaying ? "❚❚" : "▶"}
                  </button>

                  <button>
                    ⏭
                  </button>

                </div>


                <div className="audio-volume">

                  <button
                    onClick={() =>
                      setIsMuted(!isMuted)
                    }
                  >
                    {isMuted ? "🔇" : "🔊"}
                  </button>

                  <div className="volume-track">
                    <div className="volume-value"></div>
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

                  <button>
                    −
                  </button>

                  <span>
                    100%
                  </span>

                  <button>
                    +
                  </button>

                  <button>
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
                  >
                    ←
                  </button>

                  <span>
                    Page {currentPage} / 0
                  </span>

                  <button
                    onClick={() =>
                      setCurrentPage(
                        currentPage + 1
                      )
                    }
                  >
                    →
                  </button>

                </div>


                <button>
                  Open externally
                </button>

              </div>


              <div className="document-preview-area">

                <div className="document-placeholder">

                  <div className="document-icon">
                    ▤
                  </div>

                  <strong>
                    No Document Selected
                  </strong>

                  <span>
                    TXT, JSON, CSV, XML, HTML, Markdown,
                    JS, JSX, CSS, TS, TSX, Python, Java,
                    C/C++, PDF, DOCX, XLSX, PPTX
                  </span>

                  <button>
                    Open File
                  </button>

                </div>

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
              <strong>—</strong>
            </div>

            <div className="info-row">
              <span>Type</span>
              <strong>—</strong>
            </div>

            <div className="info-row">
              <span>Size</span>
              <strong>—</strong>
            </div>

            <div className="info-row">
              <span>Location</span>
              <strong>—</strong>
            </div>

            <div className="info-row">
              <span>Created</span>
              <strong>—</strong>
            </div>

            <div className="info-row">
              <span>Modified</span>
              <strong>—</strong>
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
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Dimensions</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Format</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Color</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Camera</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Date Taken</span>
                <strong>—</strong>
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
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Resolution</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>FPS</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Codec</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Bitrate</span>
                <strong>—</strong>
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
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Artist</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Album</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Genre</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Year</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Bitrate</span>
                <strong>—</strong>
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
                <span>Pages</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Author</span>
                <strong>—</strong>
              </div>

              <div className="info-row">
                <span>Format</span>
                <strong>—</strong>
              </div>

            </div>
          )}


          {/* Metadata */}

          <div className="info-section">

            <div className="info-section-title">
              Metadata
            </div>

            <div className="metadata-empty">
              Metadata will appear when a file
              is selected.
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
