"use strict";

/*
 * ============================================================
 * Safe Eject Service
 * ============================================================
 *
 * Purpose:
 * - USB / removable drive safely eject karna
 * - Physical disk identify karna
 * - Removable media verify karna
 * - System drive protection
 * - Fixed internal disk protection
 *
 * IMPORTANT:
 * - Existing files ko modify nahi karta.
 * - Formatting nahi karta.
 * - Mount / unmount functionality yahan implement nahi hai.
 * - Sirf safe removal/eject operation handle karta hai.
 *
 * Windows-focused implementation.
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
          "Safe eject is currently supported on Windows only.",
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
 * System Drive
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
 * Get Physical Disk For Drive
 * ============================================================
 *
 * Finds:
 *
 * Drive letter
 *      ↓
 * Partition
 *      ↓
 * Physical Disk
 *
 * Example:
 *
 * E:
 *  ↓
 * Disk 2
 * ============================================================
 */

async function getPhysicalDiskForDrive(
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

    [PSCustomObject]@{
      DriveLetter = '${escapePowerShellString(
        normalized,
      )}'
      DiskNumber = $disk.Number
      FriendlyName = $disk.FriendlyName
      SerialNumber = $disk.SerialNumber
      BusType = $disk.BusType
      MediaType = $disk.MediaType
      Size = $disk.Size
      IsBoot = $disk.IsBoot
      IsSystem = $disk.IsSystem
      IsOffline = $disk.IsOffline
      IsReadOnly = $disk.IsReadOnly
      OperationalStatus = $disk.OperationalStatus
      HealthStatus = $disk.HealthStatus
    } | ConvertTo-Json \`
      \`-Depth 5 \`
      \`-Compress
  `;

  try {
    const output =
      await executePowerShell(
        script,
      );

    const disk =
      parseJson(output);

    if (!disk) {
      return {
        success: false,
        driveLetter:
          normalized,
        error:
          "Physical disk information was unavailable.",
      };
    }

    return {
      success: true,

      driveLetter:
        normalized,

      diskNumber:
        Number(
          disk.DiskNumber,
        ),

      friendlyName:
        disk.FriendlyName ||
        null,

      serialNumber:
        disk.SerialNumber ||
        null,

      busType:
        disk.BusType ||
        null,

      mediaType:
        disk.MediaType ||
        null,

      size:
        Number(disk.Size) ||
        0,

      isBoot:
        Boolean(disk.IsBoot),

      isSystem:
        Boolean(disk.IsSystem),

      isOffline:
        Boolean(disk.IsOffline),

      isReadOnly:
        Boolean(disk.IsReadOnly),

      operationalStatus:
        disk.OperationalStatus ||
        null,

      healthStatus:
        disk.HealthStatus ||
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
 * Check Whether Disk Is Removable
 * ============================================================
 *
 * Windows BusType values commonly include:
 *
 * USB
 * SD
 * MMC
 * SATA
 * NVMe
 * RAID
 *
 * For safe eject we primarily allow:
 *
 * USB
 * SD
 * MMC
 *
 * ============================================================
 */

function isRemovableBusType(
  busType,
) {
  const value =
    String(
      busType || "",
    )
      .trim()
      .toLowerCase();

  return (
    value === "usb" ||
    value === "sd" ||
    value === "mmc"
  );
}

/*
 * ============================================================
 * Get Eject Eligibility
 * ============================================================
 */

async function getEjectEligibility(
  driveLetter,
) {
  const normalized =
    normalizeDriveLetter(
      driveLetter,
    );

  if (!normalized) {
    return {
      success: false,
      allowed: false,
      driveLetter,
      error:
        "Invalid drive letter.",
    };
  }

  /*
   * Never eject Windows system drive.
   */
  if (
    isSystemDrive(
      normalized,
    )
  ) {
    return {
      success: true,
      allowed: false,
      driveLetter:
        normalized,
      reason:
        "The Windows system drive cannot be ejected.",
    };
  }

  const disk =
    await getPhysicalDiskForDrive(
      normalized,
    );

  if (!disk.success) {
    return {
      success: false,
      allowed: false,
      driveLetter:
        normalized,
      error:
        disk.error,
    };
  }

  /*
   * Boot/system disk protection.
   */
  if (
    disk.isBoot ||
    disk.isSystem
  ) {
    return {
      success: true,
      allowed: false,
      driveLetter:
        normalized,
      disk,
      reason:
        "Boot/system disks cannot be ejected.",
    };
  }

  /*
   * Only removable bus types.
   */
  if (
    !isRemovableBusType(
      disk.busType,
    )
  ) {
    return {
      success: true,
      allowed: false,
      driveLetter:
        normalized,
      disk,
      reason:
        "This drive does not appear to be removable.",
    };
  }

  return {
    success: true,
    allowed: true,
    driveLetter:
      normalized,
    disk,
    reason:
      "Drive appears to be removable and can be considered for safe eject.",
  };
}

/*
 * ============================================================
 * Eject Physical Disk
 * ============================================================
 *
 * Uses Windows PowerShell / CIM to request removal.
 *
 * The actual result depends on Windows, storage controller,
 * open handles and device driver support.
 * ============================================================
 */

async function ejectDrive(
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

  /*
   * Mandatory confirmation.
   */
  if (confirm !== true) {
    return {
      success: false,
      driveLetter:
        normalized,
      error:
        "Safe eject requires explicit confirmation.",
      requiresConfirmation: true,
    };
  }

  /*
   * Check whether it is actually safe to eject.
   */
  const eligibility =
    await getEjectEligibility(
      normalized,
    );

  if (!eligibility.success) {
    return eligibility;
  }

  if (!eligibility.allowed) {
    return {
      success: false,
      driveLetter:
        normalized,
      error:
        eligibility.reason,
      disk:
        eligibility.disk ||
        null,
    };
  }

  const diskNumber =
    eligibility.disk.diskNumber;

  /*
   * Ask Windows to eject the physical disk.
   *
   * We intentionally do not force-remove the device.
   */
  const script = `
    $disk = Get-Disk \`
      \`-Number ${Number(
        diskNumber,
      )} \`
      \`-ErrorAction Stop

    if ($disk.IsBoot) {
      throw "Boot disk cannot be ejected."
    }

    if ($disk.IsSystem) {
      throw "System disk cannot be ejected."
    }

    if ($disk.BusType -notin @(
      "USB",
      "SD",
      "MMC"
    )) {
      throw "The selected disk is not a supported removable device."
    }

    $device = Get-PnpDevice \`
      \`-PresentOnly \`
      \`-ErrorAction SilentlyContinue |
      Where-Object {
        $_.InstanceId -eq $disk.UniqueId
      }

    [PSCustomObject]@{
      DiskNumber = $disk.Number
      BusType = $disk.BusType
      FriendlyName = $disk.FriendlyName
      ReadyForRemoval = $true
    } | ConvertTo-Json \`
      \`-Depth 5 \`
      \`-Compress
  `;

  try {
    /*
     * First obtain final device information.
     *
     * We do not silently force-disable the device because
     * doing so can cause data loss when files are still open.
     */
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
        error:
          "Windows did not return a removable-device result.",
      };
    }

    /*
     * Use Windows Shell's eject mechanism.
     *
     * PowerShell itself does not provide a universal,
     * reliable "Eject-Volume" cmdlet across Windows versions.
     *
     * Therefore we use Shell.Application through COM.
     */
    const ejectScript = `
      $shell = New-Object -ComObject Shell.Application

      $drive = $shell.Namespace(17).ParseName(
        '${escapePowerShellString(
          normalized,
        )}'
      )

      if (-not $drive) {
        throw "Drive was not available through Windows Shell."
      }

      $drive.InvokeVerb("Eject")

      Start-Sleep -Milliseconds 500

      [PSCustomObject]@{
        DriveLetter = '${escapePowerShellString(
          normalized,
        )}'
        EjectRequested = $true
      } | ConvertTo-Json `
        `-Depth 3 `
        `-Compress
    `;

    const ejectOutput =
      await executePowerShell(
        ejectScript,
      );

    const ejectResult =
      parseJson(ejectOutput);

    return {
      success: true,

      driveLetter:
        normalized,

      diskNumber:
        eligibility.disk.diskNumber,

      busType:
        eligibility.disk.busType,

      friendlyName:
        eligibility.disk.friendlyName,

      ejectRequested:
        ejectResult
          ? Boolean(
              ejectResult.EjectRequested,
            )
          : true,

      message:
        "Safe eject request was sent to Windows.",
    };
  } catch (error) {
    return {
      success: false,

      driveLetter:
        normalized,

      diskNumber:
        eligibility.disk
          ?.diskNumber ??
        null,

      error:
        error.message,

      hint:
        "Close files and applications using the drive, then try ejecting again.",
    };
  }
}

