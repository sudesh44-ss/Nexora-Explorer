"use strict";

/*
 * ============================================================
 * Thumbnail Service
 * ============================================================
 *
 * Purpose:
 * - Image thumbnails generate karna
 * - Thumbnail cache maintain karna
 * - Existing thumbnail reuse karna
 * - Thumbnail size control
 * - Multiple thumbnails generate karna
 * - Thumbnail cache clear karna
 *
 * Supported image formats depend on Electron/Chromium:
 * JPG / JPEG / PNG / GIF / BMP / WebP / SVG / etc.
 *
 * IMPORTANT:
 * - Ye UI component nahi hai.
 * - Actual thumbnail display baad me App/Thumbnail component
 *   se connect hoga.
 * - Existing electron.cjs / preload.cjs / App.jsx ko
 *   abhi modify nahi karna hai.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_THUMBNAIL_SIZE = 256;

const MAX_SOURCE_FILE_SIZE = 100 * 1024 * 1024;

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
]);

/**
 * Get a safe cache directory.
 *
 * It is intentionally outside the user's original files.
 */
function getCacheDirectory(customDirectory) {
  if (customDirectory) {
    return path.resolve(customDirectory);
  }

  return path.join(
    process.cwd(),
    ".thumbnail-cache",
  );
}

/**
 * Validate path.
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
 * Get file extension.
 */
function getExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

/**
 * Check whether file can have a thumbnail.
 */
function isThumbnailSupported(filePath) {
  const extension = getExtension(filePath);

  return IMAGE_EXTENSIONS.has(extension);
}

/**
 * Create a stable cache key.
 *
 * File path + modification time + size + thumbnail dimensions
 * are used so changed files automatically get a new key.
 */
