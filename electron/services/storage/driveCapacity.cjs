"use strict";

/*
 * ============================================================
 * Drive Capacity Service
 * ============================================================
 *
 * Purpose:
 * - Drive total capacity
 * - Used space
 * - Free space
 * - Used percentage
 * - Free percentage
 * - Multiple drive capacity
 * - Human-readable storage values
 *
 * Windows-focused implementation.
 *
 * IMPORTANT:
 * This service ONLY reads storage capacity information.
 *
 * It does NOT:
 * - format drives
 * - change labels
 * - mount/unmount drives
 * - eject drives
 * - modify partitions
 * ============================================================
 */

const { execFile } = require("child_process");

/**
 * Windows check.
 */
const isWindows =
  process.platform === "win32";

/**
 * ============================================================
 * PowerShell Helper
 * ============================================================
 */

function executePowerShell(script) {
  return new Promise((resolve, reject) => {
    if (!isWindows) {
      reject(
        new Error(
          "Drive capacity information is currently supported on Windows only.",
        ),
      );

      return;
    }

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
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              stderr?.trim() ||
                error.message ||
                "PowerShell command failed.",
            ),
          );

          return;
        }

        resolve(stdout || "");
      },
    );
  });
}

/**
 * ============================================================
 * JSON Helper
 * ============================================================
 */

function parsePowerShellJson(output) {
  const cleanOutput =
    String(output || "").trim();

  if (!cleanOutput) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(cleanOutput);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (
      parsed &&
      typeof parsed === "object"
    ) {
      return [parsed];
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * ============================================================
 * Number Helper
 * ============================================================
 */

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

/**
 * ============================================================
 * Format Bytes
 * ============================================================
 *
 * Example:
 *
 * 1024
 * -> 1 KB
 *
 * 1073741824
 * -> 1 GB
 * ============================================================
 */

function formatBytes(
  bytes,
  decimals = 2,
) {
  const value =
    toNumber(bytes);

  if (
    value === null ||
    value < 0
  ) {
    return "Unknown";
  }

  if (value === 0) {
    return "0 Bytes";
  }

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
    "TB",
    "PB",
    "EB",
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(value) /
          Math.log(1024),
      ),
      units.length - 1,
    );

  const decimalPlaces =
    index === 0
      ? 0
      : Math.max(
          0,
          Number(decimals),
        );

  return `${(
    value /
    Math.pow(1024, index)
  ).toFixed(decimalPlaces)} ${
    units[index]
  }`;
}

/**
 * ============================================================
 * Calculate Percent
 * ============================================================
 */

function calculatePercentage(
  value,
  total,
) {
  const numericValue =
    toNumber(value);

  const numericTotal =
    toNumber(total);

  if (
    numericValue === null ||
    numericTotal === null ||
    numericTotal <= 0
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      (numericValue /
        numericTotal) *
        100,
    ),
  );
}

/**
 * ============================================================
 * Round Percentage
 * ============================================================
 */

function roundPercentage(
  percentage,
  decimals = 2,
) {
  const value =
    Number(percentage);

  if (!Number.isFinite(value)) {
    return 0;
  }

  const multiplier =
    Math.pow(
      10,
      decimals,
    );

  return (
    Math.round(
      value * multiplier,
    ) / multiplier
  );
}

/**
 * ============================================================
 * Calculate Drive Capacity
 * ============================================================
 */

function calculateDriveCapacity(
  totalBytes,
  freeBytes,
) {
  const total =
    toNumber(totalBytes);

  const free =
    toNumber(freeBytes);

  if (
    total === null ||
    free === null ||
    total < 0 ||
    free < 0
  ) {
    return {
      success: false,
      total: null,
      free: null,
      used: null,
      usedPercentage: 0,
      freePercentage: 0,
      error:
        "Invalid drive capacity values.",
    };
  }

  /*
   * Windows should normally report:
   *
   * free <= total
   *
   * Clamp free space for safety.
   */
  const normalizedFree =
    Math.min(
      free,
      total,
    );

  const used =
    Math.max(
      0,
      total -
        normalizedFree,
    );

  const usedPercentage =
    roundPercentage(
      calculatePercentage(
        used,
        total,
      ),
    );

  const freePercentage =
    roundPercentage(
      calculatePercentage(
        normalizedFree,
        total,
      ),
    );

  return {
    success: true,

    total,

    free:
      normalizedFree,

    used,

    usedPercentage,

    freePercentage,

    totalFormatted:
      formatBytes(total),

    freeFormatted:
      formatBytes(
        normalizedFree,
      ),

    usedFormatted:
      formatBytes(used),
  };
}

