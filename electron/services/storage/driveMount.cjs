"use strict";

/*
 * ============================================================
 * Drive Mount / Unmount Service
 * ============================================================
 *
 * Purpose:
 * - Drive/volume status read karna
 * - Volume online/offline status
 * - Mount/accessibility information
 * - Volume online karna
 * - Volume offline karna
 * - Drive letter information
 *
 * IMPORTANT:
 *
 * Windows architecture me:
 *
 *     Linux:
 *     mount / unmount
 *
 * Windows:
 *     Online / Offline volume
 *     Drive letter / access path
 *
 * Therefore this service uses Windows Storage cmdlets.
 *
 * Existing electron.cjs / preload.cjs / App.jsx
 * ko abhi modify nahi karna hai.
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
          "Drive mount/unmount operations are supported on Windows only.",
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
        maxBuffer: 20 * 1024 * 1024,
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
 * Escape PowerShell String
 * ============================================================
 */

function escapePowerShellString(
  value,
) {
  return String(value).replace(
    /'/g,
    "''",
  );
}

/*
 * ============================================================
 * Get Volume Information
 * ============================================================
 */

async function getVolumeInfo(
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

  const letter =
    normalized.charAt(0);

  const escapedLetter =
    escapePowerShellString(
      letter,
    );

  const script = `
    $volume = Get-Volume \`
      \`-DriveLetter '${escapedLetter}' \`
      \`-ErrorAction Stop

    [PSCustomObject]@{
      DriveLetter = $volume.DriveLetter
      FileSystemLabel = $volume.FileSystemLabel
      FileSystem = $volume.FileSystem
      HealthStatus = $volume.HealthStatus
      OperationalStatus = $volume.OperationalStatus
      Size = $volume.Size
      SizeRemaining = $volume.SizeRemaining
      Path = $volume.Path
      UniqueId = $volume.UniqueId
    } | ConvertTo-Json \`
      \`-Depth 5 \`
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
        error:
          `Volume ${normalized} was not found.`,
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

      healthStatus:
        volume.HealthStatus ||
        null,

      operationalStatus:
        volume.OperationalStatus ||
        null,

      size:
        Number(volume.Size) ||
        0,

      freeSpace:
        Number(
          volume.SizeRemaining,
        ) || 0,

      path:
        volume.Path ||
        null,

      uniqueId:
        volume.UniqueId ||
        null,
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
 * Get All Volumes
 * ============================================================
 */

async function getAllVolumes() {
  const script = `
    Get-Volume |
    Select-Object \`
      \`DriveLetter, \`
      \`FileSystemLabel, \`
      \`FileSystem, \`
      \`HealthStatus, \`
      \`OperationalStatus, \`
      \`Size, \`
      \`SizeRemaining, \`
      \`Path, \`
      \`UniqueId \`
    | ConvertTo-Json \`
      \`-Depth 5 \`
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

      volumes:
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

            healthStatus:
              volume.HealthStatus ||
              null,

            operationalStatus:
              volume.OperationalStatus ||
              null,

            size:
              Number(
                volume.Size,
              ) || 0,

            freeSpace:
              Number(
                volume.SizeRemaining,
              ) || 0,

            path:
              volume.Path ||
              null,

            uniqueId:
              volume.UniqueId ||
              null,
          }),
        ),
    };
  } catch (error) {
    return {
      success: false,
      volumes: [],
      error:
        error.message,
    };
  }
}

/*
 * ============================================================
 * Get Volume Online Status
 * ============================================================
 */

async function getVolumeOnlineStatus(
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
      online: false,
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
      OperationalStatus = $volume.OperationalStatus
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

    const result =
      parseJson(output);

    if (!result) {
      return {
        success: false,
        driveLetter:
          normalized,
        online: false,
        error:
          "Volume information was unavailable.",
      };
    }

    const status =
      Array.isArray(
        result.OperationalStatus,
      )
        ? result.OperationalStatus
        : [
            result.OperationalStatus,
          ];

    const normalizedStatus =
      status
        .filter(Boolean)
        .map((item) =>
          String(item)
            .trim()
            .toLowerCase(),
        );

    const online =
      normalizedStatus.some(
        (item) =>
          item.includes("online") ||
          item.includes("healthy") ||
          item.includes("ok"),
      );

    return {
      success: true,

      driveLetter:
        normalized,

      online,

      operationalStatus:
        result.OperationalStatus ||
        null,

      healthStatus:
        result.HealthStatus ||
        null,
    };
  } catch (error) {
    return {
      success: false,
      driveLetter:
        normalized,
      online: false,
      error:
        error.message,
    };
  }
}

/*
 * ============================================================
 * Set Volume Online
 * ============================================================
 *
 * Uses Set-Disk -IsOffline $false.
 *
 * This requires administrative privileges for some
 * storage configurations.
 * ============================================================
 */

async function mountDrive(
  driveLetter,
  options = {},
) {
  const {
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
      driveLetter,
      error:
        "Invalid drive letter.",
    };
  }

  if (confirm !== true) {
    return {
      success: false,
      driveLetter:
        normalized,
      error:
        "Mount/online operation requires explicit confirmation.",
      requiresConfirmation: true,
    };
  }

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
        "The Windows system drive cannot be manually mounted through this service.",
    };
  }

  const letter =
    normalized.charAt(0);

  /*
   * Find physical disk associated with volume.
   */
  const script = `
    $partition = Get-Partition \`
      \`-DriveLetter '${escapePowerShellString(
        letter,
      )}' \`
      \`-ErrorAction Stop

    if (-not $partition) {
      throw "Partition was not found."
    }

    $disk = Get-Disk \`
      \`-Number $partition.DiskNumber \`
      \`-ErrorAction Stop

    if ($disk.IsOffline) {
      Set-Disk \`
        \`-Number $disk.Number \`
        \`-IsOffline:$false
    }

    $updatedDisk = Get-Disk \`
      \`-Number $disk.Number \`
      \`-ErrorAction Stop

    [PSCustomObject]@{
      DiskNumber = $updatedDisk.Number
      IsOffline = $updatedDisk.IsOffline
      IsReadOnly = $updatedDisk.IsReadOnly
    } | ConvertTo-Json \`
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
        normalized,

      online:
        result
          ? !Boolean(
              result.IsOffline,
            )
          : true,

      diskNumber:
        result
          ? Number(
              result.DiskNumber,
            )
          : null,

      isReadOnly:
        result
          ? Boolean(
              result.IsReadOnly,
            )
          : null,
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
 * Set Volume Offline
 * ============================================================
 *
 * WARNING:
 * This makes the disk unavailable to Windows.
 *
 * System drive is blocked.
 *
 * Confirmation is mandatory.
 * ============================================================
 */

async function unmountDrive(
  driveLetter,
  options = {},
) {
  const {
    confirm = false,
  } = options;

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

  if (confirm !== true) {
    return {
      success: false,
      driveLetter:
        normalized,
      error:
        "Unmount/offline operation requires explicit confirmation.",
      requiresConfirmation: true,
    };
  }

  /*
   * Never allow system drive.
   */
  if (
    isSystemDrive(
      normalized,
    )
  ) {
    return {
      success: false,
      driveLetter:
        normalized,
      error:
        "The Windows system drive cannot be taken offline.",
    };
  }

  const letter =
    normalized.charAt(0);

  const script = `
    $partition = Get-Partition \`
      \`-DriveLetter '${escapePowerShellString(
        letter,
      )}' \`
      \`-ErrorAction Stop

    if (-not $partition) {
      throw "Partition was not found."
    }

    $disk = Get-Disk \`
      \`-Number $partition.DiskNumber \`
      \`-ErrorAction Stop

    if ($disk.IsBoot) {
      throw "Boot disk cannot be taken offline."
    }

    if ($disk.IsSystem) {
      throw "System disk cannot be taken offline."
    }

    Set-Disk \`
      \`-Number $disk.Number \`
      \`-IsOffline:$true

    $updatedDisk = Get-Disk \`
      \`-Number $disk.Number \`
      \`-ErrorAction Stop

    [PSCustomObject]@{
      DiskNumber = $updatedDisk.Number
      IsOffline = $updatedDisk.IsOffline
      IsReadOnly = $updatedDisk.IsReadOnly
    } | ConvertTo-Json \`
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
        normalized,

      online:
        result
          ? !Boolean(
              result.IsOffline,
            )
          : false,

      diskNumber:
        result
          ? Number(
              result.DiskNumber,
            )
          : null,

      isReadOnly:
        result
          ? Boolean(
              result.IsReadOnly,
            )
          : null,
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
 * Get Mount/Unmount Preview
 * ============================================================
 *
 * No changes are made.
 * ============================================================
 */

async function getMountPreview(
  driveLetter,
  action,
) {
  const normalized =
    normalizeDriveLetter(
      driveLetter,
    );

  if (!normalized) {
    return {
      success: false,
      allowed: false,
      error:
        "Invalid drive letter.",
    };
  }

  if (
    action !== "mount" &&
    action !== "unmount"
  ) {
    return {
      success: false,
      allowed: false,
      error:
        'Action must be "mount" or "unmount".',
    };
  }

  if (
    action === "unmount" &&
    isSystemDrive(
      normalized,
    )
  ) {
    return {
      success: true,
      allowed: false,
      action,
      driveLetter:
        normalized,
      warning:
        "The Windows system drive cannot be taken offline.",
    };
  }

  return {
    success: true,

    allowed: true,

    action,

    driveLetter:
      normalized,

    warning:
      action === "unmount"
        ? "The drive will become unavailable to Windows until it is brought online again."
        : "The drive will be brought online if Windows can access it.",
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
  getSystemDrive,
  isSystemDrive,
  getVolumeInfo,
  getAllVolumes,
  getVolumeOnlineStatus,
  mountDrive,
  unmountDrive,
  getMountPreview,
};