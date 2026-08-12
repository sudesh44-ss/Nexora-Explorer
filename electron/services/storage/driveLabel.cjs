"use strict";

/*
 * ============================================================
 * Drive Label Service
 * ============================================================
 *
 * Purpose:
 * - Drive label read karna
 * - Drive label change karna
 * - Multiple drive labels read karna
 * - Label validation
 * - System drive protection
 *
 * IMPORTANT:
 * - Ye service sirf drive label handle karti hai.
 * - Formatting yahan nahi hoti.
 * - Mount / unmount / eject yahan nahi hota.
 * - Existing electron.cjs / preload.cjs / App.jsx ko
 *   abhi modify nahi karna hai.
 * ============================================================
 */

const { execFile } = require("child_process");

const isWindows =
  process.platform === "win32";

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
          "Drive labeling is currently supported on Windows only.",
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
    return null;
  }

  try {
    return JSON.parse(clean);
  } catch {
    return null;
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

  return (
    value.charAt(0).toUpperCase() +
    ":"
  );
}

/*
 * ============================================================
 * Normalize Label
 * ============================================================
 *
 * Windows volume labels have practical character and
 * length restrictions depending on the filesystem.
 *
 * We keep the label conservative and avoid control chars.
 * ============================================================
 */

function normalizeLabel(label) {
  if (
    label === null ||
    label === undefined
  ) {
    return "";
  }

  return String(label)
    .replace(/[\u0000-\u001F]/g, "")
    .trim()
    .substring(0, 32);
}

/*
 * ============================================================
 * Escape PowerShell String
 * ============================================================
 */

function escapePowerShellString(
  value,
) {
  return String(value)
    .replace(/'/g, "''");
}

/*
 * ============================================================
 * Get System Drive
 * ============================================================
 */

function getSystemDrive() {
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
 * Is System Drive
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
    getSystemDrive();

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
 * Get Drive Label
 * ============================================================
 */

async function getDriveLabel(
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
      label: "",
      error:
        "Invalid drive letter.",
    };
  }

  const letter =
    normalized.charAt(0);

  const script = `
    $volume = Get-Volume \`
      \`-DriveLetter '${escapePowerShellString(
        letter,
      )}' \`
      \`-ErrorAction Stop

    [PSCustomObject]@{
      DriveLetter = $volume.DriveLetter
      FileSystemLabel = $volume.FileSystemLabel
      FileSystem = $volume.FileSystem
      Size = $volume.Size
      SizeRemaining = $volume.SizeRemaining
      HealthStatus = $volume.HealthStatus
    } | ConvertTo-Json \`
      \`-Depth 3 \`
      \`-Compress
  `;

  try {
    const output =
      await executePowerShell(
        script,
      );

    const volume =
      parseJson(output);

    if (!volume) {
      return {
        success: false,
        driveLetter:
          normalized,
        label: "",
        error:
          `Drive ${normalized} was not found.`,
      };
    }

    return {
      success: true,

      driveLetter:
        volume.DriveLetter
          ? `${volume.DriveLetter}:`
          : normalized,

      label:
        volume.FileSystemLabel ||
        "",

      fileSystem:
        volume.FileSystem ||
        null,

      size:
        Number(volume.Size) ||
        0,

      freeSpace:
        Number(
          volume.SizeRemaining,
        ) || 0,

      healthStatus:
        volume.HealthStatus ||
        null,
    };
  } catch (error) {
    return {
      success: false,
      driveLetter:
        normalized,
      label: "",
      error:
        error.message,
    };
  }
}

/*
 * ============================================================
 * Set Drive Label
 * ============================================================
 *
 * Example:
 *
 * setDriveLabel({
 *   driveLetter: "E:",
 *   label: "My External SSD",
 *   confirm: true
 * })
 *
 * Label change is not destructive like formatting,
 * but explicit confirmation is still required.
 * ============================================================
 */

