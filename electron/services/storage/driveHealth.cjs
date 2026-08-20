"use strict";

/*
 * ============================================================
 * Drive Health Service
 * ============================================================
 *
 * Purpose:
 * - HDD / SSD health information
 * - SMART status
 * - Drive operational status
 * - Temperature where Windows exposes it
 * - Predictive failure status
 * - Firmware information
 * - Serial number
 * - Model information
 *
 * IMPORTANT:
 * - Read-only service.
 * - Drive ko modify nahi karti.
 * - Format / mount / unmount / eject yahan nahi hoga.
 *
 * Windows hardware/driver ke according kuch SMART fields
 * available na bhi ho sakte hain.
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
          "Drive health information is currently supported on Windows only.",
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

/*
 * ============================================================
 * Get Storage Reliability Counters
 * ============================================================
 *
 * Windows exposes reliability information through:
 *
 * MSFT_StorageReliabilityCounter
 *
 * Availability depends on Windows version,
 * storage controller and driver support.
 * ============================================================
 */

async function getReliabilityCounters() {
  const script = `
    try {
      Get-CimInstance -Namespace root/Microsoft/Windows/Storage -ClassName MSFT_StorageReliabilityCounter |
      Select-Object DeviceId, Temperature, TemperatureMax, Wear, ReadErrorsTotal, WriteErrorsTotal, ReadLatencyMax, WriteLatencyMax, PowerOnHours, StartStopCycleCount, LoadUnloadCycleCount |
      ConvertTo-Json -Depth 3 -Compress
    }
    catch {
      @()
    }
  `;

  try {
    const output =
      await executePowerShell(
        script,
      );

    return {
      success: true,
      counters:
        parseJson(output),
    };
  } catch (error) {
    return {
      success: false,
      counters: [],
      error:
        error.message,
    };
  }
}

/*
 * ============================================================
 * Get Physical Disk Health
 * ============================================================
 */

async function getPhysicalDiskHealth() {
  const script = `Get-CimInstance -Namespace root/Microsoft/Windows/Storage -ClassName MSFT_PhysicalDisk | Select-Object DeviceId, FriendlyName, SerialNumber, MediaType, BusType, HealthStatus, OperationalStatus, Size, FirmwareVersion | ConvertTo-Json -Depth 3 -Compress`;

  try {
    const output =
      await executePowerShell(
        script,
      );

    const disks =
      parseJson(output);

    return {
      success: true,
      disks:
        disks.map(
          normalizePhysicalDisk,
        ),
    };
  } catch (error) {
    return {
      success: false,
      disks: [],
      error:
        error.message,
    };
  }
}

/*
 * ============================================================
 * Normalize Physical Disk
 * ============================================================
 */

function normalizePhysicalDisk(
  disk,
) {
  return {
    deviceId:
      disk.DeviceId !== undefined
        ? toNumber(disk.DeviceId)
        : null,

    name:
      disk.FriendlyName ||
      "Unknown",

    serialNumber:
      disk.SerialNumber
        ? String(
            disk.SerialNumber,
          ).trim()
        : null,

    mediaType:
      disk.MediaType ||
      null,

    busType:
      disk.BusType ||
      null,

    healthStatus:
      disk.HealthStatus ||
      "Unknown",

    operationalStatus:
      Array.isArray(
        disk.OperationalStatus,
      )
        ? disk.OperationalStatus
        : disk.OperationalStatus
          ? [disk.OperationalStatus]
          : [],

    size:
      toNumber(disk.Size),

    firmwareVersion:
      disk.FirmwareVersion ||
      null,
  };
}

/*
 * ============================================================
 * Health Status Normalization
 * ============================================================
 */

function normalizeHealthStatus(
  status,
) {
  if (
    status === null ||
    status === undefined
  ) {
    return "Unknown";
  }

  const value =
    String(status)
      .trim()
      .toLowerCase();

  if (
    value.includes("healthy") ||
    value === "0"
  ) {
    return "Healthy";
  }

  if (
    value.includes("warning") ||
    value.includes("degraded")
  ) {
    return "Warning";
  }

  if (
    value.includes("unhealthy") ||
    value.includes("failed") ||
    value.includes("error")
  ) {
    return "Critical";
  }

  return String(status);
}

