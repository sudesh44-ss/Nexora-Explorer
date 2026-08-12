"use strict";

/*
 * ============================================================
 * File Association Service
 * ============================================================
 *
 * Purpose:
 * - File extension identify karna
 * - Windows ke associated application ko identify karna
 * - "Open With" ke liye available applications collect karna
 * - Default application open karna
 * - Specific application ke saath file open karna
 * - File association information read karna
 *
 * IMPORTANT:
 * - Windows-focused implementation.
 * - Existing electron.cjs / preload.cjs / App.jsx ko
 *   abhi modify nahi karna hai.
 * - Registry ko directly modify karke default association
 *   force nahi ki ja rahi hai.
 * ============================================================
 */

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const isWindows = process.platform === "win32";

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
 * Get extension.
 *
 * Example:
 * photo.jpg -> .jpg
 */
function getExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

/**
 * Execute Windows command safely.
 */
function executeWindowsCommand(
  executable,
  args,
) {
  return new Promise((resolve, reject) => {
    if (!isWindows) {
      reject(
        new Error(
          "File association operations are supported on Windows only.",
        ),
      );

      return;
    }

    execFile(
      executable,
      args,
      {
        windowsHide: true,
        maxBuffer: 5 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              stderr?.trim() ||
                error.message ||
                "Windows command failed.",
            ),
          );

          return;
        }

        resolve({
          stdout: stdout || "",
          stderr: stderr || "",
        });
      },
    );
  });
}

/**
 * Read Windows file association.
 *
 * Uses:
 *     assoc .ext
 *     ftype FileType
 */
async function getFileAssociation(filePath) {
  const cleanPath = validatePath(filePath);

  if (!(await pathExists(cleanPath))) {
    return {
      success: false,
      path: cleanPath,
      error: "File does not exist.",
    };
  }

  if (!isWindows) {
    return {
      success: false,
      path: cleanPath,
      error:
        "File association lookup is currently supported on Windows only.",
    };
  }

  const extension = getExtension(cleanPath);

  if (!extension) {
    return {
      success: true,
      path: cleanPath,
      extension: "",
      fileType: null,
      command: null,
    };
  }

  try {
    const assocResult =
      await executeWindowsCommand(
        "cmd.exe",
        [
          "/d",
          "/c",
          "assoc",
          extension,
        ],
      );

    const assocOutput =
      assocResult.stdout.trim();

    /*
     * Example:
     *
     * .txt=txtfile
     */
    const associationMatch =
      assocOutput.match(
        new RegExp(
          `^${escapeRegExp(extension)}=(.+)$`,
          "i",
        ),
      );

    const fileType =
      associationMatch
        ? associationMatch[1].trim()
        : null;

    let command = null;

    if (fileType) {
      try {
        const ftypeResult =
          await executeWindowsCommand(
            "cmd.exe",
            [
              "/d",
              "/c",
              "ftype",
              fileType,
            ],
          );

        const ftypeOutput =
          ftypeResult.stdout.trim();

        const ftypeMatch =
          ftypeOutput.match(
            new RegExp(
              `^${escapeRegExp(fileType)}=(.+)$`,
              "i",
            ),
          );

        if (ftypeMatch) {
          command =
            ftypeMatch[1].trim();
        }
      } catch {
        /*
         * Some extensions have an association
         * without a directly readable ftype command.
         */
      }
    }

    return {
      success: true,
      path: cleanPath,
      extension,
      fileType,
      command,
      associated: Boolean(fileType),
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      extension,
      fileType: null,
      command: null,
      error: error.message,
    };
  }
}

/**
 * Escape regular-expression characters.
 */
