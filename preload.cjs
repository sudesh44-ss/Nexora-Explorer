const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fileExplorer", {
  // ============================================================
  // Basic File Explorer
  // ============================================================

  getDrives: () => ipcRenderer.invoke("get-drives"),

  readDirectory: (path, showHidden = false) =>
  ipcRenderer.invoke(
    "read-directory",
    path,
    Boolean(showHidden),
  ),

  getFileInfo: (path) =>
    ipcRenderer.invoke("get-file-info", path),



  // ============================================================
  // Thumbnail UI
  // ============================================================

  getThumbnailDataURL: (filePath, options = {}) =>
    ipcRenderer.invoke(
      "thumbnail:get-data-url",
      filePath,
      options,
    ),

  isThumbnailSupported: (filePath) =>
    ipcRenderer.invoke(
      "thumbnail:is-supported",
      filePath,
    ),




// ============================================================
  // Details Pane
  // ============================================================

  getDetailsPaneData: (filePath) =>
    ipcRenderer.invoke(
      "details-pane:get",
      filePath,
    ),


    openItem: (itemPath) =>
  ipcRenderer.invoke("open-item", itemPath),


// ============================================================
// File Association Information
// ============================================================

getFileAssociation: (filePath) =>
  ipcRenderer.invoke(
    "file-association:get",
    filePath,
  ),

getRegisteredApplications: (extension) =>
  ipcRenderer.invoke(
    "file-association:get-registered",
    extension,
  ),


