"use strict";

const os = require("os");

/**
 * Hardware Capability Tiers
 */
const HardwareTier = Object.freeze({
  LOW: "LOW",         // < 8GB RAM, <= 4 cores -> Lightweight models & throttled indexing
  MEDIUM: "MEDIUM",   // 8-16GB RAM, 4-8 cores -> Balanced local embedding, OCR & Vision
  HIGH: "HIGH",       // > 16GB RAM, >= 8 cores -> Full multi-modal vision, large context & fast parallel vectors
});

/**
 * Hardware Interface & Inspector
 */
class HardwareInterface {
  constructor() {
    this._cachedProfile = null;
  }

  /**
   * Evaluates the hardware specifications and determines capability tier
   * @returns {Object} Hardware profile
   */
  getProfile() {
    if (this._cachedProfile) {
      return this._cachedProfile;
    }

    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const totalMemGb = Math.round((totalMemBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const freeMemGb = Math.round((freeMemBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const cpus = os.cpus() || [];
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || "Generic CPU";
    const cpuSpeed = cpus[0]?.speed || 0;
    const arch = os.arch();
    const platform = os.platform();

    let tier = HardwareTier.LOW;
    let recommendedEmbeddingModel = "bge-small-en-v1.5";
    let maxRecommendedWorkers = 1;

    if (totalMemGb >= 15.5 && cpuCount >= 8) {
      tier = HardwareTier.HIGH;
      recommendedEmbeddingModel = "bge-small-en-v1.5";
      maxRecommendedWorkers = Math.min(4, Math.floor(cpuCount / 2));
    } else if (totalMemGb >= 7.5 && cpuCount >= 4) {
      tier = HardwareTier.MEDIUM;
      recommendedEmbeddingModel = "bge-small-en-v1.5";
      maxRecommendedWorkers = 2;
    } else {
      tier = HardwareTier.LOW;
      recommendedEmbeddingModel = "all-minilm-l6-v2";
      maxRecommendedWorkers = 1;
    }

    this._cachedProfile = {
      platform,
      arch,
      cpuModel,
      cpuCount,
      cpuSpeed,
      totalMemBytes,
      freeMemBytes,
      totalMemGb,
      freeMemGb,
      tier,
      recommendedEmbeddingModel,
      recommendedVisionModel: "clip-vit-base-patch32",
      recommendedOCRModel: "trocr-small-printed",
      recommendedAudioModel: "whisper-tiny",
      maxRecommendedWorkers,
      hasGpuAcceleration: false,
      vramGb: 0,
      canRunVision: totalMemGb >= 4.0,
      canRunOCR: totalMemGb >= 4.0,
      canRunAudio: totalMemGb >= 4.0,
      canRunParallelIndexing: cpuCount >= 4 && totalMemGb >= 8.0,
      summary: `${cpuModel} (${cpuCount} cores), ${totalMemGb} GB RAM (${tier} Tier)`,
      timestamp: new Date().toISOString(),
    };

    return this._cachedProfile;
  }

  getTier() {
    return this.getProfile().tier;
  }

  invalidateCache() {
    this._cachedProfile = null;
  }
}

module.exports = {
  HardwareTier,
  HardwareInterface,
};
