"use strict";

/*
 * ============================================================
 * Drive Detection Service
 * ============================================================
 *
 * Purpose:
 *
 * - HDD detection
 * - SSD detection
 * - USB drive detection
 * - External HDD / SSD detection
 * - SD card detection
 * - Network drive detection
 * - Logical drive / partition detection
 * - Drive letter detection
 * - Drive label detection
 * - File system detection
 *
 * Windows-focused implementation.
 *
 * IMPORTANT:
 * This file ONLY detects and describes drives.
 *
 * It does NOT:
 * - format drives
 * - change drive labels
 * - mount/unmount drives
 * - eject drives
 * - modify partitions
 *
 * Those operations will be handled by separate services.
 * ============================================================
 */

const { execFile } = require("child_process");

const isWindows = process.platform === "win32";

/*
 * ============================================================
 * Utility
 * ============================================================
 */

function executePowerShell(script) {
  return new Promise((resolve, reject) => {
    if (!isWindows) {
      reject(
        new Error(
          "Drive detection is currently supported on Windows only.",
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

function safeJsonParse(output) {
  const cleanOutput = String(output || "").trim();

  if (!cleanOutput) {
    return [];
  }

  try {
    const parsed = JSON.parse(cleanOutput);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      return [parsed];
    }

    return [];
  } catch {
    return [];
  }
}

function normalizeNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

/*
 * ============================================================
 * Logical Drives
 * ============================================================
 *
 * Examples:
 *
 * C:
 * D:
 * E:
 *
 * Includes:
 * - local disks
 * - removable disks
 * - CD/DVD
 * - network drives
 *
 * Physical disk information is collected separately.
 * ============================================================
 */

async function getLogicalDrives() {
  const script = `
    Get-CimInstance Win32_LogicalDisk |
    Select-Object \`
      \`DeviceID, \`
      \`DriveType, \`
      \`VolumeName, \`
      \`FileSystem, \`
      \`Size, \`
      \`FreeSpace, \`
      \`Description, \`
      \`ProviderName, \`
      \`Compressed, \`
      \`VolumeSerialNumber \`
    | ConvertTo-Json -Depth 3 -Compress
  `;

  try {
    const output =
      await executePowerShell(script);

    const drives =
      safeJsonParse(output);

    return {
      success: true,
      drives: drives.map(
        normalizeLogicalDrive,
      ),
    };
  } catch (error) {
    return {
      success: false,
      drives: [],
      error: error.message,
    };
  }
}

/*
 * ============================================================
 * Normalize Logical Drive
 * ============================================================
 */

function normalizeLogicalDrive(drive) {
  const driveType =
    normalizeNumber(drive.DriveType);

  return {
    driveLetter:
      drive.DeviceID || null,

    type:
      getLogicalDriveTypeName(
        driveType,
      ),

    driveType,

    label:
      drive.VolumeName || "",

    fileSystem:
      drive.FileSystem || null,

    size:
      normalizeNumber(drive.Size),

    freeSpace:
      normalizeNumber(drive.FreeSpace),

    description:
      drive.Description || "",

    provider:
      drive.ProviderName || null,

    compressed:
      Boolean(drive.Compressed),

    volumeSerial:
      drive.VolumeSerialNumber || null,

    isNetwork:
      driveType === 4,

    isRemovable:
      driveType === 2,

    isLocal:
      driveType === 3,

    isCdRom:
      driveType === 5,
  };
}

/*
 * Windows Win32_LogicalDisk DriveType:
 *
 * 0 = Unknown
 * 1 = No Root Directory
 * 2 = Removable Disk
 * 3 = Local Disk
 * 4 = Network Drive
 * 5 = CD-ROM
 * 6 = RAM Disk
 */

function getLogicalDriveTypeName(
  driveType,
) {
  switch (driveType) {
    case 2:
      return "Removable";

    case 3:
      return "Local";

    case 4:
      return "Network";

    case 5:
      return "CD/DVD";

    case 6:
      return "RAM";

    case 1:
      return "No Root Directory";

    default:
      return "Unknown";
  }
}

/*
 * ============================================================
 * Physical Disks
 * ============================================================
 *
 * Uses Win32_DiskDrive.
 *
 * Can identify:
 * - HDD
 * - SSD
 * - USB storage
 * - External storage
 * - SD/card-reader related storage
 * ============================================================
 */

async function getPhysicalDrives() {
  const script = `
    Get-CimInstance Win32_DiskDrive |
    Select-Object \`
      \`Index, \`
      \`DeviceID, \`
      \`Model, \`
      \`Manufacturer, \`
      \`SerialNumber, \`
      \`InterfaceType, \`
      \`MediaType, \`
      \`Size, \`
      \`Status, \`
      \`PNPDeviceID, \`
      \`FirmwareRevision \`
    | ConvertTo-Json -Depth 3 -Compress
  `;

  try {
    const output =
      await executePowerShell(script);

    const drives =
      safeJsonParse(output);

    return {
      success: true,
      drives: drives.map(
        normalizePhysicalDrive,
      ),
    };
  } catch (error) {
    return {
      success: false,
      drives: [],
      error: error.message,
    };
  }
}

/*
 * ============================================================
 * Normalize Physical Drive
 * ============================================================
 */

function normalizePhysicalDrive(
  drive,
) {
  const interfaceType =
    String(
      drive.InterfaceType || "",
    ).trim();

  const mediaType =
    String(
      drive.MediaType || "",
    ).trim();

  const model =
    String(
      drive.Model || "",
    ).trim();

  const pnpDeviceId =
    String(
      drive.PNPDeviceID || "",
    ).trim();

  const classification =
    classifyPhysicalDrive({
      interfaceType,
      mediaType,
      model,
      pnpDeviceId,
    });

  return {
    index:
      normalizeNumber(drive.Index),

    deviceId:
      drive.DeviceID || null,

    model:
      model || "Unknown",

    manufacturer:
      drive.Manufacturer || null,

    serialNumber:
      drive.SerialNumber
        ? String(drive.SerialNumber).trim()
        : null,

    interfaceType:
      interfaceType || null,

    mediaType:
      mediaType || null,

    size:
      normalizeNumber(drive.Size),

    status:
      drive.Status || null,

    pnpDeviceId:
      pnpDeviceId || null,

    firmwareRevision:
      drive.FirmwareRevision || null,

    classification,
  };
}

/*
 * ============================================================
 * Physical Drive Classification
 * ============================================================
 */

function classifyPhysicalDrive({
  interfaceType,
  mediaType,
  model,
  pnpDeviceId,
}) {
  const combined = [
    interfaceType,
    mediaType,
    model,
    pnpDeviceId,
  ]
    .join(" ")
    .toLowerCase();

  /*
   * USB detection.
   */
  const isUSB =
    interfaceType.toLowerCase() === "usb" ||
    combined.includes("usb");

  /*
   * SD / memory card detection.
   *
   * Windows hardware reporting varies by card reader,
   * therefore this is classification rather than a guarantee.
   */
  const isSD =
    combined.includes("sd card") ||
    combined.includes("sdhc") ||
    combined.includes("sdxc") ||
    combined.includes("memory card") ||
    combined.includes("card reader");

  /*
   * SSD detection.
   *
   * MediaType can vary between Windows versions/drivers,
   * so model/media information is considered.
   */
  const isSSD =
    combined.includes("ssd") ||
    combined.includes("solid state");

  /*
   * HDD detection.
   */
  const isHDD =
    combined.includes("hard disk") ||
    combined.includes("hdd") ||
    combined.includes("fixed hard disk");

  /*
   * External classification.
   */
  const isExternal =
    isUSB ||
    combined.includes("external");

  let type = "Unknown";

  if (isSD) {
    type = "SD Card";
  } else if (isSSD) {
    type = "SSD";
  } else if (isHDD) {
    type = "HDD";
  } else if (isUSB) {
    type = "USB Storage";
  }

  return {
    type,

    isSSD,

    isHDD,

    isUSB,

    isSD,

    isExternal,

    removable:
      isUSB || isSD,
  };
}

/*
 * ============================================================
 * Network Drives
 * ============================================================
 */

async function getNetworkDrives() {
  const script = `
    Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 4" |
    Select-Object \`
      \`DeviceID, \`
      \`VolumeName, \`
      \`FileSystem, \`
      \`Size, \`
      \`FreeSpace, \`
      \`ProviderName, \`
      \`Description \`
    | ConvertTo-Json -Depth 3 -Compress
  `;

  try {
    const output =
      await executePowerShell(script);

    const drives =
      safeJsonParse(output);

    return {
      success: true,
      drives: drives.map(
        (drive) => ({
          driveLetter:
            drive.DeviceID || null,

          label:
            drive.VolumeName || "",

          fileSystem:
            drive.FileSystem || null,

          size:
            normalizeNumber(
              drive.Size,
            ),

          freeSpace:
            normalizeNumber(
              drive.FreeSpace,
            ),

          provider:
            drive.ProviderName || null,

          description:
            drive.Description || "",

          isNetwork: true,
        }),
      ),
    };
  } catch (error) {
    return {
      success: false,
      drives: [],
      error: error.message,
    };
  }
}

/*
 * ============================================================
 * Removable Drives
 * ============================================================
 */

async function getRemovableDrives() {
  const result =
    await getLogicalDrives();

  if (!result.success) {
    return result;
  }

  return {
    success: true,

    drives:
      result.drives.filter(
        (drive) =>
          drive.isRemovable,
      ),
  };
}

/*
 * ============================================================
 * Local Drives
 * ============================================================
 */

async function getLocalDrives() {
  const result =
    await getLogicalDrives();

  if (!result.success) {
    return result;
  }

  return {
    success: true,

    drives:
      result.drives.filter(
        (drive) =>
          drive.isLocal,
      ),
  };
}

/*
 * ============================================================
 * CD / DVD Drives
 * ============================================================
 */

async function getOpticalDrives() {
  const result =
    await getLogicalDrives();

  if (!result.success) {
    return result;
  }

  return {
    success: true,

    drives:
      result.drives.filter(
        (drive) =>
          drive.isCdRom,
      ),
  };
}

/*
 * ============================================================
 * Full Drive Inventory
 * ============================================================
 *
 * Combines:
 * - logical drives
 * - physical drives
 * - network drives
 * ============================================================
 */

async function getDriveInventory() {
  try {
    const [
      logicalResult,
      physicalResult,
      networkResult,
    ] = await Promise.all([
      getLogicalDrives(),
      getPhysicalDrives(),
      getNetworkDrives(),
    ]);

    return {
      success:
        logicalResult.success &&
        physicalResult.success &&
        networkResult.success,

      logicalDrives:
        logicalResult.drives,

      physicalDrives:
        physicalResult.drives,

      networkDrives:
        networkResult.drives,

      errors: {
        logical:
          logicalResult.success
            ? null
            : logicalResult.error,

        physical:
          physicalResult.success
            ? null
            : physicalResult.error,

        network:
          networkResult.success
            ? null
            : networkResult.error,
      },
    };
  } catch (error) {
    return {
      success: false,
      logicalDrives: [],
      physicalDrives: [],
      networkDrives: [],
      errors: {
        general: error.message,
      },
    };
  }
}

/*
 * ============================================================
 * Get Drive By Letter
 * ============================================================
 */

async function getDriveByLetter(
  driveLetter,
) {
  if (
    typeof driveLetter !==
      "string" ||
    !driveLetter.trim()
  ) {
    return {
      success: false,
      drive: null,
      error: "Drive letter is required.",
    };
  }

  const normalized =
    driveLetter
      .trim()
      .replace(/[\\/]+$/, "");

  const result =
    await getLogicalDrives();

  if (!result.success) {
    return result;
  }

  const drive =
    result.drives.find(
      (item) =>
        String(item.driveLetter)
          .toLowerCase() ===
        normalized.toLowerCase(),
    );

  if (!drive) {
    return {
      success: false,
      drive: null,
      error:
        `Drive "${normalized}" was not found.`,
    };
  }

  return {
    success: true,
    drive,
  };
}

/*
 * ============================================================
 * Detect Drive Category
 * ============================================================
 */

function getDriveCategory(drive) {
  if (!drive) {
    return "Unknown";
  }

  if (drive.isNetwork) {
    return "Network";
  }

  if (drive.isCdRom) {
    return "Optical";
  }

  if (drive.isRemovable) {
    return "Removable";
  }

  if (drive.isLocal) {
    return "Local";
  }

  return "Unknown";
}

/*
 * ============================================================
 * Public API
 * ============================================================
 */

module.exports = {
  getLogicalDrives,
  getPhysicalDrives,
  getNetworkDrives,
  getRemovableDrives,
  getLocalDrives,
  getOpticalDrives,
  getDriveInventory,
  getDriveByLetter,
  getDriveCategory,
  normalizeLogicalDrive,
  normalizePhysicalDrive,
  classifyPhysicalDrive,
};