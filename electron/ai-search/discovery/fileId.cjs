"use strict";

const crypto = require("crypto");
const path = require("path");

/**
 * Generates a stable, unique 32-character hex ID for a file
 * Combines filesystem inode/device identifiers, size, birthtime, and normalized path.
 *
 * @param {string} filePath - Absolute path to the file
 * @param {import("fs").Stats} stats - Node.js fs.Stats object
 * @returns {string} Unique file identifier (32 hex characters)
 */
function generateFileId(filePath, stats = null) {
  const normalizedPath = path.normalize(filePath).toLowerCase();
  
  if (stats) {
    const dev = stats.dev !== undefined ? stats.dev : 0;
    const ino = stats.ino !== undefined ? stats.ino : 0;
    const size = stats.size !== undefined ? stats.size : 0;
    const birthtimeMs = stats.birthtimeMs || stats.mtimeMs || 0;
    
    // Composite seed guaranteeing uniqueness across volume mounts
    const seed = `nexora:file:${dev}:${ino}:${size}:${birthtimeMs}:${normalizedPath}`;
    return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32);
  }

  // Fallback if stats is not available yet
  const seed = `nexora:path:${normalizedPath}`;
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

/**
 * Generates an alternative identity key based purely on content hash and size.
 * Used in Phase 3/12 for tracking moved or renamed files.
 *
 * @param {string} contentHash - SHA-256 hash of the file content
 * @param {number} size - File size in bytes
 * @returns {string} Content-based identity signature
 */
function generateContentSignature(contentHash, size) {
  if (!contentHash) return null;
  return crypto.createHash("sha256").update(`${contentHash}:${size}`).digest("hex").slice(0, 32);
}

module.exports = {
  generateFileId,
  generateContentSignature,
};
