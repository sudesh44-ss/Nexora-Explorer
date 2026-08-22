export function formatSize(bytes) {
  if (bytes === 0) {
    return "0 Bytes";
  }

  if (
    bytes === null ||
    bytes === undefined ||
    Number.isNaN(Number(bytes))
  ) {
    return "Unknown";
  }

  if (bytes < 0) {
    return "Unknown";
  }

  const units = [
    "Bytes",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(bytes) /
        Math.log(1024),
    ),
    units.length - 1,
  );

  return (
    (bytes /
      Math.pow(1024, index)
    ).toFixed(2) +
    " " +
    units[index]
  );
}

export function formatDate(date) {
  if (!date) {
    return "Unknown";
  }

  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime(),
    )
  ) {
    return "Unknown";
  }

  return parsedDate.toLocaleString();
}

export function formatTransferSpeed(
  bytesPerSecond,
) {
  if (
    !bytesPerSecond ||
    bytesPerSecond <= 0
  ) {
    return "0 B/s";
  }

  return `${formatSize(
    bytesPerSecond,
  )}/s`;
}

export function formatResultPath(
  filePath,
) {
  return filePath || "";
}