function escapeRegExp(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

/**
 * Open a file with Windows default application.
 */
async function openWithDefault(filePath) {
  const cleanPath = validatePath(filePath);

  if (!(await pathExists(cleanPath))) {
    return {
      success: false,
      path: cleanPath,
      error: "File does not exist.",
    };
  }

  if (!isWindows) {
    return {
      success: false,
      path: cleanPath,
      error:
        "Default application opening is currently supported on Windows only.",
    };
  }

  try {
    await executeWindowsCommand(
      "cmd.exe",
      [
        "/d",
        "/c",
        "start",
        "",
        cleanPath,
      ],
    );

    return {
      success: true,
      path: cleanPath,
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
 * Open file with a specific executable.
 *
 * Example:
 *
 * openWithApplication(
 *   "C:\\test.txt",
 *   "C:\\Program Files\\App\\app.exe"
 * )
 */
async function openWithApplication(
  filePath,
  applicationPath,
) {
  const cleanPath = validatePath(filePath);
  const cleanApplication =
    validatePath(applicationPath);

  if (!(await pathExists(cleanPath))) {
    return {
      success: false,
      path: cleanPath,
      error: "File does not exist.",
    };
  }

  if (!(await pathExists(cleanApplication))) {
    return {
      success: false,
      path: cleanPath,
      application: cleanApplication,
      error:
        "Selected application does not exist.",
    };
  }

  try {
    await new Promise(
      (resolve, reject) => {
        execFile(
          cleanApplication,
          [cleanPath],
          {
            windowsHide: true,
          },
          (error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          },
        );
      },
    );

    return {
      success: true,
      path: cleanPath,
      application: cleanApplication,
    };
  } catch (error) {
    return {
      success: false,
      path: cleanPath,
      application: cleanApplication,
      error: error.message,
    };
  }
}

/**
 * Get common applications from Windows.
 *
 * This provides useful applications for an
 * "Open With" menu without modifying associations.
 */
async function getCommonApplications() {
  if (!isWindows) {
    return [];
  }

  const applications = [];

  const candidates = [
    {
      id: "notepad",
      name: "Notepad",
      paths: [
        "C:\\Windows\\System32\\notepad.exe",
      ],
    },

    {
      id: "wordpad",
      name: "WordPad",
      paths: [
        "C:\\Program Files\\Windows NT\\Accessories\\wordpad.exe",
        "C:\\Program Files (x86)\\Windows NT\\Accessories\\wordpad.exe",
      ],
    },
  ];

  for (const application of candidates) {
    for (const applicationPath of application.paths) {
      if (await pathExists(applicationPath)) {
        applications.push({
          id: application.id,
          name: application.name,
          path: applicationPath,
        });

        break;
      }
    }
  }

  return applications;
}

/**
 * Get registered applications capable of handling
 * a particular file extension.
 *
 * This reads Windows Registry without changing it.
 */
async function getRegisteredApplications(
  extension,
) {
  if (!isWindows) {
    return {
      success: false,
      extension,
      applications: [],
      error:
        "Registered application lookup is supported on Windows only.",
    };
  }

  let cleanExtension =
    String(extension || "").trim().toLowerCase();

  if (!cleanExtension) {
    return {
      success: true,
      extension: "",
      applications: [],
    };
  }

  if (!cleanExtension.startsWith(".")) {
    cleanExtension =
      `.${cleanExtension}`;
  }

  try {
    const result =
      await executeWindowsCommand(
        "reg.exe",
        [
          "query",
          "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\" +
            cleanExtension +
            "\\OpenWithList",
          "/v",
        ],
      );

    const applications = [];

    const lines =
      result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
      const match =
        line.match(
          /^([A-Za-z0-9]+)\s+REG_SZ\s+(.+)$/i,
        );

      if (!match) {
        continue;
      }

      applications.push({
        valueName: match[1],
        executable: match[2].trim(),
      });
    }

    return {
      success: true,
      extension: cleanExtension,
      applications,
    };
  } catch {
    /*
     * Missing OpenWithList is normal for many extensions.
     */
    return {
      success: true,
      extension: cleanExtension,
      applications: [],
    };
  }
}

/**
 * Build Open With information for a file.
 */
async function getOpenWithOptions(
  filePath,
) {
  const cleanPath = validatePath(filePath);

  if (!(await pathExists(cleanPath))) {
    return {
      success: false,
      path: cleanPath,
      options: [],
      error: "File does not exist.",
    };
  }

  const extension =
    getExtension(cleanPath);

  const association =
    await getFileAssociation(cleanPath);

  const registered =
    await getRegisteredApplications(
      extension,
    );

  const common =
    await getCommonApplications();

  const options = [];

  /*
   * Current default association.
   */
  if (
    association.success &&
    association.associated
  ) {
    options.push({
      id: "default",
      name: "Default application",
      type: "default",
      command: association.command,
    });
  }

  /*
   * Registered Open With applications.
   */
  if (registered.success) {
    for (const application of registered.applications) {
      const duplicate =
        options.some(
          (option) =>
            option.executable ===
            application.executable,
        );

      if (!duplicate) {
        options.push({
          id:
            `registered-${application.valueName}`,
          name:
            application.executable,
          type: "registered",
          executable:
            application.executable,
        });
      }
    }
  }

  /*
   * Common applications.
   */
  for (const application of common) {
    const duplicate =
      options.some(
        (option) =>
          option.executable ===
          application.path,
      );

    if (!duplicate) {
      options.push({
        id: application.id,
        name: application.name,
        type: "common",
        executable: application.path,
      });
    }
  }

  return {
    success: true,
    path: cleanPath,
    extension,
    association,
    options,
  };
}

/**
 * Open with the selected Open With option.
 */
async function openWithOption(
  filePath,
  option,
) {
  const cleanPath = validatePath(filePath);

  if (!option || typeof option !== "object") {
    return {
      success: false,
      path: cleanPath,
      error: "Invalid Open With option.",
    };
  }

  if (option.type === "default") {
    return openWithDefault(cleanPath);
  }

  if (
    option.executable &&
    typeof option.executable === "string"
  ) {
    return openWithApplication(
      cleanPath,
      option.executable,
    );
  }

  return {
    success: false,
    path: cleanPath,
    error:
      "Selected Open With application is invalid.",
  };
}

/**
 * Get association information for multiple files.
 */
async function getMultipleAssociations(
  paths,
) {
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
      results.push(
        await getFileAssociation(
          filePath,
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
 * Public API.
 */
module.exports = {
  validatePath,
  pathExists,
  getExtension,
  getFileAssociation,
  openWithDefault,
  openWithApplication,
  getCommonApplications,
  getRegisteredApplications,
  getOpenWithOptions,
  openWithOption,
  getMultipleAssociations,
};