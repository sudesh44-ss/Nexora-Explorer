"use strict";

const { FilterTypes } = require("./filterTypes.cjs");
const { FilterSize } = require("./filterSize.cjs");
const { FilterDate } = require("./filterDate.cjs");
const { FilterPath } = require("./filterPath.cjs");
const { FilterValidator } = require("./filterValidator.cjs");

class FilterEngine {
  /**
   * Evaluates if a fileRecord satisfies all hard filter constraints
   *
   * @param {Object} fileRecord
   * @param {Array<Object>} filters
   * @returns {boolean}
   */
  static matches(fileRecord, filters = []) {
    if (!fileRecord || !Array.isArray(filters) || filters.length === 0) {
      return true;
    }

    for (const f of filters) {
      if (!f || !f.field) continue;

      if (f.field === "type") {
        if (!FilterTypes.matchesType(fileRecord, f.value)) return false;
      } else if (f.field === "extension") {
        const norm = FilterTypes.normalizeExtension(fileRecord.extension || fileRecord.name);
        if (norm !== f.value.toLowerCase()) return false;
      } else if (f.field === "size") {
        if (!FilterSize.matches(fileRecord.size, f)) return false;
      } else if (f.field === "folder") {
        if (!FilterPath.matches(fileRecord.path, f.value)) return false;
      } else if (f.field === "path") {
        if (!FilterPath.matches(fileRecord.path, f.value)) return false;
      } else if (f.field === "name") {
        if (!fileRecord.name || !fileRecord.name.toLowerCase().includes(f.value.toLowerCase())) return false;
      } else if (f.field === "created_at" || f.field === "createdAt") {
        if (!FilterDate.matches(fileRecord.created_at, f)) return false;
      } else if (f.field === "modified_at" || f.field === "modifiedAt") {
        if (!FilterDate.matches(fileRecord.modified_at, f)) return false;
      }
    }

    return true;
  }

  /**
   * Compiles filter constraints into parameterized SQL WHERE clauses
   *
   * @param {Array<Object>} filters
   * @returns {{whereClause: string, params: Array<any>}}
   */
  static compileSqlConstraints(filters = []) {
    const clauses = [];
    const params = [];

    for (const f of filters) {
      if (!f || !f.field) continue;

      if (f.field === "extension") {
        clauses.push("extension = ?");
        params.push(f.value);
      } else if (f.field === "size" && typeof f.bytes === "number") {
        if (f.operator === ">") {
          clauses.push("size > ?");
          params.push(f.bytes);
        } else if (f.operator === ">=") {
          clauses.push("size >= ?");
          params.push(f.bytes);
        } else if (f.operator === "<") {
          clauses.push("size < ?");
          params.push(f.bytes);
        } else if (f.operator === "<=") {
          clauses.push("size <= ?");
          params.push(f.bytes);
        }
      } else if (f.field === "created_at" || f.field === "modified_at") {
        const col = f.field === "created_at" ? "created_at" : "modified_at";
        if (f.start && f.end) {
          clauses.push(`${col} >= ? AND ${col} <= ?`);
          params.push(f.start, f.end);
        } else if (f.start) {
          clauses.push(`${col} >= ?`);
          params.push(f.start);
        }
      } else if (f.field === "folder" && typeof f.value === "string") {
        // Safe escaping of LIKE special characters (% and _)
        const escaped = f.value.replace(/[%_]/g, "\\$&");
        clauses.push("path LIKE ? ESCAPE '\\'");
        params.push(`%/${escaped}/%`);
      }
    }

    return {
      whereClause: clauses.length > 0 ? clauses.join(" AND ") : "1=1",
      params,
    };
  }

  /**
   * Generates structured explanation summary of active filters
   */
  static getExplanation(filters = []) {
    const active = [];

    for (const f of filters) {
      if (!f) continue;
      if (f.field === "type") active.push({ label: "Type", value: f.value });
      else if (f.field === "extension") active.push({ label: "Extension", value: f.value });
      else if (f.field === "size") active.push({ label: "Size", value: `${f.operator} ${f.value} ${f.unit || "MB"}` });
      else if (f.field === "folder") active.push({ label: "Folder", value: f.value });
      else if (f.field === "modified_at") active.push({ label: "Modified", value: f.relative || "Date range" });
      else if (f.field === "created_at") active.push({ label: "Created", value: f.relative || "Date range" });
    }

    return { activeFilters: active };
  }
}

module.exports = {
  FilterEngine,
};
