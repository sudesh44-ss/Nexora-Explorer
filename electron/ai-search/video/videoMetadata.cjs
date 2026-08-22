"use strict";

class VideoMetadata {
  /**
   * Derives friendly resolution label from dimensions
   */
  static getResolutionLabel(width, height) {
    if (!width || !height) return "unknown";
    const maxDim = Math.max(width, height);
    if (maxDim >= 3840) return "4k";
    if (maxDim >= 1920) return "1080p";
    if (maxDim >= 1280) return "720p";
    return "sd";
  }

  /**
   * Extracts indexed video metadata safely
   */
  static extract(fileRecord, aiRecord = null) {
    if (!fileRecord) return null;

    let aiMeta = {};
    if (typeof aiRecord?.entities === "string") {
      try {
        aiMeta = JSON.parse(aiRecord.entities);
      } catch {}
    } else if (typeof aiRecord?.metadata === "string") {
      try {
        aiMeta = JSON.parse(aiRecord.metadata);
      } catch {}
    } else if (aiRecord?.entities && typeof aiRecord.entities === "object") {
      aiMeta = aiRecord.entities;
    } else if (aiRecord?.metadata && typeof aiRecord.metadata === "object") {
      aiMeta = aiRecord.metadata;
    }

    const duration = typeof fileRecord.duration === "number" ? fileRecord.duration : (aiMeta.duration || null);
    const width = fileRecord.width || aiMeta.width || null;
    const height = fileRecord.height || aiMeta.height || null;
    const fps = fileRecord.fps || aiMeta.fps || null;
    const codec = fileRecord.codec || aiMeta.codec || null;
    const hasAudio = fileRecord.hasAudio !== undefined ? fileRecord.hasAudio : (aiMeta.hasAudio !== undefined ? aiMeta.hasAudio : true);

    return {
      duration,
      width,
      height,
      resolution: this.getResolutionLabel(width, height),
      fps,
      codec,
      hasAudio,
    };
  }
}

module.exports = {
  VideoMetadata,
};
