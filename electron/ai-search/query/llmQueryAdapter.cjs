"use strict";

const { QueryValidator } = require("./queryValidator.cjs");
const { createStructuredQuery } = require("./querySchema.cjs");
const { QueryErrorCode, QueryError } = require("./queryErrors.cjs");

/**
 * Optional LLM query adapter converting complex natural language queries into strict JSON schemas
 */
class LLMQueryAdapter {
  constructor(options = {}) {
    this.enabled = Boolean(options.enabled);
    this.provider = options.provider || null;
  }

  /**
   * Parses complex multi-clause query via structured LLM prompt
   *
   * @param {string} rawQuery
   * @returns {Promise<Object>} StructuredQuery
   */
  async parseComplexQuery(rawQuery) {
    if (!this.enabled || !this.provider) {
      throw new QueryError(QueryErrorCode.LLM_PARSE_FAILED, "LLM query adapter is disabled or no provider configured");
    }

    try {
      const response = await this.provider.generateStructuredQuery(rawQuery);
      let parsedJson;

      if (typeof response === "string") {
        try {
          parsedJson = JSON.parse(response);
        } catch {
          throw new QueryError(QueryErrorCode.INVALID_QUERY_SCHEMA, "LLM returned non-JSON prose");
        }
      } else {
        parsedJson = response;
      }

      // Assert strict schema compliance
      QueryValidator.assertValid(parsedJson);

      return createStructuredQuery({
        ...parsedJson,
        rawQuery,
        diagnostics: { parseMode: "llm" },
      });
    } catch (err) {
      throw new QueryError(
        QueryErrorCode.LLM_PARSE_FAILED,
        `LLM Query interpretation failed: ${err.message}`,
        err
      );
    }
  }
}

module.exports = {
  LLMQueryAdapter,
};
