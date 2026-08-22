"use strict";

class ImageOcr {
  /**
   * Evaluates OCR text relevance inside an image
   *
   * @param {Array<string>} keywords
   * @param {Array<string>} phrases
   * @param {Object} contentRecord
   * @returns {{score: number, matchedOcrTerms: Array<string>}}
   */
  static match(keywords = [], phrases = [], contentRecord = null) {
    if (!contentRecord || !contentRecord.extracted_text) {
      return { score: 0.0, matchedOcrTerms: [] };
    }

    const text = contentRecord.extracted_text.toLowerCase();
    const matched = [];

    // 1. Exact Phrase matches
    if (Array.isArray(phrases)) {
      for (const p of phrases) {
        if (text.includes(p.toLowerCase())) {
          matched.push(p);
        }
      }
    }

    // 2. Keyword matches
    if (Array.isArray(keywords)) {
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase().trim();
        if (text.includes(kwLower) && !matched.includes(kw)) {
          matched.push(kw);
        }
      }
    }

    const totalTerms = (phrases.length + keywords.length) || 1;
    const score = (matched.length / totalTerms);

    return {
      score: Math.min(1.0, score),
      matchedOcrTerms: matched,
    };
  }
}

module.exports = {
  ImageOcr,
};
