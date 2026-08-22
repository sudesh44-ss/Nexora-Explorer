"use strict";

class BenchmarkMetrics {
  /**
   * Computes Precision@K
   */
  static precisionAtK(retrievedIds = [], expectedMap = new Map(), k = 5) {
    if (!Array.isArray(retrievedIds) || retrievedIds.length === 0 || k <= 0) return 0;
    const topK = retrievedIds.slice(0, k);
    let relevantCount = 0;

    for (const id of topK) {
      const rel = expectedMap.get(String(id)) || 0;
      if (rel > 0) relevantCount++;
    }

    return relevantCount / Math.min(k, topK.length);
  }

  /**
   * Computes Recall@K
   */
  static recallAtK(retrievedIds = [], expectedMap = new Map(), k = 10) {
    let totalRelevant = 0;
    for (const rel of expectedMap.values()) {
      if (rel > 0) totalRelevant++;
    }
    if (totalRelevant === 0) return 1.0; // If no relevant items expected, recall is 1.0

    const topK = retrievedIds.slice(0, k);
    let foundRelevant = 0;

    for (const id of topK) {
      const rel = expectedMap.get(String(id)) || 0;
      if (rel > 0) foundRelevant++;
    }

    return foundRelevant / totalRelevant;
  }

  /**
   * Computes Reciprocal Rank (RR) for MRR
   */
  static reciprocalRank(retrievedIds = [], expectedMap = new Map()) {
    if (!Array.isArray(retrievedIds)) return 0;

    for (let i = 0; i < retrievedIds.length; i++) {
      const rel = expectedMap.get(String(retrievedIds[i])) || 0;
      if (rel > 0) {
        return 1.0 / (i + 1);
      }
    }

    return 0;
  }

  /**
   * Computes Discounted Cumulative Gain (DCG@K)
   */
  static dcgAtK(retrievedIds = [], expectedMap = new Map(), k = 5) {
    const topK = retrievedIds.slice(0, k);
    let dcg = 0;

    for (let i = 0; i < topK.length; i++) {
      const rel = expectedMap.get(String(topK[i])) || 0;
      // Formula: (2^rel - 1) / log2(i + 2)
      dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
    }

    return dcg;
  }

  /**
   * Computes Normalized Discounted Cumulative Gain (NDCG@K)
   */
  static ndcgAtK(retrievedIds = [], expectedMap = new Map(), k = 5) {
    const actualDcg = this.dcgAtK(retrievedIds, expectedMap, k);
    if (actualDcg === 0) return 0;

    // Compute Ideal DCG (IDCG)
    const idealRels = Array.from(expectedMap.values())
      .filter((r) => r > 0)
      .sort((a, b) => b - a)
      .slice(0, k);

    let idcg = 0;
    for (let i = 0; i < idealRels.length; i++) {
      idcg += (Math.pow(2, idealRels[i]) - 1) / Math.log2(i + 2);
    }

    if (idcg === 0) return 0;
    return actualDcg / idcg;
  }
}

module.exports = {
  BenchmarkMetrics,
};