async function setDriveLabel(
  options = {},
) {
  const {
    driveLetter,
    label,
    confirm = false,
    allowSystemDrive = false,
  } = options;

  const normalized =
    normalizeDriveLetter(
      driveLetter,
    );

  if (!normalized) {
    return {
      success: false,
      error:
        "A valid drive letter is required.",
    };
  }

  /*
   * Require explicit confirmation.
   */
  if (confirm !== true) {
    return {
      success: false,
      driveLetter:
        normalized,
      error:
        "Changing a drive label requires explicit confirmation.",
      requiresConfirmation: true,
    };
  }

  /*
   * System drive protection.
   *
   * User can explicitly allow it if required.
   */
  if (
    isSystemDrive(
      normalized,
    ) &&
    allowSystemDrive !== true
  ) {
    return {
      success: false,
      driveLetter:
        normalized,
      error:
        "Changing the Windows system drive label requires explicit additional approval.",
      requiresSystemDriveApproval: true,
    };
  }

  const normalizedLabel =
    normalizeLabel(label);

  if (
    normalizedLabel.length > 32
  ) {
    return {
      success: false,
      driveLetter:
        normalized,
      error:
        "Drive label is too long.",
    };
  }

  const letter =
    normalized.charAt(0);

  const escapedLabel =
    escapePowerShellString(
      normalizedLabel,
    );

  const script = `
    $volume = Get-Volume \`
      \`-DriveLetter '${escapePowerShellString(
        letter,
      )}' \`
      \`-ErrorAction Stop

    if (-not $volume) {
      throw "Drive was not found."
    }

    Set-Volume \`
      \`-DriveLetter '${escapePowerShellString(
        letter,
      )}' \`
      \`-NewFileSystemLabel '${escapedLabel}'

    $updated = Get-Volume \`
      \`-DriveLetter '${escapePowerShellString(
        letter,
      )}' \`
      \`-ErrorAction Stop

    [PSCustomObject]@{
      DriveLetter = $updated.DriveLetter
      FileSystemLabel = $updated.FileSystemLabel
      FileSystem = $updated.FileSystem
    } | ConvertTo-Json \`
      \`-Depth 3 \`
      \`-Compress
  `;

  try {
    const output =
      await executePowerShell(
        script,
      );

    const updated =
      parseJson(output);

    return {
      success: true,

      driveLetter:
        normalized,

      label:
        updated?.FileSystemLabel ||
        normalizedLabel,

      fileSystem:
        updated?.FileSystem ||
        null,
    };
  } catch (error) {
    return {
      success: false,

      driveLetter:
        normalized,

      label:
        normalizedLabel,

      error:
        error.message,
    };
  }
}

/*
 * ============================================================
 * Rename Drive Label
 * ============================================================
 *
 * Alias-style helper for UI.
 * ============================================================
 */

async function renameDrive(
  driveLetter,
  newLabel,
  options = {},
) {
  return setDriveLabel({
    ...options,
    driveLetter,
    label: newLabel,
  });
}

/*
 * ============================================================
 * Get Multiple Drive Labels
 * ============================================================
 */

async function getMultipleDriveLabels(
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
        await getDriveLabel(
          driveLetter,
        ),
      );
    } catch (error) {
      results.push({
        success: false,
        driveLetter,
        label: "",
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

/*
 * ============================================================
 * Get All Drive Labels
 * ============================================================
 */

async function getAllDriveLabels() {
  const script = `
    Get-Volume |
    Where-Object {
      $_.DriveLetter
    } |
    Select-Object \`
      \`DriveLetter, \`
      \`FileSystemLabel, \`
      \`FileSystem, \`
      \`Size, \`
      \`SizeRemaining, \`
      \`HealthStatus \`
    | ConvertTo-Json \`
      \`-Depth 3 \`
      \`-Compress
  `;

  try {
    const output =
      await executePowerShell(
        script,
      );

    const parsed =
      parseJson(output);

    const volumes =
      Array.isArray(parsed)
        ? parsed
        : parsed
          ? [parsed]
          : [];

    return {
      success: true,

      drives:
        volumes.map(
          (volume) => ({
            driveLetter:
              volume.DriveLetter
                ? `${volume.DriveLetter}:`
                : null,

            label:
              volume.FileSystemLabel ||
              "",

            fileSystem:
              volume.FileSystem ||
              null,

            size:
              Number(
                volume.Size,
              ) || 0,

            freeSpace:
              Number(
                volume.SizeRemaining,
              ) || 0,

            healthStatus:
              volume.HealthStatus ||
              null,
          }),
        ),
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

/*
 * ============================================================
 * Public API
 * ============================================================
 */

module.exports = {
  executePowerShell,
  normalizeDriveLetter,
  normalizeLabel,
  getSystemDrive,
  isSystemDrive,
  getDriveLabel,
  setDriveLabel,
  renameDrive,
  getMultipleDriveLabels,
  getAllDriveLabels,
};