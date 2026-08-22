export function getTransferStatus(item) {
  const status = String(
    item?.status ||
      item?.state ||
      "unknown",
  ).toLowerCase();

  if (
    status.includes("complete") ||
    status === "done" ||
    status === "finished"
  ) {
    return "completed";
  }

  if (
    status.includes("fail") ||
    status === "error"
  ) {
    return "failed";
  }

  if (
    status.includes("cancel")
  ) {
    return "cancelled";
  }

  if (
    status.includes("pause")
  ) {
    return "paused";
  }

  if (
    status.includes("conflict")
  ) {
    return "conflict";
  }

  if (
    status.includes("running") ||
    status.includes("progress") ||
    status === "active"
  ) {
    return "running";
  }

  if (
    status.includes("pending") ||
    status.includes("queued") ||
    status === "waiting"
  ) {
    return "pending";
  }

  return "unknown";
}

export function getTransferDisplayName(
  item,
) {
  return (
    item?.name ||
    item?.fileName ||
    item?.sourceName ||
    item?.source?.split(/[\\/]/).pop() ||
    "Unknown item"
  );
}

export function getTransferProgress(
  item,
) {
  const value = Number(
    item?.progress ??
      item?.percentage ??
      item?.percent ??
      0,
  );

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, value),
  );
}

export function getTransferSpeed(
  item,
) {
  const speed =
    item?.speedFormatted ||
    item?.formattedSpeed ||
    item?.speed;

  if (
    speed === undefined ||
    speed === null ||
    speed === ""
  ) {
    return "—";
  }

  return String(speed);
}

export function getTransferEta(
  item,
) {
  const eta =
    item?.etaFormatted ||
    item?.formattedEta ||
    item?.eta;

  if (
    eta === undefined ||
    eta === null ||
    eta === ""
  ) {
    return "—";
  }

  return String(eta);
}

export function getTransferQueueSummary(
  transferQueue,
) {
  const queue =
    Array.isArray(transferQueue)
      ? transferQueue
      : [];

  return queue.reduce(
    (summary, item) => {
      const status =
        getTransferStatus(item);

      if (
        Object.prototype.hasOwnProperty.call(
          summary,
          status,
        )
      ) {
        summary[status] += 1;
      }

      return summary;
    },
    {
      pending: 0,
      running: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      conflict: 0,
      unknown: 0,
    },
  );
}