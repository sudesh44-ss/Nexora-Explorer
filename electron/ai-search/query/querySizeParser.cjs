"use strict";

const UNIT_MULTIPLIERS = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024,
};

class QuerySizeParser {
  /**
   * Extracts and parses size conditions from natural query or explicit operators
   */
  static parse(query) {
    if (!query || typeof query !== "string") return null;

    // 1. Explicit operator match: size:>100MB, size:<10MB, >100MB, >=1GB
    const explicitMatch = query.match(/(?:size:)?([><]=?|=)\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)/i);
    if (explicitMatch) {
      const operator = explicitMatch[1];
      const value = parseFloat(explicitMatch[2]);
      const unit = explicitMatch[3].toUpperCase();
      const bytes = Math.round(value * (UNIT_MULTIPLIERS[unit] || 1));

      return {
        operator,
        value,
        unit,
        bytes,
        raw: explicitMatch[0],
      };
    }

    // 2. Natural language match (English & Hinglish):
    // "100 MB se badi", "over 1 GB", "more than 50MB", "greater than 200KB"
    const greaterMatch = query.match(/(?:(?:over|more than|greater than)\s+(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)|(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)\s*(?:se badi|se jyada|se upar))/i);
    if (greaterMatch) {
      const valStr = greaterMatch[1] || greaterMatch[3];
      const unitStr = (greaterMatch[2] || greaterMatch[4]).toUpperCase();
      const value = parseFloat(valStr);
      const bytes = Math.round(value * (UNIT_MULTIPLIERS[unitStr] || 1));

      return {
        operator: ">",
        value,
        unit: unitStr,
        bytes,
        raw: greaterMatch[0],
      };
    }

    // "under 10 MB", "less than 500KB", "10 MB se choti", "10MB se kam"
    const lesserMatch = query.match(/(?:(?:under|less than|smaller than)\s+(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)|(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)\s*(?:se choti|se kam|se niche))/i);
    if (lesserMatch) {
      const valStr = lesserMatch[1] || lesserMatch[3];
      const unitStr = (lesserMatch[2] || lesserMatch[4]).toUpperCase();
      const value = parseFloat(valStr);
      const bytes = Math.round(value * (UNIT_MULTIPLIERS[unitStr] || 1));

      return {
        operator: "<",
        value,
        unit: unitStr,
        bytes,
        raw: lesserMatch[0],
      };
    }

    return null;
  }
}

module.exports = {
  QuerySizeParser,
};
