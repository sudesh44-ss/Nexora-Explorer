"use strict";

const { FilterTypes } = require("../filters/filterTypes.cjs");

const OPERATORS = [
  { name: "type:", values: ["image", "video", "audio", "document", "pdf", "code", "archive"] },
  { name: "duration:", values: [">30min", "<5min", ">1hour", "<=10min", ">=20min"] },
  { name: "size:", values: [">100MB", "<10MB", ">1GB", "<=500KB"] },
  { name: "modified:", values: ["2025", "today", "yesterday", "last_month"] },
  { name: "created:", values: ["2025", "last_month", "today"] },
  { name: "extension:", values: ["pdf", "mp4", "jpg", "png", "mp3", "docx", "txt", "js"] },
];

class SuggestionSources {
  /**
   * Generates operator & filter completions
   */
  static getOperatorSuggestions(input = "") {
    const trimmed = input.trim().toLowerCase();
    const suggestions = [];

    // Check if input matches operator name prefix e.g. "typ", "dur", "siz"
    for (const op of OPERATORS) {
      if (op.name.startsWith(trimmed) && trimmed !== op.name) {
        suggestions.push({
          type: "operator",
          text: op.name,
          source: "operator",
          score: 0.95,
          category: "Operator",
        });
      }

      // Check if user typed operator name and is completing value e.g. "type:", "type:vi", "duration:>"
      if (trimmed.startsWith(op.name)) {
        const valPrefix = trimmed.substring(op.name.length);
        for (const val of op.values) {
          if (!valPrefix || val.startsWith(valPrefix)) {
            suggestions.push({
              type: "filter",
              text: `${op.name}${val}`,
              source: "operator",
              score: 0.9,
              category: "Filter",
            });
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Generates context-aware refinement suggestions from active search context
   */
  static getContextSuggestions(input = "", activeContextState = null) {
    if (!activeContextState || !activeContextState.rawQuery) return [];

    const suggestions = [];
    const trimmed = input.trim().toLowerCase();

    const refinementTemplates = [
      "only short ones",
      "only recent ones",
      "only images",
      "only videos",
      "only audio",
      "also show PDFs",
      "with firewall",
      "from 2025",
    ];

    for (const t of refinementTemplates) {
      if (!trimmed || t.toLowerCase().includes(trimmed) || t.toLowerCase().startsWith(trimmed)) {
        suggestions.push({
          type: "context",
          text: t,
          source: "context",
          score: 0.85,
          category: "Refinement",
        });
      }
    }

    return suggestions;
  }

  /**
   * Generates completions from indexed database vocabulary / files
   */
  static getIndexSuggestions(input = "", db = null, limit = 10) {
    if (!input || !db || !db.files) return [];
    const trimmed = input.trim().toLowerCase();
    if (trimmed.length < 2) return [];

    const suggestions = [];
    const files = typeof db.files.searchByName === "function" ? db.files.searchByName(trimmed, { limit }) : [];

    for (const f of files) {
      suggestions.push({
        type: "query",
        text: f.name,
        source: "index",
        score: 0.8,
        category: "File",
      });
    }

    return suggestions;
  }

  /**
   * Matches recent search history
   */
  static getHistorySuggestions(input = "", searchHistory = []) {
    if (!Array.isArray(searchHistory) || searchHistory.length === 0) return [];
    const trimmed = input.trim().toLowerCase();
    const suggestions = [];

    for (const item of searchHistory) {
      const text = typeof item === "string" ? item : item.query || item.rawQuery || "";
      if (!text) continue;

      if (!trimmed || text.toLowerCase().startsWith(trimmed) || text.toLowerCase().includes(trimmed)) {
        suggestions.push({
          type: "history",
          text,
          source: "history",
          score: 0.88,
          category: "Recent Search",
        });
      }
    }

    return suggestions;
  }

  /**
   * Generates typo / spell corrections using Levenshtein distance
   */
  static getTypoCorrections(input = "", vocabulary = []) {
    const trimmed = input.trim().toLowerCase();
    if (trimmed.length < 4 || vocabulary.length === 0) return [];

    const suggestions = [];
    for (const word of vocabulary) {
      const wLower = word.toLowerCase();
      if (Math.abs(wLower.length - trimmed.length) > 2) continue;

      const dist = this._levenshtein(trimmed, wLower);
      if (dist === 1 || (trimmed.length > 6 && dist === 2)) {
        suggestions.push({
          type: "correction",
          text: word,
          source: "correction",
          score: 0.75,
          category: "Did you mean?",
        });
      }
    }

    return suggestions;
  }

  static _levenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  }
}

module.exports = {
  SuggestionSources,
  OPERATORS,
};
