"use strict";

const { FilterErrorCode, FilterError } = require("./filterErrors.cjs");

class FilterValidator {
  /**
   * Validates filter constraints and checks for contradictory conditions
   *
   * @param {Array<Object>} filters
   * @param {number} [maxDepth=5]
   * @returns {{isValid: boolean, isContradictory: boolean, error: string|null}}
   */
  static validate(filters = [], maxDepth = 5) {
    if (!Array.isArray(filters)) {
      return { isValid: true, isContradictory: false, error: null };
    }

    if (filters.length > 50) {
      return { isValid: false, isContradictory: false, error: "Too many filter constraints" };
    }

    let minSize = -Infinity;
    let maxSize = Infinity;
    const types = new Set();

    for (const f of filters) {
      if (!f || typeof f !== "object") continue;

      // 1. Check size contradictions: e.g. >1GB AND <10MB
      if (f.field === "size" && typeof f.bytes === "number") {
        if (f.operator === ">" || f.operator === ">=") {
          minSize = Math.max(minSize, f.bytes);
        } else if (f.operator === "<" || f.operator === "<=") {
          maxSize = Math.min(maxSize, f.bytes);
        }

        if (minSize > maxSize) {
          return {
            isValid: true,
            isContradictory: true,
            error: "Contradictory size filters: min size exceeds max size",
          };
        }
      }

      // 2. Check multiple contradictory file types under AND
      if (f.field === "type" && typeof f.value === "string") {
        types.add(f.value.toLowerCase());
      }
    }

    if (types.size > 1) {
      // Multiple exclusive types under AND -> impossible match
      return {
        isValid: true,
        isContradictory: true,
        error: "Contradictory type filters: file cannot be multiple types simultaneously under AND",
      };
    }

    return { isValid: true, isContradictory: false, error: null };
  }
}

module.exports = {
  FilterValidator,
};
