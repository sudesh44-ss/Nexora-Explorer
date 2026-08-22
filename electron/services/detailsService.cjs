"use strict";

/*
 * ============================================================
 * Details Service
 * ============================================================
 *
 * Purpose:
 * - File/folder ki detailed information provide karna
 * - Size
 * - Type
 * - Extension
 * - Created date
 * - Modified date
 * - Accessed date
 * - Attributes
 * - File / folder status
 *
 * IMPORTANT:
 * - Ye UI Details Pane create nahi karti.
 * - UI baad me DetailsPane.jsx me banega.
 * - Existing electron.cjs / preload.cjs / App.jsx ko
 *   abhi modify nahi karna hai.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

const isWindows = process.platform === "win32";

/**
 * Validate filesystem path.
 */
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

/**
 * Check whether path exists.
 */
async function pathExists(filePath) {
  try {
    await fs.promises.access(
      filePath,
      fs.constants.F_OK,
    );

    return true;
  } catch {
    return false;
  }
}

/**
 * Get extension.
 */
function getExtension(filePath) {
  const extension = path.extname(filePath);

  return extension
    ? extension.toLowerCase()
    : "";
}

/**
 * Get a human-readable file type.
 */
function getFileType(filePath, isDirectory) {
  if (isDirectory) {
    return "File folder";
  }

  const extension = getExtension(filePath);

  if (!extension) {
    return "File";
  }

  const types = {
    ".txt": "Text Document",
    ".md": "Markdown Document",

    ".jpg": "JPEG Image",
    ".jpeg": "JPEG Image",
    ".png": "PNG Image",
    ".gif": "GIF Image",
    ".bmp": "Bitmap Image",
    ".webp": "WebP Image",
    ".svg": "SVG Image",

    ".mp3": "MP3 Audio",
    ".wav": "WAV Audio",
    ".flac": "FLAC Audio",
    ".m4a": "M4A Audio",
    ".ogg": "OGG Audio",

    ".mp4": "MP4 Video",
    ".mkv": "MKV Video",
    ".avi": "AVI Video",
    ".mov": "QuickTime Video",
    ".webm": "WebM Video",

    ".pdf": "PDF Document",

    ".doc": "Microsoft Word Document",
    ".docx": "Microsoft Word Document",
    ".xls": "Microsoft Excel Worksheet",
    ".xlsx": "Microsoft Excel Worksheet",
    ".ppt": "Microsoft PowerPoint Presentation",
    ".pptx": "Microsoft PowerPoint Presentation",

    ".zip": "ZIP Archive",
    ".rar": "RAR Archive",
    ".7z": "7-Zip Archive",

    ".js": "JavaScript File",
    ".jsx": "React JavaScript File",
    ".ts": "TypeScript File",
    ".tsx": "React TypeScript File",
    ".html": "HTML Document",
    ".css": "CSS Stylesheet",
    ".json": "JSON File",
    ".py": "Python File",
    ".java": "Java Source File",
    ".c": "C Source File",
    ".cpp": "C++ Source File",
    ".h": "C Header File",
    ".hpp": "C++ Header File",
    ".sql": "SQL File",
  };

  return types[extension] || `${extension.substring(1).toUpperCase()} File`;
}

/**
 * Format bytes.
 */
function formatSize(bytes) {
  if (bytes === 0) {
    return "0 Bytes";
  }

  if (!Number.isFinite(bytes)) {
    return "Unknown";
  }

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
    "TB",
    "PB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(bytes) / Math.log(1024),
    ),
    units.length - 1,
  );

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

/**
 * Get Windows attributes.
 *
 * Uses Node fs stats where possible and Windows
 * file attributes for hidden/system/readonly.
 */
async function getWindowsAttributes(filePath) {
  if (!isWindows) {
    return {
      hidden: false,
      system: false,
      readonly: false,
      archive: false,
    };
  }

  /*
   * Windows-specific attributes are read through
   * fs.statSync().mode where possible.
   *
   * Hidden/System are not directly exposed reliably
   * by Node's standard Stats object, so this service
   * keeps them false unless another service provides
   * the richer Windows attribute information.
   */
  try {
    const stats = await fs.promises.stat(filePath);

    return {
      hidden: false,
      system: false,
      readonly: !(stats.mode & 0o200),
      archive: false,
    };
  } catch {
    return {
      hidden: false,
      system: false,
      readonly: false,
      archive: false,
    };
  }
}

/**
 * Get basic ownership information.
 */
async function getOwnershipInfo(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);

    return {
      uid: typeof stats.uid === "number"
        ? stats.uid
        : null,

      gid: typeof stats.gid === "number"
        ? stats.gid
        : null,
    };
  } catch {
    return {
      uid: null,
      gid: null,
    };
  }
}

/**
 * Get detailed information for one file/folder.
 */
