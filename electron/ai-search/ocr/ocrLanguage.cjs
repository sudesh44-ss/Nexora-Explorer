"use strict";

const SUPPORTED_LANGUAGES = Object.freeze({
  EN: "en",
  HI: "hi",
  MR: "mr",
  AUTO: "auto",
  MIXED: "mixed",
});

class OCRLanguage {
  static normalizeCode(code) {
    if (!code) return SUPPORTED_LANGUAGES.AUTO;
    const clean = code.toLowerCase().trim();
    if (clean.startsWith("en")) return SUPPORTED_LANGUAGES.EN;
    if (clean.startsWith("hi")) return SUPPORTED_LANGUAGES.HI;
    if (clean.startsWith("mr")) return SUPPORTED_LANGUAGES.MR;
    return clean;
  }

  static detectLanguage(text) {
    if (!text || text.trim().length === 0) return SUPPORTED_LANGUAGES.AUTO;

    // Check for Devanagari Unicode block (Hindi/Marathi)
    const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length;
    const latinCount = (text.match(/[A-Za-z]/g) || []).length;

    if (devanagariCount > 0 && latinCount > 0) {
      return SUPPORTED_LANGUAGES.MIXED;
    }
    if (devanagariCount > latinCount) {
      return SUPPORTED_LANGUAGES.HI;
    }
    return SUPPORTED_LANGUAGES.EN;
  }
}

module.exports = {
  SUPPORTED_LANGUAGES,
  OCRLanguage,
};
