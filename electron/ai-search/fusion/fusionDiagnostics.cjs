"use strict";

class FusionDiagnostics {
  /**
   * Generates developer diagnostic metrics for a multimodal fusion pass
   */
  static generateReport(candidates = [], rankedResults = [], elapsedMs = 0) {
    const modalityCounts = {
      document: 0,
      image: 0,
      video: 0,
      audio: 0,
      code: 0,
      archive: 0,
      unknown: 0,
    };

    for (const c of candidates) {
      const mod = c.modality || "unknown";
      if (modalityCounts[mod] !== undefined) modalityCounts[mod]++;
      else modalityCounts.unknown++;
    }

    return {
      totalCandidatesMerged: candidates.length,
      finalRankedCount: rankedResults.length,
      modalityDistribution: modalityCounts,
      elapsedMs,
    };
  }
}

module.exports = {
  FusionDiagnostics,
};
