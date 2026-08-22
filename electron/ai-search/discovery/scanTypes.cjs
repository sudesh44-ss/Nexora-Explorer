"use strict";

/**
 * Hash Calculation Strategies
 */
const HashStrategy = Object.freeze({
  NONE: "none",                 // Do not compute hash during discovery
  FAST_SAMPLE: "fast_sample",   // Fast header + middle + tail sampling for huge files
  FULL_STREAM: "full_stream",   // Full streaming SHA-256 (default for standard files)
});

/**
 * Scan Status States
 */
const ScanStatus = Object.freeze({
  IDLE: "idle",
  SCANNING: "scanning",
  PAUSED: "paused",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  FAILED: "failed",
});

/**
 * Default Scan Configuration Options
 */
function getDefaultScanOptions() {
  return {
    locations: [],
    recursive: true,
    maxDepth: Infinity,
    includeHidden: false,
    includeSystem: false,
    followSymlinks: false,
    maxConcurrency: 16,
    hashStrategy: HashStrategy.FULL_STREAM,
    maxHashFileSizeMb: 100,      // Files larger than this use FAST_SAMPLE if FULL_STREAM is enabled
    excludedPatterns: [
      "**/node_modules/**",
      "**/.git/**",
      "**/AppData/**",
      "**/Temp/**",
      "**/$Recycle.Bin/**",
      "**/System Volume Information/**",
    ],
  };
}

/**
 * Factory for FileRecord structure
 */
function createFileRecord(data = {}) {
  return {
    file_id: data.file_id || "",
    name: data.name || "",
    path: data.path || "",
    extension: data.extension || "",
    size: typeof data.size === "number" ? data.size : 0,
    created_at: data.created_at || new Date().toISOString(),
    modified_at: data.modified_at || new Date().toISOString(),
    hash: data.hash || null,
    mime_type: data.mime_type || null,
    is_hidden: Boolean(data.is_hidden),
    is_system: Boolean(data.is_system),
    is_symlink: Boolean(data.is_symlink),
  };
}

/**
 * Factory for FolderRecord structure
 */
function createFolderRecord(data = {}) {
  return {
    name: data.name || "",
    path: data.path || "",
    parent_path: data.parent_path || "",
    created_at: data.created_at || new Date().toISOString(),
    modified_at: data.modified_at || new Date().toISOString(),
    is_hidden: Boolean(data.is_hidden),
    is_system: Boolean(data.is_system),
    is_symlink: Boolean(data.is_symlink),
  };
}

module.exports = {
  HashStrategy,
  ScanStatus,
  getDefaultScanOptions,
  createFileRecord,
  createFolderRecord,
};
