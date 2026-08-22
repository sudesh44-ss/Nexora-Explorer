"use strict";

const { FilterTypes } = require("./filterTypes.cjs");
const { FilterSize } = require("./filterSize.cjs");
const { FilterDate } = require("./filterDate.cjs");
const { FilterPath } = require("./filterPath.cjs");
const { FilterOperators } = require("./filterOperators.cjs");

class FilterParser {
  /**
   * Resolves structured filters from a structured query object or operator token string
   */
  static parseFromStructuredQuery(structuredQuery = {}, referenceDate = new Date()) {
    const filters = [];

    // 1. File Types
    if (Array.isArray(structuredQuery.fileTypes)) {
      for (const t of structuredQuery.fileTypes) {
        if (FilterTypes.isValidType(t)) {
          filters.push({
            field: "type",
            operator: "==",
            value: t.toLowerCase(),
            valueType: "string",
            hard: true,
          });
        }
      }
    }

    // 2. Size Filter
    if (structuredQuery.sizeFilter && typeof structuredQuery.sizeFilter === "object") {
      const sf = structuredQuery.sizeFilter;
      filters.push({
        field: "size",
        operator: sf.operator || ">",
        value: sf.value,
        unit: sf.unit,
        bytes: sf.bytes,
        valueType: "number",
        hard: true,
      });
    }

    // 3. Date Filter
    if (structuredQuery.dateFilter && typeof structuredQuery.dateFilter === "object") {
      const df = structuredQuery.dateFilter;
      filters.push({
        field: df.field || "modified_at",
        operator: df.operator || "between",
        start: df.start,
        end: df.end,
        relative: df.relative,
        valueType: "date",
        hard: true,
      });
    }

    // 4. Folder Hints
    if (Array.isArray(structuredQuery.folderHints)) {
      for (const f of structuredQuery.folderHints) {
        const sanitized = FilterPath.sanitize(f);
        if (sanitized) {
          filters.push({
            field: "folder",
            operator: "contains",
            value: sanitized,
            valueType: "string",
            hard: true,
          });
        }
      }
    }

    return filters;
  }

  /**
   * Parses explicit inline operators from raw query string:
   * e.g. "type:image size:>10MB folder:\"College Notes\" modified:2025"
   */
  static parseRawOperators(queryString, referenceDate = new Date()) {
    if (!queryString || typeof queryString !== "string") return [];

    const filters = [];
    // Regex for operator:value or operator:"quoted value"
    const opRegex = /\b([a-zA-Z_]+):("([^"]+)"|([^\s]+))/g;
    let match;

    while ((match = opRegex.exec(queryString)) !== null) {
      const op = match[1].toLowerCase();
      const val = match[3] !== undefined ? match[3] : match[4];

      if (!FilterOperators.isValidOperator(op)) continue;

      if (op === "type") {
        if (FilterTypes.isValidType(val)) {
          filters.push({ field: "type", operator: "==", value: val.toLowerCase(), hard: true });
        }
      } else if (op === "ext") {
        const normExt = FilterTypes.normalizeExtension(val);
        if (normExt) {
          filters.push({ field: "extension", operator: "==", value: normExt, hard: true });
        }
      } else if (op === "name") {
        filters.push({ field: "name", operator: "contains", value: val, hard: true });
      } else if (op === "folder") {
        const clean = FilterPath.sanitize(val);
        if (clean) filters.push({ field: "folder", operator: "contains", value: clean, hard: true });
      } else if (op === "path") {
        const clean = FilterPath.sanitize(val);
        if (clean) filters.push({ field: "path", operator: "startsWith", value: clean, hard: true });
      } else if (op === "size") {
        const parsedSize = FilterSize.parse(val);
        if (parsedSize) filters.push(parsedSize);
      } else if (op === "date") {
        const parsedDate = FilterDate.parse(val, "modified_at", referenceDate);
        if (parsedDate) filters.push(parsedDate);
      } else if (op === "created") {
        const parsedDate = FilterDate.parse(val, "created_at", referenceDate);
        if (parsedDate) filters.push(parsedDate);
      } else if (op === "modified") {
        const parsedDate = FilterDate.parse(val, "modified_at", referenceDate);
        if (parsedDate) filters.push(parsedDate);
      }
    }

    return filters;
  }
}

module.exports = {
  FilterParser,
};
