"use strict";

const { VectorErrorCode, VectorError } = require("./vectorErrors.cjs");

/**
 * Validates a numerical vector
 * @param {Array|Float32Array} vector
 * @param {number} [expectedDimension]
 * @returns {boolean}
 */
function validateVector(vector, expectedDimension = null) {
  if (!vector || (!Array.isArray(vector) && !(vector instanceof Float32Array))) {
    return false;
  }

  if (expectedDimension !== null && vector.length !== expectedDimension) {
    return false;
  }

  if (vector.length === 0) {
    return false;
  }

  for (let i = 0; i < vector.length; i++) {
    const val = vector[i];
    if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
      return false;
    }
  }

  return true;
}

/**
 * Normalizes vector to unit L2 length
 * @param {Array<number>|Float32Array} vector
 * @returns {Float32Array}
 */
function l2Normalize(vector) {
  if (!validateVector(vector)) {
    throw new VectorError(VectorErrorCode.VECTOR_INVALID, "Cannot normalize invalid vector");
  }

  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }

  const magnitude = Math.sqrt(sumSq);
  if (magnitude === 0) {
    return new Float32Array(vector.length);
  }

  const normalized = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    normalized[i] = vector[i] / magnitude;
  }

  return normalized;
}

/**
 * Computes Cosine Similarity between two vectors
 * @param {Array<number>|Float32Array} a
 * @param {Array<number>|Float32Array} b
 * @returns {number} Score between -1.0 and 1.0 (or 0 if zero vector)
 */
function cosineSimilarity(a, b) {
  if (!validateVector(a) || !validateVector(b)) {
    throw new VectorError(VectorErrorCode.VECTOR_INVALID, "Invalid vector in cosineSimilarity calculation");
  }

  if (a.length !== b.length) {
    throw new VectorError(
      VectorErrorCode.VECTOR_DIMENSION_MISMATCH,
      `Dimension mismatch: Vector A (${a.length}) !== Vector B (${b.length})`
    );
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];
    dot += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  const score = dot / denom;
  // Numerical clamp to [-1, 1] to prevent floating point boundary drift
  return Math.max(-1, Math.min(1, Number(score.toFixed(6))));
}

module.exports = {
  validateVector,
  l2Normalize,
  cosineSimilarity,
};
