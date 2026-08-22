"use strict";

const path = require("path");

/**
 * Fast, Comprehensive MIME Type Registry
 */
const EXT_TO_MIME = Object.freeze({
  // Documents & Plain Text
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".rtf": "application/rtf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".log": "text/plain",

  // Code & Web
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".cjs": "text/javascript",
  ".jsx": "text/javascript",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".sql": "application/sql",
  ".py": "text/x-python",
  ".java": "text/x-java-source",
  ".c": "text/x-c",
  ".cpp": "text/x-c++",
  ".h": "text/x-c",
  ".hpp": "text/x-c++",
  ".rs": "text/x-rust",
  ".go": "text/x-go",
  ".php": "text/x-php",
  ".sh": "application/x-sh",
  ".bat": "application/x-msdos-program",
  ".cmd": "application/x-msdos-program",
  ".ps1": "text/plain",
  ".ini": "text/plain",
  ".conf": "text/plain",
  ".env": "text/plain",

  // Images
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".ico": "image/x-icon",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".raw": "image/x-raw",
  ".cr2": "image/x-canon-cr2",
  ".nef": "image/x-nikon-nef",

  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".wma": "audio/x-ms-wma",
  ".opus": "audio/opus",
  ".mid": "audio/midi",
  ".midi": "audio/midi",

  // Video
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".wmv": "video/x-ms-wmv",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".flv": "video/x-flv",
  ".3gp": "video/3gpp",
  ".ts_video": "video/mp2t",

  // Archives & Compressed
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".bz2": "application/x-bzip2",
  ".xz": "application/x-xz",
  ".iso": "application/x-iso9660-image",
  ".dmg": "application/x-apple-diskimage",

  // Fonts & Data
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".db": "application/x-sqlite3",
  ".sqlite": "application/x-sqlite3",
  ".sqlite3": "application/x-sqlite3",
});

/**
 * Detect MIME Type safely without guessing
 * @param {string} filePathOrExt
 * @returns {string|null} Detected MIME type or null if unrecognized
 */
function detectMimeType(filePathOrExt) {
  if (!filePathOrExt || typeof filePathOrExt !== "string") {
    return null;
  }

  let ext = filePathOrExt.trim().toLowerCase();
  if (!ext.startsWith(".")) {
    ext = path.extname(ext).toLowerCase();
  }

  return EXT_TO_MIME[ext] || null;
}

module.exports = {
  detectMimeType,
  EXT_TO_MIME,
};
