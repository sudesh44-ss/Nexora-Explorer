"use strict";

const { QueryIntent } = require("./querySchema.cjs");
const { QueryErrorCode, QueryError } = require("./queryErrors.cjs");

const ALLOWED_INTENTS = new Set(Object.values(QueryIntent));
const ALLOWED_DATE_OPERATORS = new Set(["between", "after", "before", "equals"]);

class QueryValidator {
  /**
   * Validates structured query against strict constraints
   *
   * @param {Object} query - StructuredQuery object
   * @returns {{valid: boolean, errors: Array<string>}}
   */
  static validate(query) {
    const errors = [];

    if (!query || typeof query !== "object") {
      return { valid: false, errors: ["Query must be an object"] };
    }

    // 1. Intent check
    if (query.intent && !ALLOWED_INTENTS.has(query.intent)) {
      errors.push(`Invalid query intent: '${query.intent}'`);
    }

    // 2. Arrays limit checks
    if (Array.isArray(query.concepts) && query.concepts.length > 50) {
      errors.push("Concepts array exceeds maximum allowed length of 50");
    }

    if (Array.isArray(query.folderHints) && query.folderHints.length > 20) {
      errors.push("Folder hints array exceeds maximum allowed length of 20");
    }

    // 3. DateFilter validation
    if (query.dateFilter) {
      const df = query.dateFilter;
      if (!ALLOWED_DATE_OPERATORS.has(df.operator)) {
        errors.push(`Invalid date operator: '${df.operator}'`);
      }
      if (df.start && Number.isNaN(Date.parse(df.start))) {
        errors.push(`Invalid start date timestamp: '${df.start}'`);
      }
      if (df.end && Number.isNaN(Date.parse(df.end))) {
        errors.push(`Invalid end date timestamp: '${df.end}'`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Asserts validity or throws QueryError
   */
  static assertValid(query) {
    const res = this.validate(query);
    if (!res.valid) {
      throw new QueryError(
        QueryErrorCode.INVALID_QUERY_SCHEMA,
        `Structured query validation failed: ${res.errors.join(", ")}`,
        res.errors
      );
    }
  }
}

module.exports = {
  QueryValidator,
};