async function createCacheKey(
  filePath,
  width,
  height,
) {
  const cleanPath = validatePath(filePath);

  const stats =
    await fs.promises.stat(cleanPath);

  const value = [
    cleanPath,
    stats.size,
    stats.mtimeMs,
    width,
    height,
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

/**
 * Ensure cache directory exists.
 */
async function ensureCacheDirectory(
  cacheDirectory,
) {
  const directory =
    getCacheDirectory(cacheDirectory);

  await fs.promises.mkdir(
    directory,
    {
      recursive: true,
    },
  );

  return directory;
}

/**
 * Get cache file path.
 */
async function getThumbnailCachePath(
  filePath,
  options = {},
) {
  const width =
    Number(options.width) ||
    DEFAULT_THUMBNAIL_SIZE;

  const height =
    Number(options.height) ||
    width;

  const cacheDirectory =
    await ensureCacheDirectory(
      options.cacheDirectory,
    );

  const key =
    await createCacheKey(
      filePath,
      width,
      height,
    );

  return path.join(
    cacheDirectory,
    `${key}.png`,
  );
}

/**
 * Read image information.
 *
 * This does not decode the image itself.
 */
async function getImageInfo(filePath) {
  const cleanPath =
    validatePath(filePath);

  if (!(await pathExists(cleanPath))) {
    return {
      success: false,
      path: cleanPath,
      error: "Image does not exist.",
    };
  }

  if (!isThumbnailSupported(cleanPath)) {
    return {
      success: false,
      path: cleanPath,
      error: "Thumbnail is not supported for this file type.",
    };
  }

  try {
    const stats =
      await fs.promises.stat(
        cleanPath,
      );

    if (!stats.isFile()) {
      return {
        success: false,
        path: cleanPath,
        error: "Path is not a file.",
      };
    }

    if (stats.size > MAX_SOURCE_FILE_SIZE) {
      return {
        success: false,
        path: cleanPath,
        error:
          "Image is too large for thumbnail generation.",
        size: stats.size,
        maxSize: MAX_SOURCE_FILE_SIZE,
      };
    }

    return {
      success: true,
      path: cleanPath,
      name: path.basename(cleanPath),
      extension: getExtension(cleanPath),
      size: stats.size,
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
 * Generate thumbnail using Electron's native
 * nativeImage API.
 *
 * This function lazily loads Electron so the service
 * remains easier to test/import.
 */
async function generateThumbnail(
  filePath,
  options = {},
) {
  const cleanPath =
    validatePath(filePath);

  const info =
    await getImageInfo(cleanPath);

  if (!info.success) {
    return info;
  }

  const width =
    Math.max(
      32,
      Math.min(
        Number(options.width) ||
          DEFAULT_THUMBNAIL_SIZE,
        2048,
      ),
    );

  const height =
    Math.max(
      32,
      Math.min(
        Number(options.height) ||
          width,
        2048,
      ),
    );

  try {
    /*
     * Electron nativeImage is intentionally required
     * only when thumbnail generation is requested.
     */
    const { nativeImage } = require("electron");

    const cachePath =
      await getThumbnailCachePath(
        cleanPath,
        {
          ...options,
          width,
          height,
        },
      );

    /*
     * Reuse existing thumbnail if available.
     */
    if (await pathExists(cachePath)) {
      const cacheStats =
        await fs.promises.stat(
          cachePath,
        );

      return {
        success: true,
        path: cleanPath,
        thumbnailPath: cachePath,
        width,
        height,
        cached: true,
        cacheSize: cacheStats.size,
      };
    }

    const image =
      nativeImage.createFromPath(
        cleanPath,
      );

    if (image.isEmpty()) {
      return {
        success: false,
        path: cleanPath,
        error:
          "Electron could not decode the image.",
      };
    }

    const resized =
      image.resize({
        width,
        height,
        quality: "better",
      });

    const pngBuffer =
      resized.toPNG();

    await fs.promises.writeFile(
      cachePath,
      pngBuffer,
    );

    return {
      success: true,
      path: cleanPath,
      thumbnailPath: cachePath,
      width,
      height,
      cached: false,
      cacheSize: pngBuffer.length,
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
 * Generate thumbnail and return a data URL.
 *
 * Useful for renderer-side display.
 */
async function generateThumbnailDataURL(
  filePath,
  options = {},
) {
  const result =
    await generateThumbnail(
      filePath,
      options,
    );

  if (!result.success) {
    return result;
  }

  try {
    const buffer =
      await fs.promises.readFile(
        result.thumbnailPath,
      );

    return {
      ...result,
      dataURL:
        `data:image/png;base64,${buffer.toString(
          "base64",
        )}`,
    };
  } catch (error) {
    return {
      success: false,
      path: filePath,
      error: error.message,
    };
  }
}

/**
 * Generate multiple thumbnails.
 */
async function generateThumbnails(
  filePaths,
  options = {},
) {
  if (!Array.isArray(filePaths)) {
    return {
      success: false,
      results: [],
      error: "File paths must be an array.",
    };
  }

  const results = [];

  for (const filePath of filePaths) {
    try {
      results.push(
        await generateThumbnail(
          filePath,
          options,
        ),
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
 * Get thumbnail if already cached.
 *
 * Does NOT generate a new thumbnail.
 */
async function getCachedThumbnail(
  filePath,
  options = {},
) {
  const cleanPath =
    validatePath(filePath);

  try {
    const cachePath =
      await getThumbnailCachePath(
        cleanPath,
        options,
      );

    if (!(await pathExists(cachePath))) {
      return {
        success: false,
        path: cleanPath,
        cached: false,
        thumbnailPath: null,
      };
    }

    return {
      success: true,
      path: cleanPath,
      cached: true,
      thumbnailPath: cachePath,
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      cached: false,
      thumbnailPath: null,
      error: error.message,
    };
  }
}

/**
 * Delete cached thumbnail for one file.
 */
async function deleteCachedThumbnail(
  filePath,
  options = {},
) {
  const cleanPath =
    validatePath(filePath);

  try {
    const cachePath =
      await getThumbnailCachePath(
        cleanPath,
        options,
      );

    if (await pathExists(cachePath)) {
      await fs.promises.unlink(
        cachePath,
      );
    }

    return {
      success: true,
      path: cleanPath,
      thumbnailPath: cachePath,
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
 * Clear entire thumbnail cache.
 */
async function clearThumbnailCache(
  cacheDirectory,
) {
  const directory =
    getCacheDirectory(cacheDirectory);

  try {
    if (!(await pathExists(directory))) {
      return {
        success: true,
        deleted: 0,
        directory,
      };
    }

    const entries =
      await fs.promises.readdir(
        directory,
        {
          withFileTypes: true,
        },
      );

    let deleted = 0;

    for (const entry of entries) {
      const entryPath =
        path.join(
          directory,
          entry.name,
        );

      try {
        if (entry.isFile()) {
          await fs.promises.unlink(
            entryPath,
          );

          deleted++;
        }
      } catch {
        /*
         * Ignore individual cache-file failures.
         */
      }
    }

    return {
      success: true,
      deleted,
      directory,
    };
  } catch (error) {
    return {
      success: false,
      deleted: 0,
      directory,
      error: error.message,
    };
  }
}

/**
 * Get cache statistics.
 */
async function getThumbnailCacheInfo(
  cacheDirectory,
) {
  const directory =
    getCacheDirectory(cacheDirectory);

  try {
    if (!(await pathExists(directory))) {
      return {
        success: true,
        directory,
        files: 0,
        size: 0,
      };
    }

    const entries =
      await fs.promises.readdir(
        directory,
        {
          withFileTypes: true,
        },
      );

    let files = 0;
    let size = 0;

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const entryPath =
        path.join(
          directory,
          entry.name,
        );

      try {
        const stats =
          await fs.promises.stat(
            entryPath,
          );

        files++;
        size += stats.size;
      } catch {
        /*
         * Ignore inaccessible cache entries.
         */
      }
    }

    return {
      success: true,
      directory,
      files,
      size,
    };
  } catch (error) {
    return {
      success: false,
      directory,
      files: 0,
      size: 0,
      error: error.message,
    };
  }
}

/**
 * Create thumbnail information for an Explorer item.
 */
async function getThumbnailInfo(
  item,
  options = {},
) {
  if (!item || typeof item.path !== "string") {
    return {
      success: false,
      thumbnailAvailable: false,
      error: "Invalid Explorer item.",
    };
  }

  if (item.isDirectory) {
    return {
      success: true,
      path: item.path,
      thumbnailAvailable: false,
      type: "folder",
    };
  }

  if (!isThumbnailSupported(item.path)) {
    return {
      success: true,
      path: item.path,
      thumbnailAvailable: false,
      type: "unsupported",
    };
  }

  const cached =
    await getCachedThumbnail(
      item.path,
      options,
    );

  return {
    success: true,
    path: item.path,
    thumbnailAvailable: true,
    cached: cached.cached,
    thumbnailPath:
      cached.thumbnailPath || null,
  };
}

/**
 * Public API.
 */
module.exports = {
  getCacheDirectory,
  validatePath,
  pathExists,
  getExtension,
  isThumbnailSupported,
  createCacheKey,
  ensureCacheDirectory,
  getThumbnailCachePath,
  getImageInfo,
  generateThumbnail,
  generateThumbnailDataURL,
  generateThumbnails,
  getCachedThumbnail,
  deleteCachedThumbnail,
  clearThumbnailCache,
  getThumbnailCacheInfo,
  getThumbnailInfo,
};