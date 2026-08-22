"use strict";

class DateResolver {
  /**
   * Resolves natural relative date phrases into ISO date ranges
   *
   * @param {string} normalizedQuery
   * @param {Date} [referenceDate] - Current date reference (defaults to now)
   * @returns {{dateFilter: Object|null, confidence: number}}
   */
  static resolve(normalizedQuery, referenceDate = new Date()) {
    if (!normalizedQuery) {
      return { dateFilter: null, confidence: 1.0 };
    }

    const q = normalizedQuery.toLowerCase();
    const now = new Date(referenceDate);

    // 1. Today / Aaj
    if (q.includes("today") || q.includes("aaj")) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        dateFilter: { field: "modifiedAt", operator: "between", start: start.toISOString(), end: end.toISOString() },
        confidence: 0.95,
      };
    }

    // 2. Yesterday / Kal
    if (q.includes("yesterday") || q.includes("kal")) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return {
        dateFilter: { field: "modifiedAt", operator: "between", start: start.toISOString(), end: end.toISOString() },
        confidence: 0.90,
      };
    }

    // 3. Last Month / Pichle Mahine
    if (q.includes("last month") || q.includes("previous month") || q.includes("pichle mahine")) {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return {
        dateFilter: { field: "modifiedAt", operator: "between", start: start.toISOString(), end: end.toISOString() },
        confidence: 0.95,
      };
    }

    // 4. Last Year / Pichle Saal
    if (q.includes("last year") || q.includes("previous year") || q.includes("pichle saal")) {
      const prevYear = now.getFullYear() - 1;
      const start = new Date(prevYear, 0, 1, 0, 0, 0, 0);
      const end = new Date(prevYear, 11, 31, 23, 59, 59, 999);
      return {
        dateFilter: { field: "modifiedAt", operator: "between", start: start.toISOString(), end: end.toISOString() },
        confidence: 0.95,
      };
    }

    return { dateFilter: null, confidence: 1.0 };
  }
}

module.exports = {
  DateResolver,
};
