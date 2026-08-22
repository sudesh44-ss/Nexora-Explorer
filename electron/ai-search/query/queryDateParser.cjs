"use strict";

const MONTH_NAMES = {
  january: 0, jan: 0, जनवरी: 0,
  february: 1, feb: 1, फरवरी: 1,
  march: 2, mar: 2, मार्च: 2,
  april: 3, apr: 3, अप्रैल: 3,
  may: 4, मई: 4,
  june: 5, jun: 5, जून: 5,
  july: 6, jul: 6, जुलाई: 6,
  august: 7, aug: 7, अगस्त: 7,
  september: 8, sep: 8, sept: 8, सितंबर: 8,
  october: 9, oct: 9, अक्टूबर: 9,
  november: 10, nov: 10, नवंबर: 10,
  december: 11, dec: 11, दिसंबर: 11,
};

class QueryDateParser {
  /**
   * Parses explicit and natural dates, resolving against a reference date
   */
  static parse(query, referenceDate = new Date()) {
    if (!query || typeof query !== "string") return null;

    const rawLower = query.toLowerCase();
    const q = rawLower.replace(/_/g, " ");
    const now = new Date(referenceDate);

    // 1. Detect target date field: created vs modified
    let field = "modifiedAt";
    if (/(?:^|\s|[^\w])(created|bana(ye|ya|yi)|creation)(?:$|\s|[^\w])/i.test(q) || /created:/i.test(q)) {
      field = "createdAt";
    }

    // 2. Exact full date: 21 August 2025 or 21/08/2025 or 2025-08-21
    const isoMatch = q.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
      return {
        field,
        operator: "between",
        start: start.toISOString(),
        end: end.toISOString(),
        relative: null,
        confidence: 1.0,
      };
    }

    const textualDateMatch = q.match(/\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)\s+(\d{4})\b/i);
    if (textualDateMatch) {
      const day = parseInt(textualDateMatch[1], 10);
      const monthName = textualDateMatch[2].toLowerCase();
      const year = parseInt(textualDateMatch[3], 10);
      const month = MONTH_NAMES[monthName] !== undefined ? MONTH_NAMES[monthName] : 0;
      const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
      return {
        field,
        operator: "between",
        start: start.toISOString(),
        end: end.toISOString(),
        relative: null,
        confidence: 1.0,
      };
    }

    // 3. Month & Year: August 2025
    const monthYearMatch = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)\s+(\d{4})\b/i);
    if (monthYearMatch) {
      const monthName = monthYearMatch[1].toLowerCase();
      const year = parseInt(monthYearMatch[2], 10);
      const month = MONTH_NAMES[monthName] !== undefined ? MONTH_NAMES[monthName] : 0;
      const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
      return {
        field,
        operator: "between",
        start: start.toISOString(),
        end: end.toISOString(),
        relative: `${monthName}_${year}`,
        confidence: 0.95,
      };
    }

    // 4. Exact Year: 2025, date:2025
    const yearMatch = q.match(/(?:date:)?\b(19\d\d|20\d\d)\b/);
    if (yearMatch && !/\d{1,2}\s+[a-z]+/i.test(q)) {
      const year = parseInt(yearMatch[1], 10);
      const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      return {
        field,
        operator: "between",
        start: start.toISOString(),
        end: end.toISOString(),
        relative: `year_${year}`,
        confidence: 0.95,
      };
    }

    // 5. Relative Dates (English, Hinglish, Hindi)
    // Today / Aaj
    if (/(?:^|\s|[^\w])(today|aaj|आज)(?:$|\s|[^\w])/i.test(q) || q.includes("आज")) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      return {
        field,
        operator: "between",
        start: start.toISOString(),
        end: end.toISOString(),
        relative: "today",
        confidence: 0.95,
      };
    }

    // Yesterday / Kal
    if (/(?:^|\s|[^\w])(yesterday|kal|कल|बीता हुआ कल)(?:$|\s|[^\w])/i.test(q) || q.includes("कल")) {
      const yesterday = new Date(now);
      yesterday.setUTCDate(now.getUTCDate() - 1);
      const start = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 23, 59, 59, 999));
      return {
        field,
        operator: "between",
        start: start.toISOString(),
        end: end.toISOString(),
        relative: "yesterday",
        confidence: 0.90,
      };
    }

    // Last Week / Pichle Hafte
    if (/(?:^|\s|[^\w])(last week|previous week|pichle hafte|पिछले हफ्ते|पिछले सप्ताह)(?:$|\s|[^\w])/i.test(q) || q.includes("पिछले हफ्ते") || q.includes("पिछले सप्ताह")) {
      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() - 7);
      start.setUTCHours(0, 0, 0, 0);
      return {
        field,
        operator: "between",
        start: start.toISOString(),
        end: now.toISOString(),
        relative: "last_week",
        confidence: 0.95,
      };
    }

    // Last Month / Pichle Mahine
    if (/(?:^|\s|[^\w])(last month|previous month|pichle mahine|पिछले महीने|पिछले माह)(?:$|\s|[^\w])/i.test(q) || q.includes("पिछले महीने") || q.includes("पिछले माह")) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      return {
        field,
        operator: "between",
        start: start.toISOString(),
        end: end.toISOString(),
        relative: "last_month",
        confidence: 0.95,
      };
    }

    // Last Year / Pichle Saal
    if (/(?:^|\s|[^\w])(last year|previous year|pichle saal|पिछले साल|पिछले वर्ष)(?:$|\s|[^\w])/i.test(q) || q.includes("पिछले साल") || q.includes("पिछले वर्ष")) {
      const prevYear = now.getUTCFullYear() - 1;
      const start = new Date(Date.UTC(prevYear, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(prevYear, 11, 31, 23, 59, 59, 999));
      return {
        field,
        operator: "between",
        start: start.toISOString(),
        end: end.toISOString(),
        relative: "last_year",
        confidence: 0.95,
      };
    }

    return null;
  }
}

module.exports = {
  QueryDateParser,
};