/*
 * ============================================================
 * Convert Temperature
 * ============================================================
 *
 * Windows storage reliability counters can expose
 * temperature in Celsius.
 * ============================================================
 */

function normalizeTemperature(
  temperature,
) {
  const value =
    toNumber(temperature);

  if (
    value === null ||
    value < -50 ||
    value > 150
  ) {
    return null;
  }

  return value;
}

/*
 * ============================================================
 * Get Health Level
 * ============================================================
 */

function getHealthLevel(
  healthStatus,
) {
  const normalized =
    normalizeHealthStatus(
      healthStatus,
    );

  switch (normalized) {
    case "Healthy":
      return "healthy";

    case "Warning":
      return "warning";

    case "Critical":
      return "critical";

    default:
      return "unknown";
  }
}

/*
 * ============================================================
 * Get Overall Health
 * ============================================================
 */

function getOverallHealth(
  disk,
  reliability,
) {
  const diskHealth =
    normalizeHealthStatus(
      disk?.healthStatus,
    );

  if (
    diskHealth ===
    "Critical"
  ) {
    return {
      status: "critical",
      level: "critical",
      message:
        "Windows reports a critical drive health state.",
    };
  }

  if (
    diskHealth ===
    "Warning"
  ) {
    return {
      status: "warning",
      level: "warning",
      message:
        "Windows reports a warning state for this drive.",
    };
  }

  const readErrors =
    toNumber(
      reliability?.readErrorsTotal,
    );

  const writeErrors =
    toNumber(
      reliability?.writeErrorsTotal,
    );

  if (
    (readErrors !== null &&
      readErrors > 0) ||
    (writeErrors !== null &&
      writeErrors > 0)
  ) {
    return {
      status: "warning",
      level: "warning",
      message:
        "The drive reports read or write errors.",
    };
  }

  if (
    diskHealth ===
    "Healthy"
  ) {
    return {
      status: "healthy",
      level: "healthy",
      message:
        "Windows reports the drive as healthy.",
    };
  }

  return {
    status: "unknown",
    level: "unknown",
    message:
      "Complete health information is not available.",
  };
}

/*
 * ============================================================
 * Get Health For One Physical Drive
 * ============================================================
 */

async function getDriveHealth(
  deviceId,
) {
  const physicalResult =
    await getPhysicalDiskHealth();

  if (
    !physicalResult.success
  ) {
    return physicalResult;
  }

  const reliabilityResult =
    await getReliabilityCounters();

  const normalizedId =
    toNumber(deviceId);

  let disk =
    physicalResult.disks.find(
      (item) =>
        item.deviceId ===
        normalizedId,
    );

  /*
   * If no ID was supplied, use first disk.
   */
  if (
    normalizedId === null &&
    physicalResult.disks.length
  ) {
    disk =
      physicalResult.disks[0];
  }

  if (!disk) {
    return {
      success: false,
      deviceId:
        normalizedId,
      error:
        "Physical drive was not found.",
    };
  }

  let reliability =
    null;

  if (
    reliabilityResult.success
  ) {
    reliability =
      reliabilityResult.counters.find(
        (item) =>
          toNumber(
            item.DeviceId,
          ) ===
          disk.deviceId,
      );
  }

  const normalizedReliability =
    reliability
      ? {
          temperature:
            normalizeTemperature(
              reliability.Temperature,
            ),

          maximumTemperature:
            normalizeTemperature(
              reliability.TemperatureMax,
            ),

          wear:
            toNumber(
              reliability.Wear,
            ),

          readErrorsTotal:
            toNumber(
              reliability.ReadErrorsTotal,
            ),

          writeErrorsTotal:
            toNumber(
              reliability.WriteErrorsTotal,
            ),

          readLatencyMax:
            toNumber(
              reliability.ReadLatencyMax,
            ),

          writeLatencyMax:
            toNumber(
              reliability.WriteLatencyMax,
            ),

          powerOnHours:
            toNumber(
              reliability.PowerOnHours,
            ),

          startStopCycleCount:
            toNumber(
              reliability.StartStopCycleCount,
            ),

          loadUnloadCycleCount:
            toNumber(
              reliability.LoadUnloadCycleCount,
            ),
        }
      : null;

  const overall =
    getOverallHealth(
      disk,
      normalizedReliability,
    );

  return {
    success: true,

    deviceId:
      disk.deviceId,

    name:
      disk.name,

    serialNumber:
      disk.serialNumber,

    mediaType:
      disk.mediaType,

    busType:
      disk.busType,

    size:
      disk.size,

    firmwareVersion:
      disk.firmwareVersion,

    healthStatus:
      normalizeHealthStatus(
        disk.healthStatus,
      ),

    healthLevel:
      getHealthLevel(
        disk.healthStatus,
      ),

    operationalStatus:
      disk.operationalStatus,

    reliability:
      normalizedReliability,

    overallHealth:
      overall,
  };
}

