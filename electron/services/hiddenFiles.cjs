"use strict";

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

/*
 * ============================================================
 * Hidden Files Service
 * ============================================================
 *
 * Handles Windows hidden-file attributes.
 *
 * Features:
 * - Detect hidden files/folders
 * - Detect system files/folders
 * - Set hidden attribute
 * - Remove hidden attribute
 * - Toggle hidden attribute
 * - Filter hidden items
 * - Get hidden status for multiple items
 *
 * This file does NOT modify electron.cjs, preload.cjs,
 * App.jsx or any existing application logic.
 * ============================================================
 */

const isWindows = process.platform === "win32";

/**
 * Validate a filesystem path.
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
 * Check whether the target exists.
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
 * Read Windows file attributes.
 *
 * Example result:
 * {
 *   hidden: true,
 *   system: false,
 *   readonly: false,
 *   archive: true
 * }
 */
function getWindowsAttributes(filePath) {
  return new Promise((resolve, reject) => {
    if (!isWindows) {
      resolve({
        hidden: false,
        system: false,
        readonly: false,
        archive: false,
      });

      return;
    }

    const cleanPath = validatePath(filePath);

    const script = `
      $item = Get-Item -LiteralPath ${JSON.stringify(cleanPath)} -Force -ErrorAction Stop
      [PSCustomObject]@{
        Hidden = [bool]($item.Attributes -band [IO.FileAttributes]::Hidden)
        System = [bool]($item.Attributes -band [IO.FileAttributes]::System)
        ReadOnly = [bool]($item.Attributes -band [IO.FileAttributes]::ReadOnly)
        Archive = [bool]($item.Attributes -band [IO.FileAttributes]::Archive)
      } | ConvertTo-Json -Compress
    `;

    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              stderr?.trim() ||
                error.message ||
                "Unable to read Windows file attributes.",
            ),
          );

          return;
        }

        try {
          const result = JSON.parse(stdout.trim());

          resolve({
            hidden: Boolean(result.Hidden),
            system: Boolean(result.System),
            readonly: Boolean(result.ReadOnly),
            archive: Boolean(result.Archive),
          });
        } catch (parseError) {
          reject(
            new Error(
              `Failed to parse Windows file attributes: ${parseError.message}`,
            ),
          );
        }
      },
    );
  });
}

/**
 * Get hidden status of one file/folder.
 */
async function getHiddenStatus(filePath) {
  const cleanPath = validatePath(filePath);

  if (!(await pathExists(cleanPath))) {
    return {
      success: false,
      path: cleanPath,
      hidden: false,
      system: false,
      error: "File or folder does not exist.",
    };
  }

  try {
    const attributes = await getWindowsAttributes(cleanPath);

    return {
      success: true,
      path: cleanPath,
      hidden: attributes.hidden,
      system: attributes.system,
      readonly: attributes.readonly,
      archive: attributes.archive,
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      hidden: false,
      system: false,
      error: error.message,
    };
  }
}

/**
 * Set or remove Windows Hidden attribute.
 *
 * hidden = true  -> add hidden attribute
 * hidden = false -> remove hidden attribute
 */
async function setHidden(filePath, hidden = true) {
  const cleanPath = validatePath(filePath);

  if (!(await pathExists(cleanPath))) {
    return {
      success: false,
      path: cleanPath,
      hidden: false,
      error: "File or folder does not exist.",
    };
  }

  if (!isWindows) {
    return {
      success: false,
      path: cleanPath,
      hidden: false,
      error: "Hidden file attributes are currently supported on Windows only.",
    };
  }

  const command = hidden ? "+H" : "-H";

  return new Promise((resolve) => {
    execFile(
      "attrib.exe",
      [command, cleanPath],
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      async (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            path: cleanPath,
            hidden: false,
            error:
              stderr?.trim() ||
              error.message ||
              "Failed to change hidden attribute.",
          });

          return;
        }

        try {
          const status = await getHiddenStatus(cleanPath);

          if (!status.success) {
            resolve({
              success: false,
              path: cleanPath,
              hidden,
              error:
                status.error ||
                "Hidden attribute changed but status could not be verified.",
            });

            return;
          }

          resolve({
            success: true,
            path: cleanPath,
            hidden: status.hidden,
            system: status.system,
            readonly: status.readonly,
            archive: status.archive,
          });
        } catch (verifyError) {
          resolve({
            success: false,
            path: cleanPath,
            hidden,
            error: verifyError.message,
          });
        }
      },
    );
  });
}

/**
 * Toggle hidden status.
 */
async function toggleHidden(filePath) {
  const cleanPath = validatePath(filePath);

  const currentStatus = await getHiddenStatus(cleanPath);

  if (!currentStatus.success) {
    return currentStatus;
  }

  return setHidden(cleanPath, !currentStatus.hidden);
}

/**
 * Get hidden status for multiple files/folders.
 */
