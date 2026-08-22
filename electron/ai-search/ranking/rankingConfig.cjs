"use strict";

const DEFAULT_RANKING_CONFIG = Object.freeze({
  minFinalScore: 0.05,
  candidateLimit: 500,
  resultLimit: 50,
  boosts: {
    exactFilename: 1.5,
    exactPhrase: 1.4,
    allTermsCovered: 1.25,
    recentModified: 1.15,
  },
  tieBreakers: ["finalScore", "exactness", "coverage", "semantic", "fileId"],
});

function getRankingConfig(overrides = {}) {
  return {
    ...DEFAULT_RANKING_CONFIG,
    ...overrides,
    boosts: {
      ...DEFAULT_RANKING_CONFIG.boosts,
      ...(overrides.boosts || {}),
    },
  };
}

module.exports = {
  DEFAULT_RANKING_CONFIG,
  getRankingConfig,
};
