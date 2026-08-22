"use strict";

const DEFAULT_OCR_CONFIG = Object.freeze({
  defaultLanguages: ["en", "hi"],
  maxPageBatchSize: 10,
  maxFileSizeMb: 50,
  minConfidence: 0.3,
  qualityMode: "BALANCED",
  enableCloud: false,
  timeoutMs: 30000,
});

function getOCRConfig(overrides = {}) {
  return {
    ...DEFAULT_OCR_CONFIG,
    ...overrides,
    defaultLanguages: overrides.defaultLanguages || DEFAULT_OCR_CONFIG.defaultLanguages,
  };
}

module.exports = {
  DEFAULT_OCR_CONFIG,
  getOCRConfig,
};