/**
 * ============================================================
 * Get Capacity For One Drive
 * ============================================================
 */

async function getDriveCapacity(
  driveLetter,
) {
  if (
    typeof driveLetter !==
      "string" ||
    !driveLetter.trim()
  ) {
    return {
      success: false,
      driveLetter: null,
      error:
        "Drive letter is required.",
    };
  }

  let normalizedDrive =
    driveLetter
      .trim()
      .replace(/[\\/]+$/, "");

  /*
   * Accept:
   *
   * C
   * C:
   * C:\
   */
  if (
    normalizedDrive.length === 1
  ) {
    normalizedDrive += ":";
  }

  if (
    normalizedDrive.length !== 2 ||
    normalizedDrive[1] !== ":"
  ) {
    return {
      success: false,
      driveLetter:
        normalizedDrive,
      error:
        "Invalid drive letter.",
    };
  }

  const script = `Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${normalizedDrive}'" | Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace, DriveType | ConvertTo-Json -Depth 3 -Compress`;

  try {
    const output =
      await executePowerShell(
        script,
      );

    const result =
      parsePowerShellJson(
        output,
      );

    if (!result.length) {
      return {
        success: false,
        driveLetter:
          normalizedDrive,
        error:
          `Drive ${normalizedDrive} was not found.`,
      };
    }

    const drive =
      result[0];

    const capacity =
      calculateDriveCapacity(
        drive.Size,
        drive.FreeSpace,
      );

    if (!capacity.success) {
      return {
        success: false,
        driveLetter:
          normalizedDrive,
        error:
          capacity.error,
      };
    }

    return {
      success: true,

      driveLetter:
        drive.DeviceID ||
        normalizedDrive,

      label:
        drive.VolumeName || "",

      fileSystem:
        drive.FileSystem || null,

      driveType:
        toNumber(
          drive.DriveType,
        ),

      ...capacity,
    };
  } catch (error) {
    return {
      success: false,
      driveLetter:
        normalizedDrive,
      error:
        error.message,
    };
  }
}

/**
 * ============================================================
 * Get Capacity For All Drives
 * ============================================================
 */

async function getAllDriveCapacities() {
  const script = `Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace, DriveType | ConvertTo-Json -Depth 3 -Compress`;

  try {
    const output =
      await executePowerShell(
        script,
      );

    const drives =
      parsePowerShellJson(
        output,
      );

    const results =
      drives.map(
        (drive) => {
          const capacity =
            calculateDriveCapacity(
              drive.Size,
              drive.FreeSpace,
            );

          return {
            success:
              capacity.success,

            driveLetter:
              drive.DeviceID ||
              null,

            label:
              drive.VolumeName ||
              "",

            fileSystem:
              drive.FileSystem ||
              null,

            driveType:
              toNumber(
                drive.DriveType,
              ),

            ...(capacity.success
              ? capacity
              : {
                  error:
                    capacity.error,
                }),
          };
        },
      );

    return {
      success: true,
      drives: results,
    };
  } catch (error) {
    return {
      success: false,
      drives: [],
      error:
        error.message,
    };
  }
}

/**
 * ============================================================
 * Get Capacity For Selected Drives
 * ============================================================
 */