/*
 * ============================================================
 * Get Health For All Drives
 * ============================================================
 */

async function getAllDriveHealth() {
  const physicalResult =
    await getPhysicalDiskHealth();

  if (
    !physicalResult.success
  ) {
    return physicalResult;
  }

  const reliabilityResult =
    await getReliabilityCounters();

  const results = [];

  for (
    const disk
    of physicalResult.disks
  ) {
    let reliability =
      null;

    if (
      reliabilityResult.success
    ) {
      const raw =
        reliabilityResult.counters.find(
          (item) =>
            toNumber(
              item.DeviceId,
            ) ===
            disk.deviceId,
        );

      if (raw) {
        reliability = {
          temperature:
            normalizeTemperature(
              raw.Temperature,
            ),

          maximumTemperature:
            normalizeTemperature(
              raw.TemperatureMax,
            ),

          wear:
            toNumber(
              raw.Wear,
            ),

          readErrorsTotal:
            toNumber(
              raw.ReadErrorsTotal,
            ),

          writeErrorsTotal:
            toNumber(
              raw.WriteErrorsTotal,
            ),

          powerOnHours:
            toNumber(
              raw.PowerOnHours,
            ),
        };
      }
    }

    results.push({
      ...disk,

      healthStatus:
        normalizeHealthStatus(
          disk.healthStatus,
        ),

      healthLevel:
        getHealthLevel(
          disk.healthStatus,
        ),

      reliability,

      overallHealth:
        getOverallHealth(
          disk,
          reliability,
        ),
    });
  }

  return {
    success: true,
    drives: results,

    reliabilityAvailable:
      reliabilityResult.success,
  };
}

/*
 * ============================================================
 * Get Health Summary
 * ============================================================
 */

async function getDriveHealthSummary(
  deviceId,
) {
  const result =
    await getDriveHealth(
      deviceId,
    );

  if (!result.success) {
    return result;
  }

  return {
    success: true,

    deviceId:
      result.deviceId,

    name:
      result.name,

    mediaType:
      result.mediaType,

    health:
      result.overallHealth.status,

    healthLevel:
      result.overallHealth.level,

    message:
      result.overallHealth.message,

    temperature:
      result.reliability
        ?.temperature ?? null,

    wear:
      result.reliability
        ?.wear ?? null,

    powerOnHours:
      result.reliability
        ?.powerOnHours ?? null,

    readErrors:
      result.reliability
        ?.readErrorsTotal ?? null,

    writeErrors:
      result.reliability
        ?.writeErrorsTotal ?? null,
  };
}

/*
 * ============================================================
 * Public API
 * ============================================================
 */

module.exports = {
  executePowerShell,
  getReliabilityCounters,
  getPhysicalDiskHealth,
  normalizePhysicalDisk,
  normalizeHealthStatus,
  normalizeTemperature,
  getHealthLevel,
  getOverallHealth,
  getDriveHealth,
  getAllDriveHealth,
  getDriveHealthSummary,
};