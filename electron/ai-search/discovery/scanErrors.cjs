"use strict";

const ScanErrorCode = Object.freeze({
  ACCESS_DENIED: "ACCESS_DENIED",
  PATH_NOT_FOUND: "PATH_NOT_FOUND",
  DRIVE_UNAVAILABLE: "DRIVE_UNAVAILABLE",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  IO_ERROR: "IO_ERROR",
  DIRECTORY_READ_ERROR: "DIRECTORY_READ_ERROR",
  HASH_ERROR: "HASH_ERROR",
  METADATA_ERROR: "METADATA_ERROR",
  SYMLINK_LOOP_DETECTED: "SYMLINK_LOOP_DETECTED",
  SCAN_CANCELLED: "SCAN_CANCELLED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
});

function classifyNodeError(err, targetPath) {
  const code = err?.code || "";
  const message = err?.message || String(err);

  let scanCode = ScanErrorCode.UNKNOWN_ERROR;

  if (code === "EACCES" || code === "EPERM") {
    scanCode = ScanErrorCode.ACCESS_DENIED;
  } else if (code === "ENOENT") {
    scanCode = ScanErrorCode.FILE_NOT_FOUND;
  } else if (code === "ENOTDIR" || code === "ENOTEMPTY") {
    scanCode = ScanErrorCode.DIRECTORY_READ_ERROR;
  } else if (code === "EBUSY" || code === "ETXTBSY") {
    scanCode = ScanErrorCode.IO_ERROR;
  } else if (code === "ELOOP") {
    scanCode = ScanErrorCode.SYMLINK_LOOP_DETECTED;
  }

  return {
    code: scanCode,
    path: targetPath,
    message,
    originalCode: code,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  ScanErrorCode,
  classifyNodeError,
};
