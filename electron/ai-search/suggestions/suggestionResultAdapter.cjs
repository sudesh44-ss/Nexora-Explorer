"use strict";

const { SuggestionValidator } = require("./suggestionValidator.cjs");

class SuggestionResultAdapter {
  /**
   * Formats suggestions into UI-ready payload
   */
  static format(suggestions = []) {
    return suggestions.map((s, index) => SuggestionValidator.sanitize(s, `sug_${index}`)).filter(Boolean);
  }
}

module.exports = {
  SuggestionResultAdapter,
};
