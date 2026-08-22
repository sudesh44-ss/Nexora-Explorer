"use strict";

class QueryParser {
  /**
   * Parses boolean operators, exact quoted phrases, and explicit search operators
   */
  static parse(rawQuery) {
    if (!rawQuery || typeof rawQuery !== "string") {
      return {
        phrases: [],
        operators: {},
        boolean: { must: [], should: [], mustNot: [] },
        cleanedQuery: "",
      };
    }

    let q = rawQuery.trim();
    const phrases = [];
    const operators = {};
    const must = [];
    const should = [];
    const mustNot = [];

    // 1. Extract Quoted Exact Phrases: "project report"
    const phraseMatches = q.match(/"([^"]+)"/g);
    if (phraseMatches) {
      for (const p of phraseMatches) {
        const cleanPhrase = p.replace(/^"|"$/g, "").trim();
        if (cleanPhrase) phrases.push(cleanPhrase);
        q = q.replace(p, " ");
      }
    }

    // 2. Extract Explicit Search Operators: name:, content:, folder:, type:, ext:, size:, date:, created:, modified:
    const opRegex = /\b(name|content|folder|type|ext|size|date|created|modified):([^\s]+)/gi;
    let opMatch;
    while ((opMatch = opRegex.exec(q)) !== null) {
      const key = opMatch[1].toLowerCase();
      const val = opMatch[2];
      operators[key] = val;
    }
    q = q.replace(opRegex, " ");

    // 3. Extract Natural & Boolean Exclusions: "without X", "X nahi", "NOT X"
    const notRegex = /\b(?:NOT|without|no)\s+([a-zA-Z0-9_\-\.]+)/gi;
    let notMatch;
    while ((notMatch = notRegex.exec(q)) !== null) {
      mustNot.push(notMatch[1].toLowerCase());
    }
    q = q.replace(notRegex, " ");

    // "X nahi", "X mat" (Hinglish/Hindi)
    const hindiNotRegex = /\b([a-zA-Z0-9_\-\.]+)\s+(?:nahi|mat|नही|नहीं)\b/gi;
    let hNotMatch;
    while ((hNotMatch = hindiNotRegex.exec(q)) !== null) {
      mustNot.push(hNotMatch[1].toLowerCase());
    }
    q = q.replace(hindiNotRegex, " ");

    // 4. Extract Explicit Boolean OR clauses: "A OR B", "(cake OR party)"
    const orClauseMatch = q.match(/\(([^)]+)\)|\b([a-zA-Z0-9_\-\.]+)\s+OR\s+([a-zA-Z0-9_\-\.]+)/i);
    if (orClauseMatch) {
      if (orClauseMatch[1]) {
        const terms = orClauseMatch[1].split(/\s+OR\s+/i).map((t) => t.trim().toLowerCase());
        should.push(...terms);
      } else {
        should.push(orClauseMatch[2].toLowerCase(), orClauseMatch[3].toLowerCase());
      }
      q = q.replace(orClauseMatch[0], " ");
    }

    // 5. Clean remaining query
    const cleanedQuery = q.replace(/\b(AND|OR)\b/g, " ").replace(/\s+/g, " ").trim();

    return {
      phrases,
      operators,
      boolean: {
        must: Array.from(new Set(must)),
        should: Array.from(new Set(should)),
        mustNot: Array.from(new Set(mustNot)),
      },
      cleanedQuery,
    };
  }
}

module.exports = {
  QueryParser,
};
