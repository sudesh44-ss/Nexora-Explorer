import { useState, useEffect } from "react";
import "./SearchProgress.css";

function SearchProgress({
  isSearching,
  progressData,
  isComplete,
  isCancelled,
  onCancel,
  finalStats
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [prevIsSearching, setPrevIsSearching] = useState(isSearching);

  if (isSearching !== prevIsSearching) {
    setPrevIsSearching(isSearching);
    if (isSearching) {
      setElapsedSeconds(0);
    }
  }

  useEffect(() => {
    if (isSearching) {
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSearching]);

  if (!isSearching && !isComplete && !isCancelled) {
    return null;
  }

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Get current stats
  const folders = isComplete || isCancelled ? (finalStats?.scannedFolders || 0) : (progressData?.scannedFolders || 0);
  const files = isComplete || isCancelled ? (finalStats?.scannedFiles || 0) : (progressData?.scannedFiles || 0);
  const matches = isComplete || isCancelled ? (finalStats?.resultsCount || 0) : (progressData?.resultsCount || 0);
  const currentPath = progressData?.currentPath || "";
  const pendingLength = progressData?.pendingLength || 0;

  // Calculate estimated remaining
  let estRemaining = "Estimating...";
  if (isSearching && elapsedSeconds > 2 && folders > 5) {
    const foldersPerSecond = folders / elapsedSeconds;
    if (foldersPerSecond > 0 && pendingLength > 0) {
      const remSeconds = Math.round(pendingLength / foldersPerSecond);
      estRemaining = `~${formatTime(remSeconds)}`;
    } else if (pendingLength === 0) {
      estRemaining = "~00:00";
    }
  }

  // Calculate percentage if possible
  const totalEstimatedFolders = folders + pendingLength;
  const percent = totalEstimatedFolders > 0 ? Math.round((folders / totalEstimatedFolders) * 100) : 0;

  return (
    <div className="search-progress-card">
      <div className="progress-header">
        {isSearching && (
          <div className="searching-title-row">
            <span className="spinner">⌛</span>
            <span className="status-text">Searching...</span>
          </div>
        )}
        {isComplete && (
          <div className="searching-title-row success">
            <span className="status-icon">✓</span>
            <span className="status-text">Search complete</span>
          </div>
        )}
        {isCancelled && (
          <div className="searching-title-row cancelled">
            <span className="status-icon">⚠️</span>
            <span className="status-text">Search cancelled</span>
          </div>
        )}
      </div>

      <div className="progress-bar-container">
        {isSearching ? (
          <div className="progress-bar-outer">
            <div 
              className={`progress-bar-inner ${pendingLength > 0 ? "determinate" : "indeterminate"}`} 
              style={{ width: pendingLength > 0 ? `${percent}%` : "100%" }}
            />
          </div>
        ) : (
          <div className="progress-bar-outer">
            <div className="progress-bar-inner complete" style={{ width: "100%" }} />
          </div>
        )}
        {isSearching && pendingLength > 0 && (
          <div className="progress-percent-label">{percent}%</div>
        )}
      </div>

      <div className="progress-stats-grid">
        <div className="stat-box">
          <div className="stat-label">Folders Scanned</div>
          <div className="stat-value">{folders}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Files Checked</div>
          <div className="stat-value">{files}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label font-bold">Matches Found</div>
          <div className="stat-value text-indigo">{matches}</div>
        </div>
      </div>

      {isSearching && currentPath && (
        <div className="current-path-container" title={currentPath}>
          <span className="path-label">Current:</span>
          <span className="path-value">{currentPath}</span>
        </div>
      )}

      <div className="progress-footer">
        <div className="time-stats">
          <div className="time-item">
            <span className="time-label">Elapsed:</span>
            <span className="time-value">{formatTime(isComplete || isCancelled ? (finalStats?.elapsedSeconds || 0) : elapsedSeconds)}</span>
          </div>
          {isSearching && (
            <div className="time-item">
              <span className="time-label">Remaining:</span>
              <span className="time-value">{estRemaining}</span>
            </div>
          )}
        </div>

        {isSearching && onCancel && (
          <button className="cancel-search-btn" onClick={onCancel}>
            Cancel Search
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchProgress;
