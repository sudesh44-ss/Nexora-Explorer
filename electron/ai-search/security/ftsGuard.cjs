"use strict";

class FtsGuard {
  /**
   * Cleans an expression for safe execution in SQLite FTS5 MATCH queries
   */
  static cleanFtsExpression(expr = "") {
    if (typeof expr !== "string" || !expr.trim()) return "";

    let clean = expr.trim();

    // 1. Remove dangling leading/trailing boolean keywords
    clean = clean.replace(/^(AND|OR|NOT)\s+/i, "").replace(/\s+(AND|OR|NOT)$/i, "");

    // 2. Remove consecutive boolean keywords e.g. "AND AND", "NOT OR"
    clean = clean.replace(/\b(AND|OR|NOT)\s+(AND|OR|NOT)\b/gi, "$1");

    // 3. Balance unmatched parentheses
    const openParen = (clean.match(/\(/g) || []).length;
    const closeParen = (clean.match(/\)/g) || []).length;
    if (openParen > closeParen) {
      clean += ")".repeat(openParen - closeParen);
    } else if (closeParen > openParen) {
      clean = "(".repeat(closeParen - openParen) + clean;
    }

    return clean;
  }
}

module.exports = {
  FtsGuard,
};
