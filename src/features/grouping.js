"use strict";

/*
 * ============================================================
 * File Grouping Utility
 * ============================================================
 *
 * Supports:
 * - No grouping
 * - Group by file type
 * - Group by date
 *
 * Expected item structure:
 *
 * {
 *   name: "example.jpg",
 *   path: "C:\\Photos\\example.jpg",
 *   isDirectory: false,
 *   size: 123456,
 *   modified: "2026-08-12T10:20:30.000Z"
 * }
 *
 * This file only handles grouping logic.
 * It does NOT modify App.jsx or any existing code.
 * ============================================================
 */

/**
 * Supported grouping modes.
 */
const GROUP_MODES = {
  NONE: "none",
  TYPE: "type",
  DATE: "date",
};

/**
 * Get file extension.
 *
 * Example:
 * "photo.JPG" -> ".jpg"
 * "document.pdf" -> ".pdf"
 * "README" -> ""
 */
function getExtension(item) {
  if (!item || item.isDirectory || typeof item.name !== "string") {
    return "";
  }

  const name = item.name.trim();

  const lastDot = name.lastIndexOf(".");

  if (lastDot <= 0 || lastDot === name.length - 1) {
    return "";
  }

  return name.substring(lastDot).toLowerCase();
}

/**
 * Convert extension into a human-readable type.
 */
function getTypeGroup(item) {
  if (!item) {
    return "Other";
  }

  if (item.isDirectory) {
    return "Folders";
  }

  const extension = getExtension(item);

  if (!extension) {
    return "Other";
  }

  const imageExtensions = new Set([
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

  const videoExtensions = new Set([
    ".mp4",
    ".mkv",
    ".avi",
    ".mov",
    ".wmv",
    ".webm",
    ".flv",
    ".m4v",
    ".mpeg",
    ".mpg",
  ]);

  const audioExtensions = new Set([
    ".mp3",
    ".wav",
    ".flac",
    ".aac",
    ".ogg",
    ".m4a",
    ".wma",
    ".opus",
    ".aiff",
  ]);

  const documentExtensions = new Set([
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
    ".odt",
    ".ods",
    ".odp",
    ".md",
  ]);

  const archiveExtensions = new Set([
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".bz2",
    ".xz",
    ".iso",
  ]);

  const codeExtensions = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".json",
    ".xml",
    ".yml",
    ".yaml",
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
    ".ps1",
  ]);

  if (imageExtensions.has(extension)) {
    return "Images";
  }

  if (videoExtensions.has(extension)) {
    return "Videos";
  }

  if (audioExtensions.has(extension)) {
    return "Audio";
  }

  if (documentExtensions.has(extension)) {
    return "Documents";
  }

  if (archiveExtensions.has(extension)) {
    return "Archives";
  }

  if (codeExtensions.has(extension)) {
    return "Code";
  }

  return "Other";
}

/**
 * Safely convert item's modified date.
 */
function getItemDate(item) {
  if (!item || !item.modified) {
    return null;
  }

  const date = new Date(item.modified);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Get date group.
 *
 * Groups:
 * - Today
 * - Yesterday
 * - Earlier this week
 * - Last week
 * - Earlier this month
 * - Last month
 * - Older
 */
function getDateGroup(item, now = new Date()) {
  const date = getItemDate(item);

  if (!date) {
    return "Unknown date";
  }

  const current = new Date(now);

  /*
   * Remove time from both dates.
   */
  const today = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
  );

  const itemDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  const difference = Math.floor(
    (today.getTime() - itemDay.getTime()) /
      millisecondsPerDay,
  );

  if (difference === 0) {
    return "Today";
  }

  if (difference === 1) {
    return "Yesterday";
  }

  /*
   * Future dates should not normally occur for modified files,
   * but handle them safely.
   */
  if (difference < 0) {
    return "Future";
  }

  /*
   * Same week.
   *
   * JavaScript:
   * Sunday = 0
   * Monday = 1
   * ...
   */
  const currentDay = today.getDay();

  const daysSinceMonday =
    currentDay === 0 ? 6 : currentDay - 1;

  const startOfWeek = new Date(today);

  startOfWeek.setDate(
    today.getDate() - daysSinceMonday,
  );

  if (itemDay >= startOfWeek) {
    return "Earlier this week";
  }

  /*
   * Previous week.
   */
  const startOfPreviousWeek = new Date(startOfWeek);

  startOfPreviousWeek.setDate(
    startOfWeek.getDate() - 7,
  );

  if (itemDay >= startOfPreviousWeek) {
    return "Last week";
  }

  /*
   * Current month.
   */
  if (
    itemDay.getFullYear() === today.getFullYear() &&
    itemDay.getMonth() === today.getMonth()
  ) {
    return "Earlier this month";
  }

  /*
   * Previous month.
   */
  const previousMonth = new Date(
    today.getFullYear(),
    today.getMonth() - 1,
    1,
  );

  const endOfPreviousMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    0,
  );

  if (
    itemDay >= previousMonth &&
    itemDay <= endOfPreviousMonth
  ) {
    return "Last month";
  }

  return "Older";
}

