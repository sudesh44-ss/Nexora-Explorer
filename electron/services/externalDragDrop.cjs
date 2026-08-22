"use strict";

/*
 * ============================================================
 * External Drag & Drop Service
 * ============================================================
 *
 * Purpose:
 * - Windows Explorer se files/folders ko application me
 *   drag & drop karne ke liye path handling.
 * - Dropped files/folders ko validate karna.
 * - Multiple dropped items support karna.
 * - Duplicate paths remove karna.
 * - Invalid/non-existent paths ko reject karna.
 * - Source item ko target folder me copy/move karne ke
 *   liye safe operation information prepare karna.
 *
 * NOTE:
 * Ye service actual DOM drag/drop event handle nahi karti.
 * DOM event React/App.jsx me rahega.
 *
 * Ye file filesystem-level processing handle karegi.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

/**
 * Supported operating system check.
 */
const isWindows = process.platform === "win32";

/**
 * Validate a path.
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
 * Check whether a path exists.
 */
async function pathExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get basic information about a dropped item.
 */
async function getDroppedItemInfo(filePath) {
  const cleanPath = validatePath(filePath);

  try {
    const stats = await fs.promises.stat(cleanPath);

    return {
      success: true,
      path: cleanPath,
      name: path.basename(cleanPath),
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.isFile() ? stats.size : 0,
      modified: stats.mtime.toISOString(),
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
 * Normalize and remove duplicate dropped paths.
 */
function normalizeDroppedPaths(paths) {
  if (!Array.isArray(paths)) {
    return [];
  }

  const unique = new Map();

  for (const filePath of paths) {
    if (typeof filePath !== "string") {
      continue;
    }

    const cleanPath = filePath.trim();

    if (!cleanPath) {
      continue;
    }

    try {
      const normalized = path.normalize(cleanPath);

      /*
       * Windows paths are case-insensitive.
       */
      const key = isWindows
        ? normalized.toLowerCase()
        : normalized;

      if (!unique.has(key)) {
        unique.set(key, normalized);
      }
    } catch {
      // Ignore invalid path.
    }
  }

  return Array.from(unique.values());
}

/**
 * Validate all dropped paths.
 *
 * Returns valid files/folders and rejected items separately.
 */
async function validateDroppedPaths(paths) {
  const normalizedPaths = normalizeDroppedPaths(paths);

  const valid = [];
  const rejected = [];

  for (const filePath of normalizedPaths) {
    try {
      const exists = await pathExists(filePath);

      if (!exists) {
        rejected.push({
          path: filePath,
          reason: "File or folder does not exist.",
        });

        continue;
      }

      const info = await getDroppedItemInfo(filePath);

      if (!info.success) {
        rejected.push({
          path: filePath,
          reason: info.error || "Unable to read item.",
        });

        continue;
      }

      valid.push(info);
    } catch (error) {
      rejected.push({
        path: filePath,
        reason: error.message,
      });
    }
  }

  return {
    success: true,
    valid,
    rejected,
    total: normalizedPaths.length,
  };
}

/**
 * Check whether source is inside destination.
 *
 * This prevents:
 *
 * C:\Folder
 *      ↓
 * C:\Folder\SubFolder
 *
 * which would attempt to move/copy a folder into itself.
 */
function isPathInside(sourcePath, destinationPath) {
  const source = path.resolve(validatePath(sourcePath));
  const destination = path.resolve(validatePath(destinationPath));

  const sourceKey = isWindows
    ? source.toLowerCase()
    : source;

  const destinationKey = isWindows
    ? destination.toLowerCase()
    : destination;

  return (
    destinationKey === sourceKey ||
    destinationKey.startsWith(`${sourceKey}${path.sep}`)
  );
}

/**
 * Check whether two paths point to the same location.
 */
function areSamePath(firstPath, secondPath) {
  const first = path.resolve(validatePath(firstPath));
  const second = path.resolve(validatePath(secondPath));

  if (isWindows) {
    return first.toLowerCase() === second.toLowerCase();
  }

  return first === second;
}

/**
 * Generate destination path for a dropped item.
 */
function getDestinationPath(sourcePath, destinationFolder) {
  const source = validatePath(sourcePath);
  const destination = validatePath(destinationFolder);

  return path.join(destination, path.basename(source));
}

/**
 * Prepare a drag/drop operation.
 *
 * operation:
 *   "copy"
 *   "move"
 */
async function prepareDropOperation(
  sourcePaths,
  destinationFolder,
  operation = "copy",
) {
  const destination = validatePath(destinationFolder);

  if (!["copy", "move"].includes(operation)) {
    return {
      success: false,
      error: 'Operation must be either "copy" or "move".',
      operations: [],
    };
  }

  try {
    const destinationExists = await pathExists(destination);

    if (!destinationExists) {
      return {
        success: false,
        error: "Destination folder does not exist.",
        operations: [],
      };
    }

    const destinationInfo = await getDroppedItemInfo(destination);

    if (!destinationInfo.success || !destinationInfo.isDirectory) {
      return {
        success: false,
        error: "Destination must be a folder.",
        operations: [],
      };
    }

    const validation = await validateDroppedPaths(sourcePaths);

    const operations = [];
    const rejected = [...validation.rejected];

    for (const item of validation.valid) {
      const source = item.path;
      const target = getDestinationPath(source, destination);

      /*
       * Prevent dropping an item onto itself.
       */
      if (areSamePath(source, target)) {
        rejected.push({
          path: source,
          reason: "Source and destination are the same.",
        });

        continue;
      }

      /*
       * Prevent moving/copying a folder into itself
       * or into one of its child folders.
       */
      if (item.isDirectory && isPathInside(source, destination)) {
        rejected.push({
          path: source,
          reason:
            "Cannot copy or move a folder into itself or one of its subfolders.",
        });

        continue;
      }

      operations.push({
        operation,
        source,
        destination: target,
        name: item.name,
        isDirectory: item.isDirectory,
        size: item.size,
      });
    }

    return {
      success: true,
      destination,
      operation,
      operations,
      rejected,
      total: operations.length,
    };
  } catch (error) {
    return {
      success: false,
      destination,
      operation,
      operations: [],
      error: error.message,
    };
  }
}

/**
 * Check whether destination already contains an item
 * with the same name.
 */
async function checkDropConflicts(operations) {
  if (!Array.isArray(operations)) {
    return [];
  }

  const results = [];

  for (const operation of operations) {
    const destinationExists = await pathExists(operation.destination);

    results.push({
      ...operation,
      conflict: destinationExists,
    });
  }

  return results;
}

/**
 * Generate a "keep both" destination name.
 *
 * Example:
 *
 * photo.jpg
 * photo (1).jpg
 * photo (2).jpg
 */
async function getKeepBothPath(destinationPath) {
  const cleanDestination = validatePath(destinationPath);

  if (!(await pathExists(cleanDestination))) {
    return cleanDestination;
  }

  const directory = path.dirname(cleanDestination);
  const extension = path.extname(cleanDestination);
  const baseName = path.basename(
    cleanDestination,
    extension,
  );

  let counter = 1;

  while (true) {
    const candidate = path.join(
      directory,
      `${baseName} (${counter})${extension}`,
    );

    if (!(await pathExists(candidate))) {
      return candidate;
    }

    counter += 1;
  }
}

/**
 * Apply "keep both" names to conflicting operations.
 */
async function resolveKeepBothConflicts(operations) {
  if (!Array.isArray(operations)) {
    return [];
  }

  const resolved = [];

  /*
   * Track paths created during this resolution so multiple
   * dropped items cannot receive the same generated name.
   */
  const reserved = new Set();

  for (const operation of operations) {
    let destination = operation.destination;

    const normalizedKey = isWindows
      ? destination.toLowerCase()
      : destination;

    const exists = await pathExists(destination);

    if (exists || reserved.has(normalizedKey)) {
      const originalDestination = destination;

      const directory = path.dirname(originalDestination);
      const extension = path.extname(originalDestination);
      const baseName = path.basename(
        originalDestination,
        extension,
      );

      let counter = 1;

      while (true) {
        const candidate = path.join(
          directory,
          `${baseName} (${counter})${extension}`,
        );

        const candidateKey = isWindows
          ? candidate.toLowerCase()
          : candidate;

        if (
          !(await pathExists(candidate)) &&
          !reserved.has(candidateKey)
        ) {
          destination = candidate;
          break;
        }

        counter += 1;
      }
    }

    const finalKey = isWindows
      ? destination.toLowerCase()
      : destination;

    reserved.add(finalKey);

    resolved.push({
      ...operation,
      originalDestination: operation.destination,
      destination,
      conflictResolved: destination !== operation.destination,
    });
  }

  return resolved;
}

/**
 * Return information useful to the renderer for displaying
 * dropped items.
 */
async function describeDroppedItems(paths) {
  const validation = await validateDroppedPaths(paths);

  return {
    success: validation.success,
    items: validation.valid,
    rejected: validation.rejected,
    count: validation.valid.length,
  };
}

/**
 * Public API
 */
module.exports = {
  normalizeDroppedPaths,
  validateDroppedPaths,
  getDroppedItemInfo,
  isPathInside,
  areSamePath,
  getDestinationPath,
  prepareDropOperation,
  checkDropConflicts,
  getKeepBothPath,
  resolveKeepBothConflicts,
  describeDroppedItems,
};