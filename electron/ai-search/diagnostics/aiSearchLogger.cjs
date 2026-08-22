"use strict";

const { AISearchError } = require("./aiSearchErrors.cjs");

const LogLevel = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
});

class AISearchLogger {
  constructor(options = {}) {
    this.prefix = options.prefix || "[Nexora AI Search]";
    this.currentLevel = options.level !== undefined ? options.level : LogLevel.INFO;
    this.history = [];
    this.maxHistory = options.maxHistory || 200;
  }

  setLevel(level) {
    if (typeof level === "number" && level >= 0 && level <= 4) {
      this.currentLevel = level;
    }
  }

  _log(levelName, levelValue, message, meta = null) {
    if (this.currentLevel > levelValue) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      meta,
    };

    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const formattedMessage = `${this.prefix} [${entry.timestamp}] [${levelName}]: ${message}`;
    
    if (levelValue === LogLevel.ERROR) {
      console.error(formattedMessage, meta || "");
    } else if (levelValue === LogLevel.WARN) {
      console.warn(formattedMessage, meta || "");
    } else if (levelValue === LogLevel.INFO) {
      console.log(formattedMessage, meta || "");
    } else {
      console.debug(formattedMessage, meta || "");
    }
  }

  debug(message, meta) {
    this._log("DEBUG", LogLevel.DEBUG, message, meta);
  }

  info(message, meta) {
    this._log("INFO", LogLevel.INFO, message, meta);
  }

  warn(message, meta) {
    this._log("WARN", LogLevel.WARN, message, meta);
  }

  error(message, errorOrMeta) {
    let meta = errorOrMeta;
    if (errorOrMeta instanceof AISearchError) {
      meta = errorOrMeta.toJSON();
    } else if (errorOrMeta instanceof Error) {
      meta = {
        name: errorOrMeta.name,
        message: errorOrMeta.message,
        stack: errorOrMeta.stack,
      };
    }
    this._log("ERROR", LogLevel.ERROR, message, meta);
  }

  getRecentLogs(limit = 50) {
    return this.history.slice(-limit);
  }

  clearLogs() {
    this.history = [];
  }
}

// Export singleton instance as default along with class
const defaultLogger = new AISearchLogger();

module.exports = {
  LogLevel,
  AISearchLogger,
  logger: defaultLogger,
};
