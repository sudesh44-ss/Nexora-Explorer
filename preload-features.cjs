// ============================================================
// preload-features.cjs
// Secure bridge for new Electron features
// ============================================================

const {
  contextBridge,
  ipcRenderer,
} = require("electron");

// ============================================================
// Helper
// ============================================================

function invoke(channel, ...args) {
  return ipcRenderer.invoke(
    channel,
    ...args,
  );
}

// ============================================================
// Feature API
// ============================================================

const featureAPI = {

  // ----------------------------------------------------------
  // Advanced Search / File Operations
  // ----------------------------------------------------------

  batchRename: (
    items,
    options = {},
  ) => {
    return invoke(
      "batch-rename",
      items,
      options,
    );
  },

  findDuplicates: (
    rootPath,
  ) => {
    return invoke(
      "find-duplicates",
      rootPath,
    );
  },

  findLargeFiles: (
    rootPath,
    minimumBytes,
  ) => {
    return invoke(
      "find-large-files",
      rootPath,
      minimumBytes,
    );
  },

  findEmptyFolders: (
    rootPath,
  ) => {
    return invoke(
      "find-empty-folders",
      rootPath,
    );
  },

  compareFiles: (
    firstPath,
    secondPath,
    algorithm = "sha256",
  ) => {
    return invoke(
      "compare-files",
      firstPath,
      secondPath,
      algorithm,
    );
  },

  compareFolders: (
    firstPath,
    secondPath,
  ) => {
    return invoke(
      "compare-folders",
      firstPath,
      secondPath,
    );
  },

  mergeFolders: (
    sourcePath,
    destinationPath,
    conflictMode = "skip",
  ) => {
    return invoke(
      "merge-folders",
      sourcePath,
      destinationPath,
      conflictMode,
    );
  },

  // ----------------------------------------------------------
  // File Hash / Security
  // ----------------------------------------------------------

  getFileHash: (
    filePath,
    algorithms = ["sha256"],
  ) => {
    return invoke(
      "get-file-hash",
      filePath,
      algorithms,
    );
  },

  verifyFileIntegrity: (
    filePath,
    expectedHash,
    algorithm = "sha256",
  ) => {
    return invoke(
      "verify-file-integrity",
      filePath,
      expectedHash,
      algorithm,
    );
  },

  // ----------------------------------------------------------
  // Advanced File Information
  // ----------------------------------------------------------

  getAdvancedFileInfo: (
    filePath,
  ) => {
    return invoke(
      "get-advanced-file-info",
      filePath,
    );
  },

  // ----------------------------------------------------------
  // Transfer Manager
  // ----------------------------------------------------------

  queueTransfer: (
    options,
  ) => {
    return invoke(
      "queue-transfer",
      options,
    );
  },

  getTransferQueue: () => {
    return invoke(
      "get-transfer-queue",
    );
  },

  pauseTransfer: (
    jobId,
  ) => {
    return invoke(
      "pause-transfer",
      jobId,
    );
  },

  resumeTransfer: (
    jobId,
  ) => {
    return invoke(
      "resume-transfer",
      jobId,
    );
  },

  cancelTransfer: (
    jobId,
  ) => {
    return invoke(
      "cancel-transfer",
      jobId,
    );
  },

  // ----------------------------------------------------------
  // Transfer Progress Listener
  // ----------------------------------------------------------

  onTransferProgress: (
    callback,
  ) => {
    if (
      typeof callback !==
      "function"
    ) {
      return () => {};
    }

    const listener = (
      _event,
      data,
    ) => {
      callback(data);
    };

    ipcRenderer.on(
      "transfer-progress",
      listener,
    );

    // Cleanup function
    return () => {
      ipcRenderer.removeListener(
        "transfer-progress",
        listener,
      );
    };
  },

  // ----------------------------------------------------------
  // System / Utility Features
  // ----------------------------------------------------------

  openTerminal: (
    folderPath,
  ) => {
    return invoke(
      "feature:open-terminal",
      folderPath,
    );
  },

  openItem: (
    itemPath,
  ) => {
    return invoke(
      "feature:open-item",
      itemPath,
    );
  },

  chooseFolder: () => {
    return invoke(
      "feature:choose-folder",
    );
  },

  // ----------------------------------------------------------
  // Health Check
  // ----------------------------------------------------------

  healthCheck: () => {
    return invoke(
      "features:health-check",
    );
  },
  getSystemPaths: () => {
    return invoke(
      "get-system-paths",
    );
  },
};

// ============================================================
// Expose API to Renderer
// ============================================================

contextBridge.exposeInMainWorld(
  "electronFeatures",
  featureAPI,
);