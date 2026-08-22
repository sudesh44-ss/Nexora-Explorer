"use strict";

const { QueryErrorCode, QueryError } = require("./queryErrors.cjs");

/**
 * Normalizes user queries safely while preserving original raw query
 */
class QueryNormalizer {
  static normalize(rawQuery, maxLength = 1000) {
    if (typeof rawQuery !== "string") {
      return { rawQuery: "", normalizedQuery: "" };
    }

    if (rawQuery.length > maxLength) {
      throw new QueryError(
        QueryErrorCode.QUERY_TOO_LONG,
        `Query exceeds maximum allowed length of ${maxLength} characters`
      );
    }

    const raw = rawQuery;
    const normalized = raw
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

    return {
      rawQuery: raw,
      normalizedQuery: normalized,
    };
  }
}

module.exports = {
  QueryNormalizer,
};
