// ============================================================
// electron-features.cjs
// Advanced / New Electron Features
// ============================================================

const {
  ipcMain,
  shell,
  dialog,
} = require("electron");

const fs = require("fs");
const fsp = fs.promises;

const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { spawn } = require("child_process");

// ============================================================
// Internal State
// ============================================================

const transferJobs = new Map();
let transferJobCounter = 1;

// ============================================================
// Utility Helpers
// ============================================================

function success(data = {}) {
  return {
    success: true,
    ...data,
  };
}

function failure(error) {
  return {
    success: false,
    error: error?.message || String(error),
  };
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getFileSize(filePath) {
  const stat = await fsp.stat(filePath);
  return stat.size;
}

async function getDirectoryEntries(directoryPath) {
  return await fsp.readdir(directoryPath, {
    withFileTypes: true,
  });
}

function normalizeAlgorithm(algorithm = "sha256") {
  const value = String(algorithm).toLowerCase();

  const supported = {
    md5: "md5",
    sha1: "sha1",
    sha256: "sha256",
    sha384: "sha384",
    sha512: "sha512",
  };

  return supported[value] || "sha256";
}

// ============================================================
// Recursive File Walker
// ============================================================

async function walkDirectory(rootPath, options = {}) {
  const {
    includeFiles = true,
    includeDirectories = false,
    maxDepth = Infinity,
  } = options;

  const results = [];

  async function walk(currentPath, depth) {
    if (depth > maxDepth) {
      return;
    }

    let entries;

    try {
      entries = await getDirectoryEntries(currentPath);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        if (includeDirectories) {
          results.push({
            path: fullPath,
            name: entry.name,
            type: "directory",
          });
        }

        await walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        if (includeFiles) {
          results.push({
            path: fullPath,
            name: entry.name,
            type: "file",
          });
        }
      }
    }
  }

  await walk(rootPath, 0);

  return results;
}