async function getDetails(filePath) {
  const cleanPath = validatePath(filePath);

  if (!(await pathExists(cleanPath))) {
    return {
      success: false,
      path: cleanPath,
      error: "File or folder does not exist.",
    };
  }

  try {
    const stats = await fs.promises.stat(
      cleanPath,
    );

    const isDirectory = stats.isDirectory();
    const isFile = stats.isFile();

    const extension = isFile
      ? getExtension(cleanPath)
      : "";

    const attributes =
      await getWindowsAttributes(cleanPath);

    const ownership =
      await getOwnershipInfo(cleanPath);

    return {
      success: true,

      path: cleanPath,

      name: path.basename(cleanPath),

      parentPath: path.dirname(cleanPath),

      type: getFileType(
        cleanPath,
        isDirectory,
      ),

      extension,

      isFile,
      isDirectory,

      size: stats.size,

      formattedSize: formatSize(
        stats.size,
      ),

      created: stats.birthtime.toISOString(),

      modified: stats.mtime.toISOString(),

      accessed: stats.atime.toISOString(),

      changed: stats.ctime.toISOString(),

      attributes,

      ownership,

      mode: stats.mode,

      hardLinks:
        typeof stats.nlink === "number"
          ? stats.nlink
          : null,

      device:
        typeof stats.dev === "number"
          ? stats.dev
          : null,

      inode:
        typeof stats.ino === "number"
          ? stats.ino
          : null,
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      error: error.message,
    };
  }
}

/**
 * Get details for multiple selected items.
 */
async function getMultipleDetails(paths) {
  if (!Array.isArray(paths)) {
    return {
      success: false,
      results: [],
      error: "Paths must be an array.",
    };
  }

  const results = [];

  for (const filePath of paths) {
    try {
      results.push(
        await getDetails(filePath),
      );
    } catch (error) {
      results.push({
        success: false,
        path: filePath,
        error: error.message,
      });
    }
  }

  return {
    success: true,
    results,
  };
}

/**
 * Calculate combined size of selected files/folders.
 *
 * Folder contents are recursively included.
 */
async function calculateFolderSize(
  folderPath,
) {
  const cleanPath = validatePath(folderPath);

  let totalSize = 0;

  async function walk(currentPath) {
    const entries =
      await fs.promises.readdir(
        currentPath,
        {
          withFileTypes: true,
        },
      );

    for (const entry of entries) {
      const entryPath = path.join(
        currentPath,
        entry.name,
      );

      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        try {
          const stats =
            await fs.promises.stat(
              entryPath,
            );

          totalSize += stats.size;
        } catch {
          // Ignore inaccessible files.
        }
      }
    }
  }

  try {
    const stats =
      await fs.promises.stat(cleanPath);

    if (!stats.isDirectory()) {
      return {
        success: true,
        path: cleanPath,
        size: stats.size,
        formattedSize: formatSize(
          stats.size,
        ),
      };
    }

    await walk(cleanPath);

    return {
      success: true,
      path: cleanPath,
      size: totalSize,
      formattedSize: formatSize(
        totalSize,
      ),
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      size: 0,
      formattedSize: "Unknown",
      error: error.message,
    };
  }
}

/**
 * Get folder item count.
 */
async function getFolderItemCount(
  folderPath,
) {
  const cleanPath = validatePath(folderPath);

  try {
    const entries =
      await fs.promises.readdir(
        cleanPath,
        {
          withFileTypes: true,
        },
      );

    let files = 0;
    let folders = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        folders++;
      } else {
        files++;
      }
    }

    return {
      success: true,
      path: cleanPath,
      total: entries.length,
      files,
      folders,
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      total: 0,
      files: 0,
      folders: 0,
      error: error.message,
    };
  }
}

/**
 * Get complete Details Pane data.
 */
async function getDetailsPaneData(
  filePath,
) {
  const details =
    await getDetails(filePath);

  if (!details.success) {
    return details;
  }

  if (details.isDirectory) {
    const [folderSize, itemCount] =
      await Promise.all([
        calculateFolderSize(filePath),
        getFolderItemCount(filePath),
      ]);

    return {
      ...details,

      folderSize:
        folderSize.success
          ? folderSize.size
          : null,

      formattedFolderSize:
        folderSize.success
          ? folderSize.formattedSize
          : "Unknown",

      itemCount:
        itemCount.success
          ? itemCount.total
          : 0,

      fileCount:
        itemCount.success
          ? itemCount.files
          : 0,

      folderCount:
        itemCount.success
          ? itemCount.folders
          : 0,
    };
  }

  return details;
}

/**
 * Get a lightweight details object.
 *
 * Useful when the pane is closed and only a small
 * amount of metadata is required.
 */
function getLightweightDetails(
  details,
) {
  if (!details || !details.success) {
    return details;
  }

  return {
    success: true,
    path: details.path,
    name: details.name,
    type: details.type,
    extension: details.extension,
    isFile: details.isFile,
    isDirectory: details.isDirectory,
    size: details.size,
    formattedSize: details.formattedSize,
    created: details.created,
    modified: details.modified,
  };
}

/**
 * Public API.
 */
module.exports = {
  validatePath,
  pathExists,
  getExtension,
  getFileType,
  formatSize,
  getDetails,
  getMultipleDetails,
  calculateFolderSize,
  getFolderItemCount,
  getDetailsPaneData,
  getLightweightDetails,
};