"use strict";

const DURATION_MULTIPLIERS = {
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
};

class VideoDuration {
  /**
   * Parses duration string to seconds
   * E.g. ">10min" -> { operator: ">", seconds: 600 }
   *
   * @param {string} raw
   * @returns {{operator: string, seconds: number}|null}
   */
  static parse(raw) {
    if (typeof raw !== "string") return null;

    const trimmed = raw.trim().toLowerCase();
    const match = trimmed.match(/^([><]=?|==|=)?\s*(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
    if (!match) return null;

    let op = match[1] || "==";
    if (op === "=") op = "==";

    const num = parseFloat(match[2]);
    if (isNaN(num) || num < 0) return null;

    const unitStr = match[3] || "s";
    const multiplier = DURATION_MULTIPLIERS[unitStr];
    if (multiplier === undefined) return null;

    return {
      operator: op,
      seconds: num * multiplier,
    };
  }

  /**
   * Evaluates if duration satisfies condition
   *
   * @param {number} fileDurationSec
   * @param {{operator: string, seconds: number}} condition
   * @returns {boolean}
   */
  static evaluate(fileDurationSec, condition) {
    if (typeof fileDurationSec !== "number" || isNaN(fileDurationSec) || !condition) {
      return false;
    }

    const { operator, seconds } = condition;
    switch (operator) {
      case ">":
        return fileDurationSec > seconds;
      case ">=":
        return fileDurationSec >= seconds;
      case "<":
        return fileDurationSec < seconds;
      case "<=":
        return fileDurationSec <= seconds;
      case "==":
      default:
        return Math.abs(fileDurationSec - seconds) < 1.0;
    }
  }
}

module.exports = {
  VideoDuration,
  DURATION_MULTIPLIERS,
};