// ============================================================
// 1. Batch Rename
// ============================================================

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "batch-rename",
  async (_event, items, options = {}) => {
    try {
      if (!Array.isArray(items)) {
        throw new Error("Items must be an array.");
      }

      const {
        prefix = "",
        suffix = "",
        find = "",
        replace = "",
        startNumber = 1,
        padding = 0,
      } = options;

      const results = [];

      let counter = Number(startNumber) || 1;

      for (const item of items) {
        const oldPath =
          typeof item === "string"
            ? item
            : item.path;

        if (!oldPath) {
          continue;
        }

        const exists = await pathExists(oldPath);

        if (!exists) {
          results.push({
            success: false,
            oldPath,
            error: "File or folder does not exist.",
          });

          continue;
        }

        const parsed = path.parse(oldPath);

        let newName = parsed.name;

        if (find) {
          newName = newName.split(find).join(replace);
        }

        if (options.numbering) {
          const number =
            String(counter).padStart(
              Number(padding) || 0,
              "0",
            );

          newName = `${newName} ${number}`;

          counter++;
        }

        newName =
          `${prefix}${newName}${suffix}` +
          parsed.ext;

        const newPath =
          path.join(parsed.dir, newName);

        if (newPath === oldPath) {
          results.push({
            success: true,
            oldPath,
            newPath,
          });

          continue;
        }

        if (await pathExists(newPath)) {
          results.push({
            success: false,
            oldPath,
            newPath,
            error: "Destination already exists.",
          });

          continue;
        }

        await fsp.rename(
          oldPath,
          newPath,
        );

        results.push({
          success: true,
          oldPath,
          newPath,
        });
      }

      return success({
        results,
        count: results.length,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

// ============================================================
// 2. Find Duplicate Files
// ============================================================

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "find-duplicates",
  async (_event, rootPath) => {
    try {
      if (!rootPath) {
        throw new Error("Root path is required.");
      }

      const files = await walkDirectory(
        rootPath,
        {
          includeFiles: true,
          includeDirectories: false,
        },
      );

      const sizeGroups = new Map();

      for (const file of files) {
        try {
          const stat = await fsp.stat(
            file.path,
          );

          if (!sizeGroups.has(stat.size)) {
            sizeGroups.set(stat.size, []);
          }

          sizeGroups
            .get(stat.size)
            .push(file.path);
        } catch {
          // Ignore inaccessible files.
        }
      }

      const duplicateGroups = [];

      for (const [size, paths] of sizeGroups) {
        if (paths.length < 2) {
          continue;
        }

        const hashGroups = new Map();

        for (const filePath of paths) {
          try {
            const hashResult =
              await calculateHash(
                filePath,
                "sha256",
              );

            if (!hashGroups.has(hashResult.hash)) {
              hashGroups.set(
                hashResult.hash,
                [],
              );
            }

            hashGroups
              .get(hashResult.hash)
              .push(filePath);
          } catch {
            // Ignore files that cannot be hashed.
          }
        }

        for (const [hash, sameFiles] of hashGroups) {
          if (sameFiles.length > 1) {
            duplicateGroups.push({
              size,
              hash,
              files: sameFiles,
            });
          }
        }
      }

      return success({
        groups: duplicateGroups,
        count: duplicateGroups.length,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

// ============================================================
// 3. Find Large Files
// ============================================================

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "find-large-files",
  async (_event, rootPath, minimumBytes = 100 * 1024 * 1024) => {
    try {
      if (!rootPath) {
        throw new Error("Root path is required.");
      }

      const files = await walkDirectory(
        rootPath,
        {
          includeFiles: true,
        },
      );

      const largeFiles = [];

      for (const file of files) {
        try {
          const stat = await fsp.stat(
            file.path,
          );

          if (stat.size >= minimumBytes) {
            largeFiles.push({
              path: file.path,
              name: file.name,
              size: stat.size,
              modified: stat.mtime,
            });
          }
        } catch {
          // Ignore inaccessible files.
        }
      }

      largeFiles.sort(
        (a, b) => b.size - a.size,
      );

      return success({
        files: largeFiles,
        count: largeFiles.length,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

// ============================================================
// 4. Find Empty Folders
// ============================================================

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "find-empty-folders",
  async (_event, rootPath) => {
    try {
      if (!rootPath) {
        throw new Error("Root path is required.");
      }

      const folders = await walkDirectory(
        rootPath,
        {
          includeFiles: false,
          includeDirectories: true,
        },
      );

      const emptyFolders = [];

      for (const folder of folders) {
        try {
          const entries =
            await fsp.readdir(
              folder.path,
            );

          if (entries.length === 0) {
            emptyFolders.push(
              folder.path,
            );
          }
        } catch {
          // Ignore inaccessible folders.
        }
      }

      return success({
        folders: emptyFolders,
        count: emptyFolders.length,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

// ============================================================
// 5. Compare Files
// ============================================================

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "compare-files",
  async (
    _event,
    firstPath,
    secondPath,
    algorithm = "sha256",
  ) => {
    try {
      if (!firstPath || !secondPath) {
        throw new Error(
          "Both file paths are required.",
        );
      }

      const firstStat =
        await fsp.stat(firstPath);

      const secondStat =
        await fsp.stat(secondPath);

      if (
        !firstStat.isFile() ||
        !secondStat.isFile()
      ) {
        throw new Error(
          "Both paths must be files.",
        );
      }

      if (
        firstStat.size !==
        secondStat.size
      ) {
        return success({
          identical: false,
          reason: "Different file sizes.",
          firstSize: firstStat.size,
          secondSize: secondStat.size,
        });
      }

      const firstHash =
        await calculateHash(
          firstPath,
          algorithm,
        );

      const secondHash =
        await calculateHash(
          secondPath,
          algorithm,
        );

      return success({
        identical:
          firstHash.hash ===
          secondHash.hash,

        algorithm:
          normalizeAlgorithm(
            algorithm,
          ),

        firstHash: firstHash.hash,
        secondHash: secondHash.hash,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

// ============================================================
// 6. Compare Folders
// ============================================================

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "compare-folders",
  async (
    _event,
    firstPath,
    secondPath,
  ) => {
    try {
      const firstFiles =
        await walkDirectory(
          firstPath,
          {
            includeFiles: true,
          },
        );

      const secondFiles =
        await walkDirectory(
          secondPath,
          {
            includeFiles: true,
          },
        );

      const makeRelativeMap = (
        root,
        files,
      ) => {
        const map = new Map();

        for (const file of files) {
          const relative =
            path.relative(
              root,
              file.path,
            );

          map.set(
            relative.toLowerCase(),
            file,
          );
        }

        return map;
      };

      const firstMap =
        makeRelativeMap(
          firstPath,
          firstFiles,
        );

      const secondMap =
        makeRelativeMap(
          secondPath,
          secondFiles,
        );

      const onlyInFirst = [];
      const onlyInSecond = [];
      const different = [];
      const identical = [];

      for (const [relative, file] of firstMap) {
        if (!secondMap.has(relative)) {
          onlyInFirst.push(
            file.path,
          );

          continue;
        }

        const other =
          secondMap.get(relative);

        try {
          const firstHash =
            await calculateHash(
              file.path,
              "sha256",
            );

          const secondHash =
            await calculateHash(
              other.path,
              "sha256",
            );

          if (
            firstHash.hash ===
            secondHash.hash
          ) {
            identical.push(relative);
          } else {
            different.push(relative);
          }
        } catch {
          different.push(relative);
        }
      }

      for (const [relative, file] of secondMap) {
        if (!firstMap.has(relative)) {
          onlyInSecond.push(
            file.path,
          );
        }
      }

      return success({
        onlyInFirst,
        onlyInSecond,
        different,
        identical,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

// ============================================================
// 7. Merge Folders
// ============================================================

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "merge-folders",
  async (
    _event,
    sourcePath,
    destinationPath,
    conflictMode = "skip",
  ) => {
    try {
      if (
        !sourcePath ||
        !destinationPath
      ) {
        throw new Error(
          "Source and destination paths are required.",
        );
      }

      await fsp.mkdir(
        destinationPath,
        {
          recursive: true,
        },
      );

      const copied = [];
      const skipped = [];
      const overwritten = [];

      async function merge(
        source,
        destination,
      ) {
        const entries =
          await fsp.readdir(
            source,
            {
              withFileTypes: true,
            },
          );

        for (const entry of entries) {
          const sourceItem =
            path.join(
              source,
              entry.name,
            );

          const destinationItem =
            path.join(
              destination,
              entry.name,
            );

          if (entry.isDirectory()) {
            await fsp.mkdir(
              destinationItem,
              {
                recursive: true,
              },
            );

            await merge(
              sourceItem,
              destinationItem,
            );

            continue;
          }

          const exists =
            await pathExists(
              destinationItem,
            );

          if (exists) {
            if (
              conflictMode ===
              "skip"
            ) {
              skipped.push(
                destinationItem,
              );

              continue;
            }

            if (
              conflictMode ===
              "overwrite"
            ) {
              await fsp.copyFile(
                sourceItem,
                destinationItem,
              );

              overwritten.push(
                destinationItem,
              );

              continue;
            }

            if (
              conflictMode ===
              "rename"
            ) {
              const parsed =
                path.parse(
                  destinationItem,
                );

              let counter = 1;

              let newPath =
                destinationItem;

              while (
                await pathExists(
                  newPath,
                )
              ) {
                newPath =
                  path.join(
                    parsed.dir,
                    `${parsed.name} (${counter})${parsed.ext}`,
                  );

                counter++;
              }

              await fsp.copyFile(
                sourceItem,
                newPath,
              );

              copied.push(newPath);

              continue;
            }
          }

          await fsp.copyFile(
            sourceItem,
            destinationItem,
          );

          copied.push(
            destinationItem,
          );
        }
      }

      await merge(
        sourcePath,
        destinationPath,
      );

      return success({
        copied,
        skipped,
        overwritten,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

// ============================================================
// 8. File Hash
// ============================================================

async function calculateHash(
  filePath,
  algorithm = "sha256",
) {
  const normalized =
    normalizeAlgorithm(
      algorithm,
    );

  return new Promise(
    (resolve, reject) => {
      const hash =
        crypto.createHash(
          normalized,
        );

      const stream =
        fs.createReadStream(
          filePath,
        );

      stream.on(
        "error",
        reject,
      );

      stream.on(
        "data",
        (chunk) => {
          hash.update(chunk);
        },
      );

      stream.on(
        "end",
        () => {
          resolve({
            success: true,
            algorithm: normalized,
            hash: hash.digest("hex"),
          });
        },
      );
    },
  );
}

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "get-file-hash",
  async (
    _event,
    filePath,
    algorithms = ["sha256"],
  ) => {
    try {
      if (!filePath) {
        throw new Error(
          "File path is required.",
        );
      }

      if (!Array.isArray(algorithms)) {
        algorithms = [
          algorithms,
        ];
      }

      const hashes = {};

      for (const algorithm of algorithms) {
        const result =
          await calculateHash(
            filePath,
            algorithm,
          );

        hashes[
          normalizeAlgorithm(
            algorithm,
          )
        ] = result.hash;
      }

      return success({
        filePath,
        hashes,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

// ============================================================
// 9. Verify File Integrity
// ============================================================

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "verify-file-integrity",
  async (
    _event,
    filePath,
    expectedHash,
    algorithm = "sha256",
  ) => {
    try {
      if (
        !filePath ||
        !expectedHash
      ) {
        throw new Error(
          "File path and expected hash are required.",
        );
      }

      const result =
        await calculateHash(
          filePath,
          algorithm,
        );

      const actualHash =
        result.hash.toLowerCase();

      const expected =
        String(
          expectedHash,
        ).toLowerCase();

      return success({
        valid:
          actualHash ===
          expected,

        algorithm:
          result.algorithm,

        expectedHash: expected,
        actualHash,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

// ============================================================
// 10. Transfer Engine
// ============================================================

async function copyDirectory(
  source,
  destination,
  job,
) {
  await fsp.mkdir(
    destination,
    {
      recursive: true,
    },
  );

  const entries =
    await fsp.readdir(
      source,
      {
        withFileTypes: true,
      },
    );

  for (const entry of entries) {
    if (job.cancelled) {
      throw new Error(
        "Transfer cancelled.",
      );
    }

    while (job.paused) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            200,
          ),
      );

      if (job.cancelled) {
        throw new Error(
          "Transfer cancelled.",
        );
      }
    }

    const sourceItem =
      path.join(
        source,
        entry.name,
      );

    const destinationItem =
      path.join(
        destination,
        entry.name,
      );

    if (entry.isDirectory()) {
      await copyDirectory(
        sourceItem,
        destinationItem,
        job,
      );
    } else {
      await fsp.copyFile(
        sourceItem,
        destinationItem,
      );
    }
  }
}

async function performTransfer(
  job,
) {
  const {
    sourcePath,
    destinationPath,
    operation = "copy",
  } = job.options;

  if (
    !sourcePath ||
    !destinationPath
  ) {
    throw new Error(
      "Source and destination paths are required.",
    );
  }

  const sourceStat =
    await fsp.stat(
      sourcePath,
    );

  job.status = "running";

  if (sourceStat.isDirectory()) {
    await copyDirectory(
      sourcePath,
      destinationPath,
      job,
    );
  } else {
    await fsp.mkdir(
      path.dirname(
        destinationPath,
      ),
      {
        recursive: true,
      },
    );

    await fsp.copyFile(
      sourcePath,
      destinationPath,
    );
  }

  if (
    operation === "move"
  ) {
    await fsp.rm(
      sourcePath,
      {
        recursive: true,
        force: true,
      },
    );
  }

  job.status = "completed";
}

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "queue-transfer",
  async (
    event,
    options,
  ) => {
    try {
      const jobId =
        `transfer-${transferJobCounter++}`;

      const job = {
        id: jobId,
        options: options || {},
        status: "queued",
        paused: false,
        cancelled: false,
        createdAt:
          new Date().toISOString(),
      };

      transferJobs.set(
        jobId,
        job,
      );

      performTransfer(job)
        .then(() => {
          event.sender.send(
            "transfer-progress",
            {
              jobId,
              status:
                "completed",
              progress: 100,
            },
          );
        })
        .catch((error) => {
          job.status =
            job.cancelled
              ? "cancelled"
              : "failed";

          event.sender.send(
            "transfer-progress",
            {
              jobId,
              status:
                job.status,
              progress: 0,
              error:
                error.message,
            },
          );
        });

      return success({
        jobId,
        status: job.status,
      });
    } catch (error) {
      return failure(error);
    }
  },
);
*/

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "get-transfer-queue",
  async () => {
    return success({
      jobs: Array.from(
        transferJobs.values(),
      ).map((job) => ({
        id: job.id,
        options: job.options,
        status: job.status,
        createdAt: job.createdAt,
      })),
    });
  },
);
*/

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "pause-transfer",
  async (_event, jobId) => {
    const job =
      transferJobs.get(
        jobId,
      );

    if (!job) {
      return failure(
        new Error(
          "Transfer job not found.",
        ),
      );
    }

    job.paused = true;
    job.status = "paused";

    return success({
      jobId,
      status: job.status,
    });
  },
);
*/

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "resume-transfer",
  async (_event, jobId) => {
    const job =
      transferJobs.get(
        jobId,
      );

    if (!job) {
      return failure(
        new Error(
          "Transfer job not found.",
        ),
      );
    }

    job.paused = false;
    job.status = "running";

    return success({
      jobId,
      status: job.status,
    });
  },
);
*/

/* DUPLICATE HANDLER REMOVED FOR RUNTIME FIX:
ipcMain.handle(
  "cancel-transfer",
  async (_event, jobId) => {
    const job =
      transferJobs.get(
        jobId,
      );

    if (!job) {
      return failure(
        new Error(
          "Transfer job not found.",
        ),
      );
    }

    job.cancelled = true;
    job.status = "cancelled";

    return success({
      jobId,
      status: job.status,
    });
  },
);
*/

// ============================================================
// 11. Advanced File Information
// ============================================================

ipcMain.handle(
  "get-advanced-file-info",
  async (_event, filePath) => {
    try {
      if (!filePath) {
        throw new Error(
          "File path is required.",
        );
      }

      const stat =
        await fsp.stat(
          filePath,
        );

      return success({
        path: filePath,
        name:
          path.basename(
            filePath,
          ),
        extension:
          path.extname(
            filePath,
          ),
        size: stat.size,
        created:
          stat.birthtime,
        modified:
          stat.mtime,
        accessed:
          stat.atime,
        isFile:
          stat.isFile(),
        isDirectory:
          stat.isDirectory(),
        permissions:
          stat.mode,
      });
    } catch (error) {
      return failure(error);
    }
  },
);

// ============================================================
// 12. Open Terminal
// ============================================================

ipcMain.handle(
  "feature:open-terminal",
  async (_event, folderPath) => {
    try {
      const target =
        folderPath || os.homedir();

      if (process.platform === "win32") {
        spawn(
          "cmd.exe",
          ["/K", `cd /d "${target}"`],
          {
            detached: true,
            stdio: "ignore",
          },
        ).unref();
      } else if (
        process.platform === "darwin"
      ) {
        spawn(
          "open",
          ["-a", "Terminal", target],
          {
            detached: true,
            stdio: "ignore",
          },
        ).unref();
      } else {
        spawn(
          "x-terminal-emulator",
          [],
          {
            cwd: target,
            detached: true,
            stdio: "ignore",
          },
        ).unref();
      }

      return success();
    } catch (error) {
      return failure(error);
    }
  },
);

// ============================================================
// 13. Open Item
// ============================================================

ipcMain.handle(
  "feature:open-item",
  async (_event, itemPath) => {
    try {
      if (!itemPath) {
        throw new Error(
          "Item path is required.",
        );
      }

      const result =
        await shell.openPath(
          itemPath,
        );

      if (result) {
        return failure(
          new Error(result),
        );
      }

      return success();
    } catch (error) {
      return failure(error);
    }
  },
);

// ============================================================
// 14. Select Folder
// ============================================================

ipcMain.handle(
  "feature:choose-folder",
  async () => {
    try {
      const result =
        await dialog.showOpenDialog({
          properties: [
            "openDirectory",
          ],
        });

      if (result.canceled) {
        return success({
          canceled: true,
          path: null,
        });
      }

      return success({
        canceled: false,
        path:
          result.filePaths[0] ||
          null,
      });
    } catch (error) {
      return failure(error);
    }
  },
);

// ============================================================
// 15. Feature Health Check
// ============================================================

ipcMain.handle(
  "features:health-check",
  async () => {
    return success({
      module:
        "electron-features",
      platform:
        process.platform,
      nodeVersion:
        process.version,
      electronVersion:
        process.versions.electron,
      featuresLoaded: true,
    });
  },
);

ipcMain.handle("get-system-paths", async () => {
  try {
    const home = os.homedir();
    return {
      success: true,
      home,
      desktop: path.join(home, "Desktop"),
      documents: path.join(home, "Documents"),
      downloads: path.join(home, "Downloads"),
      pictures: path.join(home, "Pictures"),
      music: path.join(home, "Music"),
      videos: path.join(home, "Videos"),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// Export
// ============================================================

module.exports = {
  calculateHash,
  walkDirectory,
};