"use strict";

const KNOWN_OBJECTS = [
  "cake", "car", "dog", "cat", "person", "people", "laptop", "phone",
  "tree", "flower", "food", "bottle", "chair", "table", "book", "beach",
  "mountain", "cup", "camera", "balloons", "केक", "गाड़ी", "कार", "कुत्ता", "बिल्ली",
];

const KNOWN_SCENES = [
  "outdoor", "indoor", "beach", "office", "classroom", "kitchen", "park",
  "mountain", "party", "garden", "street", "बाहर", "अंदर",
];

const KNOWN_ORGS = [
  "amazon", "google", "microsoft", "apple", "flipkart", "uber", "zomato", "swiggy",
];

class QueryEntitiesExtractor {
  /**
   * Extracts visual objects, scene contexts, people flags, document types, and money conditions
   */
  static extract(query) {
    if (!query || typeof query !== "string") {
      return {
        objects: [],
        scenes: [],
        containsPeople: false,
        organization: null,
        documentType: null,
        money: null,
      };
    }

    const q = query.toLowerCase();

    // 1. Objects
    const objects = [];
    for (const obj of KNOWN_OBJECTS) {
      if (q.includes(obj.toLowerCase())) {
        if (!objects.includes(obj)) objects.push(obj);
      }
    }

    // 2. Scenes
    const scenes = [];
    for (const sc of KNOWN_SCENES) {
      if (q.includes(sc.toLowerCase())) {
        scenes.push(sc);
      }
    }

    // 3. People Intent
    let containsPeople = false;
    if (/(?:people|person|friends|family|dost|doston|log|bache|bachon|kids|with people|dosto|लोग|दोस्त|बच्चे)/i.test(q)) {
      containsPeople = true;
    }

    // 4. Organizations
    let organization = null;
    for (const org of KNOWN_ORGS) {
      if (new RegExp(`\\b${org}\\b`, "i").test(q)) {
        organization = org.charAt(0).toUpperCase() + org.slice(1);
        break;
      }
    }

    // 5. Document Types
    let documentType = null;
    if (/(?:invoice|bill|receipt|रसीद|बिल)/i.test(q)) {
      documentType = "invoice";
    } else if (/(?:resume|cv|biodata)/i.test(q)) {
      documentType = "resume";
    } else if (/(?:report|रिपोर्ट)/i.test(q)) {
      documentType = "report";
    }

    // 6. Money / Currency
    let money = null;
    const moneyMatch = q.match(/(?:(?:around|approx|above|below|worth)\s+)?([₹$€£]|rs\.?|inr|usd)\s*([\d,]+(?:\.\d+)?)/i);
    if (moneyMatch) {
      const rawCur = moneyMatch[1].toUpperCase();
      const cur = (rawCur === "₹" || rawCur.startsWith("RS") || rawCur === "INR") ? "INR" : (rawCur === "$" ? "USD" : rawCur);
      const val = parseFloat(moneyMatch[2].replace(/,/g, ""));
      money = {
        amount: val,
        currency: cur,
      };
    }

    return {
      objects,
      scenes,
      containsPeople,
      organization,
      documentType,
      money,
    };
  }
}

module.exports = {
  QueryEntitiesExtractor,
};
