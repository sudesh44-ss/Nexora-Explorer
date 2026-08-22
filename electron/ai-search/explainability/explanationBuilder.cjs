"use strict";

const { SignalExplanation } = require("./signalExplanation.cjs");
const { ExplanationNormalizer } = require("./explanationNormalizer.cjs");
const { ExplanationValidator } = require("./explanationValidator.cjs");

class ExplanationBuilder {
  /**
   * Builds user-facing explanation object from evidence records
   */
  static build(searchResult, evidenceList = []) {
    if (!searchResult) return ExplanationValidator.sanitize(null);

    const bullets = [];
    let bestMatchTimestamp = searchResult.scoreBreakdown?.bestMatchTimestamp || null;

    for (const ev of evidenceList) {
      const line = SignalExplanation.describe(ev);
      if (line) bullets.push(line);
      if (ev.timestamp && !bestMatchTimestamp) {
        bestMatchTimestamp = ev.timestamp;
      }
    }

    const dedupedBullets = ExplanationNormalizer.deduplicateBullets(bullets, 4);
    const summary = dedupedBullets.length > 0
      ? `Matched: ${dedupedBullets[0]}`
      : "Matched relevant keywords and indexed metadata";

    return ExplanationValidator.sanitize({
      summary,
      bullets: dedupedBullets,
      bestMatchTimestamp,
      modality: searchResult.scoreBreakdown?.modality || "document",
    });
  }
}

module.exports = {
  ExplanationBuilder,
};
