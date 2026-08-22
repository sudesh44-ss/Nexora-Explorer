"use strict";

class ContextNormalizer {
  /**
   * Analyzes raw query to detect refinement action type
   *
   * @param {string} rawQuery
   * @returns {{action: "NEW"|"CLEAR"|"REMOVE"|"REPLACE_MODALITY"|"ADD_MODIFIER"|"ADDITIVE", payload: string}}
   */
  static analyze(rawQuery = "") {
    const trimmed = (rawQuery || "").trim().toLowerCase();

    if (!trimmed || trimmed === "clear" || trimmed === "reset" || trimmed === "clear search") {
      return { action: "CLEAR", payload: "" };
    }

    if (trimmed.startsWith("now search ") || trimmed.startsWith("search for ")) {
      return {
        action: "NEW",
        payload: rawQuery.replace(/^(now\s+search\s+|search\s+for\s+)/i, "").trim(),
      };
    }

    if (trimmed.startsWith("remove ") || trimmed.startsWith("delete filter ") || trimmed.startsWith("remove filter ")) {
      return {
        action: "REMOVE",
        payload: rawQuery.replace(/^(remove\s+filter\s+|delete\s+filter\s+|remove\s+)/i, "").trim(),
      };
    }

    if (trimmed.startsWith("same but ") || trimmed.startsWith("only ") || trimmed.startsWith("also show ") || trimmed.startsWith("also ")) {
      return {
        action: "ADD_MODIFIER",
        payload: rawQuery.replace(/^(same\s+but\s+|only\s+|also\s+show\s+|also\s+)/i, "").trim(),
      };
    }

    return {
      action: "ADDITIVE",
      payload: rawQuery.trim(),
    };
  }
}

module.exports = {
  ContextNormalizer,
};
