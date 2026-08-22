"use strict";

const DEFAULT_CHANGE_CONFIG = Object.freeze({
  debounceWindowMs: 100,
  maxBurstBufferSize: 1000,
  reconciliationBatchSize: 100,
  enableAutoReconciliation: true,
  ignorePatterns: [
    "**/node_modules/**",
    "**/.git/**",
    "**/.vscode/**",
    "**/.tmp/**",
    "**/$RECYCLE.BIN/**",
    "**/System Volume Information/**",
    "**/*.tmp",
  ],
});

function getChangeConfig(overrides = {}) {
  return {
    ...DEFAULT_CHANGE_CONFIG,
    ...overrides,
    ignorePatterns: overrides.ignorePatterns || DEFAULT_CHANGE_CONFIG.ignorePatterns,
  };
}

module.exports = {
  DEFAULT_CHANGE_CONFIG,
  getChangeConfig,
};
