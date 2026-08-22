"use strict";

const SUPPORTED_FILTER_TYPES = Object.freeze([
  "image",
  "video",
  "audio",
  "pdf",
  "document",
  "code",
  "archive",
]);

const TYPE_EXTENSIONS = Object.freeze({
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".tiff", ".ico"],
  video: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v"],
  audio: [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".wma"],
  pdf: [".pdf"],
  document: [".pdf", ".docx", ".doc", ".txt", ".rtf", ".odt", ".md", ".csv", ".xlsx", ".pptx"],
  code: [".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".json", ".c", ".cpp", ".java", ".go", ".rs", ".sql", ".sh", ".bat"],
  archive: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz"],
});

class FilterTypes {
  /**
   * Checks if type is supported
   */
  static isValidType(type) {
    if (!type || typeof type !== "string") return false;
    return SUPPORTED_FILTER_TYPES.includes(type.toLowerCase().trim());
  }

  /**
   * Normalizes an extension to lowercase with leading dot
   */
  static normalizeExtension(ext) {
    if (!ext || typeof ext !== "string") return "";
    let clean = ext.toLowerCase().trim();
    if (!clean.startsWith(".")) clean = `.${clean}`;
    return clean;
  }

  /**
   * Gets extensions belonging to a category
   */
  static getExtensionsForType(type) {
    const t = (type || "").toLowerCase().trim();
    return TYPE_EXTENSIONS[t] || [];
  }

  /**
   * Evaluates if a fileRecord matches a type
   */
  static matchesType(fileRecord, type) {
    if (!fileRecord || !type) return false;
    const t = type.toLowerCase().trim();
    const ext = this.normalizeExtension(fileRecord.extension || fileRecord.name);
    const mime = (fileRecord.mime_type || "").toLowerCase();

    if (t === "pdf") {
      return ext === ".pdf" || mime === "application/pdf";
    }
    if (t === "image") {
      return mime.startsWith("image/") || (TYPE_EXTENSIONS.image && TYPE_EXTENSIONS.image.includes(ext));
    }
    if (t === "video") {
      return mime.startsWith("video/") || (TYPE_EXTENSIONS.video && TYPE_EXTENSIONS.video.includes(ext));
    }
    if (t === "audio") {
      return mime.startsWith("audio/") || (TYPE_EXTENSIONS.audio && TYPE_EXTENSIONS.audio.includes(ext));
    }
    if (t === "document") {
      return TYPE_EXTENSIONS.document.includes(ext) || mime.startsWith("text/") || mime.includes("document") || mime.includes("pdf");
    }
    if (t === "code") {
      return TYPE_EXTENSIONS.code.includes(ext);
    }
    if (t === "archive") {
      return TYPE_EXTENSIONS.archive.includes(ext) || mime.includes("zip") || mime.includes("compressed");
    }

    return false;
  }
}

module.exports = {
  SUPPORTED_FILTER_TYPES,
  TYPE_EXTENSIONS,
  FilterTypes,
};
