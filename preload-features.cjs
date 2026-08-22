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

  chooseFolder: (defaultPath) => {
    return invoke(
      "choose-folder",
      defaultPath,
    );
  },

  chooseFile: () => {
    return invoke(
      "feature:choose-file",
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

  // ----------------------------------------------------------
  // Developer Features
  // ----------------------------------------------------------

  developerTerminal: (folderOrFilePath, terminalType) => {
    return invoke("developer:terminal", folderOrFilePath, terminalType);
  },

  developerGitStatus: (folderPath) => {
    return invoke("developer:git-status", folderPath);
  },

  developerGitInfo: (folderPath) => {
    return invoke("developer:git-info", folderPath);
  },

  developerEncode: (input, algorithm, isFilePath) => {
    return invoke("developer:encode", input, algorithm, isFilePath);
  },

  developerDecode: (input, algorithm, isFilePath) => {
    return invoke("developer:decode", input, algorithm, isFilePath);
  },

  developerHexRead: (filePath, offset, limit) => {
    return invoke("developer:hex-read", filePath, offset, limit);
  },

  developerJsonParse: (jsonText, filePath) => {
    return invoke("developer:json-parse", jsonText, filePath);
  },

  developerJsonFormat: (jsonText, mode) => {
    return invoke("developer:json-format", jsonText, mode);
  },

  developerJsonSave: (filePath, jsonText) => {
    return invoke("developer:json-save", filePath, jsonText);
  },

  developerCodePreview: (filePath, maxLines, maxBytes) => {
    return invoke("developer:code-preview", filePath, maxLines, maxBytes);
  },

  developerFileHash: (filePath, algorithm) => {
    return invoke("developer:file-hash", filePath, algorithm);
  },

  developerCompareFileHashes: (firstPath, secondPath, algorithm) => {
    return invoke("developer:compare-file-hashes", firstPath, secondPath, algorithm);
  },

  developerFileMetadata: (filePath) => {
    return invoke("developer:file-metadata", filePath);
  },

  developerContextAction: (actionName, filePath, extraArgs) => {
    return invoke("developer:context-action", actionName, filePath, extraArgs);
  },

  // ----------------------------------------------------------
  // Network Features
  // ----------------------------------------------------------

  networkDiscover: () => {
    return invoke("network:discover");
  },

  networkGetInterfaces: () => {
    return invoke("network:get-interfaces");
  },

  networkConnectSMB: (pathStr, username, password) => {
    return invoke("network:connect-smb", pathStr, username, password);
  },

  networkBrowseSMB: (pathStr) => {
    return invoke("network:browse-smb", pathStr);
  },

  networkTestFTP: (host, port, username, password, secure) => {
    return invoke("network:test-ftp", host, port, username, password, secure);
  },

  networkConnectFTP: (host, port, username, password, secure) => {
    return invoke("network:connect-ftp", host, port, username, password, secure);
  },

  networkTestSFTP: (host, port, username, password, privateKeyPath) => {
    return invoke("network:test-sftp", host, port, username, password, privateKeyPath);
  },

  networkConnectSFTP: (host, port, username, password, privateKeyPath) => {
    return invoke("network:connect-sftp", host, port, username, password, privateKeyPath);
  },

  networkWebDAVConnect: (url, username, password) => {
    return invoke("network:webdav-connect", url, username, password);
  },

  networkBrowseRemote: (sessionId, remotePath) => {
    return invoke("network:browse-remote", sessionId, remotePath);
  },

  networkUpload: (sessionId, localFilePath, remoteFilePath) => {
    return invoke("network:upload", sessionId, localFilePath, remoteFilePath);
  },

  networkDownload: (sessionId, remoteFilePath, localFilePath) => {
    return invoke("network:download", sessionId, remoteFilePath, localFilePath);
  },

  networkRename: (sessionId, remoteOldPath, remoteNewPath) => {
    return invoke("network:rename", sessionId, remoteOldPath, remoteNewPath);
  },

  networkDelete: (sessionId, remotePath, isDir) => {
    return invoke("network:delete", sessionId, remotePath, isDir);
  },

  networkCreateFolder: (sessionId, remotePath) => {
    return invoke("network:create-folder", sessionId, remotePath);
  },

  networkGetMappedDrives: () => {
    return invoke("network:get-mapped-drives");
  },

  networkMapDrive: (letter, remotePath, username, password) => {
    return invoke("network:map-drive", letter, remotePath, username, password);
  },

  networkUnmapDrive: (letter) => {
    return invoke("network:unmap-drive", letter);
  },

  networkGetNas: () => {
    return invoke("network:get-nas");
  },

  networkAddNas: (name, protocol, pathOrHost, port, username, password) => {
    return invoke("network:add-nas", name, protocol, pathOrHost, port, username, password);
  },

  networkRemoveNas: (id) => {
    return invoke("network:remove-nas", id);
  },

  // ----------------------------------------------------------
  // OCR Features
  // ----------------------------------------------------------

  ocrGetStatus: () => {
    return invoke("ocr:get-status");
  },

  ocrStartFile: (filePath, options) => {
    return invoke("ocr:start-file", filePath, options);
  },

  ocrCancel: (jobId) => {
    return invoke("ocr:cancel", jobId);
  },

  ocrAddQueue: (filePaths, options) => {
    return invoke("ocr:add-queue", filePaths, options);
  },

  ocrGetQueue: () => {
    return invoke("ocr:get-queue");
  },

  ocrControlQueue: (action, itemId) => {
    return invoke("ocr:control-queue", action, itemId);
  },

  ocrSearch: (query, scope, targetPath) => {
    return invoke("ocr:search", query, scope, targetPath);
  },

  ocrGetSettings: () => {
    return invoke("ocr:get-settings");
  },

  ocrSaveSettings: (settings) => {
    return invoke("ocr:save-settings", settings);
  },

  ocrExportText: (localDestPath, text) => {
    return invoke("ocr:export-text", localDestPath, text);
  },

  ocrExportJson: (localDestPath, data) => {
    return invoke("ocr:export-json", localDestPath, data);
  },

  onOcrProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("ocr:progress", subscription);
    return () => ipcRenderer.removeListener("ocr:progress", subscription);
  },

  onOcrQueueChanged: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("ocr:queue-changed", subscription);
    return () => ipcRenderer.removeListener("ocr:queue-changed", subscription);
  },

  onOcrQueueFinished: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("ocr:queue-finished", subscription);
    return () => ipcRenderer.removeListener("ocr:queue-finished", subscription);
  },

  // ----------------------------------------------------------
  // Security Features
  // ----------------------------------------------------------

  securityGetPermissions: (filePath) => {
    return invoke("security:get-permissions", filePath);
  },

  securityGetOwner: (filePath) => {
    return invoke("security:get-owner", filePath);
  },

  securitySetPermissions: (filePath, username, right, type) => {
    return invoke("security:set-permissions", filePath, username, right, type);
  },

  securitySetOwner: (filePath, ownerName) => {
    return invoke("security:set-owner", filePath, ownerName);
  },

  securityGetAttributes: (filePath) => {
    return invoke("security:get-attributes", filePath);
  },

  securitySetAttributes: (filePath, attrs) => {
    return invoke("security:set-attributes", filePath, attrs);
  },

  securitySecureDelete: (targetPath) => {
    return invoke("security:secure-delete", targetPath);
  },

  securityEncrypt: (filePath, password) => {
    return invoke("security:encrypt", filePath, password);
  },

  securityDecrypt: (encFilePath, password) => {
    return invoke("security:decrypt", encFilePath, password);
  },

  securityVaultCreate: (vaultPath, password) => {
    return invoke("security:vault-create", vaultPath, password);
  },

  securityVaultUnlock: (vaultPath, password) => {
    return invoke("security:vault-unlock", vaultPath, password);
  },

  securityVaultLock: (vaultPath) => {
    return invoke("security:vault-lock", vaultPath);
  },

  securityVaultAdd: (vaultPath, localFilePath) => {
    return invoke("security:vault-add", vaultPath, localFilePath);
  },

  securityVaultExtract: (vaultPath, fileName, destFolder) => {
    return invoke("security:vault-extract", vaultPath, fileName, destFolder);
  },

  securityScanFile: (filePath) => {
    return invoke("security:scan-file", filePath);
  },

  securityGetLogs: () => {
    return invoke("security:get-logs");
  },

  securityClearLogs: () => {
    return invoke("security:clear-logs");
  },

  securityGetCurrentUser: () => {
    return invoke("security:get-current-user");
  },

  onSecurityDeleteProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("security:delete-progress", subscription);
    return () => ipcRenderer.removeListener("security:delete-progress", subscription);
  },

  // ----------------------------------------------------------
  // Storage Analytics Features
  // ----------------------------------------------------------

  storageGetDrives: () => {
    return invoke("storageAnalytics:get-drives");
  },

  storageScanStart: (rootPath) => {
    return invoke("storageAnalytics:scan-start", rootPath);
  },

  storageScanCancel: () => {
    return invoke("storageAnalytics:scan-cancel");
  },

  storageDeleteItem: (itemPath) => {
    return invoke("storageAnalytics:delete-item", itemPath);
  },

  storageGetCache: (targetPath) => {
    return invoke("storageAnalytics:get-cache", targetPath);
  },

  storageClearCache: () => {
    return invoke("storageAnalytics:clear-cache");
  },

  onStorageProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("storageAnalytics:progress", subscription);
    return () => ipcRenderer.removeListener("storageAnalytics:progress", subscription);
  },

  // ----------------------------------------------------------
  // Archive Manager Features
  // ----------------------------------------------------------

  archiveGetSupportedFormats: () => {
    return invoke("archive:get-supported-formats");
  },

  archiveCreate: (sourcePaths, destinationPath, format, options) => {
    return invoke("archive:create", sourcePaths, destinationPath, format, options);
  },

  archiveExtract: (archivePath, destinationFolder, options) => {
    return invoke("archive:extract", archivePath, destinationFolder, options);
  },

  archiveList: (archivePath, password) => {
    return invoke("archive:list", archivePath, password);
  },

  archiveTest: (archivePath) => {
    return invoke("archive:test", archivePath);
  },

  onArchiveProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("archive:progress", subscription);
    return () => ipcRenderer.removeListener("archive:progress", subscription);
  },

  // ----------------------------------------------------------
  // Cloud Integration Features
  // ----------------------------------------------------------

  cloudGetProviders: () => {
    return invoke("cloud:get-providers");
  },

  cloudConnect: (providerId, config) => {
    return invoke("cloud:connect", providerId, config);
  },

  cloudDisconnect: (providerId) => {
    return invoke("cloud:disconnect", providerId);
  },

  cloudStatus: (providerId) => {
    return invoke("cloud:status", providerId);
  },

  cloudList: (providerId, remotePath) => {
    return invoke("cloud:list", providerId, remotePath);
  },

  cloudUpload: (providerId, localPath, remotePath) => {
    return invoke("cloud:upload", providerId, localPath, remotePath);
  },

  cloudDownload: (providerId, remotePath, localPath) => {
    return invoke("cloud:download", providerId, remotePath, localPath);
  },

  cloudRename: (providerId, remotePath, newName) => {
    return invoke("cloud:rename", providerId, remotePath, newName);
  },

  cloudDelete: (providerId, remotePath) => {
    return invoke("cloud:delete", providerId, remotePath);
  },

  cloudCreateFolder: (providerId, remotePath, folderName) => {
    return invoke("cloud:create-folder", providerId, remotePath, folderName);
  },

  cloudSync: (jobId) => {
    return invoke("cloud:sync", jobId);
  },

  cloudGetConflicts: () => {
    return invoke("cloud:get-conflicts");
  },

  cloudResolveConflict: (jobId, relativePath, resolution) => {
    return invoke("cloud:resolve-conflict", jobId, relativePath, resolution);
  },

  cloudMarkOffline: (providerId, remotePath) => {
    return invoke("cloud:mark-offline", providerId, remotePath);
  },

  cloudRemoveOffline: (providerId, remotePath) => {
    return invoke("cloud:remove-offline", providerId, remotePath);
  },

  cloudGetOfflineFiles: () => {
    return invoke("cloud:get-offline-files");
  },

  onCloudSyncProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("cloud:sync-progress", subscription);
    return () => ipcRenderer.removeListener("cloud:sync-progress", subscription);
  },

  onCloudSyncComplete: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("cloud:sync-complete", subscription);
    return () => ipcRenderer.removeListener("cloud:sync-complete", subscription);
  },

  onCloudSyncFailed: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("cloud:sync-failed", subscription);
    return () => ipcRenderer.removeListener("cloud:sync-failed", subscription);
  },

  // ----------------------------------------------------------
  // Advanced Search Persistence & Control
  // ----------------------------------------------------------
  getSearchHistory: () => {
    return invoke("search:get-history");
  },

  addToSearchHistory: (item) => {
    return invoke("search:add-history", item);
  },

  clearSearchHistory: () => {
    return invoke("search:clear-history");
  },

  getSavedSearches: () => {
    return invoke("search:get-saved");
  },

  saveSearch: (item) => {
    return invoke("search:save", item);
  },

  deleteSavedSearch: (name) => {
    return invoke("search:delete-saved", name);
  },

  cancelSearch: () => {
    return invoke("search:cancel");
  },

  onSearchProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("search:progress", subscription);
    return () => ipcRenderer.removeListener("search:progress", subscription);
  },

  // ----------------------------------------------------------
  // Real AI File Intelligence Bridges
  // ----------------------------------------------------------
  aiGetStatus: () => invoke("ai:get-status"),
  aiGetProviders: () => invoke("ai:get-providers"),
  aiGetConfig: () => invoke("ai:get-config"),
  aiSetProvider: (providerName, modelName, url, key) => invoke("ai:set-provider", providerName, modelName, url, key),
  aiAnalyzeFiles: (itemsList, options) => invoke("ai:analyze-files", itemsList, options),
  aiCategorize: (fileInfo, extraContent) => invoke("ai:categorize", fileInfo, extraContent),
  aiGenerateTags: (fileInfo, extraContent) => invoke("ai:generate-tags", fileInfo, extraContent),
  aiAnalyzeImage: (imagePath) => invoke("ai:analyze-image", imagePath),
  aiAnalyzeDocument: (filePath) => invoke("ai:analyze-document", filePath),
  aiSemanticSearch: (query, sources) => invoke("ai:semantic-search", query, sources),
  aiSearch: (payload) => invoke("ai:search", payload),
  aiAssistant: (currentPath, items, question) => invoke("ai:assistant", currentPath, items, question),
  aiGetAnalysis: (filePath) => invoke("ai:get-analysis", filePath),
  aiSaveTags: (filePath, tags) => invoke("ai:save-tags", filePath, tags),
  aiGetIndexStatus: () => invoke("ai:get-index-status"),
  aiRebuildIndex: (targetDir) => invoke("ai:rebuild-index", targetDir),
  aiPauseIndexing: () => invoke("ai:pause-indexing"),
  aiResumeIndexing: () => invoke("ai:resume-indexing"),
  aiGetModels: () => invoke("ai:get-models"),
  aiGetActiveModels: () => invoke("ai:get-active-models"),
  aiSetActiveModel: (task, modelId) => invoke("ai:set-active-model", task, modelId),
  aiVerifyModel: (modelId) => invoke("ai:verify-model", modelId),
  aiGetSettings: () => invoke("ai:get-settings"),
  aiSaveSettings: (settings) => invoke("ai:save-settings", settings),
  aiGetStorageInfo: () => invoke("ai:get-storage-info"),
  aiClearCache: () => invoke("ai:clear-cache"),
  aiOptimizeDatabase: () => invoke("ai:optimize-database"),
  aiCheckIntegrity: () => invoke("ai:check-integrity"),
  aiRepairIndex: () => invoke("ai:repair-index"),
  aiClearData: () => invoke("ai:clear-data"),
  aiCancel: () => invoke("ai:cancel"),
  
  aiGetModelsStatus: () => invoke("ai:get-models-status"),
  aiDetectHardware: () => invoke("ai:detect-hardware"),
  aiSelectRecommendedModels: (capabilities) => invoke("ai:select-recommended-models", capabilities),
  aiDownloadModel: (modelId) => invoke("ai:download-model", modelId),
  aiDownloadRecommendedPack: (capabilities) => invoke("ai:download-recommended-pack", capabilities),
  aiCancelModelDownload: (modelId) => invoke("ai:cancel-model-download", modelId),
  aiUninstallModel: (modelId) => invoke("ai:uninstall-model", modelId),
  aiValidateCustomModel: (sourcePath) => invoke("ai:validate-custom-model", sourcePath),
  aiImportCustomModel: (validationResult, userOverrides) => invoke("ai:import-custom-model", validationResult, userOverrides),
  
  onAiProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("ai:progress", subscription);
    return () => ipcRenderer.removeListener("ai:progress", subscription);
  },
  
  onAiIndexingProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on("ai:indexing-progress", subscription);
    return () => ipcRenderer.removeListener("ai:indexing-progress", subscription);
  },
};

// ============================================================
// Expose API to Renderer
// ============================================================

contextBridge.exposeInMainWorld(
  "electronFeatures",
  featureAPI,
);