"use strict";

const fs = require("fs");
const fsp = fs.promises;
const crypto = require("crypto");
const { HashStrategy } = require("./scanTypes.cjs");

/**
 * Calculates SHA-256 hash using a stream (Memory Safe)
 *
 * @param {string} filePath
 * @param {Object} options
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<string|null>}
 */
function computeStreamHash(filePath, options = {}) {
  const signal = options.signal;

  return new Promise((resolve) => {
    if (signal?.aborted) {
      return resolve(null);
    }

    let stream;
    try {
      stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
    } catch {
      return resolve(null);
    }

    const hash = crypto.createHash("sha256");

    const onAbort = () => {
      stream.destroy();
      resolve(null);
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }

    stream.on("data", (chunk) => {
      if (signal?.aborted) {
        stream.destroy();
        return resolve(null);
      }
      hash.update(chunk);
    });

    stream.on("end", () => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      resolve(hash.digest("hex"));
    });

    stream.on("error", () => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      stream.destroy();
      resolve(null);
    });
  });
}

/**
 * Computes a fast sample hash for very large files
 * (Samples first 64KB + middle 64KB + tail 64KB + size)
 *
 * @param {string} filePath
 * @param {number} fileSize
 * @returns {Promise<string|null>}
 */
async function computeSampleHash(filePath, fileSize) {
  const SAMPLE_SIZE = 64 * 1024; // 64 KB

  if (fileSize <= SAMPLE_SIZE * 3) {
    return computeStreamHash(filePath);
  }

  let handle;
  try {
    handle = await fsp.open(filePath, "r");
    const hash = crypto.createHash("sha256");
    hash.update(`sample:${fileSize}:`);

    // 1. Head sample
    const headBuf = Buffer.alloc(SAMPLE_SIZE);
    const headRead = await handle.read(headBuf, 0, SAMPLE_SIZE, 0);
    hash.update(headBuf.subarray(0, headRead.bytesRead));

    // 2. Middle sample
    const midPos = Math.floor(fileSize / 2) - Math.floor(SAMPLE_SIZE / 2);
    const midBuf = Buffer.alloc(SAMPLE_SIZE);
    const midRead = await handle.read(midBuf, 0, SAMPLE_SIZE, midPos);
    hash.update(midBuf.subarray(0, midRead.bytesRead));

    // 3. Tail sample
    const tailPos = Math.max(0, fileSize - SAMPLE_SIZE);
    const tailBuf = Buffer.alloc(SAMPLE_SIZE);
    const tailRead = await handle.read(tailBuf, 0, SAMPLE_SIZE, tailPos);
    hash.update(tailBuf.subarray(0, tailRead.bytesRead));

    await handle.close();
    return hash.digest("hex");
  } catch {
    if (handle) {
      try { await handle.close(); } catch {}
    }
    return null;
  }
}

/**
 * High-level hashing coordinator based on strategy and size
 *
 * @param {string} filePath
 * @param {number} fileSize
 * @param {Object} options
 * @returns {Promise<string|null>}
 */
async function computeFileHash(filePath, fileSize, options = {}) {
  const strategy = options.hashStrategy || HashStrategy.FULL_STREAM;
  const maxMb = options.maxHashFileSizeMb || 100;
  const maxBytes = maxMb * 1024 * 1024;

  if (strategy === HashStrategy.NONE) {
    return null;
  }

  if (strategy === HashStrategy.FAST_SAMPLE || (fileSize > maxBytes && strategy === HashStrategy.FULL_STREAM)) {
    return computeSampleHash(filePath, fileSize);
  }

  return computeStreamHash(filePath, options);
}

module.exports = {
  computeStreamHash,
  computeSampleHash,
  computeFileHash,
};