async function getHiddenStatuses(paths) {
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
      const result = await getHiddenStatus(filePath);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        path: filePath,
        hidden: false,
        system: false,
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
 * Run attrib.exe once for all children in the directory.
 */
function getDirectoryAttributes(directoryPath) {
  return new Promise((resolve) => {
    if (!isWindows) {
      resolve(new Map());
      return;
    }

    try {
      const cleanPath = path.normalize(directoryPath.trim());
      const searchPath = cleanPath.endsWith("\\") || cleanPath.endsWith("/")
        ? `${cleanPath}*`
        : `${cleanPath}\\*`;

      execFile(
        "attrib.exe",
        ["/d", searchPath],
        { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout) => {
          const attributesMap = new Map();
          if (error || !stdout) {
            resolve(attributesMap);
            return;
          }

          const lines = stdout.split(/\r?\n/);
          for (const line of lines) {
            if (line.length > 21) {
              const attrPart = line.substring(0, 21);
              const itemPath = line.substring(21).trim();
              if (itemPath) {
                attributesMap.set(itemPath.toLowerCase(), {
                  hidden: attrPart.includes("H"),
                  system: attrPart.includes("S"),
                  readonly: attrPart.includes("R"),
                  archive: attrPart.includes("A"),
                });
              }
            }
          }
          resolve(attributesMap);
        }
      );
    } catch {
      resolve(new Map());
    }
  });
}

/**
 * Filter a list of Explorer items.
 *
 * showHidden = true:
 *     Hidden files are included.
 *
 * showHidden = false:
 *     Hidden files and folders are removed.
 *
 * System items:
 *     By default, system items are also hidden when
 *     showHidden is false.
 */
async function filterHiddenItems(items, showHidden = false) {
  if (!Array.isArray(items)) {
    return [];
  }

  if (showHidden) {
    return items;
  }

  const dirToItems = new Map();
  for (const item of items) {
    if (item && typeof item.path === "string") {
      const parentDir = path.dirname(item.path);
      const list = dirToItems.get(parentDir) || [];
      list.push(item);
      dirToItems.set(parentDir, list);
    }
  }

  const visibleItems = [];

  for (const [parentDir, list] of dirToItems) {
    try {
      const attributesMap = await getDirectoryAttributes(parentDir);

      for (const item of list) {
        const attrs = attributesMap.get(item.path.toLowerCase());
        if (attrs) {
          if (attrs.hidden || attrs.system) {
            continue;
          }
          visibleItems.push(item);
        } else {
          // Fallback
          const status = await getHiddenStatus(item.path);
          if (status.success && (status.hidden || status.system)) {
            continue;
          }
          visibleItems.push(item);
        }
      }
    } catch {
      // In case of error, show all items
      visibleItems.push(...list);
    }
  }

  return visibleItems;
}

/**
 * Get hidden items from an existing item list.
 */
async function getHiddenItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const dirToItems = new Map();
  for (const item of items) {
    if (item && typeof item.path === "string") {
      const parentDir = path.dirname(item.path);
      const list = dirToItems.get(parentDir) || [];
      list.push(item);
      dirToItems.set(parentDir, list);
    }
  }

  const hiddenItems = [];

  for (const [parentDir, list] of dirToItems) {
    try {
      const attributesMap = await getDirectoryAttributes(parentDir);

      for (const item of list) {
        const attrs = attributesMap.get(item.path.toLowerCase());
        if (attrs) {
          if (attrs.hidden || attrs.system) {
            hiddenItems.push({
              ...item,
              hidden: attrs.hidden,
              system: attrs.system,
            });
          }
        } else {
          // Fallback
          const status = await getHiddenStatus(item.path);
          if (status.success && (status.hidden || status.system)) {
            hiddenItems.push({
              ...item,
              hidden: status.hidden,
              system: status.system,
            });
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  return hiddenItems;
}

/**
 * Apply hidden metadata to an Explorer item.
 */
async function decorateItemWithHiddenStatus(item) {
  if (!item || typeof item.path !== "string") {
    return item;
  }

  try {
    const status = await getHiddenStatus(item.path);

    if (!status.success) {
      return {
        ...item,
        hidden: false,
        system: false,
      };
    }

    return {
      ...item,
      hidden: status.hidden,
      system: status.system,
      readonly: status.readonly,
      archive: status.archive,
    };
  } catch {
    return {
      ...item,
      hidden: false,
      system: false,
    };
  }
}

/**
 * Add hidden/system information to multiple Explorer items.
 */
async function decorateItemsWithHiddenStatus(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const dirToItems = new Map();
  for (const item of items) {
    if (item && typeof item.path === "string") {
      const parentDir = path.dirname(item.path);
      const list = dirToItems.get(parentDir) || [];
      list.push(item);
      dirToItems.set(parentDir, list);
    }
  }

  const decoratedItems = [];

  for (const [parentDir, list] of dirToItems) {
    try {
      const attributesMap = await getDirectoryAttributes(parentDir);

      for (const item of list) {
        const attrs = attributesMap.get(item.path.toLowerCase());
        if (attrs) {
          decoratedItems.push({
            ...item,
            hidden: attrs.hidden,
            system: attrs.system,
            readonly: attrs.readonly,
            archive: attrs.archive,
          });
        } else {
          // Fallback
          const status = await getHiddenStatus(item.path);
          if (!status.success) {
            decoratedItems.push({
              ...item,
              hidden: false,
              system: false,
            });
          } else {
            decoratedItems.push({
              ...item,
              hidden: status.hidden,
              system: status.system,
              readonly: status.readonly,
              archive: status.archive,
            });
          }
        }
      }
    } catch {
      // In case of error, return item as undecorated
      for (const item of list) {
        decoratedItems.push({
          ...item,
          hidden: false,
          system: false,
        });
      }
    }
  }

  return decoratedItems;
}

/**
 * Public API
 */
module.exports = {
  getHiddenStatus,
  setHidden,
  toggleHidden,
  getHiddenStatuses,
  filterHiddenItems,
  getHiddenItems,
  decorateItemWithHiddenStatus,
  decorateItemsWithHiddenStatus,
  getDirectoryAttributes,
};