// ============================================================
  // File Association — Open With
  // ============================================================

  getOpenWithOptions: (filePath) =>
    ipcRenderer.invoke(
      "file-association:get-options",
      filePath,
    ),

  openWithOption: (filePath, option) =>
    ipcRenderer.invoke(
      "file-association:open-option",
      filePath,
      option,
    ),

  // ============================================================
  // Preview Pane
  // ============================================================

  getPreview: (filePath) =>
    ipcRenderer.invoke(
      "preview:get",
      filePath,
    ),

  getPreviewMetadata: (filePath) =>
    ipcRenderer.invoke(
      "preview:get-metadata",
      filePath,
    ),

  isPreviewSupported: (filePath) =>
    ipcRenderer.invoke(
      "preview:is-supported",
      filePath,
    ),


  getFolderSize: (path) =>
    ipcRenderer.invoke("get-folder-size", path),

  renameItem: (oldPath, newPath) =>
    ipcRenderer.invoke("rename-item", oldPath, newPath),

  deleteItem: (itemPath) =>
    ipcRenderer.invoke("delete-item", itemPath),

  copyItem: (sourcePath, destinationPath) =>
    ipcRenderer.invoke("copy-item", sourcePath, destinationPath),

  moveItem: (sourcePath, destinationPath) =>
    ipcRenderer.invoke("move-item", sourcePath, destinationPath),

  createItem: (parentPath, itemType) =>
    ipcRenderer.invoke("create-item", parentPath, itemType),

  // ============================================================
  // Search & Archive
  // ============================================================

  searchDirectory: (
    rootPath,
    query,
    filterType,
    showHidden = false,
    options = {}
  ) => {
    ipcRenderer.invoke("debug-log", {
      source: "Preload",
      message: "[Preload] searchDirectory",
      data: { rootPath, query, filterType, showHidden, options }
    }).catch(() => {});
    return ipcRenderer.invoke(
      "search-directory",
      rootPath,
      query,
      filterType,
      Boolean(showHidden),
      options
    );
  },

  createZip: (sourcePath, destinationZip) =>
    ipcRenderer.invoke(
      "create-zip",
      sourcePath,
      destinationZip,
    ),

  extractZip: (zipPath, destinationFolder) =>
    ipcRenderer.invoke(
      "extract-zip",
      zipPath,
      destinationFolder,
    ),

  createShortcut: (targetPath, shortcutPath) =>
    ipcRenderer.invoke(
      "create-shortcut",
      targetPath,
      shortcutPath,
    ),

  openTerminal: (folderPath) =>
    ipcRenderer.invoke("open-terminal", folderPath),

  getFilePermissions: (itemPath) =>
    ipcRenderer.invoke("get-file-permissions", itemPath),

  newWindow: (initialPath) =>
    ipcRenderer.invoke("new-window", initialPath),

  // ============================================================
  // Phase 4 — Advanced File Operations
  // ============================================================

  batchRename: (items, options) =>
    ipcRenderer.invoke("batch-rename", items, options),

  findDuplicates: (rootPath) =>
    ipcRenderer.invoke("find-duplicates", rootPath),

  findLargeFiles: (rootPath, minimumBytes) =>
    ipcRenderer.invoke(
      "find-large-files",
      rootPath,
      minimumBytes,
    ),

  findEmptyFolders: (rootPath) =>
    ipcRenderer.invoke("find-empty-folders", rootPath),

  compareFiles: (firstPath, secondPath, algorithm) =>
    ipcRenderer.invoke(
      "compare-files",
      firstPath,
      secondPath,
      algorithm,
    ),

  compareFolders: (firstPath, secondPath) =>
    ipcRenderer.invoke(
      "compare-folders",
      firstPath,
      secondPath,
    ),

  mergeFolders: (sourcePath, destinationPath, conflictMode) =>
    ipcRenderer.invoke(
      "merge-folders",
      sourcePath,
      destinationPath,
      conflictMode,
    ),

  queueTransfer: (options) =>
    ipcRenderer.invoke("queue-transfer", options),

  getTransferQueue: () =>
    ipcRenderer.invoke("get-transfer-queue"),

  pauseTransfer: (jobId) =>
    ipcRenderer.invoke("pause-transfer", jobId),

  resumeTransfer: (jobId) =>
    ipcRenderer.invoke("resume-transfer", jobId),

  cancelTransfer: (jobId) =>
    ipcRenderer.invoke("cancel-transfer", jobId),

  getFileHash: (filePath, algorithms) =>
    ipcRenderer.invoke(
      "get-file-hash",
      filePath,
      algorithms,
    ),

  verifyFileIntegrity: (filePath, expectedHash, algorithm) =>
    ipcRenderer.invoke(
      "verify-file-integrity",
      filePath,
      expectedHash,
      algorithm,
    ),

  // ============================================================
  // Transfer Progress Listener
  // ============================================================

  onTransferProgress: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const listener = (_event, progress) => {
      callback(progress);
    };

    ipcRenderer.on("transfer-progress", listener);

    return () => {
      ipcRenderer.removeListener(
        "transfer-progress",
        listener,
      );
    };
  },

  // ============================================================
  // Storage Management
  // ============================================================

  getDriveInventory: () =>
    ipcRenderer.invoke("storage:get-drive-inventory"),

  getDriveCapacity: (driveLetter) =>
    ipcRenderer.invoke(
      "storage:get-drive-capacity",
      driveLetter,
    ),

  getAllDriveCapacities: () =>
    ipcRenderer.invoke("storage:get-all-drive-capacities"),

  getDriveHealth: (deviceId) =>
    ipcRenderer.invoke(
      "storage:get-drive-health",
      deviceId,
    ),

  getAllDriveHealth: () =>
    ipcRenderer.invoke("storage:get-all-drive-health"),

  getFormatPreview: (options) =>
    ipcRenderer.invoke(
      "storage:get-format-preview",
      options,
    ),

  formatDrive: (options) =>
    ipcRenderer.invoke(
      "storage:format-drive",
      options,
    ),

  getDriveLabel: (driveLetter) =>
    ipcRenderer.invoke(
      "storage:get-drive-label",
      driveLetter,
    ),

  setDriveLabel: (options) =>
    ipcRenderer.invoke(
      "storage:set-drive-label",
      options,
    ),

  getAllDriveLabels: () =>
    ipcRenderer.invoke("storage:get-all-drive-labels"),

  getVolumeInfo: (driveLetter) =>
    ipcRenderer.invoke(
      "storage:get-volume-info",
      driveLetter,
    ),

  getAllVolumes: () =>
    ipcRenderer.invoke("storage:get-all-volumes"),

  mountDrive: (driveLetter, options = {}) =>
    ipcRenderer.invoke(
      "storage:mount-drive",
      driveLetter,
      options,
    ),

  unmountDrive: (driveLetter, options = {}) =>
    ipcRenderer.invoke(
      "storage:unmount-drive",
      driveLetter,
      options,
    ),

  getMountPreview: (driveLetter, action) =>
    ipcRenderer.invoke(
      "storage:get-mount-preview",
      driveLetter,
      action,
    ),

  getEjectPreview: (driveLetter) =>
    ipcRenderer.invoke(
      "storage:get-eject-preview",
      driveLetter,
    ),

  ejectDrive: (driveLetter, options = {}) =>
    ipcRenderer.invoke(
      "storage:eject-drive",
      driveLetter,
      options,
    ),

  getRemovableDrives: () =>
    ipcRenderer.invoke("storage:get-removable-drives"),

  // ============================================================
// Phase 5 — Hidden Files
// ============================================================

getHiddenStatus: (filePath) =>
  ipcRenderer.invoke(
    "hidden:get-status",
    filePath,
  ),

setHidden: (filePath, hidden = true) =>
  ipcRenderer.invoke(
    "hidden:set",
    filePath,
    Boolean(hidden),
  ),

toggleHidden: (filePath) =>
  ipcRenderer.invoke(
    "hidden:toggle",
    filePath,
  ),

getHiddenStatuses: (paths) =>
  ipcRenderer.invoke(
    "hidden:get-statuses",
    paths,
  ),

  chooseFolder: () =>
    ipcRenderer.invoke("choose-folder"),

  debugLog: (data) =>
    ipcRenderer.invoke("debug-log", data),

  resolveTransferConflict: (conflictId, options) =>
    ipcRenderer.invoke("resolve-transfer-conflict", conflictId, options),


  calculateHash: async (filePath, algorithm) => {
    const res = await ipcRenderer.invoke("get-file-hash", filePath, [algorithm]);
    if (res && res.success && res.hashes) {
      return {
        success: true,
        hash: res.hashes[algorithm.toLowerCase()]
      };
    }
    return res || { success: false, error: "Hash calculation failed." };
  },
});

require("./preload-features.cjs");
