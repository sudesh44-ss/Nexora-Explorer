"use strict";

/*
 * ============================================================
 * Drive Formatting Service
 * ============================================================
 *
 * Purpose:
 * - Drive formatting information
 * - Available file systems
 * - Format removable / external drives
 * - Volume label support
 * - Quick format support
 * - System-drive protection
 * - Drive existence validation
 *
 * Supported file systems:
 * - NTFS
 * - exFAT
 * - FAT32
 *
 * IMPORTANT:
 * Formatting is destructive.
 *
 * This service intentionally requires:
 *
 *   confirm: true
 *
 * before formatting.
 *
 * It also refuses to format the Windows system drive.
 *
 * Existing electron.cjs / preload.cjs / App.jsx
 * are NOT modified here.
 * ============================================================
 */

const { execFile } = require("child_process");

const isWindows =
  process.platform === "win32";

/*
 * ============================================================
 * Supported File Systems
 * ============================================================
 */

const SUPPORTED_FILE_SYSTEMS = new Set([
  "NTFS",
  "exFAT",
  "FAT32",
]);

/*
 * ============================================================
 * PowerShell Helper
 * ============================================================
 */

function executePowerShell(script) {
  return new Promise((resolve, reject) => {
    if (!isWindows) {
      reject(
        new Error(
          "Drive formatting is currently supported on Windows only.",
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

/*
 * ============================================================
 * JSON Parser
 * ============================================================
 */

function parseJson(output) {
  const clean =
    String(output || "").trim();

  if (!clean) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(clean);

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

/*
 * ============================================================
 * Normalize Drive Letter
 * ============================================================
 *
 * Accepts:
 *
 * C
 * C:
 * C:\
 *
 * Returns:
 *
 * C:
 * ============================================================
 */

function normalizeDriveLetter(
  driveLetter,
) {
  if (
    typeof driveLetter !==
      "string" ||
    !driveLetter.trim()
  ) {
    return null;
  }

  let value =
    driveLetter
      .trim()
      .replace(/[\\/]+$/, "");

  if (
    value.length === 1 &&
    /^[A-Za-z]$/.test(value)
  ) {
    value += ":";
  }

  if (
    !/^[A-Za-z]:$/.test(value)
  ) {
    return null;
  }

  return value
    .charAt(0)
    .toUpperCase() + ":";
}

/*
 * ============================================================
 * Validate File System
 * ============================================================
 */

function normalizeFileSystem(
  fileSystem,
) {
  if (
    typeof fileSystem !==
      "string"
  ) {
    return null;
  }

  const value =
    fileSystem.trim();

  for (
    const supported
    of SUPPORTED_FILE_SYSTEMS
  ) {
    if (
      supported.toLowerCase() ===
      value.toLowerCase()
    ) {
      return supported;
    }
  }

  return null;
}

/*
 * ============================================================
 * Validate Volume Label
 * ============================================================
 */

function normalizeVolumeLabel(
  label,
) {
  if (
    label === null ||
    label === undefined
  ) {
    return "";
  }

  return String(label)
    .trim()
    .substring(0, 32);
}

/*
 * ============================================================
 * Get Available File Systems
 * ============================================================
 */

function getSupportedFileSystems() {
  return [
    {
      value: "NTFS",
      label: "NTFS",
      description:
        "Windows-native file system.",
    },

    {
      value: "exFAT",
      label: "exFAT",
      description:
        "Suitable for removable and cross-platform storage.",
    },

    {
      value: "FAT32",
      label: "FAT32",
      description:
        "Compatible with many older devices.",
    },
  ];
}

/*
 * ============================================================
 * Get Windows Logical Disk
 * ============================================================
 */

async function getDriveInfo(
  driveLetter,
) {
  const normalized =
    normalizeDriveLetter(
      driveLetter,
    );

  if (!normalized) {
    return {
      success: false,
      driveLetter,
      error:
        "Invalid drive letter.",
    };
  }

  const script = `
    Get-CimInstance Win32_LogicalDisk \`
      \`-Filter "DeviceID='${normalized}'" |
    Select-Object \`
      \`DeviceID, \`
      \`VolumeName, \`
      \`FileSystem, \`
      \`DriveType, \`
      \`Size, \`
      \`FreeSpace, \`
      \`Description \`
    | ConvertTo-Json \`
      \`-Depth 3 \`
      \`-Compress
  `;

  try {
    const output =
      await executePowerShell(
        script,
      );

    const drives =
      parseJson(output);

    if (!drives.length) {
      return {
        success: false,
        driveLetter:
          normalized,
        error:
          `Drive ${normalized} was not found.`,
      };
    }

    const drive =
      drives[0];

    return {
      success: true,

      driveLetter:
        drive.DeviceID ||
        normalized,

      label:
        drive.VolumeName ||
        "",

      fileSystem:
        drive.FileSystem ||
        null,

      driveType:
        Number(drive.DriveType),

      size:
        Number(drive.Size) || 0,

      freeSpace:
        Number(drive.FreeSpace) || 0,

      description:
        drive.Description ||
        "",
    };
  } catch (error) {
    return {
      success: false,
      driveLetter:
        normalized,
      error:
        error.message,
    };
  }
}

/*
 * ============================================================
 * System Drive Detection
 * ============================================================
 */

function getSystemDriveLetter() {
  if (!isWindows) {
    return null;
  }

  return (
    process.env.SystemDrive ||
    "C:"
  ).toUpperCase();
}

/*
 * ============================================================
 * Check System Drive
 * ============================================================
 */

function isSystemDrive(
  driveLetter,
) {
  const normalized =
    normalizeDriveLetter(
      driveLetter,
    );

  const systemDrive =
    getSystemDriveLetter();

  if (
    !normalized ||
    !systemDrive
  ) {
    return false;
  }

  return (
    normalized.toUpperCase() ===
    systemDrive.toUpperCase()
  );
}

/*
 * ============================================================
 * Check Formatting Eligibility
 * ============================================================
 *
 * Default policy:
 *
 * - System drive: BLOCKED
 * - Local fixed drive: BLOCKED by default
 * - Removable drive: allowed after confirmation
 * - External/removable storage: allowed
 *
 * This is intentionally conservative.
 * ============================================================
 */

async function checkFormattingEligibility(
  driveLetter,
) {
  const info =
    await getDriveInfo(
      driveLetter,
    );

  if (!info.success) {
    return {
      success: false,
      allowed: false,
      error:
        info.error,
    };
  }

  if (
    isSystemDrive(
      info.driveLetter,
    )
  ) {
    return {
      success: true,
      allowed: false,
      reason:
        "The Windows system drive cannot be formatted.",
      drive: info,
    };
  }

  /*
   * Win32 LogicalDisk DriveType:
   *
   * 2 = Removable
   * 3 = Local Disk
   * 4 = Network
   * 5 = CD-ROM
   */
  if (
    info.driveType === 4
  ) {
    return {
      success: true,
      allowed: false,
      reason:
        "Network drives cannot be formatted through this service.",
      drive: info,
    };
  }

  if (
    info.driveType === 5
  ) {
    return {
      success: true,
      allowed: false,
      reason:
        "CD/DVD drives cannot be formatted.",
      drive: info,
    };
  }

  /*
   * Removable drives are explicitly supported.
   */
  if (
    info.driveType === 2
  ) {
    return {
      success: true,
      allowed: true,
      reason:
        "Removable drive can be formatted after confirmation.",
      drive: info,
    };
  }

  /*
   * Fixed drives are not automatically allowed.
   *
   * The caller must explicitly request this.
   */
  if (
    info.driveType === 3
  ) {
    return {
      success: true,
      allowed: false,
      requiresExplicitFixedDriveApproval:
        true,
      reason:
        "Fixed drives require explicit additional approval.",
      drive: info,
    };
  }

  return {
    success: true,
    allowed: false,
    reason:
      "This drive type is not supported for formatting.",
    drive: info,
  };
}

/*
 * ============================================================
 * Build Format Arguments
 * ============================================================
 */

function buildFormatOptions({
  fileSystem,
  label,
  quickFormat,
}) {
  const normalizedFileSystem =
    normalizeFileSystem(
      fileSystem,
    );

  if (!normalizedFileSystem) {
    return {
      success: false,
      error:
        "Unsupported file system.",
    };
  }

  const normalizedLabel =
    normalizeVolumeLabel(
      label,
    );

  return {
    success: true,

    fileSystem:
      normalizedFileSystem,

    label:
      normalizedLabel,

    quickFormat:
      quickFormat !== false,
  };
}

/*
 * ============================================================
 * Format Drive
 * ============================================================
 *
 * REQUIRED:
 *
 * {
 *   driveLetter: "E:",
 *   fileSystem: "exFAT",
 *   label: "External SSD",
 *   quickFormat: true,
 *   confirm: true
 * }
 *
 * Optional:
 *
 * allowFixedDrive: true
 *
 * This is intentionally required for fixed drives.
 * ============================================================
 */

async function formatDrive(options = {}) {
  const {
    driveLetter,
    fileSystem,
    label,
    quickFormat = true,
    confirm = false,
    allowFixedDrive = false,
  } = options;

  const normalizedDrive =
    normalizeDriveLetter(
      driveLetter,
    );

  if (!normalizedDrive) {
    return {
      success: false,
      error:
        "A valid drive letter is required.",
    };
  }

  /*
   * Mandatory confirmation.
   */
  if (confirm !== true) {
    return {
      success: false,
      driveLetter:
        normalizedDrive,
      error:
        "Formatting requires explicit confirmation.",
      requiresConfirmation: true,
    };
  }

  /*
   * Never allow system drive.
   */
  if (
    isSystemDrive(
      normalizedDrive,
    )
  ) {
    return {
      success: false,
      driveLetter:
        normalizedDrive,
      error:
        "Formatting the Windows system drive is blocked.",
    };
  }

  const driveInfo =
    await getDriveInfo(
      normalizedDrive,
    );

  if (!driveInfo.success) {
    return driveInfo;
  }

  /*
   * Network / optical drives are blocked.
   */
  if (
    driveInfo.driveType === 4
  ) {
    return {
      success: false,
      driveLetter:
        normalizedDrive,
      error:
        "Network drives cannot be formatted.",
    };
  }

  if (
    driveInfo.driveType === 5
  ) {
    return {
      success: false,
      driveLetter:
        normalizedDrive,
      error:
        "CD/DVD drives cannot be formatted.",
    };
  }

  /*
   * Fixed drive requires additional explicit flag.
   */
  if (
    driveInfo.driveType === 3 &&
    allowFixedDrive !== true
  ) {
    return {
      success: false,
      driveLetter:
        normalizedDrive,
      error:
        "Formatting a fixed drive requires allowFixedDrive=true.",
      requiresFixedDriveApproval: true,
    };
  }

  /*
   * Prepare filesystem settings.
   */
  const formatOptions =
    buildFormatOptions({
      fileSystem,
      label,
      quickFormat,
    });

  if (!formatOptions.success) {
    return formatOptions;
  }

  /*
   * Escape PowerShell single quotes safely.
   */
  const escapedDrive =
    normalizedDrive.replace(
      /'/g,
      "''",
    );

  const escapedLabel =
    formatOptions.label.replace(
      /'/g,
      "''",
    );

  const escapedFileSystem =
    formatOptions.fileSystem.replace(
      /'/g,
      "''",
    );

  /*
   * Build PowerShell command.
   *
   * Clear-Everything operation is intentionally NOT used.
   */
  const script = `
    $volume = Get-Volume -DriveLetter '${escapedDrive.charAt(
      0,
    )}' -ErrorAction Stop

    if (-not $volume) {
      throw "Volume was not found."
    }

    Format-Volume \`
      \`-DriveLetter '${escapedDrive.charAt(
        0,
      )}' \`
      \`-FileSystem '${escapedFileSystem}' \`
      \`-NewFileSystemLabel '${escapedLabel}' \`
      \`${
        formatOptions.quickFormat
          ? "-Full:$false"
          : "-Full:$true"
      } \`
      \`-Confirm:$false \`
      \`-Force \`
    | Select-Object \`
      \`DriveLetter, \`
      \`FileSystem, \`
      \`FileSystemLabel, \`
      \`Size, \`
      \`SizeRemaining \`
    | ConvertTo-Json \`
      \`-Depth 3 \`
      \`-Compress
  `;

  try {
    const output =
      await executePowerShell(
        script,
      );

    const result =
      parseJson(output);

    return {
      success: true,

      driveLetter:
        normalizedDrive,

      fileSystem:
        formatOptions.fileSystem,

      label:
        formatOptions.label,

      quickFormat:
        formatOptions.quickFormat,

      result:
        result[0] || null,
    };
  } catch (error) {
    return {
      success: false,

      driveLetter:
        normalizedDrive,

      fileSystem:
        formatOptions.fileSystem,

      label:
        formatOptions.label,

      error:
        error.message,
    };
  }
}

/*
 * ============================================================
 * Format Preview
 * ============================================================
 *
 * Does NOT format anything.
 *
 * Used by UI before confirmation.
 * ============================================================
 */

async function getFormatPreview(
  options = {},
) {
  const {
    driveLetter,
    fileSystem,
    label,
    quickFormat = true,
    allowFixedDrive = false,
  } = options;

  const eligibility =
    await checkFormattingEligibility(
      driveLetter,
    );

  if (!eligibility.success) {
    return eligibility;
  }

  if (
    !eligibility.allowed &&
    !(
      eligibility.requiresExplicitFixedDriveApproval &&
      allowFixedDrive === true
    )
  ) {
    return {
      success: true,
      allowed: false,
      warning:
        eligibility.reason,
      drive:
        eligibility.drive,
    };
  }

  const formatOptions =
    buildFormatOptions({
      fileSystem,
      label,
      quickFormat,
    });

  if (!formatOptions.success) {
    return formatOptions;
  }

  return {
    success: true,

    allowed: true,

    drive:
      eligibility.drive,

    fileSystem:
      formatOptions.fileSystem,

    label:
      formatOptions.label,

    quickFormat:
      formatOptions.quickFormat,

    warning:
      "Formatting will permanently erase data on the selected drive.",
  };
}

/*
 * ============================================================
 * Public API
 * ============================================================
 */

module.exports = {
  executePowerShell,
  normalizeDriveLetter,
  normalizeFileSystem,
  normalizeVolumeLabel,
  getSupportedFileSystems,
  getDriveInfo,
  getSystemDriveLetter,
  isSystemDrive,
  checkFormattingEligibility,
  buildFormatOptions,
  formatDrive,
  getFormatPreview,
};