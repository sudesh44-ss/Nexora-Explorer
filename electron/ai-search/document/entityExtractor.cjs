"use strict";

const { EntityType } = require("./documentMetadata.cjs");

class EntityExtractor {
  static extractEntities(text) {
    if (!text || typeof text !== "string") return [];
    const entities = [];

    // 1. Email Extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailRegex.exec(text)) !== null) {
      entities.push({
        type: EntityType.EMAIL,
        value: match[0],
        normalizedValue: match[0].toLowerCase(),
        confidence: 0.99,
      });
    }

    // 2. Money / Currency Extraction
    const moneyRegex = /(?:₹|\$|€|£|INR|USD)\s*([\d,]+(?:\.\d{2})?)/gi;
    while ((match = moneyRegex.exec(text)) !== null) {
      const rawNum = match[1].replace(/,/g, "");
      const amount = parseFloat(rawNum);
      if (!isNaN(amount)) {
        entities.push({
          type: EntityType.MONEY,
          value: match[0],
          normalizedValue: { amount, currency: match[0].includes("₹") || match[0].includes("INR") ? "INR" : "USD" },
          confidence: 0.95,
        });
      }
    }

    // 3. Date Normalization (DD/MM/YYYY or YYYY-MM-DD)
    const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b|\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g;
    while ((match = dateRegex.exec(text)) !== null) {
      let isoDate = null;
      if (match[3]) {
        // DD/MM/YYYY
        const d = match[1].padStart(2, "0");
        const m = match[2].padStart(2, "0");
        const y = match[3];
        isoDate = `${y}-${m}-${d}`;
      } else if (match[4]) {
        // YYYY-MM-DD
        const y = match[4];
        const m = match[5].padStart(2, "0");
        const d = match[6].padStart(2, "0");
        isoDate = `${y}-${m}-${d}`;
      }

      if (isoDate) {
        entities.push({
          type: EntityType.DATE,
          value: match[0],
          normalizedValue: isoDate,
          confidence: 0.92,
        });
      }
    }

    // 4. Document ID (e.g. INV-2025-001)
    const docIdRegex = /\b([A-Z]{2,5}[-_]\d{3,8}[-_]?\d*)\b/g;
    while ((match = docIdRegex.exec(text)) !== null) {
      entities.push({
        type: EntityType.DOCUMENT_ID,
        value: match[0],
        normalizedValue: match[0].toUpperCase(),
        confidence: 0.90,
      });
    }

    // 5. Common Organizations
    const orgs = ["Amazon", "Google", "Microsoft", "Apple", "Flipkart", "Meta", "Adobe"];
    for (const org of orgs) {
      if (new RegExp(`\\b${org}\\b`, "i").test(text)) {
        entities.push({
          type: EntityType.ORGANIZATION,
          value: org,
          normalizedValue: org,
          confidence: 0.88,
        });
      }
    }

    return entities;
  }
}

module.exports = {
  EntityExtractor,
};
