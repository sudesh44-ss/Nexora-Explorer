"use strict";

const SUPPORTED_OPERATORS = Object.freeze([
  "type",
  "ext",
  "name",
  "content",
  "folder",
  "path",
  "size",
  "date",
  "created",
  "modified",
]);

class FilterOperators {
  /**
   * Checks if an operator string is valid
   */
  static isValidOperator(op) {
    if (!op || typeof op !== "string") return false;
    return SUPPORTED_OPERATORS.includes(op.toLowerCase().trim());
  }
}

module.exports = {
  SUPPORTED_OPERATORS,
  FilterOperators,
};
