"use strict";

/*
 * ============================================================
 * Preview Service
 * ============================================================
 *
 * Purpose:
 * - Files ke preview ke liye safe metadata/content provide karna
 * - Images ke liye preview data
 * - Text files ke liye readable preview
 * - PDF / audio / video / archive / binary files ko identify karna
 * - File size aur basic metadata provide karna
 *
 * IMPORTANT:
 * - Ye file actual Preview Pane UI create nahi karti.
 * - UI baad me PreviewPane.jsx me banega.
 * - Ye service sirf preview data prepare karegi.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

const MAX_TEXT_PREVIEW_SIZE = 2 * 1024 * 1024;
const MAX_IMAGE_PREVIEW_SIZE = 25 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
  ".ico",
  ".tif",
  ".tiff",
  ".avif",
  ".heic",
]);

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".json",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".htm",
  ".xml",
  ".csv",
  ".log",
  ".ini",
  ".conf",
  ".yaml",
  ".yml",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".java",
  ".py",
  ".rb",
  ".php",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".kts",
  ".sql",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
]);

const PDF_EXTENSIONS = new Set([
  ".pdf",
]);

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".flac",
  ".aac",
  ".ogg",
  ".m4a",
  ".wma",
  ".opus",
]);

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".wmv",
  ".webm",
  ".m4v",
  ".flv",
  ".mpeg",
  ".mpg",
]);

const ARCHIVE_EXTENSIONS = new Set([
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".iso",
]);

function validatePath(filePath) {
  if (typeof filePath !== "string") {
    throw new TypeError("Path must be a string.");
  }

  const cleanPath = filePath.trim();

  if (!cleanPath) {
    throw new Error("Path cannot be empty.");
  }

  return path.normalize(cleanPath);
}

async function getFileStats(filePath) {
  const cleanPath = validatePath(filePath);

  try {
    const stats = await fs.promises.stat(cleanPath);

    return {
      success: true,
      path: cleanPath,
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      accessed: stats.atime.toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      error: error.message,
    };
  }
}

function getExtension(filePath) {
  const extension = path.extname(filePath);

  return extension ? extension.toLowerCase() : "";
}

function getPreviewType(filePath, isDirectory = false) {
  if (isDirectory) {
    return "folder";
  }

  const extension = getExtension(filePath);

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return "text";
  }

  if (PDF_EXTENSIONS.has(extension)) {
    return "pdf";
  }

  if (AUDIO_EXTENSIONS.has(extension)) {
    return "audio";
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return "archive";
  }

  return "binary";
}

function getMimeType(filePath) {
  const extension = getExtension(filePath);

  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".avif": "image/avif",

    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".csv": "text/csv",
    ".xml": "application/xml",

    ".pdf": "application/pdf",

    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",

    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",

    ".zip": "application/zip",
    ".json": "application/json",
  };

  return mimeTypes[extension] || "application/octet-stream";
}

async function readTextPreview(filePath) {
  const cleanPath = validatePath(filePath);

  try {
    const stats = await fs.promises.stat(cleanPath);

    if (!stats.isFile()) {
      return {
        success: false,
        error: "Preview target is not a file.",
      };
    }

    if (stats.size > MAX_TEXT_PREVIEW_SIZE) {
      return {
        success: false,
        error: "File is too large for text preview.",
        size: stats.size,
        maxSize: MAX_TEXT_PREVIEW_SIZE,
      };
    }

    const content = await fs.promises.readFile(
      cleanPath,
      "utf8",
    );

    return {
      success: true,
      type: "text",
      path: cleanPath,
      content,
      size: stats.size,
      truncated: false,
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      error: error.message,
    };
  }
}

async function readImagePreview(filePath) {
  const cleanPath = validatePath(filePath);

  try {
    const stats = await fs.promises.stat(cleanPath);

    if (!stats.isFile()) {
      return {
        success: false,
        error: "Preview target is not a file.",
      };
    }

    if (stats.size > MAX_IMAGE_PREVIEW_SIZE) {
      return {
        success: false,
        error: "Image is too large for preview.",
        size: stats.size,
        maxSize: MAX_IMAGE_PREVIEW_SIZE,
      };
    }

    const buffer = await fs.promises.readFile(cleanPath);
    const mimeType = getMimeType(cleanPath);

    return {
      success: true,
      type: "image",
      path: cleanPath,
      mimeType,
      data: buffer.toString("base64"),
      size: stats.size,
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      error: error.message,
    };
  }
}

async function getPreviewMetadata(filePath) {
  const cleanPath = validatePath(filePath);

  const stats = await getFileStats(cleanPath);

  if (!stats.success) {
    return stats;
  }

  const type = getPreviewType(
    cleanPath,
    stats.isDirectory,
  );

  return {
    success: true,
    path: cleanPath,
    name: path.basename(cleanPath),
    extension: getExtension(cleanPath),
    type,
    mimeType: stats.isFile
      ? getMimeType(cleanPath)
      : null,
    size: stats.size,
    created: stats.created,
    modified: stats.modified,
    accessed: stats.accessed,
    isFile: stats.isFile,
    isDirectory: stats.isDirectory,
  };
}

async function getPreview(filePath) {
  const metadata = await getPreviewMetadata(filePath);

  if (!metadata.success) {
    return metadata;
  }

  if (metadata.isDirectory) {
    return {
      ...metadata,
      previewAvailable: false,
      message: "Folder preview is not available.",
    };
  }

  if (metadata.type === "text") {
    const preview = await readTextPreview(filePath);

    return {
      ...metadata,
      previewAvailable: preview.success,
      preview: preview.success ? preview.content : null,
      previewError: preview.success
        ? null
        : preview.error,
    };
  }

  if (metadata.type === "image") {
    const preview = await readImagePreview(filePath);

    return {
      ...metadata,
      previewAvailable: preview.success,
      data: preview.success ? preview.data : null,
      previewError: preview.success
        ? null
        : preview.error,
    };
  }

  if (metadata.type === "pdf") {
    return {
      ...metadata,
      previewAvailable: true,
      previewMode: "browser",
      message: "PDF preview can be rendered by the Preview Pane.",
    };
  }

  if (metadata.type === "audio") {
    return {
      ...metadata,
      previewAvailable: true,
      previewMode: "media",
    };
  }

  if (metadata.type === "video") {
    return {
      ...metadata,
      previewAvailable: true,
      previewMode: "media",
    };
  }

  return {
    ...metadata,
    previewAvailable: false,
    message: "No built-in preview available for this file type.",
  };
}

function isPreviewSupported(filePath) {
  const type = getPreviewType(filePath);

  return [
    "image",
    "text",
    "pdf",
    "audio",
    "video",
  ].includes(type);
}

function getSupportedPreviewTypes() {
  return [
    "image",
    "text",
    "pdf",
    "audio",
    "video",
  ];
}

module.exports = {
  getFileStats,
  getExtension,
  getPreviewType,
  getMimeType,
  readTextPreview,
  readImagePreview,
  getPreviewMetadata,
  getPreview,
  isPreviewSupported,
  getSupportedPreviewTypes,
};