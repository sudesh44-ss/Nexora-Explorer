"use strict";

const fsp = require("fs").promises;
const path = require("path");
const { createFileRecord, createFolderRecord } = require("./scanTypes.cjs");
const { generateFileId } = require("./fileId.cjs");
const { computeFileHash } = require("./fileHash.cjs");
const { detectMimeType } = require("./mimeDetector.cjs");
const { classifyNodeError } = require("./scanErrors.cjs");

/**
 * Safely inspects and extracts metadata for a filesystem entry
 *
 * @param {string} targetPath - Absolute path to file or directory
 * @param {Object} options - Scan configuration options
 * @param {import("fs").Dirent} [dirent] - Optional Dirent from readdir to optimize checks
 * @returns {Promise<{success: boolean, isDirectory: boolean, record: Object|null, error: Object|null}>}
 */
async function readMetadata(targetPath, options = {}, dirent = null) {
  try {
    // Use lstat to properly detect symbolic links and reparse points without following blindly
    const stats = await fsp.lstat(targetPath);
    const isSymlink = stats.isSymbolicLink();
    let isDir = dirent ? dirent.isDirectory() : stats.isDirectory();
    let isFile = dirent ? dirent.isFile() : stats.isFile();

    // If symlink and followSymlinks is enabled, inspect target stats
    if (isSymlink && options.followSymlinks) {
      try {
        const targetStats = await fsp.stat(targetPath);
        isDir = targetStats.isDirectory();
        isFile = targetStats.isFile();
      } catch {
        // Broken symlink
        return {
          success: false,
          isDirectory: false,
          record: null,
          error: {
            code: "BROKEN_SYMLINK",
            path: targetPath,
            message: "Symbolic link target is missing or inaccessible.",
            timestamp: new Date().toISOString(),
          },
        };
      }
    }

    const name = path.basename(targetPath) || targetPath;
    const isHidden = name.startsWith(".") || Boolean(stats.mode & 0o4000); // Also Windows hidden attribute support
    const isSystem = false; // Windows system attribute flag placeholder

    if (isDir) {
      const folderRecord = createFolderRecord({
        name,
        path: path.normalize(targetPath),
        parent_path: path.dirname(targetPath),
        created_at: stats.birthtime ? stats.birthtime.toISOString() : stats.mtime.toISOString(),
        modified_at: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
        is_hidden: isHidden,
        is_system: isSystem,
        is_symlink: isSymlink,
      });

      return {
        success: true,
        isDirectory: true,
        record: folderRecord,
        error: null,
      };
    }

    if (isFile) {
      const ext = path.extname(name).toLowerCase();
      const mimeType = detectMimeType(ext);
      const fileId = generateFileId(targetPath, stats);

      // Compute hash if requested
      const hash = await computeFileHash(targetPath, stats.size, options);

      const fileRecord = createFileRecord({
        file_id: fileId,
        name,
        path: path.normalize(targetPath),
        extension: ext,
        size: stats.size,
        created_at: stats.birthtime ? stats.birthtime.toISOString() : stats.mtime.toISOString(),
        modified_at: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
        hash,
        mime_type: mimeType,
        is_hidden: isHidden,
        is_system: isSystem,
        is_symlink: isSymlink,
      });

      return {
        success: true,
        isDirectory: false,
        record: fileRecord,
        error: null,
      };
    }

    // Other entry type (socket, FIFO, block device)
    return {
      success: true,
      isDirectory: false,
      record: null,
      error: null,
    };
  } catch (err) {
    const errorDetails = classifyNodeError(err, targetPath);
    return {
      success: false,
      isDirectory: false,
      record: null,
      error: errorDetails,
    };
  }
}

module.exports = {
  readMetadata,
};