async function getSelectedDriveCapacities(
  driveLetters,
) {
  if (
    !Array.isArray(
      driveLetters,
    )
  ) {
    return {
      success: false,
      drives: [],
      error:
        "Drive letters must be an array.",
    };
  }

  const results = [];

  for (
    const driveLetter
    of driveLetters
  ) {
    try {
      results.push(
        await getDriveCapacity(
          driveLetter,
        ),
      );
    } catch (error) {
      results.push({
        success: false,
        driveLetter,
        error:
          error.message,
      });
    }
  }

  return {
    success: true,
    drives: results,
  };
}

/**
 * ============================================================
 * Get Storage Usage
 * ============================================================
 */

async function getDriveUsage(
  driveLetter,
) {
  const result =
    await getDriveCapacity(
      driveLetter,
    );

  if (!result.success) {
    return result;
  }

  return {
    success: true,

    driveLetter:
      result.driveLetter,

    total:
      result.total,

    used:
      result.used,

    free:
      result.free,

    usedPercentage:
      result.usedPercentage,

    freePercentage:
      result.freePercentage,

    totalFormatted:
      result.totalFormatted,

    usedFormatted:
      result.usedFormatted,

    freeFormatted:
      result.freeFormatted,

    /*
     * Useful for a progress bar.
     */
    usageRatio:
      result.usedPercentage /
      100,
  };
}

/**
 * ============================================================
 * Get Storage Status
 * ============================================================
 *
 * Returns a simple status:
 *
 * healthy
 * warning
 * critical
 *
 * Thresholds:
 *
 * < 80%  = healthy
 * 80-90% = warning
 * > 90%  = critical
 * ============================================================
 */

function getStorageStatus(
  usedPercentage,
) {
  const percentage =
    Number(
      usedPercentage,
    );

  if (
    !Number.isFinite(
      percentage,
    )
  ) {
    return {
      status: "unknown",
      message:
        "Storage usage is unavailable.",
    };
  }

  if (percentage >= 90) {
    return {
      status: "critical",
      message:
        "Drive is almost full.",
    };
  }

  if (percentage >= 80) {
    return {
      status: "warning",
      message:
        "Drive storage is getting low.",
    };
  }

  return {
    status: "healthy",
    message:
      "Drive has sufficient free space.",
  };
}

/**
 * ============================================================
 * Get Capacity Summary
 * ============================================================
 */

async function getDriveCapacitySummary(
  driveLetter,
) {
  const result =
    await getDriveUsage(
      driveLetter,
    );

  if (!result.success) {
    return result;
  }

  const status =
    getStorageStatus(
      result.usedPercentage,
    );

  return {
    ...result,

    storageStatus:
      status.status,

    storageMessage:
      status.message,
  };
}

/**
 * ============================================================
 * Get Total Storage Across Drives
 * ============================================================
 *
 * Adds physical logical-drive capacity together.
 *
 * Useful for a "This PC" overview.
 * ============================================================
 */

async function getTotalStorageSummary() {
  const result =
    await getAllDriveCapacities();

  if (!result.success) {
    return result;
  }

  let total = 0;
  let used = 0;
  let free = 0;

  for (
    const drive
    of result.drives
  ) {
    if (!drive.success) {
      continue;
    }

    total +=
      Number(drive.total) || 0;

    used +=
      Number(drive.used) || 0;

    free +=
      Number(drive.free) || 0;
  }

  const usedPercentage =
    roundPercentage(
      calculatePercentage(
        used,
        total,
      ),
    );

  const freePercentage =
    roundPercentage(
      calculatePercentage(
        free,
        total,
      ),
    );

  return {
    success: true,

    total,

    used,

    free,

    usedPercentage,

    freePercentage,

    totalFormatted:
      formatBytes(total),

    usedFormatted:
      formatBytes(used),

    freeFormatted:
      formatBytes(free),
  };
}

/**
 * ============================================================
 * Public API
 * ============================================================
 */

module.exports = {
  formatBytes,
  calculatePercentage,
  roundPercentage,
  calculateDriveCapacity,
  getDriveCapacity,
  getAllDriveCapacities,
  getSelectedDriveCapacities,
  getDriveUsage,
  getStorageStatus,
  getDriveCapacitySummary,
  getTotalStorageSummary,
};