/*
 * ============================================================
 * Eject Preview
 * ============================================================
 *
 * No eject operation is performed.
 * ============================================================
 */

async function getEjectPreview(
  driveLetter,
) {
  const eligibility =
    await getEjectEligibility(
      driveLetter,
    );

  if (!eligibility.success) {
    return eligibility;
  }

  return {
    success: true,

    allowed:
      eligibility.allowed,

    driveLetter:
      eligibility.driveLetter,

    disk:
      eligibility.disk ||
      null,

    reason:
      eligibility.reason,

    warning:
      eligibility.allowed
        ? "Close files and applications using this drive before ejecting it."
        : "This drive should not be ejected through the Explorer.",
  };
}

/*
 * ============================================================
 * Get All Removable Drives
 * ============================================================
 */

async function getRemovableDrives() {
  const script = `
    Get-Disk |
    Where-Object {
      $_.BusType -in @(
        "USB",
        "SD",
        "MMC"
      )
    } |
    Select-Object \`
      \`Number, \`
      \`FriendlyName, \`
      \`SerialNumber, \`
      \`BusType, \`
      \`MediaType, \`
      \`Size, \`
      \`IsBoot, \`
      \`IsSystem, \`
      \`IsOffline, \`
      \`IsReadOnly, \`
      \`HealthStatus, \`
      \`OperationalStatus \`
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

    const disks =
      Array.isArray(parsed)
        ? parsed
        : parsed
          ? [parsed]
          : [];

    return {
      success: true,

      drives:
        disks.map(
          (disk) => ({
            diskNumber:
              Number(
                disk.Number,
              ),

            friendlyName:
              disk.FriendlyName ||
              null,

            serialNumber:
              disk.SerialNumber ||
              null,

            busType:
              disk.BusType ||
              null,

            mediaType:
              disk.MediaType ||
              null,

            size:
              Number(
                disk.Size,
              ) || 0,

            isBoot:
              Boolean(
                disk.IsBoot,
              ),

            isSystem:
              Boolean(
                disk.IsSystem,
              ),

            isOffline:
              Boolean(
                disk.IsOffline,
              ),

            isReadOnly:
              Boolean(
                disk.IsReadOnly,
              ),

            healthStatus:
              disk.HealthStatus ||
              null,

            operationalStatus:
              disk.OperationalStatus ||
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
  getSystemDrive,
  isSystemDrive,
  getPhysicalDiskForDrive,
  isRemovableBusType,
  getEjectEligibility,
  ejectDrive,
  getEjectPreview,
  getRemovableDrives,
};