/**
 * Return the grouping key for an item.
 */
function getGroupKey(item, mode = GROUP_MODES.NONE) {
  switch (mode) {
    case GROUP_MODES.TYPE:
      return getTypeGroup(item);

    case GROUP_MODES.DATE:
      return getDateGroup(item);

    case GROUP_MODES.NONE:
    default:
      return null;
  }
}

/**
 * Group items.
 *
 * Returns:
 *
 * [
 *   {
 *     key: "Images",
 *     label: "Images",
 *     items: [...]
 *   },
 *   ...
 * ]
 */
function groupItems(items, mode = GROUP_MODES.NONE) {
  if (!Array.isArray(items)) {
    return [];
  }

  if (mode === GROUP_MODES.NONE) {
    return [
      {
        key: "all",
        label: "",
        items: [...items],
      },
    ];
  }

  const groups = new Map();

  for (const item of items) {
    const key = getGroupKey(item, mode);

    if (!key) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
  }

  return Array.from(groups.entries()).map(
    ([key, groupItemsList]) => ({
      key,
      label: key,
      items: groupItemsList,
    }),
  );
}

/**
 * Preferred ordering for Type groups.
 */
const TYPE_GROUP_ORDER = [
  "Folders",
  "Images",
  "Videos",
  "Audio",
  "Documents",
  "Archives",
  "Code",
  "Other",
];

/**
 * Preferred ordering for Date groups.
 */
const DATE_GROUP_ORDER = [
  "Today",
  "Yesterday",
  "Earlier this week",
  "Last week",
  "Earlier this month",
  "Last month",
  "Older",
  "Future",
  "Unknown date",
];

/**
 * Sort groups according to Explorer-style ordering.
 */
function sortGroups(groups, mode = GROUP_MODES.TYPE) {
  if (!Array.isArray(groups)) {
    return [];
  }

  const order =
    mode === GROUP_MODES.DATE
      ? DATE_GROUP_ORDER
      : TYPE_GROUP_ORDER;

  return [...groups].sort((a, b) => {
    const firstIndex = order.indexOf(a.key);
    const secondIndex = order.indexOf(b.key);

    /*
     * Known groups first.
     */
    if (firstIndex !== -1 && secondIndex !== -1) {
      return firstIndex - secondIndex;
    }

    if (firstIndex !== -1) {
      return -1;
    }

    if (secondIndex !== -1) {
      return 1;
    }

    return String(a.label).localeCompare(
      String(b.label),
      undefined,
      {
        sensitivity: "base",
      },
    );
  });
}

/**
 * Group and sort in one operation.
 */
function groupAndSortItems(
  items,
  mode = GROUP_MODES.NONE,
) {
  const groups = groupItems(items, mode);

  if (mode === GROUP_MODES.NONE) {
    return groups;
  }

  return sortGroups(groups, mode);
}

/**
 * Flatten grouped items back into a normal array.
 *
 * Useful when selection, search or other existing Explorer
 * logic needs a normal item array.
 */
function flattenGroups(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }

  return groups.flatMap((group) =>
    Array.isArray(group.items)
      ? group.items
      : [],
  );
}

/**
 * Count items in all groups.
 */
function countGroupedItems(groups) {
  if (!Array.isArray(groups)) {
    return 0;
  }

  return groups.reduce(
    (total, group) =>
      total +
      (Array.isArray(group.items)
        ? group.items.length
        : 0),
    0,
  );
}

/**
 * Get available grouping modes for UI.
 */
function getGroupingModes() {
  return [
    {
      value: GROUP_MODES.NONE,
      label: "None",
    },
    {
      value: GROUP_MODES.TYPE,
      label: "Type",
    },
    {
      value: GROUP_MODES.DATE,
      label: "Date modified",
    },
  ];
}

export {
  GROUP_MODES,
  getExtension,
  getTypeGroup,
  getDateGroup,
  getGroupKey,
  groupItems,
  sortGroups,
  groupAndSortItems,
  flattenGroups,
  countGroupedItems,
  getGroupingModes,
};