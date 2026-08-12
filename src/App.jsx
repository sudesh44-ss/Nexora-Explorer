import { useEffect, useRef, useState } from "react";
import "./App.css";
import { getDisplayName } from "./features/extensionVisibility";

function App() {
  // =============================
  // Basic State
  // =============================

  const [drives, setDrives] = useState([]);
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [addressPath, setAddressPath] = useState("This PC");

  // =============================
  // Navigation History
  // =============================

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // =============================
  // Error
  // =============================

  const [error, setError] = useState("");

  // =============================
  // Context Menu
  // =============================

  const [contextMenu, setContextMenu] = useState(null);

  // =============================
  // Selection (multi-select support)
  // =============================

  // selectedPaths ek Set hai jisme currently-selected items ke paths hote hain.
  // Rename/Properties/Open jaise "single item only" actions ke liye
  // selectedItem/selectedList derive kiya gaya hai.

  const [selectedPaths, setSelectedPaths] = useState(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

  // =============================
  // Properties
  // =============================

  const [showProperties, setShowProperties] = useState(false);
  const [propertiesItem, setPropertiesItem] = useState(null);

  // null | "calculating" | { size, fileCount, folderCount }
  const [folderSize, setFolderSize] = useState(null);

  // =============================
  // Rename
  // =============================

  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // =============================
  // Clipboard
  // =============================

  const [clipboard, setClipboard] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const [showNewMenu, setShowNewMenu] = useState(false);

  // =============================
  // Sort
  // =============================

  // name | size | type | date
  const [sortBy, setSortBy] = useState("name");

  // asc | desc
  const [sortOrder, setSortOrder] = useState("asc");

  // =============================
  // View Mode
  // =============================

  // grid | list
  const [viewMode, setViewMode] = useState("grid");

  // =============================
  // Drag & Drop
  // =============================

  const [draggedPaths, setDraggedPaths] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);

  // =============================
  // Undo / Redo
  // =============================

  // Har entry actions ka ek array hai (batch), taaki ek paste/drag
  // jisme multiple files move/copy hue, Ctrl+Z se ek hi baar me
  // undo ho jaaye.
  //
  // NOTE:
  // Delete undo nahi hota - OS Recycle Bin se cheezein wapas laane
  // ka koi direct API Electron "shell" module nahi deta, isliye
  // Delete ko undo stack me nahi daala gaya.
  //
  // Delete hui cheez Recycle Bin se manually restore ki ja sakti hai.

  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // ============================================================
  // Phase 2 — Advanced Features
  // ============================================================

  // ============================================================
  // Phase 2 — Advanced Features
  // ============================================================

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fileExplorerFavorites") || "[]");
    } catch {
      return [];
    }
  });

  const [tabs, setTabs] = useState(() => [
    {
      id: Date.now(),
      path: null,
      label: "This PC",
    },
  ]);

  const [activeTabId, setActiveTabId] = useState(null);

  const [filterType, setFilterType] = useState("all");
  const [deepSearch, setDeepSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [clipboardHistory, setClipboardHistory] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("fileExplorerClipboardHistory") || "[]",
      );
    } catch {
      return [];
    }
  });

  const [showClipboardHistory, setShowClipboardHistory] = useState(false);

  const [showPermissions, setShowPermissions] = useState(false);

  const [permissionsInfo, setPermissionsInfo] = useState(null);

  // ============================================================
  // Phase 5 — Explorer Display Settings
  // ============================================================

  const [showHiddenFiles, setShowHiddenFiles] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("fileExplorerShowHidden") || "false",
      );
    } catch {
      return false;
    }
  });

  const [showFileExtensions, setShowFileExtensions] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("fileExplorerShowExtensions") || "true",
      );
    } catch {
      return true;
    }
  });

  // ============================================================
  // Storage Management
  // ============================================================

  // eslint-disable-next-line no-unused-vars
  const [driveInventory, setDriveInventory] = useState(null);
  const [driveCapacities, setDriveCapacities] = useState([]);
  const [driveHealth, setDriveHealth] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [storageLoading, setStorageLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [storageError, setStorageError] = useState("");

  // ============================================================
  // Phase 4 — Advanced File Operations
  // ============================================================

  const [showAdvancedOperations, setShowAdvancedOperations] = useState(false);

  const [advancedOperation, setAdvancedOperation] = useState("batch-rename");

  const [advancedLoading, setAdvancedLoading] = useState(false);

  const [advancedResults, setAdvancedResults] = useState(null);

  const [advancedError, setAdvancedError] = useState("");

  // Batch Rename
  const [batchPrefix, setBatchPrefix] = useState("");

  const [batchSuffix, setBatchSuffix] = useState("");

  const [batchPattern, setBatchPattern] = useState("");

  const [batchStartNumber, setBatchStartNumber] = useState(1);

  // Finder
  const [largeFileThreshold, setLargeFileThreshold] = useState(100);

  // File / Folder comparison
  const [compareFirstPath, setCompareFirstPath] = useState("");

  const [compareSecondPath, setCompareSecondPath] = useState("");

  // Merge
  const [mergeSourcePath, setMergeSourcePath] = useState("");

  const [mergeDestinationPath, setMergeDestinationPath] = useState("");

  const [mergeConflictMode, setMergeConflictMode] = useState("keep-both");

  // Transfer
  const [transferDestination, setTransferDestination] = useState("");

  const [transferConflictMode, setTransferConflictMode] = useState("keep-both");

  const [transferOperation, setTransferOperation] = useState("copy");

  const [transferQueue, setTransferQueue] = useState([]);

  const [selectedTransferJob, setSelectedTransferJob] = useState(null);

  // Hash
  const [hashAlgorithm, setHashAlgorithm] = useState("sha256");

  // eslint-disable-next-line no-unused-vars
  const [hashResult, setHashResult] = useState(null);

  // Integrity
  const [expectedHash, setExpectedHash] = useState("");

  // eslint-disable-next-line no-unused-vars
  const [integrityResult, setIntegrityResult] = useState(null);

  // ============================================================
  // Phase 4 — Transfer Progress Listener
  // ============================================================

  useEffect(() => {
    if (!window.fileExplorer?.onTransferProgress) {
      return undefined;
    }

    const cleanup = window.fileExplorer.onTransferProgress((progress) => {
      setTransferQueue((prev) => {
        const exists = prev.some((job) => job.id === progress.jobId);

        if (!exists) {
          return [
            ...prev,
            {
              id: progress.jobId,
              state: progress.state || "queued",
              percent: progress.percent || 0,
              speed: progress.speed || 0,
              totalBytes: progress.totalBytes || 0,
              completedBytes: progress.completedBytes || 0,
              currentFile: progress.currentFile || "",
              error: progress.error || "",
            },
          ];
        }

        return prev.map((job) =>
          job.id === progress.jobId
            ? {
                ...job,
                ...progress,
                percent: progress.percent ?? job.percent ?? 0,
                speed: progress.speed ?? job.speed ?? 0,
                totalBytes: progress.totalBytes ?? job.totalBytes ?? 0,
                completedBytes:
                  progress.completedBytes ?? job.completedBytes ?? 0,
              }
            : job,
        );
      });
    });

    return cleanup;
  }, []);

  // ============================================================
  // Phase 4 — Helpers
  // ============================================================

  function openAdvancedOperations(operation = "batch-rename") {
    setAdvancedOperation(operation);
    setAdvancedResults(null);
    setAdvancedError("");
    setHashResult(null);
    setIntegrityResult(null);
    setShowAdvancedOperations(true);
    closeContextMenu();
  }

  function closeAdvancedOperations() {
    setShowAdvancedOperations(false);
    setAdvancedLoading(false);
    setAdvancedError("");
  }

  function selectedPathsForOperation() {
    return selectedList.map((item) => item.path);
  }

  function selectedItemsForOperation() {
    return selectedList.map((item) => ({
      path: item.path,
      name: item.name,
      isDirectory: item.isDirectory,
    }));
  }

  function operationRootPath() {
    if (currentPath) {
      return currentPath;
    }

    return "";
  }

  // ============================================================
  // Batch Rename
  // ============================================================

  async function runBatchRename() {
    const selected = selectedItemsForOperation();

    if (!selected.length) {
      setAdvancedError("Select at least one file or folder.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");
    setAdvancedResults(null);

    try {
      const result = await window.fileExplorer.batchRename(selected, {
        prefix: batchPrefix,
        suffix: batchSuffix,
        pattern: batchPattern,
        startNumber: Number(batchStartNumber) || 1,
      });

      if (!result.success) {
        setAdvancedError(result.error || "Batch rename failed.");
        return;
      }

      setAdvancedResults(result);

      await refresh();
      clearSelection();
    } catch (error) {
      setAdvancedError(error.message || "Batch rename failed.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  // ============================================================
  // Duplicate Finder
  // ============================================================

  async function runDuplicateFinder() {
    const root = operationRootPath();

    if (!root) {
      setAdvancedError("Open a folder first.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");
    setAdvancedResults(null);

    try {
      const result = await window.fileExplorer.findDuplicates(root);

      if (!result.success) {
        setAdvancedError(result.error || "Duplicate search failed.");
        return;
      }

      setAdvancedResults(result);
    } catch (error) {
      setAdvancedError(error.message || "Duplicate search failed.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  // ============================================================
  // Large File Finder
  // ============================================================

  async function runLargeFileFinder() {
    const root = operationRootPath();

    if (!root) {
      setAdvancedError("Open a folder first.");
      return;
    }

    const megabytes = Number(largeFileThreshold);

    if (!Number.isFinite(megabytes) || megabytes < 0) {
      setAdvancedError("Enter a valid file size.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");
    setAdvancedResults(null);

    try {
      const result = await window.fileExplorer.findLargeFiles(
        root,
        megabytes * 1024 * 1024,
      );

      if (!result.success) {
        setAdvancedError(result.error || "Large file search failed.");
        return;
      }

      setAdvancedResults(result);
    } catch (error) {
      setAdvancedError(error.message || "Large file search failed.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  // ============================================================
  // Empty Folder Finder
  // ============================================================

  async function runEmptyFolderFinder() {
    const root = operationRootPath();

    if (!root) {
      setAdvancedError("Open a folder first.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");
    setAdvancedResults(null);

    try {
      const result = await window.fileExplorer.findEmptyFolders(root);

      if (!result.success) {
        setAdvancedError(result.error || "Empty folder search failed.");
        return;
      }

      setAdvancedResults(result);
    } catch (error) {
      setAdvancedError(error.message || "Empty folder search failed.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  // ============================================================
  // File Comparison
  // ============================================================

  async function runFileComparison() {
    if (!compareFirstPath.trim() || !compareSecondPath.trim()) {
      setAdvancedError("Enter both file paths.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");
    setAdvancedResults(null);

    try {
      const result = await window.fileExplorer.compareFiles(
        compareFirstPath.trim(),
        compareSecondPath.trim(),
        "sha256",
      );

      if (!result.success) {
        setAdvancedError(result.error || "File comparison failed.");
        return;
      }

      setAdvancedResults(result);
    } catch (error) {
      setAdvancedError(error.message || "File comparison failed.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  // ============================================================
  // Folder Comparison
  // ============================================================

  async function runFolderComparison() {
    if (!compareFirstPath.trim() || !compareSecondPath.trim()) {
      setAdvancedError("Enter both folder paths.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");
    setAdvancedResults(null);

    try {
      const result = await window.fileExplorer.compareFolders(
        compareFirstPath.trim(),
        compareSecondPath.trim(),
      );

      if (!result.success) {
        setAdvancedError(result.error || "Folder comparison failed.");
        return;
      }

      setAdvancedResults(result);
    } catch (error) {
      setAdvancedError(error.message || "Folder comparison failed.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  // ============================================================
  // Merge Folders
  // ============================================================

  async function runMergeFolders() {
    if (!mergeSourcePath.trim() || !mergeDestinationPath.trim()) {
      setAdvancedError("Enter source and destination folder paths.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");
    setAdvancedResults(null);

    try {
      const result = await window.fileExplorer.mergeFolders(
        mergeSourcePath.trim(),
        mergeDestinationPath.trim(),
        mergeConflictMode,
      );

      if (!result.success) {
        setAdvancedError(result.error || "Folder merge failed.");
        return;
      }

      setAdvancedResults(result);
      await refresh();
    } catch (error) {
      setAdvancedError(error.message || "Folder merge failed.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  // ============================================================
  // Transfer Queue
  // ============================================================

  async function startTransfer() {
    const sources = selectedPathsForOperation();

    if (!sources.length) {
      setAdvancedError("Select files or folders to transfer.");
      return;
    }

    if (!transferDestination.trim()) {
      setAdvancedError("Enter a destination folder.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");

    try {
      const result = await window.fileExplorer.queueTransfer({
        sources,
        destination: transferDestination.trim(),
        operation: transferOperation,
        conflictMode: transferConflictMode,
      });

      if (!result.success) {
        setAdvancedError(result.error || "Unable to start transfer.");
        return;
      }

      setSelectedTransferJob(result.jobId);

      const queue = await window.fileExplorer.getTransferQueue();

      setTransferQueue(queue || []);
    } catch (error) {
      setAdvancedError(error.message || "Unable to start transfer.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  async function pauseSelectedTransfer() {
    if (!selectedTransferJob) {
      return;
    }

    const result = await window.fileExplorer.pauseTransfer(selectedTransferJob);

    if (!result.success) {
      setAdvancedError(result.error || "Unable to pause transfer.");
    }
  }

  async function resumeSelectedTransfer() {
    if (!selectedTransferJob) {
      return;
    }

    const result =
      await window.fileExplorer.resumeTransfer(selectedTransferJob);

    if (!result.success) {
      setAdvancedError(result.error || "Unable to resume transfer.");
    }
  }

  async function cancelSelectedTransfer() {
    if (!selectedTransferJob) {
      return;
    }

    const result =
      await window.fileExplorer.cancelTransfer(selectedTransferJob);

    if (!result.success) {
      setAdvancedError(result.error || "Unable to cancel transfer.");
    }
  }

  // ============================================================
  // Hash
  // ============================================================

  async function calculateSelectedHash() {
    if (!selectedItem) {
      setAdvancedError("Select one file first.");
      return;
    }

    if (selectedItem.isDirectory) {
      setAdvancedError("Hash calculation requires a file.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");
    setHashResult(null);

    try {
      const result = await window.fileExplorer.getFileHash(selectedItem.path, [
        "md5",
        "sha1",
        "sha256",
      ]);

      if (!result.success) {
        setAdvancedError(result.error || "Hash calculation failed.");
        return;
      }

      setHashResult(result);
    } catch (error) {
      setAdvancedError(error.message || "Hash calculation failed.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  // ============================================================
  // Integrity Verification
  // ============================================================

  async function verifySelectedIntegrity() {
    if (!selectedItem) {
      setAdvancedError("Select one file first.");
      return;
    }

    if (selectedItem.isDirectory) {
      setAdvancedError("Integrity verification requires a file.");
      return;
    }

    if (!expectedHash.trim()) {
      setAdvancedError("Enter the expected hash.");
      return;
    }

    setAdvancedLoading(true);
    setAdvancedError("");
    setIntegrityResult(null);

    try {
      const result = await window.fileExplorer.verifyFileIntegrity(
        selectedItem.path,
        expectedHash.trim(),
        hashAlgorithm,
      );

      if (!result.success) {
        setAdvancedError(result.error || "Integrity verification failed.");
        return;
      }

      setIntegrityResult(result);
    } catch (error) {
      setAdvancedError(error.message || "Integrity verification failed.");
    } finally {
      setAdvancedLoading(false);
    }
  }

  // ============================================================
  // Phase 4 — Format Helpers
  // ============================================================

  // eslint-disable-next-line no-unused-vars
  function getDriveHealthInfo(deviceId) {
    return (
      driveHealth.find(
        (drive) => Number(drive.deviceId) === Number(deviceId),
      ) || null
    );
  }

  function formatTransferSpeed(bytesPerSecond) {
    if (!bytesPerSecond || bytesPerSecond <= 0) {
      return "0 B/s";
    }

    return `${formatSize(bytesPerSecond)}/s`;
  }

  function operationButton(label, operation) {
    return (
      <button
        type="button"
        className={advancedOperation === operation ? "active" : ""}
        onClick={() => {
          setAdvancedOperation(operation);
          setAdvancedResults(null);
          setAdvancedError("");
          setHashResult(null);
          setIntegrityResult(null);
        }}
      >
        {label}
      </button>
    );
  }

  // ============================================================
  // Storage Helpers — Drive Capacity
  // ============================================================

  function getDriveCapacityInfo(driveLetter) {
    if (!driveLetter) {
      return null;
    }

    const normalized = driveLetter.replace(/[\\/]+$/, "").toUpperCase();

    return (
      driveCapacities.find(
        (drive) => String(drive.driveLetter || "").toUpperCase() === normalized,
      ) || null
    );
  }

  // ============================================================
  // Storage Management — Load Drive Inventory
  // ============================================================

  async function loadDriveInventory() {
    try {
      setStorageLoading(true);
      setStorageError("");

      const result = await window.fileExplorer.getDriveInventory();

      if (!result?.success) {
        setStorageError(result?.errors?.general || "Unable to detect drives.");
        return;
      }

      setDriveInventory(result);

      // Load fresh capacity information
      // for all logical drives.
      const capacityResult = await window.fileExplorer.getAllDriveCapacities();

      if (capacityResult?.success) {
        setDriveCapacities(capacityResult.drives || []);
      }

      // Load drive health information.
      const healthResult = await window.fileExplorer.getAllDriveHealth();

      if (healthResult?.success) {
        setDriveHealth(healthResult.drives || []);
      }
    } catch (error) {
      console.error("Drive inventory failed:", error);

      setStorageError(error.message || "Unable to load storage information.");
    } finally {
      setStorageLoading(false);
    }
  }

  // ============================================================
  // Initial Load
  // ============================================================

  useEffect(() => {
    loadDrives();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDriveInventory();

    const rawHash = window.location.hash.startsWith("#path=")
      ? window.location.hash.slice(6)
      : "";

    const initialPath = rawHash ? decodeURIComponent(rawHash) : "";

    const firstTab = {
      id: Date.now(),
      path: initialPath || null,
      label: initialPath || "This PC",
    };

    setTabs([firstTab]);
    setActiveTabId(firstTab.id);

    if (initialPath) {
      readFolder(initialPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Favorites Persistence
  // ============================================================

  useEffect(() => {
    localStorage.setItem("fileExplorerFavorites", JSON.stringify(favorites));
  }, [favorites]);

  // ============================================================
  // Clipboard History Persistence
  // ============================================================

  useEffect(() => {
    localStorage.setItem(
      "fileExplorerClipboardHistory",
      JSON.stringify(clipboardHistory.slice(0, 20)),
    );
  }, [clipboardHistory]);

  // ============================================================
  // Phase 5 — Hidden Files Persistence
  // ============================================================

  useEffect(() => {
    localStorage.setItem(
      "fileExplorerShowHidden",
      JSON.stringify(showHiddenFiles),
    );
  }, [showHiddenFiles]);

  // ============================================================
  // Phase 5 — File Extensions Persistence
  // ============================================================

  useEffect(() => {
    localStorage.setItem(
      "fileExplorerShowExtensions",
      JSON.stringify(showFileExtensions),
    );
  }, [showFileExtensions]);

  // ============================================================
  // Keyboard Listener
  // ============================================================

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPaths,
    clipboard,
    currentPath,
    items,
    searchQuery,
    sortBy,
    sortOrder,
    undoStack,
    redoStack,
    activeTabId,
    deepSearch,
    filterType,
  ]);

  // ============================================================
  // Load Drives
  // ============================================================

  async function loadDrives() {
    try {
      setError("");

      const result = await window.fileExplorer.getDrives();

      setDrives(result);
    } catch (error) {
      console.error("Load drives failed:", error);

      setError(error.message || "Unable to load drives.");
    }
  }

  // ============================================================
  // Read Folder
  // ============================================================

  async function readFolder(folderPath, showHiddenOverride = showHiddenFiles) {
    try {
      if (typeof folderPath !== "string") {
        setError("Invalid folder path.");
        return false;
      }

      const cleanPath = folderPath.trim();

      if (!cleanPath || cleanPath === "This PC") {
        setError("Invalid folder path.");
        return false;
      }

      setError("");

      const result = await window.fileExplorer.readDirectory(
        cleanPath,
        showHiddenOverride,
      );

      if (result?.error) {
        setError(result.error);
        return false;
      }

      setItems(Array.isArray(result) ? result : []);

      setCurrentPath(cleanPath);
      setAddressPath(cleanPath);
      setSearchResults([]);

      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                path: cleanPath,
                label: pathLabel(cleanPath),
              }
            : tab,
        ),
      );

      setSelectedPaths(new Set());

      setLastSelectedIndex(null);

      return true;
    } catch (error) {
      console.error("Read folder failed:", error);

      setError(error.message || "Unable to read folder.");

      return false;
    }
  }

  // ============================================================
  // Open Folder
  // ============================================================

  async function openFolder(folderPath) {
    if (typeof folderPath !== "string") {
      setError("Invalid folder path.");
      return;
    }

    const cleanPath = folderPath.trim();

    if (!cleanPath || cleanPath === "This PC") {
      goToThisPC();
      return;
    }

    const success = await readFolder(cleanPath);

    if (!success) {
      return;
    }

    const newHistory = history.slice(0, historyIndex + 1);

    newHistory.push(cleanPath);

    setHistory(newHistory);

    setHistoryIndex(newHistory.length - 1);

    closeContextMenu();
  }

  // ============================================================
  // Back
  // ============================================================

  async function goBack() {
    if (historyIndex <= 0) {
      return;
    }

    const newIndex = historyIndex - 1;

    const previousPath = history[newIndex];

    const success = await readFolder(previousPath);

    if (success) {
      setHistoryIndex(newIndex);
    }
  }

  // ============================================================
  // Forward
  // ============================================================

  async function goForward() {
    if (historyIndex >= history.length - 1) {
      return;
    }

    const newIndex = historyIndex + 1;

    const nextPath = history[newIndex];

    const success = await readFolder(nextPath);

    if (success) {
      setHistoryIndex(newIndex);
    }
  }

  // ============================================================
  // Up
  // ============================================================

  async function goUp() {
    if (!currentPath) {
      return;
    }

    // Already at drive root.
    if (/^[A-Z]:\\$/i.test(currentPath)) {
      return;
    }

    const lastSlash = currentPath.lastIndexOf("\\");

    if (lastSlash === -1) {
      return;
    }

    const parentPath = currentPath.substring(0, lastSlash);

    const targetPath = parentPath.endsWith(":")
      ? `${parentPath}\\`
      : parentPath;

    await openFolder(targetPath);
  }

  // ============================================================
  // Refresh
  // ============================================================

  async function refresh() {
    setError("");

    if (!currentPath) {
      await loadDrives();
      return;
    }

    await readFolder(currentPath, showHiddenFiles);
  }

  // ============================================================
  // This PC
  // ============================================================

  function goToThisPC() {
    setCurrentPath(null);
    setAddressPath("This PC");
    setItems([]);
    setSearchResults([]);

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTabId
          ? {
              ...tab,
              path: null,
              label: "This PC",
            }
          : tab,
      ),
    );

    setSelectedPaths(new Set());

    setLastSelectedIndex(null);
    setError("");
    closeContextMenu();
  }

  // ============================================================
  // Address Bar
  // ============================================================

  async function handleAddressSubmit(event) {
    event.preventDefault();

    const path = addressPath.trim();

    if (!path || path === "This PC") {
      goToThisPC();
      return;
    }

    await openFolder(path);
  }

  // ============================================================
  // Phase 2 Helpers
  // ============================================================

  function pathLabel(filePath) {
    if (!filePath) {
      return "This PC";
    }

    const clean = filePath.replace(/[\\/]+$/, "");

    return clean.substring(clean.lastIndexOf("\\") + 1) || clean;
  }

  function formatResultPath(filePath) {
    return filePath || "";
  }

  function runAdvancedAction() {
    if (advancedLoading) {
      return false;
    }
    setAdvancedError("");
    setAdvancedResults(null);
    return true;
  }

  function extensionOf(item) {
    if (item.isDirectory) {
      return "";
    }

    const index = item.name.lastIndexOf(".");

    return index === -1 ? "" : item.name.substring(index).toLowerCase();
  }

  function matchesFilter(item) {
    if (filterType === "all") {
      return true;
    }

    if (filterType === "folder") {
      return item.isDirectory;
    }

    if (item.isDirectory) {
      return false;
    }

    const ext = extensionOf(item);

    const groups = {
      image: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".ico"],

      video: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm", ".m4v"],

      audio: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"],

      document: [
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
      ],

      archive: [".zip", ".rar", ".7z", ".tar", ".gz"],
    };

    return groups[filterType]?.includes(ext) || false;
  }

  // ============================================================
  // Advanced Search
  // ============================================================

  async function runAdvancedSearch(showHiddenOverride = showHiddenFiles) {
    if (!currentPath || !searchQuery.trim()) {
      return;
    }

    setSearchLoading(true);
    setError("");

    try {
      const result = await window.fileExplorer.searchDirectory(
        currentPath,
        searchQuery.trim(),
        filterType,
        showHiddenOverride,
      );

      if (result?.error) {
        setError(result.error);
        setSearchResults([]);
        return;
      }

      setSearchResults(Array.isArray(result) ? result : []);
    } catch (error) {
      setError(error.message || "Search failed.");

      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  // ============================================================
  // Phase 5 — Display Name
  // ============================================================

  function displayItemName(item) {
    if (typeof getDisplayName === "function") {
      return getDisplayName(item, showFileExtensions);
    }

    return item?.name || "";
  }

  // ============================================================
  // Favorites
  // ============================================================

  function toggleFavorite(itemPath) {
    if (!itemPath) {
      return;
    }

    setFavorites((prev) =>
      prev.includes(itemPath)
        ? prev.filter((value) => value !== itemPath)
        : [...prev, itemPath],
    );

    closeContextMenu();
  }

  function openFavorite(itemPath) {
    if (!itemPath) {
      return;
    }

    openFolder(itemPath);
  }

  // ============================================================
  // Clipboard History
  // ============================================================

  function addClipboardHistory(operation, paths) {
    if (!paths?.length) {
      return;
    }

    const entry = {
      id: Date.now(),
      operation,
      paths,
      label: paths.length === 1 ? pathLabel(paths[0]) : `${paths.length} items`,
      time: new Date().toISOString(),
    };

    setClipboardHistory((prev) =>
      [
        entry,
        ...prev.filter(
          (old) => JSON.stringify(old.paths) !== JSON.stringify(paths),
        ),
      ].slice(0, 20),
    );
  }

  // ============================================================
  // New Tab
  // ============================================================

  function newTab(initialPath = null) {
    const tab = {
      id: Date.now() + Math.random(),

      path: initialPath,

      label: initialPath ? pathLabel(initialPath) : "This PC",
    };

    setTabs((prev) => [...prev, tab]);

    setActiveTabId(tab.id);

    setCurrentPath(null);
    setAddressPath("This PC");
    setItems([]);
    setSelectedPaths(new Set());
    setLastSelectedIndex(null);
    setSearchResults([]);
    setError("");

    if (initialPath) {
      readFolderForTab(initialPath, tab.id);
    }
  }

  // ============================================================
  // Read Folder For Tab
  // ============================================================

  async function readFolderForTab(folderPath, tabId) {
    try {
      const result = await window.fileExplorer.readDirectory(
        folderPath,
        showHiddenFiles,
      );

      if (result?.error) {
        setError(result.error);
        return false;
      }

      setActiveTabId(tabId);

      setItems(Array.isArray(result) ? result : []);

      setCurrentPath(folderPath);

      setAddressPath(folderPath);

      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabId
            ? {
                ...tab,
                path: folderPath,
                label: pathLabel(folderPath),
              }
            : tab,
        ),
      );

      return true;
    } catch (error) {
      setError(error.message || "Unable to read folder.");

      return false;
    }
  }

  // ============================================================
  // Switch Tab
  // ============================================================

  async function switchTab(tab) {
    setActiveTabId(tab.id);
    setSearchResults([]);
    setSelectedPaths(new Set());
    setLastSelectedIndex(null);

    if (!tab.path) {
      setCurrentPath(null);
      setAddressPath("This PC");
      setItems([]);
      return;
    }

    await readFolderForTab(tab.path, tab.id);
  }

  // ============================================================
  // Close Tab
  // ============================================================

  function closeTab(tabId) {
    if (tabs.length === 1) {
      return;
    }

    const index = tabs.findIndex((tab) => tab.id === tabId);

    const nextTabs = tabs.filter((tab) => tab.id !== tabId);

    setTabs(nextTabs);

    if (tabId === activeTabId) {
      const next = nextTabs[Math.max(0, index - 1)];

      setActiveTabId(next.id);

      if (next.path) {
        readFolderForTab(next.path, next.id);
      } else {
        setCurrentPath(null);
        setAddressPath("This PC");
        setItems([]);
      }
    }
  }

  // ============================================================
  // New Window
  // ============================================================

  async function openNewWindow() {
    const result = await window.fileExplorer.newWindow(currentPath);

    if (!result?.success) {
      setError(result?.error || "Failed to open a new window.");
    }
  }

  // ============================================================
  // Create ZIP
  // ============================================================

  async function createZipFromSelection() {
    if (!selectedItem && selectedList.length === 0) {
      return;
    }

    const source = selectedItem || selectedList[0];

    const zipPath = `${source.path}.zip`;

    const result = await window.fileExplorer.createZip(source.path, zipPath);

    if (!result.success) {
      setError(result.error);
      return;
    }

    await refresh();
    closeContextMenu();
  }

  // ============================================================
  // Extract ZIP
  // ============================================================

  async function extractSelectedZip() {
    if (
      !selectedItem ||
      selectedItem.isDirectory ||
      extensionOf(selectedItem) !== ".zip"
    ) {
      return;
    }

    const destination = selectedItem.path.replace(/\.zip$/i, "");

    const result = await window.fileExplorer.extractZip(
      selectedItem.path,
      destination,
    );

    if (!result.success) {
      setError(result.error);
      return;
    }

    await refresh();
    closeContextMenu();
  }

  // ============================================================
  // Create Shortcut
  // ============================================================

  async function createShortcutForSelected() {
    if (!selectedItem) {
      return;
    }

    const shortcutPath = `${selectedItem.path}.lnk`;

    const result = await window.fileExplorer.createShortcut(
      selectedItem.path,
      shortcutPath,
    );

    if (!result.success) {
      setError(result.error);
      return;
    }

    await refresh();
    closeContextMenu();
  }

  // ============================================================
  // Open Terminal
  // ============================================================

  async function openSelectedTerminal() {
    const target = selectedItem?.isDirectory ? selectedItem.path : currentPath;

    const result = await window.fileExplorer.openTerminal(target);

    if (!result.success) {
      setError(result.error);
    }

    closeContextMenu();
  }

  // ============================================================
  // File Permissions
  // ============================================================

  async function showFilePermissions() {
    if (!selectedItem) {
      return;
    }

    const result = await window.fileExplorer.getFilePermissions(
      selectedItem.path,
    );

    if (!result.success) {
      setError(result.error);
      return;
    }

    setPermissionsInfo(result);
    setShowPermissions(true);
    closeContextMenu();
  }

  // ============================================================
  // Selection Helpers
  // ============================================================

  function handleItemClick(event, item, index) {
    event.stopPropagation();
    closeContextMenu();

    const isCtrl = event.ctrlKey || event.metaKey;

    const isShift = event.shiftKey;

    // Shift + Click → range select
    if (isShift && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);

      const end = Math.max(lastSelectedIndex, index);

      const rangePaths = sortedItems
        .slice(start, end + 1)
        .map((rangeItem) => rangeItem.path);

      setSelectedPaths((prev) => {
        const next = isCtrl ? new Set(prev) : new Set();

        rangePaths.forEach((path) => next.add(path));

        return next;
      });

      setLastSelectedIndex(index);

      return;
    }

    // Ctrl + Click → toggle individual item
    if (isCtrl) {
      setSelectedPaths((prev) => {
        const next = new Set(prev);

        if (next.has(item.path)) {
          next.delete(item.path);
        } else {
          next.add(item.path);
        }

        return next;
      });

      setLastSelectedIndex(index);

      return;
    }

    // Normal click → single select
    setSelectedPaths(new Set([item.path]));

    setLastSelectedIndex(index);
  }

  // ============================================================
  // Select All
  // ============================================================

  function selectAll() {
    if (!currentPath) {
      return;
    }

    setSelectedPaths(new Set(sortedItems.map((item) => item.path)));
  }

  // ============================================================
  // Clear Selection
  // ============================================================

  function clearSelection() {
    setSelectedPaths(new Set());
    setLastSelectedIndex(null);
  }

  // ============================================================
  // Background Click
  // ============================================================

  function handleBackgroundClick() {
    closeContextMenu();
    clearSelection();
  }

  // ============================================================
  // Context Menu
  // ============================================================

  function handleContextMenu(event, item) {
    event.preventDefault();
    event.stopPropagation();

    // Agar item pehle se multi-selected hai,
    // selection ko preserve karo.
    setSelectedPaths((prev) => {
      if (prev.has(item.path) && prev.size > 1) {
        return prev;
      }

      return new Set([item.path]);
    });

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  }

  // ============================================================
  // Empty Area Context Menu
  // ============================================================

  function handleEmptyAreaContextMenu(event) {
    event.preventDefault();

    if (!currentPath) {
      return;
    }

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  }

  // ============================================================
  // Close Context Menu
  // ============================================================

  function closeContextMenu() {
    setContextMenu(null);
    setShowNewMenu(false);
  }

  // ============================================================
  // Keyboard Shortcuts
  // ============================================================

  function handleKeyboard(event) {
    const activeElement = document.activeElement;

    // Explorer shortcuts input/textarea
    // ke andar execute nahi honge.
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA")
    ) {
      // Search box me Escape se search clear.
      if (event.key === "Escape" && activeElement === searchInputRef.current) {
        setSearchQuery("");
      }

      return;
    }

    // Ctrl + A → Select All
    if (event.ctrlKey && event.key.toLowerCase() === "a") {
      if (!currentPath) {
        return;
      }

      event.preventDefault();
      selectAll();

      return;
    }

    // Ctrl + F → Search
    if (event.ctrlKey && event.key.toLowerCase() === "f") {
      event.preventDefault();

      searchInputRef.current?.focus();

      return;
    }

    // Ctrl + Z → Undo
    if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();

      return;
    }

    // Ctrl + Y / Ctrl + Shift + Z → Redo
    if (
      (event.ctrlKey && event.key.toLowerCase() === "y") ||
      (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z")
    ) {
      event.preventDefault();
      redo();

      return;
    }

    // Ctrl + C → Copy
    if (event.ctrlKey && event.key.toLowerCase() === "c") {
      if (selectedList.length === 0) {
        return;
      }

      event.preventDefault();
      copySelection();

      return;
    }

    // Ctrl + X → Cut
    if (event.ctrlKey && event.key.toLowerCase() === "x") {
      if (selectedList.length === 0) {
        return;
      }

      event.preventDefault();
      cutSelection();

      return;
    }

    // Ctrl + V → Paste
    if (event.ctrlKey && event.key.toLowerCase() === "v") {
      if (!clipboard || !currentPath) {
        return;
      }

      event.preventDefault();
      pasteItems();

      return;
    }

    // Delete → Recycle Bin
    if (event.key === "Delete") {
      if (selectedList.length === 0) {
        return;
      }

      event.preventDefault();
      deleteSelection();

      return;
    }

    // F2 → Rename
    if (event.key === "F2") {
      if (!selectedItem) {
        return;
      }

      event.preventDefault();

      setRenameValue(selectedItem.name);

      setShowRename(true);
      closeContextMenu();

      return;
    }

    // F5 → Refresh
    if (event.key === "F5") {
      event.preventDefault();
      refresh();

      return;
    }

    // Enter → Open
    if (event.key === "Enter") {
      if (selectedList.length === 0) {
        return;
      }

      event.preventDefault();
      openSelection();

      return;
    }

    // Ctrl + T → New Tab
    if (event.ctrlKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      newTab();

      return;
    }

    // Ctrl + W → Close Tab
    if (event.ctrlKey && event.key.toLowerCase() === "w") {
      event.preventDefault();
      closeTab(activeTabId);

      return;
    }

    // Ctrl + Shift + N → New Window
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      openNewWindow();

      return;
    }

    // Backspace → Back
    if (event.key === "Backspace") {
      if (!currentPath || historyIndex <= 0) {
        return;
      }

      event.preventDefault();
      goBack();
    }
  }

  // ============================================================
  // Properties
  // ============================================================

  async function openProperties() {
    if (!selectedItem) {
      return;
    }

    try {
      const result = await window.fileExplorer.getFileInfo(selectedItem.path);

      if (result?.error) {
        setError(result.error);
        closeContextMenu();

        return;
      }

      setPropertiesItem(result);
      setShowProperties(true);
      setFolderSize(null);

      closeContextMenu();

      if (result.isDirectory) {
        setFolderSize("calculating");

        const sizeResult = await window.fileExplorer.getFolderSize(result.path);

        if (sizeResult?.success) {
          setFolderSize(sizeResult);
        } else {
          setFolderSize(null);
        }
      }
    } catch (error) {
      console.error("Properties failed:", error);

      setError(error.message || "Unable to load properties.");

      closeContextMenu();
    }
  }

  // ============================================================
  // Rename
  // ============================================================

  async function renameSelectedItem() {
    if (!selectedItem) {
      return;
    }

    const newName = renameValue.trim();

    if (!newName) {
      return;
    }

    if (/[<>:"/\\|?*]/.test(newName)) {
      setError("The name contains invalid Windows filename characters.");

      return;
    }

    const oldPath = selectedItem.path;

    const lastSlash = oldPath.lastIndexOf("\\");

    if (lastSlash === -1) {
      return;
    }

    const parentPath = oldPath.substring(0, lastSlash);

    const newPath = `${parentPath}\\${newName}`;

    try {
      const result = await window.fileExplorer.renameItem(oldPath, newPath);

      if (!result?.success) {
        console.error("Rename failed:", result?.error);

        setError(result?.error || "Rename failed.");

        return;
      }

      pushUndo({
        type: "rename",
        oldPath,
        newPath,
      });

      setShowRename(false);
      setRenameValue("");

      await refresh();

      setSelectedPaths(new Set([newPath]));
    } catch (error) {
      console.error("Rename failed:", error);

      setError(error.message || "Rename failed.");
    }
  }

  // ============================================================
  // Delete
  // ============================================================

  async function deleteSelection() {
    if (selectedList.length === 0) {
      return;
    }

    const confirmMessage =
      selectedList.length === 1
        ? `Are you sure you want to move "${selectedList[0].name}" to the Recycle Bin?`
        : `Are you sure you want to move ${selectedList.length} items to the Recycle Bin?`;

    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) {
      return;
    }

    let hadError = false;

    for (const item of selectedList) {
      try {
        const result = await window.fileExplorer.deleteItem(item.path);

        if (!result?.success) {
          console.error("Delete failed:", result?.error);

          setError(result?.error || "Delete failed.");

          hadError = true;
        }
      } catch (error) {
        console.error("Delete failed:", error);

        setError(error.message || "Delete failed.");

        hadError = true;
      }
    }

    if (!hadError) {
      setError("");
    }

    clearSelection();

    await refresh();
  }

  // ============================================================
  // Copy
  // ============================================================

  function copySelection() {
    if (selectedList.length === 0) {
      return;
    }

    const paths = selectedList.map((item) => item.path);

    setClipboard({
      paths,
      operation: "copy",
    });

    addClipboardHistory("copy", paths);

    closeContextMenu();
  }

  // ============================================================
  // Cut
  // ============================================================

  function cutSelection() {
    if (selectedList.length === 0) {
      return;
    }

    const paths = selectedList.map((item) => item.path);

    setClipboard({
      paths,
      operation: "cut",
    });

    addClipboardHistory("cut", paths);

    closeContextMenu();
  }

  // ============================================================
  // Paste
  // ============================================================

  async function pasteItems() {
    if (!clipboard || !currentPath) {
      return;
    }

    const actions = [];
    let hadError = false;

    for (const sourcePath of clipboard.paths) {
      const itemName = sourcePath.substring(sourcePath.lastIndexOf("\\") + 1);

      const destinationPath = `${currentPath}\\${itemName}`;

      const normalizedSource = sourcePath.replace(/[\\/]+$/, "").toLowerCase();

      const normalizedDestination = destinationPath
        .replace(/[\\/]+$/, "")
        .toLowerCase();

      // Same location
      if (normalizedSource === normalizedDestination) {
        continue;
      }

      // Folder cannot be copied/moved
      // into itself or its child.
      if (normalizedDestination.startsWith(normalizedSource + "\\")) {
        setError(
          "Cannot copy or move a folder into itself or one of its subfolders.",
        );

        hadError = true;
        continue;
      }

      try {
        let result;

        if (clipboard.operation === "copy") {
          result = await window.fileExplorer.copyItem(
            sourcePath,
            destinationPath,
          );

          if (result?.success) {
            actions.push({
              type: "copy",
              sourcePath,
              createdPath: destinationPath,
            });
          }
        } else {
          result = await window.fileExplorer.moveItem(
            sourcePath,
            destinationPath,
          );

          if (result?.success) {
            actions.push({
              type: "move",
              from: sourcePath,
              to: destinationPath,
            });
          }
        }

        if (!result?.success) {
          setError(result?.error || "Paste failed.");

          hadError = true;
        }
      } catch (error) {
        console.error("Paste failed:", error);

        setError(error.message || "Paste failed.");

        hadError = true;
      }
    }

    if (actions.length > 0) {
      pushUndo(actions);
    }

    if (clipboard.operation === "cut" && !hadError) {
      setClipboard(null);
    }

    await refresh();
    closeContextMenu();
  }

  // ============================================================
  // Create New Item
  // ============================================================

  async function createNewItem(itemType) {
    if (!currentPath) {
      return;
    }

    try {
      const result = await window.fileExplorer.createItem(
        currentPath,
        itemType,
      );

      if (!result?.success) {
        setError(result?.error || "Unable to create item.");

        return;
      }

      pushUndo({
        type: "create",
        path: result.path,
        itemType,
        parentPath: currentPath,
      });

      setShowNewMenu(false);
      closeContextMenu();

      await refresh();

      setSelectedPaths(new Set([result.path]));
    } catch (error) {
      console.error("Create item failed:", error);

      setError(error.message || "Create item failed.");
    }
  }

  // ============================================================
  // Undo / Redo
  // ============================================================

  function pushUndo(entry) {
    const actions = Array.isArray(entry) ? entry : [entry];

    if (actions.length === 0) {
      return;
    }

    setUndoStack((prev) => [...prev, actions]);

    // New action invalidates redo history.
    setRedoStack([]);
  }

  async function undoAction(action) {
    try {
      if (action.type === "rename") {
        await window.fileExplorer.renameItem(action.newPath, action.oldPath);
      } else if (action.type === "move") {
        await window.fileExplorer.moveItem(action.to, action.from);
      } else if (action.type === "copy") {
        await window.fileExplorer.deleteItem(action.createdPath);
      } else if (action.type === "create") {
        await window.fileExplorer.deleteItem(action.path);
      }
    } catch (error) {
      console.error("Undo failed:", error);

      setError(`Undo failed: ${error.message || "Unknown error"}`);
    }
  }

  async function redoAction(action) {
    try {
      if (action.type === "rename") {
        await window.fileExplorer.renameItem(action.oldPath, action.newPath);
      } else if (action.type === "move") {
        await window.fileExplorer.moveItem(action.from, action.to);
      } else if (action.type === "copy") {
        await window.fileExplorer.copyItem(
          action.sourcePath,
          action.createdPath,
        );
      } else if (action.type === "create") {
        const result = await window.fileExplorer.createItem(
          action.parentPath,
          action.itemType,
        );

        if (!result?.success) {
          throw new Error(result?.error || "Unable to recreate item.");
        }
      }
    } catch (error) {
      console.error("Redo failed:", error);

      setError(`Redo failed: ${error.message || "Unknown error"}`);
    }
  }

  async function undo() {
    if (undoStack.length === 0) {
      return;
    }

    const actions = undoStack[undoStack.length - 1];

    setUndoStack((prev) => prev.slice(0, -1));

    for (const action of [...actions].reverse()) {
      await undoAction(action);
    }

    setRedoStack((prev) => [...prev, actions]);

    await refresh();
  }

  async function redo() {
    if (redoStack.length === 0) {
      return;
    }

    const actions = redoStack[redoStack.length - 1];

    setRedoStack((prev) => prev.slice(0, -1));

    for (const action of actions) {
      await redoAction(action);
    }

    setUndoStack((prev) => [...prev, actions]);

    await refresh();
  }

  // ============================================================
  // Open File / Folder Directly
  // ============================================================

  async function openSelectedItemByPath(item) {
    if (!item) {
      return;
    }

    if (item.isDirectory) {
      await openFolder(item.path);

      return;
    }

    try {
      const result = await window.fileExplorer.openItem(item.path);

      if (!result?.success) {
        setError(result?.error || "Failed to open item.");
      }
    } catch (error) {
      console.error("Open failed:", error);

      setError(error.message || "Failed to open item.");
    }
  }

  // ============================================================
  // Open Selection
  // ============================================================

  async function openSelection() {
    if (selectedList.length === 0) {
      return;
    }

    // Single selection
    if (selectedList.length === 1) {
      closeContextMenu();

      await openSelectedItemByPath(selectedList[0]);

      return;
    }

    // Multiple selections:
    // only files are opened.
    closeContextMenu();

    for (const item of selectedList) {
      if (!item.isDirectory) {
        try {
          const result = await window.fileExplorer.openItem(item.path);

          if (!result?.success) {
            setError(result?.error || "Failed to open item.");
          }
        } catch (error) {
          console.error("Open failed:", error);

          setError(error.message || "Failed to open item.");
        }
      }
    }
  }

  // ============================================================
  // Drag & Drop — Internal Move
  // ============================================================

  function handleDragStart(event, item) {
    event.stopPropagation();

    let paths = selectedPaths;

    if (!selectedPaths.has(item.path)) {
      paths = new Set([item.path]);

      setSelectedPaths(paths);

      setLastSelectedIndex(null);
    }

    setDraggedPaths(paths);

    event.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(event, item) {
    if (!item.isDirectory || !draggedPaths) {
      return;
    }

    if (draggedPaths.has(item.path)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect = "move";

    setDragOverPath(item.path);
  }

  function handleDragLeave(item) {
    setDragOverPath((prev) => (prev === item.path ? null : prev));
  }

  async function handleDrop(event, item) {
    event.preventDefault();
    event.stopPropagation();

    setDragOverPath(null);

    if (!item.isDirectory || !draggedPaths) {
      return;
    }

    if (draggedPaths.has(item.path)) {
      return;
    }

    const targetFolder = item.path;

    const actions = [];

    for (const sourcePath of draggedPaths) {
      const itemName = sourcePath.substring(sourcePath.lastIndexOf("\\") + 1);

      const destinationPath = `${targetFolder}\\${itemName}`;

      const normalizedSource = sourcePath.replace(/[\\/]+$/, "").toLowerCase();

      const normalizedDestination = destinationPath
        .replace(/[\\/]+$/, "")
        .toLowerCase();

      if (normalizedSource === normalizedDestination) {
        continue;
      }

      if (normalizedDestination.startsWith(normalizedSource + "\\")) {
        setError(
          "Cannot copy or move a folder into itself or one of its subfolders.",
        );

        continue;
      }

      try {
        const result = await window.fileExplorer.moveItem(
          sourcePath,
          destinationPath,
        );

        if (result?.success) {
          actions.push({
            type: "move",
            from: sourcePath,
            to: destinationPath,
          });
        } else {
          setError(result?.error || "Drag & drop move failed.");
        }
      } catch (error) {
        console.error("Drag & drop move failed:", error);

        setError(error.message || "Drag & drop move failed.");
      }
    }

    if (actions.length > 0) {
      pushUndo(actions);
    }

    setDraggedPaths(null);

    await refresh();
  }

  function handleDragEnd() {
    setDraggedPaths(null);
    setDragOverPath(null);
  }

  // ============================================================
  // Format Size
  // ============================================================

  function formatSize(bytes) {
    if (bytes === 0) {
      return "0 Bytes";
    }

    if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) {
      return "Unknown";
    }

    if (bytes < 0) {
      return "Unknown";
    }

    const units = ["Bytes", "KB", "MB", "GB", "TB"];

    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );

    return (bytes / Math.pow(1024, index)).toFixed(2) + " " + units[index];
  }



  // ============================================================
  // Format Date
  // ============================================================

  function formatDate(date) {
    if (!date) {
      return "Unknown";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Unknown";
    }

    return parsedDate.toLocaleString();
  }

  // ============================================================
  // File Type Label
  // ============================================================

  function fileTypeLabel(item) {
    if (item.isDirectory) {
      return "File folder";
    }

    const dotIndex = item.name.lastIndexOf(".");

    if (dotIndex === -1) {
      return "File";
    }

    return item.name.substring(dotIndex + 1).toUpperCase() + " File";
  }

  // ============================================================
  // Sort
  // ============================================================

  function handleSortClick(field) {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  function sortIndicator(field) {
    if (sortBy !== field) {
      return "";
    }

    return sortOrder === "asc" ? " ▲" : " ▼";
  }

  // ============================================================
  // Filter / Sort Data
  // ============================================================

  const baseItems = deepSearch && searchQuery.trim() ? searchResults : items;

  const filteredItems = baseItems.filter((item) => {
    const matchesText = item.name
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());

    return matchesText && matchesFilter(item);
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    // Folders first.
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    let compare = 0;

    if (sortBy === "name") {
      compare = a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    } else if (sortBy === "size") {
      compare = (a.size || 0) - (b.size || 0);
    } else if (sortBy === "type") {
      compare = fileTypeLabel(a).localeCompare(fileTypeLabel(b));
    } else if (sortBy === "date") {
      compare = new Date(a.modified || 0) - new Date(b.modified || 0);
    }

    return sortOrder === "asc" ? compare : -compare;
  });

  const selectedList = sortedItems.filter((item) =>
    selectedPaths.has(item.path),
  );

  const selectedItem = selectedList.length === 1 ? selectedList[0] : null;

  const hasSelection = selectedList.length > 0;

  // ============================================================
  // Phase 4 — Advanced Results
  // ============================================================

  function renderAdvancedResults() {
    if (advancedLoading) {
      return <div className="phase4-status">⏳ Working...</div>;
    }

    if (!advancedResults) {
      return null;
    }

    // ----------------------------------------------------------
    // Batch Rename
    // ----------------------------------------------------------

    if (advancedOperation === "batch-rename") {
      const results = Array.isArray(advancedResults.results)
        ? advancedResults.results
        : [];

      return (
        <div className="phase4-results">
          <div className="phase4-result-title">Rename Results</div>

          {results.length === 0 ? (
            <div className="phase4-muted">No rename results returned.</div>
          ) : (
            results.map((item, index) => (
              <div
                className="phase4-result-row"
                key={`${item.oldPath}-${index}`}
              >
                <span className={item.success ? "phase4-ok" : "phase4-fail"}>
                  {item.success ? "✓" : "✕"}
                </span>

                <div>
                  <div>{formatResultPath(item.oldPath)}</div>

                  <small>→ {formatResultPath(item.newPath)}</small>

                  {item.error && (
                    <small className="phase4-fail">{item.error}</small>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Duplicate Finder
    // ----------------------------------------------------------

    if (advancedOperation === "duplicates") {
      const groups = Array.isArray(advancedResults.groups)
        ? advancedResults.groups
        : [];

      return (
        <div className="phase4-results">
          <div className="phase4-result-title">
            Duplicate Groups ({groups.length})
          </div>

          {groups.length === 0 ? (
            <div className="phase4-muted">No duplicate files found.</div>
          ) : (
            groups.map((group, index) => (
              <div className="phase4-group" key={`${group.hash}-${index}`}>
                <div className="phase4-group-head">
                  <strong>Group {index + 1}</strong>

                  <span>{formatSize(group.size)}</span>
                </div>

                <small className="phase4-mono">SHA-256: {group.hash}</small>

                {Array.isArray(group.paths) &&
                  group.paths.map((filePath) => (
                    <div className="phase4-path" key={filePath}>
                      📄 {filePath}
                    </div>
                  ))}
              </div>
            ))
          )}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Large Files
    // ----------------------------------------------------------

    if (advancedOperation === "large-files") {
      const results = Array.isArray(advancedResults.results)
        ? advancedResults.results
        : [];

      return (
        <div className="phase4-results">
          <div className="phase4-result-title">
            Large Files ({results.length})
          </div>

          {results.length === 0 ? (
            <div className="phase4-muted">No files matched the threshold.</div>
          ) : (
            results.map((item) => (
              <div className="phase4-result-row" key={item.path}>
                <span>📄</span>

                <div>
                  <strong>{item.name || pathLabel(item.path)}</strong>

                  <div>{formatSize(item.size)}</div>

                  <small>{item.path}</small>
                </div>
              </div>
            ))
          )}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Empty Folders
    // ----------------------------------------------------------

    if (advancedOperation === "empty-folders") {
      const results = Array.isArray(advancedResults.results)
        ? advancedResults.results
        : [];

      return (
        <div className="phase4-results">
          <div className="phase4-result-title">
            Empty Folders ({results.length})
          </div>

          {results.length === 0 ? (
            <div className="phase4-muted">No empty folders found.</div>
          ) : (
            results.map((item) => (
              <div className="phase4-path" key={item.path}>
                📁 {item.path}
              </div>
            ))
          )}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Compare Files
    // ----------------------------------------------------------

    if (advancedOperation === "compare-files") {
      return (
        <div className="phase4-results">
          <div
            className={`phase4-compare ${
              advancedResults.identical ? "same" : "different"
            }`}
          >
            {advancedResults.identical
              ? "✓ Files are identical"
              : "✕ Files are different"}
          </div>

          {advancedResults.reason === "size" && (
            <div className="phase4-muted">
              Different sizes: {formatSize(advancedResults.firstSize)} vs{" "}
              {formatSize(advancedResults.secondSize)}
            </div>
          )}

          {advancedResults.algorithm && (
            <div className="phase4-hash-grid">
              <div>
                <span>Algorithm</span>

                <strong>{advancedResults.algorithm}</strong>
              </div>

              <div>
                <span>File 1</span>

                <code>{advancedResults.firstHash || "—"}</code>
              </div>

              <div>
                <span>File 2</span>

                <code>{advancedResults.secondHash || "—"}</code>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Compare Folders
    // ----------------------------------------------------------

    if (advancedOperation === "compare-folders") {
      const sections = [
        ["Only in first folder", advancedResults.onlyInFirst],
        ["Only in second folder", advancedResults.onlyInSecond],
        ["Different", advancedResults.different],
        ["Same", advancedResults.same],
      ];

      return (
        <div className="phase4-results">
          <div className="phase4-result-title">Folder Comparison</div>

          {sections.map(([title, values]) => (
            <div className="phase4-section" key={title}>
              <strong>
                {title} ({values?.length || 0})
              </strong>

              {(values || []).slice(0, 100).map((value) => (
                <div className="phase4-path" key={`${title}-${value}`}>
                  {value}
                </div>
              ))}

              {(values?.length || 0) > 100 && (
                <small className="phase4-muted">Showing first 100 items.</small>
              )}
            </div>
          ))}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Merge Folders
    // ----------------------------------------------------------

    if (advancedOperation === "merge") {
      return (
        <div className="phase4-results">
          <div className="phase4-compare same">✓ Folder merge completed</div>

          {advancedResults.path && (
            <div className="phase4-path">📁 {advancedResults.path}</div>
          )}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Hash
    // ----------------------------------------------------------

    if (advancedOperation === "hash") {
      const hashes = advancedResults.hashes || {};

      return (
        <div className="phase4-results">
          <div className="phase4-result-title">File Hashes</div>

          {Object.entries(hashes).map(([algorithm, hash]) => (
            <div className="phase4-hash-line" key={algorithm}>
              <span>{algorithm.toUpperCase()}</span>

              <code>{hash}</code>

              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(String(hash))}
                title="Copy hash"
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      );
    }

    // ----------------------------------------------------------
    // Integrity
    // ----------------------------------------------------------

    if (advancedOperation === "integrity") {
      return (
        <div className="phase4-results">
          <div
            className={`phase4-compare ${
              advancedResults.verified ? "same" : "different"
            }`}
          >
            {advancedResults.verified
              ? "✓ Integrity verified"
              : "✕ Integrity check failed"}
          </div>

          <div className="phase4-hash-grid">
            <div>
              <span>Algorithm</span>

              <strong>{advancedResults.algorithm}</strong>
            </div>

            <div>
              <span>Expected</span>

              <code>{advancedResults.expectedHash}</code>
            </div>

            <div>
              <span>Actual</span>

              <code>{advancedResults.actualHash}</code>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  // ============================================================
  // Transfer Queue
  // ============================================================

  function renderTransferQueue() {
    if (!transferQueue.length) {
      return <div className="phase4-muted">No transfer jobs.</div>;
    }

    return transferQueue.map((job) => {
      const percent = Math.max(0, Math.min(100, Number(job.percent) || 0));

      return (
        <div
          className={`phase4-transfer-job ${
            selectedTransferJob === job.id ? "selected" : ""
          }`}
          key={job.id}
          onClick={() => setSelectedTransferJob(job.id)}
        >
          <div className="phase4-transfer-head">
            <strong>{job.operation === "move" ? "Move" : "Copy"}</strong>

            <span>{job.state || "queued"}</span>
          </div>

          <div className="phase4-progress-track">
            <div
              className="phase4-progress-fill"
              style={{
                width: `${percent}%`,
              }}
            />
          </div>

          <div className="phase4-transfer-meta">
            <span>{percent.toFixed(1)}%</span>

            <span>{formatTransferSpeed(job.speed)}</span>

            <span>
              {formatSize(job.completedBytes || 0)}
              {" / "}
              {formatSize(job.totalBytes || 0)}
            </span>
          </div>

          {job.currentFile && <small>{job.currentFile}</small>}
        </div>
      );
    });
  }

  // ============================================================
  // Main UI
  // ============================================================

  return (
    <div className="explorer" onClick={handleBackgroundClick}>
      {/* ======================================================
          TOP BAR
      ====================================================== */}

      <header className="topbar">
        <div className="navigation">
          {/* Back */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goBack();
            }}
            disabled={historyIndex <= 0}
            title="Back"
          >
            ←
          </button>

          {/* Forward */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goForward();
            }}
            disabled={historyIndex >= history.length - 1}
            title="Forward"
          >
            →
          </button>

          {/* Up */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goUp();
            }}
            disabled={!currentPath}
            title="Up"
          >
            ↑
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              refresh();
            }}
            title="Refresh (F5)"
          >
            ↻
          </button>

          {/* Undo */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              undo();
            }}
            disabled={undoStack.length === 0}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>

          {/* Redo */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              redo();
            }}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>
        </div>

        {/* Address Bar */}
        <form
          className="address-bar"
          onSubmit={handleAddressSubmit}
          onClick={(event) => event.stopPropagation()}
        >
          <span>📁</span>

          <input
            type="text"
            value={addressPath}
            onChange={(event) => setAddressPath(event.target.value)}
            onFocus={(event) => event.target.select()}
            placeholder="Enter a path..."
          />
        </form>

        {/* Search */}
        <div
          className="search-box"
          onClick={(event) => event.stopPropagation()}
        >
          <span>🔍</span>

          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(event) => {
              const value = event.target.value;

              setSearchQuery(value);

              if (!value.trim()) {
                setSearchResults([]);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && deepSearch) {
                runAdvancedSearch();
              }
            }}
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Sort + View Controls */}
        <div
          className="view-controls"
          onClick={(event) => event.stopPropagation()}
        >
          {/* File Type Filter */}
          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            title="File type filter"
          >
            <option value="all">All</option>

            <option value="folder">Folders</option>

            <option value="image">Images</option>

            <option value="video">Videos</option>

            <option value="audio">Audio</option>

            <option value="document">Documents</option>

            <option value="archive">Archives</option>
          </select>

          {/* Deep Search */}
          <button
            type="button"
            className={deepSearch ? "active" : ""}
            onClick={() => {
              setDeepSearch((prev) => !prev);

              setSearchResults([]);
            }}
            title="Search subfolders"
          >
            🔎
          </button>

          {/* Hidden Files */}
          <button
            type="button"
            className={showHiddenFiles ? "active" : ""}
            onClick={async () => {
              const nextValue = !showHiddenFiles;

              setShowHiddenFiles(nextValue);

              if (currentPath) {
                await readFolder(currentPath, nextValue);
              }

              if (deepSearch && searchQuery.trim()) {
                await runAdvancedSearch(nextValue);
              }
            }}
            title={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
          >
            {showHiddenFiles ? "👁️" : "🙈"}
          </button>

          {/* File Extensions */}
          <button
            type="button"
            className={showFileExtensions ? "active" : ""}
            onClick={() => setShowFileExtensions((prev) => !prev)}
            title={
              showFileExtensions
                ? "Hide file extensions"
                : "Show file extensions"
            }
          >
            {showFileExtensions ? "📄" : "📄̸"}
          </button>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            title="Sort by"
          >
            <option value="name">Name</option>

            <option value="date">Date modified</option>

            <option value="type">Type</option>

            <option value="size">Size</option>
          </select>

          {/* Sort Direction */}
          <button
            type="button"
            onClick={() =>
              setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            title="Toggle sort order"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </button>

          {/* Grid */}
          <button
            type="button"
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            🔲
          </button>

          {/* List */}
          <button
            type="button"
            className={viewMode === "list" ? "active" : ""}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            📋
          </button>

          {/* Advanced Operations */}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openAdvancedOperations();
            }}
            title="Advanced file operations"
          >
            ⚙️
          </button>

          {/* Clipboard History */}
          <button
            type="button"
            onClick={() => setShowClipboardHistory(true)}
            title="Clipboard history"
          >
            📋+
          </button>
        </div>
      </header>

      {/* ======================================================
          TABS
      ====================================================== */}

      <div className="tabs-bar" onClick={(event) => event.stopPropagation()}>
        <div className="tabs-list">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`explorer-tab ${
                tab.id === activeTabId ? "active" : ""
              }`}
              onClick={() => switchTab(tab)}
              title={tab.path || "This PC"}
            >
              <span>📁 {tab.label}</span>

              {tabs.length > 1 && (
                <button
                  type="button"
                  className="tab-close"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  title="Close tab"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="tab-action"
          onClick={() => newTab()}
          title="New tab (Ctrl+T)"
        >
          +
        </button>

        <button
          type="button"
          className="tab-action"
          onClick={openNewWindow}
          title="New window (Ctrl+Shift+N)"
        >
          🪟
        </button>
      </div>

      {/* ======================================================
          MAIN AREA
      ====================================================== */}

      <div className="main-area">
        {/* ====================================================
            SIDEBAR
        ==================================================== */}

        <aside className="sidebar">
          <div className="sidebar-title">Quick Access</div>

          <div className="sidebar-item">🏠 Home</div>

          <div className="sidebar-item">⭐ Favorites</div>

          {favorites.map((favorite) => (
            <div
              key={favorite}
              className="sidebar-item favorite-item"
              onClick={() => openFavorite(favorite)}
              title={favorite}
            >
              📌 {pathLabel(favorite)}
            </div>
          ))}

          <div className="sidebar-item">📥 Downloads</div>

          <div className="sidebar-item">📄 Documents</div>

          <div className="sidebar-item">🖼️ Pictures</div>

          <div className="sidebar-item">🎵 Music</div>

          <div className="sidebar-item">🎬 Videos</div>

          <div className="sidebar-title">This PC</div>

          <div className="sidebar-item" onClick={goToThisPC}>
            💻 This PC
          </div>

          {drives.map((drive) => (
            <div
              key={drive.path}
              className="sidebar-item"
              onClick={() => openFolder(drive.path)}
            >
              💾 {drive.name}
            </div>
          ))}
        </aside>

        {/* ====================================================
            CONTENT
        ==================================================== */}

        <main className="content" onContextMenu={handleEmptyAreaContextMenu}>
          <h2>{currentPath || "This PC"}</h2>

          {/* Error */}
          {error && <div className="error-message">⚠️ {error}</div>}

          {/* ==================================================
              DRIVES
          ================================================== */}

          {!currentPath && (
            <section>
              <h3>Drives</h3>

              <div className="drive-grid">
                {drives.map((drive) => {
                  const capacity = getDriveCapacityInfo(drive.path);

                  return (
                    <div
                      className="drive"
                      key={drive.path}
                      onDoubleClick={() => openFolder(drive.path)}
                    >
                      <div className="drive-icon">💾</div>

                      <div className="drive-info">
                        <strong>{drive.name}</strong>

                        {capacity && (
                          <>
                            <div>Used: {capacity.usedFormatted}</div>

                            <div>Free: {capacity.freeFormatted}</div>

                            <div>Total: {capacity.totalFormatted}</div>

                            <div>{capacity.usedPercentage}% used</div>
                          </>
                        )}

                        <p>{drive.path}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ==================================================
              FILES & FOLDERS — GRID VIEW
          ================================================== */}

          {currentPath && viewMode === "grid" && (
            <section>
              <h3>Files & Folders</h3>

              <div className="file-grid">
                {sortedItems.map((item, index) => {
                  const isSelected = selectedPaths.has(item.path);

                  const isDragOver = dragOverPath === item.path;

                  const isDragging = draggedPaths?.has(item.path);

                  return (
                    <div
                      className={[
                        "file-item",
                        isSelected ? "selected" : "",
                        isDragOver ? "drag-over" : "",
                        isDragging ? "dragging" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={item.path}
                      draggable
                      onDragStart={(event) => handleDragStart(event, item)}
                      onDragOver={(event) => handleDragOver(event, item)}
                      onDragLeave={() => handleDragLeave(item)}
                      onDrop={(event) => handleDrop(event, item)}
                      onDragEnd={handleDragEnd}
                      onClick={(event) => handleItemClick(event, item, index)}
                      onDoubleClick={() => {
                        if (item.isDirectory) {
                          openFolder(item.path);
                        } else {
                          openSelectedItemByPath(item);
                        }
                      }}
                      onContextMenu={(event) => {
                        event.stopPropagation();

                        handleContextMenu(event, item);
                      }}
                    >
                      <div className="file-icon">
                        {item.isDirectory ? "📁" : "📄"}
                      </div>

                      <span>{displayItemName(item)}</span>
                    </div>
                  );
                })}

                {searchLoading && (
                  <div className="no-results">Searching subfolders...</div>
                )}

                {!searchLoading &&
                  searchQuery.trim() &&
                  sortedItems.length === 0 && (
                    <div className="no-results">No items found</div>
                  )}
              </div>
            </section>
          )}

          {/* ==================================================
              FILES & FOLDERS — LIST / DETAILS VIEW
          ================================================== */}

          {currentPath && viewMode === "list" && (
            <section>
              <h3>Files & Folders</h3>

              <div className="file-list">
                {/* Table Header */}

                <div className="file-list-header">
                  <span onClick={() => handleSortClick("name")}>
                    Name
                    {sortIndicator("name")}
                  </span>

                  <span onClick={() => handleSortClick("date")}>
                    Date modified
                    {sortIndicator("date")}
                  </span>

                  <span onClick={() => handleSortClick("type")}>
                    Type
                    {sortIndicator("type")}
                  </span>

                  <span onClick={() => handleSortClick("size")}>
                    Size
                    {sortIndicator("size")}
                  </span>
                </div>

                {/* File Rows */}

                {sortedItems.map((item, index) => {
                  const isSelected = selectedPaths.has(item.path);

                  const isDragOver = dragOverPath === item.path;

                  const isDragging = draggedPaths?.has(item.path);

                  return (
                    <div
                      className={[
                        "file-row",
                        isSelected ? "selected" : "",
                        isDragOver ? "drag-over" : "",
                        isDragging ? "dragging" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={item.path}
                      draggable
                      onDragStart={(event) => handleDragStart(event, item)}
                      onDragOver={(event) => handleDragOver(event, item)}
                      onDragLeave={() => handleDragLeave(item)}
                      onDrop={(event) => handleDrop(event, item)}
                      onDragEnd={handleDragEnd}
                      onClick={(event) => handleItemClick(event, item, index)}
                      onDoubleClick={() => {
                        if (item.isDirectory) {
                          openFolder(item.path);
                        } else {
                          openSelectedItemByPath(item);
                        }
                      }}
                      onContextMenu={(event) => {
                        event.stopPropagation();

                        handleContextMenu(event, item);
                      }}
                    >
                      <span className="file-row-name">
                        {item.isDirectory ? "📁" : "📄"} {displayItemName(item)}
                      </span>

                      <span>{formatDate(item.modified)}</span>

                      <span>{fileTypeLabel(item)}</span>

                      <span>
                        {item.isDirectory ? "" : formatSize(item.size)}
                      </span>
                    </div>
                  );
                })}

                {searchLoading && (
                  <div className="no-results">Searching subfolders...</div>
                )}

                {!searchLoading &&
                  searchQuery.trim() &&
                  sortedItems.length === 0 && (
                    <div className="no-results">No items found</div>
                  )}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* ======================================================
          STATUS BAR
      ====================================================== */}

      <footer className="statusbar">
        {currentPath
          ? `${items.length} items${
              hasSelection ? ` (${selectedList.length} selected)` : ""
            }`
          : `${drives.length} drives`}
      </footer>

      {/* ======================================================
          CONTEXT MENU
      ====================================================== */}

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {/* Open */}

          {hasSelection && (
            <div className="context-item" onClick={openSelection}>
              Open
            </div>
          )}

          {hasSelection && <div className="context-separator" />}

          {/* Copy */}

          {hasSelection && (
            <div className="context-item" onClick={copySelection}>
              Copy
              {selectedList.length > 1 ? ` (${selectedList.length})` : ""}
            </div>
          )}

          {/* Cut */}

          {hasSelection && (
            <div className="context-item" onClick={cutSelection}>
              Cut
              {selectedList.length > 1 ? ` (${selectedList.length})` : ""}
            </div>
          )}

          {/* Favorite */}

          {selectedItem && (
            <div
              className="context-item"
              onClick={() => toggleFavorite(selectedItem.path)}
            >
              {favorites.includes(selectedItem.path)
                ? "★ Unpin from Quick Access"
                : "📌 Pin to Quick Access"}
            </div>
          )}

          {/* Paste */}

          {currentPath && (
            <div
              className={`context-item ${!clipboard ? "context-disabled" : ""}`}
              onClick={() => {
                if (clipboard) {
                  pasteItems();
                }
              }}
            >
              Paste
            </div>
          )}

          {/* Rename */}

          {selectedItem && (
            <div
              className="context-item"
              onClick={() => {
                setRenameValue(selectedItem.name);

                setShowRename(true);

                closeContextMenu();
              }}
            >
              Rename
            </div>
          )}

          {/* Delete */}

          {hasSelection && (
            <div className="context-item" onClick={deleteSelection}>
              Delete
              {selectedList.length > 1 ? ` (${selectedList.length})` : ""}
            </div>
          )}

          {/* Create ZIP */}

          {selectedItem && (
            <div className="context-item" onClick={createZipFromSelection}>
              📦 Create ZIP
            </div>
          )}

          {/* Extract ZIP */}

          {selectedItem &&
            !selectedItem.isDirectory &&
            extensionOf(selectedItem) === ".zip" && (
              <div className="context-item" onClick={extractSelectedZip}>
                📂 Extract ZIP
              </div>
            )}

          {/* Shortcut */}

          {selectedItem && (
            <div className="context-item" onClick={createShortcutForSelected}>
              🔗 Create Shortcut
            </div>
          )}

          {/* Terminal */}

          {currentPath && (
            <div className="context-item" onClick={openSelectedTerminal}>
              🖥️ Open in Terminal
            </div>
          )}

          {/* Permissions */}

          {selectedItem && (
            <div className="context-item" onClick={showFilePermissions}>
              🛡️ Access / Permissions
            </div>
          )}

          {/* Properties */}

          {selectedItem && (
            <div className="context-item" onClick={openProperties}>
              Properties
            </div>
          )}

          <div className="context-separator" />

          {/* Select All */}

          <div
            className="context-item"
            onClick={() => {
              selectAll();
              closeContextMenu();
            }}
          >
            Select All
          </div>

          <div className="context-separator" />

          {/* New */}

          <div
            className="context-item new-menu-item"
            onMouseEnter={() => setShowNewMenu(true)}
            onClick={(event) => {
              event.stopPropagation();

              setShowNewMenu((prev) => !prev);
            }}
          >
            <span>New</span>

            <span>›</span>

            {showNewMenu && (
              <div
                className="new-submenu"
                onClick={(event) => event.stopPropagation()}
              >
                {/* New Folder */}

                <div
                  className="context-item"
                  onClick={() => createNewItem("folder")}
                >
                  📁 Folder
                </div>

                {/* New Text Document */}

                <div
                  className="context-item"
                  onClick={() => createNewItem("text")}
                >
                  📄 Text Document
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================
          RENAME MODAL
      ====================================================== */}

      {showRename && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowRename(false)}>
          <div
            className="rename-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Rename</h3>

            <input
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  renameSelectedItem();
                }

                if (event.key === "Escape") {
                  setShowRename(false);
                }
              }}
            />

            <div className="rename-buttons">
              <button type="button" onClick={() => setShowRename(false)}>
                Cancel
              </button>

              <button type="button" onClick={renameSelectedItem}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          CLIPBOARD HISTORY
      ====================================================== */}

      {showClipboardHistory && (
        <div
          className="modal-overlay"
          onClick={() => setShowClipboardHistory(false)}
        >
          <div
            className="clipboard-history-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="properties-header">
              <span>📋</span>

              <strong>Clipboard History</strong>
            </div>

            <div className="clipboard-history-list">
              {clipboardHistory.length === 0 && (
                <div className="no-results">No clipboard history yet.</div>
              )}

              {clipboardHistory.map((entry) => (
                <div className="clipboard-history-item" key={entry.id}>
                  <div>
                    <strong>{entry.operation.toUpperCase()}</strong>

                    <div>{entry.label}</div>

                    <small>{formatDate(entry.time)}</small>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!currentPath) {
                        return;
                      }

                      setClipboard({
                        paths: entry.paths,
                        operation: entry.operation,
                      });

                      setShowClipboardHistory(false);
                    }}
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>

            <div className="properties-footer">
              <button
                type="button"
                onClick={() => {
                  setClipboardHistory([]);

                  setShowClipboardHistory(false);
                }}
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => setShowClipboardHistory(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          PHASE 4 — ADVANCED OPERATIONS
      ====================================================== */}

      {showAdvancedOperations && (
        <div className="phase4-overlay" onClick={closeAdvancedOperations}>
          <div
            className="phase4-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            {/* ------------------------------------------------
                HEADER
            ------------------------------------------------ */}

            <div className="phase4-header">
              <div>
                <span className="phase4-header-icon">⚙️</span>

                <div>
                  <strong>Advanced File Operations</strong>

                  <small>
                    {currentPath || "Open a folder to use folder operations."}
                  </small>
                </div>
              </div>

              <button type="button" onClick={closeAdvancedOperations}>
                ×
              </button>
            </div>

            {/* ------------------------------------------------
                LAYOUT
            ------------------------------------------------ */}

            <div className="phase4-layout">
              {/* ----------------------------------------------
                  NAVIGATION
              ---------------------------------------------- */}

              <aside className="phase4-nav">
                {operationButton("Batch Rename", "batch-rename")}

                {operationButton("Duplicate Finder", "duplicates")}

                {operationButton("Large Files", "large-files")}

                {operationButton("Empty Folders", "empty-folders")}

                {operationButton("Compare Files", "compare-files")}

                {operationButton("Compare Folders", "compare-folders")}

                {operationButton("Merge Folders", "merge")}

                {operationButton("Transfer Queue", "transfer")}

                {operationButton("File Hash", "hash")}

                {operationButton("Integrity", "integrity")}
              </aside>

              {/* ----------------------------------------------
                  CONTENT
              ---------------------------------------------- */}

              <section className="phase4-content">
                {advancedError && (
                  <div className="phase4-error">⚠️ {advancedError}</div>
                )}

                {/* ==========================================
                    BATCH RENAME
                ========================================== */}

                {advancedOperation === "batch-rename" && (
                  <div className="phase4-form">
                    <h3>Batch Rename</h3>

                    <p>
                      Rename all selected files/folders using a prefix, suffix
                      or pattern.
                    </p>

                    <div className="phase4-selection-info">
                      {selectedList.length} item
                      {selectedList.length === 1 ? "" : "s"} selected
                    </div>

                    <label>
                      Prefix
                      <input
                        value={batchPrefix}
                        onChange={(event) => setBatchPrefix(event.target.value)}
                        placeholder="e.g. Project-"
                      />
                    </label>

                    <label>
                      Suffix
                      <input
                        value={batchSuffix}
                        onChange={(event) => setBatchSuffix(event.target.value)}
                        placeholder="e.g. -final"
                      />
                    </label>

                    <label>
                      Pattern{" "}
                      <span className="phase4-help">
                        Use {"{name}"} and {"{n}"}
                      </span>
                      <input
                        value={batchPattern}
                        onChange={(event) =>
                          setBatchPattern(event.target.value)
                        }
                        placeholder="{name}-{n}"
                      />
                    </label>

                    <label>
                      Start number
                      <input
                        type="number"
                        min="1"
                        value={batchStartNumber}
                        onChange={(event) =>
                          setBatchStartNumber(event.target.value)
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="phase4-primary"
                      disabled={advancedLoading}
                      onClick={() => {
                        if (runAdvancedAction("batchRename")) {
                          runBatchRename();
                        }
                      }}
                    >
                      Rename Selected
                    </button>
                  </div>
                )}

                {/* ==========================================
                    DUPLICATE FINDER
                ========================================== */}

                {advancedOperation === "duplicates" && (
                  <div className="phase4-form">
                    <h3>Duplicate Finder</h3>

                    <p>
                      Find files with identical size and SHA-256 hash inside the
                      current folder.
                    </p>

                    <button
                      type="button"
                      className="phase4-primary"
                      disabled={advancedLoading || !currentPath}
                      onClick={() => {
                        if (runAdvancedAction("findDuplicates")) {
                          runDuplicateFinder();
                        }
                      }}
                    >
                      Find Duplicates
                    </button>
                  </div>
                )}

                {/* ==========================================
                    LARGE FILE FINDER
                ========================================== */}

                {advancedOperation === "large-files" && (
                  <div className="phase4-form">
                    <h3>Large File Finder</h3>

                    <p>Find files at or above the selected size threshold.</p>

                    <label>
                      Minimum size (MB)
                      <input
                        type="number"
                        min="0"
                        value={largeFileThreshold}
                        onChange={(event) =>
                          setLargeFileThreshold(event.target.value)
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="phase4-primary"
                      disabled={advancedLoading || !currentPath}
                      onClick={() => {
                        if (runAdvancedAction("findLargeFiles")) {
                          runLargeFileFinder();
                        }
                      }}
                    >
                      Find Large Files
                    </button>
                  </div>
                )}

                {/* ==========================================
                    EMPTY FOLDER FINDER
                ========================================== */}

                {advancedOperation === "empty-folders" && (
                  <div className="phase4-form">
                    <h3>Empty Folder Finder</h3>

                    <p>Find folders that contain no files or subfolders.</p>

                    <button
                      type="button"
                      className="phase4-primary"
                      disabled={advancedLoading || !currentPath}
                      onClick={() => {
                        if (runAdvancedAction("findEmptyFolders")) {
                          runEmptyFolderFinder();
                        }
                      }}
                    >
                      Find Empty Folders
                    </button>
                  </div>
                )}

                {/* ==========================================
                    COMPARE FILES / FOLDERS
                ========================================== */}

                {(advancedOperation === "compare-files" ||
                  advancedOperation === "compare-folders") && (
                  <div className="phase4-form">
                    <h3>
                      {advancedOperation === "compare-files"
                        ? "Compare Files"
                        : "Compare Folders"}
                    </h3>

                    <p>
                      {advancedOperation === "compare-files"
                        ? "Compare two files using SHA-256."
                        : "Compare the complete contents of two folders."}
                    </p>

                    <label>
                      First path
                      <input
                        value={compareFirstPath}
                        onChange={(event) =>
                          setCompareFirstPath(event.target.value)
                        }
                        placeholder="C:\Path\First"
                      />
                    </label>

                    <label>
                      Second path
                      <input
                        value={compareSecondPath}
                        onChange={(event) =>
                          setCompareSecondPath(event.target.value)
                        }
                        placeholder="C:\Path\Second"
                      />
                    </label>

                    <button
                      type="button"
                      className="phase4-primary"
                      disabled={advancedLoading}
                      onClick={() => {
                        const api =
                          advancedOperation === "compare-files"
                            ? "compareFiles"
                            : "compareFolders";

                        if (runAdvancedAction(api)) {
                          if (advancedOperation === "compare-files") {
                            runFileComparison();
                          } else {
                            runFolderComparison();
                          }
                        }
                      }}
                    >
                      Compare
                    </button>
                  </div>
                )}

                {/* ==========================================
                    MERGE FOLDERS
                ========================================== */}

                {advancedOperation === "merge" && (
                  <div className="phase4-form">
                    <h3>Merge Folders</h3>

                    <p>
                      Copy the source folder contents into the destination
                      folder.
                    </p>

                    <label>
                      Source folder
                      <input
                        value={mergeSourcePath}
                        onChange={(event) =>
                          setMergeSourcePath(event.target.value)
                        }
                        placeholder="C:\Source"
                      />
                    </label>

                    <label>
                      Destination folder
                      <input
                        value={mergeDestinationPath}
                        onChange={(event) =>
                          setMergeDestinationPath(event.target.value)
                        }
                        placeholder="C:\Destination"
                      />
                    </label>

                    <label>
                      Conflict handling
                      <select
                        value={mergeConflictMode}
                        onChange={(event) =>
                          setMergeConflictMode(event.target.value)
                        }
                      >
                        <option value="keep-both">Keep both</option>

                        <option value="replace">Replace</option>

                        <option value="skip">Skip</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      className="phase4-primary"
                      disabled={advancedLoading}
                      onClick={() => {
                        if (runAdvancedAction("mergeFolders")) {
                          runMergeFolders();
                        }
                      }}
                    >
                      Merge Folders
                    </button>
                  </div>
                )}

                {/* ==========================================
                    TRANSFER QUEUE
                ========================================== */}

                {advancedOperation === "transfer" && (
                  <div className="phase4-form">
                    <h3>Transfer Queue</h3>

                    <p>
                      Queue the currently selected files/folders for copy or
                      move.
                    </p>

                    <div className="phase4-selection-info">
                      {selectedList.length} item
                      {selectedList.length === 1 ? "" : "s"} selected
                    </div>

                    <label>
                      Destination folder
                      <input
                        value={transferDestination}
                        onChange={(event) =>
                          setTransferDestination(event.target.value)
                        }
                        placeholder="C:\Destination"
                      />
                    </label>

                    <div className="phase4-two-col">
                      <label>
                        Operation
                        <select
                          value={transferOperation}
                          onChange={(event) =>
                            setTransferOperation(event.target.value)
                          }
                        >
                          <option value="copy">Copy</option>

                          <option value="move">Move</option>
                        </select>
                      </label>

                      <label>
                        Conflicts
                        <select
                          value={transferConflictMode}
                          onChange={(event) =>
                            setTransferConflictMode(event.target.value)
                          }
                        >
                          <option value="keep-both">Keep both</option>

                          <option value="replace">Replace</option>

                          <option value="skip">Skip</option>
                        </select>
                      </label>
                    </div>

                    <button
                      type="button"
                      className="phase4-primary"
                      disabled={advancedLoading}
                      onClick={() => {
                        if (runAdvancedAction("queueTransfer")) {
                          startTransfer();
                        }
                      }}
                    >
                      Start Transfer
                    </button>

                    <div className="phase4-queue">{renderTransferQueue()}</div>

                    <div className="phase4-transfer-actions">
                      <button
                        type="button"
                        disabled={!selectedTransferJob}
                        onClick={() => {
                          if (runAdvancedAction("pauseTransfer")) {
                            pauseSelectedTransfer();
                          }
                        }}
                      >
                        Pause
                      </button>

                      <button
                        type="button"
                        disabled={!selectedTransferJob}
                        onClick={() => {
                          if (runAdvancedAction("resumeTransfer")) {
                            resumeSelectedTransfer();
                          }
                        }}
                      >
                        Resume
                      </button>

                      <button
                        type="button"
                        disabled={!selectedTransferJob}
                        onClick={() => {
                          if (runAdvancedAction("cancelTransfer")) {
                            cancelSelectedTransfer();
                          }
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* ==========================================
                    HASH
                ========================================== */}

                {advancedOperation === "hash" && (
                  <div className="phase4-form">
                    <h3>File Hash</h3>

                    <p>
                      Calculate MD5, SHA-1 and SHA-256 for the selected file.
                    </p>

                    <div className="phase4-selection-info">
                      {selectedItem
                        ? selectedItem.path
                        : "No single file selected"}
                    </div>

                    <button
                      type="button"
                      className="phase4-primary"
                      disabled={advancedLoading}
                      onClick={() => {
                        if (runAdvancedAction("getFileHash")) {
                          calculateSelectedHash();
                        }
                      }}
                    >
                      Calculate Hashes
                    </button>
                  </div>
                )}

                {/* ==========================================
                    INTEGRITY
                ========================================== */}

                {advancedOperation === "integrity" && (
                  <div className="phase4-form">
                    <h3>Integrity Verification</h3>

                    <p>Compare the selected file against a known hash.</p>

                    <div className="phase4-selection-info">
                      {selectedItem
                        ? selectedItem.path
                        : "No single file selected"}
                    </div>

                    <label>
                      Algorithm
                      <select
                        value={hashAlgorithm}
                        onChange={(event) =>
                          setHashAlgorithm(event.target.value)
                        }
                      >
                        <option value="sha256">SHA-256</option>

                        <option value="sha1">SHA-1</option>

                        <option value="md5">MD5</option>
                      </select>
                    </label>

                    <label>
                      Expected hash
                      <input
                        value={expectedHash}
                        onChange={(event) =>
                          setExpectedHash(event.target.value)
                        }
                        placeholder="Paste expected hash"
                      />
                    </label>

                    <button
                      type="button"
                      className="phase4-primary"
                      disabled={advancedLoading}
                      onClick={() => {
                        if (runAdvancedAction("verifyFileIntegrity")) {
                          verifySelectedIntegrity();
                        }
                      }}
                    >
                      Verify Integrity
                    </button>
                  </div>
                )}

                {/* ==========================================
                    RESULTS
                ========================================== */}

                {renderAdvancedResults()}
              </section>
            </div>

            {/* ------------------------------------------------
                FOOTER
            ------------------------------------------------ */}

            <div className="phase4-footer">
              <button
                type="button"
                onClick={() => {
                  setAdvancedResults(null);

                  setAdvancedError("");
                }}
              >
                Clear Results
              </button>

              <button type="button" onClick={closeAdvancedOperations}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          PERMISSIONS MODAL
      ====================================================== */}

      {showPermissions && permissionsInfo && (
        <div
          className="modal-overlay"
          onClick={() => setShowPermissions(false)}
        >
          <div
            className="properties-dialog permissions-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="properties-header">
              <span>🛡️</span>

              <strong>Access / Permissions</strong>
            </div>

            <div className="properties-body">
              <div className="property-row">
                <span>Path</span>

                <span>{permissionsInfo.path}</span>
              </div>

              <div className="property-row">
                <span>Read</span>

                <span>{permissionsInfo.readable ? "Allowed" : "Denied"}</span>
              </div>

              <div className="property-row">
                <span>Write</span>

                <span>{permissionsInfo.writable ? "Allowed" : "Denied"}</span>
              </div>

              <div className="property-row">
                <span>Access</span>

                <span>{permissionsInfo.access}</span>
              </div>
            </div>

            <div className="properties-footer">
              <button type="button" onClick={() => setShowPermissions(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          PROPERTIES MODAL
      ====================================================== */}

      {showProperties && propertiesItem && (
        <div className="modal-overlay" onClick={() => setShowProperties(false)}>
          <div
            className="properties-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="properties-header">
              <span>{propertiesItem.isDirectory ? "📁" : "📄"}</span>

              <strong>{propertiesItem.name}</strong>
            </div>

            <div className="properties-body">
              <div className="property-row">
                <span>Name</span>

                <span>{propertiesItem.name}</span>
              </div>

              <div className="property-row">
                <span>Type</span>

                <span>{propertiesItem.type}</span>
              </div>

              <div className="property-row">
                <span>Location</span>

                <span>{propertiesItem.path}</span>
              </div>

              {!propertiesItem.isDirectory && (
                <div className="property-row">
                  <span>Size</span>

                  <span>{formatSize(propertiesItem.size)}</span>
                </div>
              )}

              {propertiesItem.isDirectory && (
                <div className="property-row">
                  <span>Size</span>

                  <span>
                    {folderSize === "calculating" && "Calculating..."}

                    {folderSize && folderSize !== "calculating" && (
                      <>
                        {formatSize(folderSize.size)} ({folderSize.fileCount}{" "}
                        files, {folderSize.folderCount} folders)
                      </>
                    )}

                    {folderSize === null && "Unknown"}
                  </span>
                </div>
              )}

              <div className="property-row">
                <span>Created</span>

                <span>{formatDate(propertiesItem.created)}</span>
              </div>

              <div className="property-row">
                <span>Modified</span>

                <span>{formatDate(propertiesItem.modified)}</span>
              </div>

              <div className="property-row">
                <span>Accessed</span>

                <span>{formatDate(propertiesItem.accessed)}</span>
              </div>
            </div>

            <div className="properties-footer">
              <button type="button" onClick={() => setShowProperties(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
