"use strict";

const { QueryDateParser } = require("../query/queryDateParser.cjs");

class FilterDate {
  /**
   * Parses date expression and maps to createdAt or modifiedAt
   */
  static parse(dateStr, defaultField = "modified_at", referenceDate = new Date()) {
    if (!dateStr || typeof dateStr !== "string") return null;

    const trimmed = dateStr.trim();

    // 1. Check for explicit range: 2025-01-01..2025-03-31
    const rangeMatch = trimmed.match(/^(\d{4}-\d{1,2}-\d{1,2})\.\.(\d{4}-\d{1,2}-\d{1,2})$/);
    if (rangeMatch) {
      const startIso = new Date(rangeMatch[1]).toISOString();
      const endIso = new Date(rangeMatch[2]).toISOString();
      return {
        field: defaultField,
        operator: "between",
        start: startIso,
        end: endIso,
        hard: true,
      };
    }

    // 2. Delegate to Part 16 QueryDateParser for single date / relative keywords
    const parsed = QueryDateParser.parse(trimmed, referenceDate);
    if (!parsed) return null;

    return {
      field: defaultField,
      operator: parsed.operator || "between",
      start: parsed.start,
      end: parsed.end,
      relative: parsed.relative,
      hard: true,
    };
  }

  /**
   * Evaluates if a file's timestamp matches the date constraint
   */
  static matches(fileTimestamp, filter) {
    if (!fileTimestamp || !filter || !filter.start) return false;

    const fileTime = new Date(fileTimestamp).getTime();
    if (isNaN(fileTime)) return false;

    const startTime = new Date(filter.start).getTime();
    const endTime = filter.end ? new Date(filter.end).getTime() : Date.now();

    if (filter.operator === "between") {
      return fileTime >= startTime && fileTime <= endTime;
    }
    if (filter.operator === ">=") {
      return fileTime >= startTime;
    }
    if (filter.operator === "<=") {
      return fileTime <= startTime;
    }

    return fileTime >= startTime && fileTime <= endTime;
  }
}

module.exports = {
  FilterDate,
};
