import { extensionOf } from "./path";

export function fileTypeLabel(item) {
  if (item.isDirectory) {
    return "File folder";
  }

  const dotIndex =
    item.name.lastIndexOf(".");

  if (dotIndex === -1) {
    return "File";
  }

  return (
    item.name
      .substring(dotIndex + 1)
      .toUpperCase() +
    " File"
  );
}

export function matchesFilter(
  item,
  filterType,
) {
  if (filterType === "all") {
    return true;
  }

  if (filterType === "folder") {
    return item.isDirectory;
  }

  if (item.isDirectory) {
    return false;
  }

  const ext =
    extensionOf(item);

  const groups = {
    image: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
      ".ico",
    ],

    video: [
      ".mp4",
      ".mkv",
      ".avi",
      ".mov",
      ".wmv",
      ".webm",
      ".m4v",
    ],

    audio: [
      ".mp3",
      ".wav",
      ".flac",
      ".aac",
      ".ogg",
      ".m4a",
      ".wma",
    ],

    document: [
      ".txt",
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".csv",
      ".rtf",
    ],

    archive: [
      ".zip",
      ".rar",
      ".7z",
      ".tar",
      ".gz",
    ],
  };

  return (
    groups[filterType]?.includes(
      ext,
    ) || false
  );
}