const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const hiddenFiles = require("./electron/services/hiddenFiles.cjs");

const fileAssociation = require(
  "./electron/services/fileAssociation.cjs",
);
const thumbnailService = require(
  "./electron/services/thumbnailService.cjs",
);
const previewService = require("./electron/services/previewService.cjs");
const detailsService = require("./electron/services/detailsService.cjs");

// ============================================================
// Storage Management Services
// ============================================================

const driveDetection = require("./electron/services/storage/driveDetection.cjs");
const driveCapacity = require("./electron/services/storage/driveCapacity.cjs");
const driveHealth = require("./electron/services/storage/driveHealth.cjs");
const driveFormatting = require("./electron/services/storage/driveFormatting.cjs");
const driveLabel = require("./electron/services/storage/driveLabel.cjs");
const driveMount = require("./electron/services/storage/driveMount.cjs");
const safeEject = require("./electron/services/storage/safeEject.cjs");

function createWindow(initialPath = null) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.openDevTools();

  win.webContents.on("console-message", (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [Level ${level}] ${message} (at ${sourceId}:${line})`);
  });

  const hash = initialPath
    ? `#path=${encodeURIComponent(initialPath)}`
    : "";
  win.loadURL(`http://localhost:5173/${hash}`);
  return win;
}

// Get available drives
ipcMain.handle("get-drives", () => {
  const drives = [];

  for (let letter = 65; letter <= 90; letter++) {
    const driveLetter = String.fromCharCode(letter);
    const drivePath = `${driveLetter}:\\`;

    if (fs.existsSync(drivePath)) {
      drives.push({
        name: `Local Disk (${driveLetter}:)`,
        path: drivePath,
      });
    }
  }

  console.log("Detected drives:", drives);

  return drives;
});
// ============================================================
// Storage Management — Drive Detection
// ============================================================

ipcMain.handle(
  "storage:get-drive-inventory",
  async () => {
    try {
      return await driveDetection.getDriveInventory();
    } catch (error) {
      console.error(
        "Drive inventory failed:",
        error,
      );

      return {
        success: false,
        logicalDrives: [],
        physicalDrives: [],
        networkDrives: [],
        errors: {
          general: error.message,
        },
      };
    }
  },
);

// ============================================================
// Storage Management — Drive Capacity
// ============================================================

ipcMain.handle(
  "storage:get-drive-capacity",
  async (event, driveLetter) => {
    try {
      return await driveCapacity.getDriveCapacity(
        driveLetter,
      );
    } catch (error) {
      console.error(
        "Drive capacity failed:",
        error,
      );

      return {
        success: false,
        driveLetter,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — All Drive Capacities
// ============================================================

ipcMain.handle(
  "storage:get-all-drive-capacities",
  async () => {
    try {
      return await driveCapacity.getAllDriveCapacities();
    } catch (error) {
      console.error(
        "All drive capacities failed:",
        error,
      );

      return {
        success: false,
        drives: [],
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Drive Health
// ============================================================

ipcMain.handle(
  "storage:get-drive-health",
  async (event, deviceId) => {
    try {
      return await driveHealth.getDriveHealth(
        deviceId,
      );
    } catch (error) {
      console.error(
        "Drive health failed:",
        error,
      );

      return {
        success: false,
        deviceId,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — All Drive Health
// ============================================================

ipcMain.handle(
  "storage:get-all-drive-health",
  async () => {
    try {
      return await driveHealth.getAllDriveHealth();
    } catch (error) {
      console.error(
        "All drive health failed:",
        error,
      );

      return {
        success: false,
        drives: [],
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Format Preview
// ============================================================

ipcMain.handle(
  "storage:get-format-preview",
  async (event, options) => {
    try {
      return await driveFormatting.getFormatPreview(
        options,
      );
    } catch (error) {
      console.error(
        "Format preview failed:",
        error,
      );

      return {
        success: false,
        allowed: false,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Format Drive
// ============================================================

ipcMain.handle(
  "storage:format-drive",
  async (event, options) => {
    try {
      return await driveFormatting.formatDrive(
        options,
      );
    } catch (error) {
      console.error(
        "Drive formatting failed:",
        error,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Get Drive Label
// ============================================================

ipcMain.handle(
  "storage:get-drive-label",
  async (event, driveLetter) => {
    try {
      return await driveLabel.getDriveLabel(
        driveLetter,
      );
    } catch (error) {
      console.error(
        "Get drive label failed:",
        error,
      );

      return {
        success: false,
        driveLetter,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Set Drive Label
// ============================================================

ipcMain.handle(
  "storage:set-drive-label",
  async (event, options) => {
    try {
      return await driveLabel.setDriveLabel(
        options,
      );
    } catch (error) {
      console.error(
        "Set drive label failed:",
        error,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — All Drive Labels
// ============================================================

ipcMain.handle(
  "storage:get-all-drive-labels",
  async () => {
    try {
      return await driveLabel.getAllDriveLabels();
    } catch (error) {
      console.error(
        "Get all drive labels failed:",
        error,
      );

      return {
        success: false,
        drives: [],
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Volume Info
// ============================================================

ipcMain.handle(
  "storage:get-volume-info",
  async (event, driveLetter) => {
    try {
      return await driveMount.getVolumeInfo(
        driveLetter,
      );
    } catch (error) {
      console.error(
        "Get volume info failed:",
        error,
      );

      return {
        success: false,
        driveLetter,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — All Volumes
// ============================================================

ipcMain.handle(
  "storage:get-all-volumes",
  async () => {
    try {
      return await driveMount.getAllVolumes();
    } catch (error) {
      console.error(
        "Get all volumes failed:",
        error,
      );

      return {
        success: false,
        volumes: [],
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Mount / Online
// ============================================================

ipcMain.handle(
  "storage:mount-drive",
  async (event, driveLetter, options = {}) => {
    try {
      return await driveMount.mountDrive(
        driveLetter,
        options,
      );
    } catch (error) {
      console.error(
        "Mount drive failed:",
        error,
      );

      return {
        success: false,
        driveLetter,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Unmount / Offline
// ============================================================

ipcMain.handle(
  "storage:unmount-drive",
  async (event, driveLetter, options = {}) => {
    try {
      return await driveMount.unmountDrive(
        driveLetter,
        options,
      );
    } catch (error) {
      console.error(
        "Unmount drive failed:",
        error,
      );

      return {
        success: false,
        driveLetter,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Mount Preview
// ============================================================

ipcMain.handle(
  "storage:get-mount-preview",
  async (event, driveLetter, action) => {
    try {
      return await driveMount.getMountPreview(
        driveLetter,
        action,
      );
    } catch (error) {
      console.error(
        "Mount preview failed:",
        error,
      );

      return {
        success: false,
        allowed: false,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Eject Preview
// ============================================================

ipcMain.handle(
  "storage:get-eject-preview",
  async (event, driveLetter) => {
    try {
      return await safeEject.getEjectPreview(
        driveLetter,
      );
    } catch (error) {
      console.error(
        "Eject preview failed:",
        error,
      );

      return {
        success: false,
        allowed: false,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Safe Eject
// ============================================================

ipcMain.handle(
  "storage:eject-drive",
  async (event, driveLetter, options = {}) => {
    try {
      return await safeEject.ejectDrive(
        driveLetter,
        options,
      );
    } catch (error) {
      console.error(
        "Safe eject failed:",
        error,
      );

      return {
        success: false,
        driveLetter,
        error: error.message,
      };
    }
  },
);

// ============================================================
// Storage Management — Removable Drives
// ============================================================

ipcMain.handle(
  "storage:get-removable-drives",
  async () => {
    try {
      return await safeEject.getRemovableDrives();
    } catch (error) {
      console.error(
        "Get removable drives failed:",
        error,
      );

      return {
        success: false,
        drives: [],
        error: error.message,
      };
    }
  },
);
// ============================================================
// Basic File Explorer — File Operations
// ============================================================

// Read files and folders
// NOTE: ab har item ke saath size + modified date bhi bhej rahe hain,
// taaki frontend Sort (name/size/type/date) aur List/Details view dikha sake.
// Folder ka "size" yahan nahi nikalte (bahut slow ho sakta hai bade folders ke liye) -
// woh Properties dialog khulne par "get-folder-size" se alag se calculate hota hai.
ipcMain.handle(
  "read-directory",
  async (event, directoryPath, showHidden = false) => {
    try {
      const entries = await fs.promises.readdir(directoryPath, {
        withFileTypes: true,
      });

      const items = await Promise.all(
        entries.map(async (entry) => {
          const itemPath = path.join(directoryPath, entry.name);
          const isDirectory = entry.isDirectory();

          let size = null;
          let modified = null;

          try {
            const stats = await fs.promises.stat(itemPath);

            modified = stats.mtime.toISOString();
            size = isDirectory ? null : stats.size;
          } catch {
            // Permission issue / broken link.
          }

          return {
            name: entry.name,
            isDirectory,
            path: itemPath,
            size,
            modified,
          };
        }),
      );

      return await hiddenFiles.decorateItemsWithHiddenStatus(
        await hiddenFiles.filterHiddenItems(
          items,
          Boolean(showHidden),
        ),
      );
    } catch (error) {
      return {
        error: error.message,
      };
    }
  },
);



// Get file/folder information
ipcMain.handle("get-file-info", async (event, filePath) => {
  try {
    const stats = await fs.promises.stat(filePath);

    const isDirectory = stats.isDirectory();

    return {
      name: path.basename(filePath),
      path: filePath,
      type: isDirectory
        ? "Folder"
        : path.extname(filePath).toUpperCase() || "File",
      isDirectory,

      size: stats.size,

      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      accessed: stats.atime.toISOString(),
    };
  } catch (error) {
    return {
      error: error.message,
    };
  }
});



// ============================================================
// Thumbnail UI
// ============================================================

ipcMain.handle(
  "thumbnail:get-data-url",
  async (event, filePath, options = {}) => {
    try {
      return await thumbnailService.generateThumbnailDataURL(
        filePath,
        options,
      );
    } catch (error) {
      console.error(
        "Thumbnail generation failed:",
        error,
      );

      return {
        success: false,
        path: filePath,
        error: error.message,
      };
    }
  },
);

ipcMain.handle(
  "thumbnail:is-supported",
  async (event, filePath) => {
    try {
      return {
        success: true,
        supported:
          thumbnailService.isThumbnailSupported(
            filePath,
          ),
      };
    } catch (error) {
      console.error(
        "Thumbnail support check failed:",
        error,
      );

      return {
        success: false,
        supported: false,
        error: error.message,
      };
    }
  },
);







// ============================================================
// Details Pane
// ============================================================

ipcMain.handle(
  "details-pane:get",
  async (event, filePath) => {
    try {
      return await detailsService.getDetailsPaneData(
        filePath,
      );
    } catch (error) {
      console.error(
        "Details pane failed:",
        error,
      );

      return {
        success: false,
        path: filePath,
        error: error.message,
      };
    }
  },
);





// ============================================================
// Preview Pane
// ============================================================

ipcMain.handle(
  "preview:get",
  async (event, filePath) => {
    try {
      return await previewService.getPreview(filePath);
    } catch (error) {
      console.error(
        "Preview failed:",
        error,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  },
);

ipcMain.handle(
  "preview:get-metadata",
  async (event, filePath) => {
    try {
      return await previewService.getPreviewMetadata(
        filePath,
      );
    } catch (error) {
      console.error(
        "Preview metadata failed:",
        error,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  },
);

ipcMain.handle(
  "preview:is-supported",
  async (event, filePath) => {
    try {
      return {
        success: true,
        supported:
          previewService.isPreviewSupported(
            filePath,
          ),
      };
    } catch (error) {
      console.error(
        "Preview support check failed:",
        error,
      );

      return {
        success: false,
        supported: false,
        error: error.message,
      };
    }
  },
);



// Recursively calculate a folder's total size (files + subfolder count)
// Isse Properties dialog me folder ka size dikha sakte hain, jaisa Windows
// Explorer "Calculating size..." dikha kar karta hai.
ipcMain.handle("get-folder-size", async (event, folderPath) => {
  try {
    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;

    async function walk(currentPath) {
      const entries = await fs.promises.readdir(currentPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          folderCount++;
          await walk(entryPath);
        } else {
          try {
            const stats = await fs.promises.stat(entryPath);

            totalSize += stats.size;
            fileCount++;
          } catch (statError) {
            // Skip files hum read nahi kar paaye (permissions, etc.)
          }
        }
      }
    }

    await walk(folderPath);

    return {
      success: true,
      size: totalSize,
      fileCount,
      folderCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

// ============================================================
// Application Lifecycle
// ============================================================

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Rename file or folder
ipcMain.handle("rename-item", async (event, oldPath, newPath) => {
  try {
    await fs.promises.rename(oldPath, newPath);

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
});

// Move file/folder to Recycle Bin
ipcMain.handle("delete-item", async (event, itemPath) => {
  console.log("DELETE REQUEST RECEIVED:", itemPath);

  try {
    console.log("Sending to Recycle Bin...");

    await shell.trashItem(itemPath);

    console.log("DELETE SUCCESS:", itemPath);

    return {
      success: true,
    };
  } catch (error) {
    console.error("DELETE ERROR:", error);

    return {
      success: false,
      error: error.message,
    };
  }
});

// Open file with default Windows application
ipcMain.handle("open-item", async (event, itemPath) => {
  try {
    if (fs.existsSync(itemPath)) {
      const error = await shell.openPath(itemPath);

      if (error) {
        return {
          success: false,
          error,
        };
      }

      return {
        success: true,
      };
    }

    return {
      success: false,
      error: "File or folder does not exist.",
    };
  } catch (error) {
    console.error("Open failed:", error);

    return {
      success: false,
      error: error.message,
    };
  }
});


ipcMain.handle("choose-folder", async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }
    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    console.error("Choose folder dialog failed:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("resolve-transfer-conflict", async (event, conflictId, options) => {
  return { success: true };
});


// ============================================================
// File Association — Open With
// ============================================================

ipcMain.handle(
  "file-association:get-options",
  async (event, filePath) => {
    try {
      return await fileAssociation.getOpenWithOptions(
        filePath,
      );
    } catch (error) {
      console.error(
        "Get Open With options failed:",
        error,
      );

      return {
        success: false,
        path: filePath,
        options: [],
        error: error.message,
      };
    }
  },
);

ipcMain.handle(
  "file-association:open-option",
  async (event, filePath, option) => {
    try {
      return await fileAssociation.openWithOption(
        filePath,
        option,
      );
    } catch (error) {
      console.error(
        "Open With failed:",
        error,
      );

      return {
        success: false,
        path: filePath,
        error: error.message,
      };
    }
  },
);




// ============================================================
// File Association Information
// ============================================================

ipcMain.handle(
  "file-association:get",
  async (event, filePath) => {
    try {
      return await fileAssociation.getFileAssociation(
        filePath,
      );
    } catch (error) {
      console.error(
        "File association lookup failed:",
        error,
      );

      return {
        success: false,
        path: filePath,
        error: error.message,
      };
    }
  },
);

ipcMain.handle(
  "file-association:get-registered",
  async (event, extension) => {
    try {
      return await fileAssociation.getRegisteredApplications(
        extension,
      );
    } catch (error) {
      console.error(
        "Registered applications lookup failed:",
        error,
      );

      return {
        success: false,
        extension,
        applications: [],
        error: error.message,
      };
    }
  },
);




// Copy file or folder
ipcMain.handle("copy-item", async (event, sourcePath, destinationPath) => {
  try {
    await fs.promises.cp(sourcePath, destinationPath, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Copy failed:", error);

    return {
      success: false,
      error: error.message,
    };
  }
});

// Move file or folder
ipcMain.handle("move-item", async (event, sourcePath, destinationPath) => {
  try {
    await fs.promises.rename(sourcePath, destinationPath);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Move failed:", error);

    return {
      success: false,
      error: error.message,
    };
  }
});

// Create new file or folder
ipcMain.handle("create-item", async (event, parentPath, itemType) => {
  try {
    let baseName;
    let extension = "";

    if (itemType === "folder") {
      baseName = "New folder";
    } else if (itemType === "text") {
      baseName = "New Text Document";
      extension = ".txt";
    } else {
      throw new Error("Unknown item type.");
    }

    let counter = 0;
    let itemPath;

    while (true) {
      const suffix = counter === 0 ? "" : ` (${counter + 1})`;

      itemPath = path.join(parentPath, `${baseName}${suffix}${extension}`);

      if (!fs.existsSync(itemPath)) {
        break;
      }

      counter++;
    }

    if (itemType === "folder") {
      await fs.promises.mkdir(itemPath);
    } else {
      await fs.promises.writeFile(itemPath, "", "utf8");
    }

    return {
      success: true,
      path: itemPath,
      name: path.basename(itemPath),
    };
  } catch (error) {
    console.error("Create item failed:", error);

    return {
      success: false,
      error: error.message,
    };
  }
});

// =============================
// Phase 2 — Advanced File Explorer Features
// =============================

// Recursive search with optional type filter.
ipcMain.handle("search-directory", async (event, rootPath, query, filterType = "all", showHidden = false) => {
  try {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!rootPath || !normalizedQuery) return [];

    const imageExt = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".ico"];
    const videoExt = [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm", ".m4v"];
    const audioExt = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"];
    const documentExt = [".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".rtf"];
    const archiveExt = [".zip", ".rar", ".7z", ".tar", ".gz"];

    const matchesFilter = (item) => {
      if (filterType === "all") return true;
      if (filterType === "folder") return item.isDirectory;
      if (item.isDirectory) return false;

      const ext = path.extname(item.name).toLowerCase();
      if (filterType === "image") return imageExt.includes(ext);
      if (filterType === "video") return videoExt.includes(ext);
      if (filterType === "audio") return audioExt.includes(ext);
      if (filterType === "document") return documentExt.includes(ext);
      if (filterType === "archive") return archiveExt.includes(ext);
      return true;
    };

    const results = [];
    const pending = [rootPath];

    while (pending.length && results.length < 5000) {
      const current = pending.pop();

      let entries;
      try {
        entries = await fs.promises.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const itemPath = path.join(current, entry.name);
        const isDirectory = entry.isDirectory();

        if (isDirectory) pending.push(itemPath);

        if (!entry.name.toLowerCase().includes(normalizedQuery)) continue;
        if (!matchesFilter({ name: entry.name, isDirectory })) continue;

        let size = null;
        let modified = null;
        try {
          const stats = await fs.promises.stat(itemPath);
          modified = stats.mtime.toISOString();
          size = isDirectory ? null : stats.size;
        } catch {}

        results.push({
          name: entry.name,
          isDirectory,
          path: itemPath,
          size,
          modified,
        });

        if (results.length >= 5000) break;
      }
    }

    return await hiddenFiles.decorateItemsWithHiddenStatus(
      await hiddenFiles.filterHiddenItems(
        results,
        Boolean(showHidden),
      ),
    );
  } catch (error) {
    return { error: error.message };
  }
});

// Create a ZIP archive using Windows PowerShell (no npm package required).
ipcMain.handle("create-zip", async (event, sourcePath, destinationZip) => {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: "Source does not exist." };
    }

    const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const command = `Compress-Archive -LiteralPath ${psQuote(sourcePath)} -DestinationPath ${psQuote(destinationZip)} -Force`;
    const result = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      command,
    ], { windowsHide: true });

    const code = await new Promise((resolve) => result.on("close", resolve));
    if (code !== 0) {
      return { success: false, error: "Failed to create ZIP archive." };
    }

    return { success: true, path: destinationZip };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Extract a ZIP archive using Windows PowerShell.
ipcMain.handle("extract-zip", async (event, zipPath, destinationFolder) => {
  try {
    if (!fs.existsSync(zipPath)) {
      return { success: false, error: "ZIP file does not exist." };
    }

    await fs.promises.mkdir(destinationFolder, { recursive: true });

    const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const command = `Expand-Archive -LiteralPath ${psQuote(zipPath)} -DestinationPath ${psQuote(destinationFolder)} -Force`;
    const result = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      command,
    ], { windowsHide: true });

    const code = await new Promise((resolve) => result.on("close", resolve));
    if (code !== 0) {
      return { success: false, error: "Failed to extract ZIP archive." };
    }

    return { success: true, path: destinationFolder };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create a Windows .lnk shortcut.
ipcMain.handle("create-shortcut", async (event, targetPath, shortcutPath) => {
  try {
    if (!fs.existsSync(targetPath)) {
      return { success: false, error: "Target does not exist." };
    }

    const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const workingDirectory = path.dirname(targetPath);
    const command =
      `$ws = New-Object -ComObject WScript.Shell; ` +
      `$sc = $ws.CreateShortcut(${psQuote(shortcutPath)}); ` +
      `$sc.TargetPath = ${psQuote(targetPath)}; ` +
      `$sc.WorkingDirectory = ${psQuote(workingDirectory)}; ` +
      `$sc.Save()`;

    const result = spawn("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      command,
    ], { windowsHide: true });

    const code = await new Promise((resolve) => result.on("close", resolve));
    if (code !== 0) {
      return { success: false, error: "Failed to create shortcut." };
    }

    return { success: true, path: shortcutPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open a Windows Terminal/Command Prompt at a folder.
ipcMain.handle("open-terminal", async (event, folderPath) => {
  try {
    const target = folderPath && fs.existsSync(folderPath) ? folderPath : process.env.USERPROFILE;
    const child = spawn("cmd.exe", ["/K", `cd /d "${target}"`], {
      detached: true,
      windowsHide: false,
      stdio: "ignore",
    });
    child.unref();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Basic access/permission diagnostics. The actual Windows ACL remains controlled by Windows.
ipcMain.handle("get-file-permissions", async (event, itemPath) => {
  try {
    const readable = await fs.promises.access(itemPath, fs.constants.R_OK).then(() => true).catch(() => false);
    const writable = await fs.promises.access(itemPath, fs.constants.W_OK).then(() => true).catch(() => false);

    return {
      success: true,
      path: itemPath,
      readable,
      writable,
      access: readable && writable ? "Read / Write" : readable ? "Read only" : "Access denied",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// =============================
// Phase 4 — Advanced File Operations
// =============================

// Transfer queue state is kept in the Electron main process so copy/move jobs
// continue to be managed independently from React UI state.
const transferQueue = [];
const transferJobs = new Map();
let transferWorkerRunning = false;
let transferJobCounter = 0;

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function sendTransferEvent(job, payload = {}) {
  const win = job.window;
  if (win && !win.isDestroyed()) {
    win.webContents.send("transfer-progress", {
      jobId: job.id,
      ...payload,
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitIfPaused(job) {
  while (job.state === "paused") {
    await sleep(100);
  }
  if (job.state === "cancelled") {
    const error = new Error("Transfer cancelled.");
    error.code = "TRANSFER_CANCELLED";
    throw error;
  }
}

function makeUniquePath(targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath;

  const parsed = path.parse(targetPath);
  let counter = 1;
  let candidate;

  do {
    candidate = path.join(
      parsed.dir,
      `${parsed.name} (${counter})${parsed.ext}`,
    );
    counter++;
  } while (fs.existsSync(candidate));

  return candidate;
}

async function getDirectoryTotalSize(rootPath) {
  const stat = await fs.promises.stat(rootPath);
  if (!stat.isDirectory()) return stat.size;

  let total = 0;
  const stack = [rootPath];

  while (stack.length) {
    const current = stack.pop();
    let entries;

    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else {
        try {
          total += (await fs.promises.stat(entryPath)).size;
        } catch {}
      }
    }
  }

  return total;
}

async function collectFiles(rootPath) {
  const result = [];
  const stat = await fs.promises.stat(rootPath);

  if (!stat.isDirectory()) {
    result.push(rootPath);
    return result;
  }

  const stack = [rootPath];
  while (stack.length) {
    const current = stack.pop();
    let entries;

    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(entryPath);
      else result.push(entryPath);
    }
  }

  return result;
}

async function hashFile(filePath, algorithm = "sha256", job = null) {
  const crypto = require("crypto");
  const hash = crypto.createHash(algorithm);
  const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });

  return new Promise((resolve, reject) => {
    stream.on("data", async (chunk) => {
      stream.pause();
      try {
        if (job) await waitIfPaused(job);
        hash.update(chunk);
        stream.resume();
      } catch (error) {
        stream.destroy(error);
      }
    });

    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function copyFileWithProgress(sourcePath, destinationPath, job) {
  const sourceStat = await fs.promises.stat(sourcePath);
  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const reader = fs.createReadStream(sourcePath, { highWaterMark: 1024 * 1024 });
    const writer = fs.createWriteStream(destinationPath);
    let copied = 0;
    let lastUpdate = Date.now();
    let lastBytes = 0;

    const fail = (error) => {
      reader.destroy();
      writer.destroy();
      reject(error);
    };

    reader.on("error", fail);
    writer.on("error", fail);

    reader.on("data", async (chunk) => {
      reader.pause();

      try {
        await waitIfPaused(job);
        writer.write(chunk);
        copied += chunk.length;

        const now = Date.now();
        if (now - lastUpdate >= 150 || copied === sourceStat.size) {
          const elapsed = Math.max((now - lastUpdate) / 1000, 0.001);
          const speed = (copied - lastBytes) / elapsed;
          lastUpdate = now;
          lastBytes = copied;

          sendTransferEvent(job, {
            state: "running",
            currentFile: sourcePath,
            copiedBytes: copied,
            totalBytes: job.totalBytes,
            speed,
            percent: job.totalBytes
              ? Math.min(100, (job.completedBytes + copied) / job.totalBytes * 100)
              : 100,
          });
        }

        reader.resume();
      } catch (error) {
        fail(error);
      }
    });

    reader.on("end", () => {
      writer.end();
    });

    writer.on("finish", async () => {
      try {
        await fs.promises.utimes(
          destinationPath,
          sourceStat.atime,
          sourceStat.mtime,
        ).catch(() => {});
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function copyPathWithProgress(sourcePath, destinationPath, job) {
  const stat = await fs.promises.stat(sourcePath);

  if (!stat.isDirectory()) {
    await copyFileWithProgress(sourcePath, destinationPath, job);
    job.completedBytes += stat.size;
    sendTransferEvent(job, {
      state: "running",
      currentFile: sourcePath,
      copiedBytes: 0,
      totalBytes: job.totalBytes,
      speed: 0,
      percent: job.totalBytes
        ? Math.min(100, job.completedBytes / job.totalBytes * 100)
        : 100,
    });
    return;
  }

  await fs.promises.mkdir(destinationPath, { recursive: true });
  const entries = await fs.promises.readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    await waitIfPaused(job);
    await copyPathWithProgress(
      path.join(sourcePath, entry.name),
      path.join(destinationPath, entry.name),
      job,
    );
  }
}

async function resolveConflict(sourcePath, destinationPath, mode) {
  if (!fs.existsSync(destinationPath)) return destinationPath;

  if (mode === "skip") return null;
  if (mode === "replace") {
    await fs.promises.rm(destinationPath, { recursive: true, force: true });
    return destinationPath;
  }

  return makeUniquePath(destinationPath);
}

async function runTransferJob(job) {
  job.state = "running";
  job.startedAt = Date.now();
  job.completedBytes = 0;
  job.totalBytes = 0;

  try {
    for (const sourcePath of job.sources) {
      if (!fs.existsSync(sourcePath)) continue;
      job.totalBytes += await getDirectoryTotalSize(sourcePath);
    }

    sendTransferEvent(job, {
      state: "running",
      totalBytes: job.totalBytes,
      completedBytes: 0,
      percent: 0,
      speed: 0,
    });

    for (const sourcePath of job.sources) {
      await waitIfPaused(job);

      const itemName = path.basename(sourcePath);
      const requestedDestination = path.join(job.destination, itemName);
      const targetPath = await resolveConflict(
        sourcePath,
        requestedDestination,
        job.conflictMode,
      );

      if (!targetPath) continue;

      await copyPathWithProgress(sourcePath, targetPath, job);

      if (job.operation === "move") {
        await fs.promises.rm(sourcePath, { recursive: true, force: true });
      }
    }

    job.state = "completed";
    sendTransferEvent(job, {
      state: "completed",
      totalBytes: job.totalBytes,
      completedBytes: job.totalBytes,
      percent: 100,
      speed: 0,
    });
  } catch (error) {
    if (error.code === "TRANSFER_CANCELLED") {
      job.state = "cancelled";
      sendTransferEvent(job, { state: "cancelled", error: error.message });
    } else {
      job.state = "error";
      job.error = error.message;
      sendTransferEvent(job, { state: "error", error: error.message });
    }
  }
}

async function processTransferQueue() {
  if (transferWorkerRunning) return;
  transferWorkerRunning = true;

  try {
    while (transferQueue.length) {
      const job = transferQueue.shift();
      if (!job || job.state === "cancelled") continue;
      await runTransferJob(job);
    }
  } finally {
    transferWorkerRunning = false;
  }
}

ipcMain.handle("batch-rename", async (event, items, options = {}) => {
  try {
    const prefix = String(options.prefix || "");
    const suffix = String(options.suffix || "");
    const pattern = String(options.pattern || "");
    const startNumber = Number.isFinite(Number(options.startNumber))
      ? Number(options.startNumber)
      : 1;

    const results = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item?.path) continue;

      const parsed = path.parse(item.path);
      let baseName = parsed.name;

      if (pattern) {
        baseName = pattern
          .replace(/\{name\}/gi, parsed.name)
          .replace(/\{n\}/gi, String(startNumber + index));
      }

      const newName = `${prefix}${baseName}${suffix}${parsed.ext}`;
      const newPath = path.join(parsed.dir, newName);

      if (path.resolve(item.path) === path.resolve(newPath)) {
        results.push({ oldPath: item.path, newPath, success: true });
        continue;
      }

      if (fs.existsSync(newPath)) {
        results.push({
          oldPath: item.path,
          newPath,
          success: false,
          error: "Destination already exists.",
        });
        continue;
      }

      await fs.promises.rename(item.path, newPath);
      results.push({ oldPath: item.path, newPath, success: true });
    }

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("find-duplicates", async (event, rootPath) => {
  try {
    const files = await collectFiles(rootPath);
    const bySize = new Map();

    for (const filePath of files) {
      try {
        const size = (await fs.promises.stat(filePath)).size;
        const list = bySize.get(size) || [];
        list.push(filePath);
        bySize.set(size, list);
      } catch {}
    }

    const groups = [];

    for (const [size, candidates] of bySize) {
      if (candidates.length < 2) continue;

      const byHash = new Map();
      for (const filePath of candidates) {
        try {
          const hash = await hashFile(filePath, "sha256");
          const list = byHash.get(hash) || [];
          list.push(filePath);
          byHash.set(hash, list);
        } catch {}
      }

      for (const [hash, paths] of byHash) {
        if (paths.length > 1) groups.push({ size, hash, paths });
      }
    }

    return { success: true, groups };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("find-large-files", async (event, rootPath, minimumBytes = 100 * 1024 * 1024) => {
  try {
    const files = await collectFiles(rootPath);
    const results = [];
    const threshold = Math.max(0, Number(minimumBytes) || 0);

    for (const filePath of files) {
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.size >= threshold) {
          results.push({
            path: filePath,
            name: path.basename(filePath),
            size: stat.size,
            modified: stat.mtime.toISOString(),
          });
        }
      } catch {}
    }

    results.sort((a, b) => b.size - a.size);
    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("find-empty-folders", async (event, rootPath) => {
  try {
    const results = [];
    const stack = [rootPath];

    while (stack.length) {
      const current = stack.pop();
      let entries;

      try {
        entries = await fs.promises.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }

      let hasChildren = false;
      for (const entry of entries) {
        hasChildren = true;
        if (entry.isDirectory()) stack.push(path.join(current, entry.name));
      }

      if (!hasChildren) {
        results.push({ path: current, name: path.basename(current) });
      }
    }

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("compare-files", async (event, firstPath, secondPath, algorithm = "sha256") => {
  try {
    const firstStat = await fs.promises.stat(firstPath);
    const secondStat = await fs.promises.stat(secondPath);

    if (firstStat.isDirectory() || secondStat.isDirectory()) {
      return { success: false, error: "File comparison requires two files." };
    }

    if (firstStat.size !== secondStat.size) {
      return {
        success: true,
        identical: false,
        reason: "size",
        firstSize: firstStat.size,
        secondSize: secondStat.size,
      };
    }

    const firstHash = await hashFile(firstPath, algorithm);
    const secondHash = await hashFile(secondPath, algorithm);

    return {
      success: true,
      identical: firstHash === secondHash,
      algorithm,
      firstHash,
      secondHash,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

async function buildFolderMap(rootPath) {
  const map = new Map();
  const files = await collectFiles(rootPath);

  for (const filePath of files) {
    const relative = path.relative(rootPath, filePath);
    try {
      const stat = await fs.promises.stat(filePath);
      map.set(relative.toLowerCase(), {
        relative,
        path: filePath,
        size: stat.size,
      });
    } catch {}
  }

  return map;
}

ipcMain.handle("compare-folders", async (event, firstPath, secondPath) => {
  try {
    const [firstMap, secondMap] = await Promise.all([
      buildFolderMap(firstPath),
      buildFolderMap(secondPath),
    ]);

    const onlyInFirst = [];
    const onlyInSecond = [];
    const different = [];
    const same = [];

    for (const [key, first] of firstMap) {
      if (!secondMap.has(key)) {
        onlyInFirst.push(first.relative);
        continue;
      }

      const second = secondMap.get(key);
      if (first.size !== second.size) {
        different.push(first.relative);
        continue;
      }

      try {
        const [hashA, hashB] = await Promise.all([
          hashFile(first.path, "sha256"),
          hashFile(second.path, "sha256"),
        ]);
        if (hashA === hashB) same.push(first.relative);
        else different.push(first.relative);
      } catch {
        different.push(first.relative);
      }
    }

    for (const [key, second] of secondMap) {
      if (!firstMap.has(key)) onlyInSecond.push(second.relative);
    }

    return {
      success: true,
      onlyInFirst,
      onlyInSecond,
      different,
      same,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("merge-folders", async (event, sourcePath, destinationPath, conflictMode = "keep-both") => {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: "Source folder does not exist." };
    }
    await fs.promises.mkdir(destinationPath, { recursive: true });

    const job = {
      id: `merge-${++transferJobCounter}`,
      window: getSenderWindow(event),
      sources: [sourcePath],
      destination: destinationPath,
      operation: "copy",
      conflictMode,
      state: "running",
      totalBytes: await getDirectoryTotalSize(sourcePath),
      completedBytes: 0,
    };

    await copyPathWithProgress(job.sources[0], destinationPath, job);

    return { success: true, path: destinationPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("queue-transfer", async (event, options = {}) => {
  try {
    const sources = Array.isArray(options.sources) ? options.sources.filter(Boolean) : [];
    if (!sources.length) return { success: false, error: "No source files selected." };
    if (!options.destination) return { success: false, error: "Destination is required." };

    const job = {
      id: `transfer-${++transferJobCounter}`,
      window: getSenderWindow(event),
      sources,
      destination: options.destination,
      operation: options.operation === "move" ? "move" : "copy",
      conflictMode: ["replace", "skip", "keep-both"].includes(options.conflictMode)
        ? options.conflictMode
        : "keep-both",
      state: "queued",
      totalBytes: 0,
      completedBytes: 0,
      speed: 0,
    };

    transferJobs.set(job.id, job);
    transferQueue.push(job);
    sendTransferEvent(job, { state: "queued", percent: 0, speed: 0 });
    processTransferQueue();

    return { success: true, jobId: job.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-transfer-queue", () => {
  return Array.from(transferJobs.values()).map((job) => ({
    id: job.id,
    sources: job.sources,
    destination: job.destination,
    operation: job.operation,
    conflictMode: job.conflictMode,
    state: job.state,
    totalBytes: job.totalBytes,
    completedBytes: job.completedBytes,
    percent: job.totalBytes
      ? Math.min(100, job.completedBytes / job.totalBytes * 100)
      : 0,
  }));
});

ipcMain.handle("pause-transfer", async (event, jobId) => {
  const job = transferJobs.get(jobId);
  if (!job || job.state !== "running") {
    return { success: false, error: "Transfer is not running." };
  }
  job.state = "paused";
  sendTransferEvent(job, { state: "paused" });
  return { success: true };
});

ipcMain.handle("resume-transfer", async (event, jobId) => {
  const job = transferJobs.get(jobId);
  if (!job || job.state !== "paused") {
    return { success: false, error: "Transfer is not paused." };
  }
  job.state = "running";
  sendTransferEvent(job, { state: "running" });
  return { success: true };
});

ipcMain.handle("cancel-transfer", async (event, jobId) => {
  const job = transferJobs.get(jobId);
  if (!job) return { success: false, error: "Transfer not found." };

  job.state = "cancelled";
  sendTransferEvent(job, { state: "cancelled" });
  return { success: true };
});

ipcMain.handle("get-file-hash", async (event, filePath, algorithms = ["md5", "sha1", "sha256"]) => {
  try {
    const supported = ["md5", "sha1", "sha256"];
    const requested = Array.isArray(algorithms)
      ? algorithms.filter((algorithm) => supported.includes(String(algorithm).toLowerCase()))
      : supported;

    const hashes = {};
    for (const algorithm of requested) {
      hashes[algorithm] = await hashFile(filePath, algorithm);
    }

    return { success: true, path: filePath, hashes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("verify-file-integrity", async (event, filePath, expectedHash, algorithm = "sha256") => {
  try {
    const supported = ["md5", "sha1", "sha256"];
    const normalizedAlgorithm = String(algorithm).toLowerCase();
    if (!supported.includes(normalizedAlgorithm)) {
      return { success: false, error: "Unsupported hash algorithm." };
    }

    const actualHash = await hashFile(filePath, normalizedAlgorithm);
    const expected = String(expectedHash || "").trim().toLowerCase();
    const verified = Boolean(expected) && actualHash.toLowerCase() === expected;

    return {
      success: true,
      verified,
      algorithm: normalizedAlgorithm,
      expectedHash: expected,
      actualHash,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open a second Explorer window.
ipcMain.handle("new-window", async (event, initialPath = null) => {
  try {
    createWindow(initialPath || null);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


// ============================================================
// Phase 5 — Hidden Files IPC
// ============================================================

ipcMain.handle(
  "hidden:get-status",
  async (event, filePath) => {
    return hiddenFiles.getHiddenStatus(filePath);
  },
);

ipcMain.handle(
  "hidden:set",
  async (event, filePath, hidden = true) => {
    return hiddenFiles.setHidden(
      filePath,
      Boolean(hidden),
    );
  },
);

ipcMain.handle(
  "hidden:toggle",
  async (event, filePath) => {
    return hiddenFiles.toggleHidden(filePath);
  },
);

ipcMain.handle(
  "hidden:get-statuses",
  async (event, paths) => {
    return hiddenFiles.getHiddenStatuses(paths);
  },
);