"use strict";

const SIZE_UNITS = Object.freeze({
  b: 1,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
  tb: 1024 * 1024 * 1024 * 1024,
});

class FilterSize {
  /**
   * Parses size filter string into structured constraint
   */
  static parse(sizeStr) {
    if (!sizeStr || typeof sizeStr !== "string") return null;

    const trimmed = sizeStr.trim();
    // Match optional operator, numeric value, and optional unit
    const match = trimmed.match(/^([><]=?|=)?\s*(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
    if (!match) return null;

    const op = match[1] || "=";
    const num = parseFloat(match[2]);
    const unitStr = (match[3] || "MB").toLowerCase();

    if (isNaN(num) || num < 0) {
      return null; // Reject NaN and negative sizes
    }

    const multiplier = SIZE_UNITS[unitStr];
    if (!multiplier) {
      return null; // Unknown unit e.g. banana
    }

    const bytes = Math.round(num * multiplier);

    let normalizedOp = op;
    if (op === "=") normalizedOp = "==";

    return {
      field: "size",
      operator: normalizedOp,
      value: num,
      unit: unitStr.toUpperCase(),
      bytes,
      hard: true,
    };
  }

  /**
   * Evaluates if a file's size matches the constraint
   */
  static matches(fileSize, filter) {
    if (fileSize === undefined || fileSize === null || typeof fileSize !== "number") {
      return false;
    }
    if (!filter || typeof filter.bytes !== "number") return true;

    switch (filter.operator) {
      case ">":
        return fileSize > filter.bytes;
      case ">=":
        return fileSize >= filter.bytes;
      case "<":
        return fileSize < filter.bytes;
      case "<=":
        return fileSize <= filter.bytes;
      case "==":
      case "=":
        return fileSize === filter.bytes;
      default:
        return true;
    }
  }
}

module.exports = {
  SIZE_UNITS,
  FilterSize,
};
