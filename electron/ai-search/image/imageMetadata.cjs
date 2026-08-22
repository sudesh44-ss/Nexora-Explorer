"use strict";

class ImageMetadata {
  /**
   * Derives orientation from dimensions
   */
  static getOrientation(width, height) {
    if (!width || !height) return "unknown";
    if (width > height) return "landscape";
    if (height > width) return "portrait";
    return "square";
  }

  /**
   * Computes aspect ratio string e.g. "16:9", "4:3", "1:1"
   */
  static getAspectRatio(width, height) {
    if (!width || !height) return null;
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  /**
   * Extracts and formats indexed image metadata
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

    const width = fileRecord.width || aiMeta.width || null;
    const height = fileRecord.height || aiMeta.height || null;
    const orientation = this.getOrientation(width, height);
    const aspectRatio = this.getAspectRatio(width, height);

    // Safely retrieve EXIF if stored in aiRecord / fileRecord metadata without raw GPS exposure
    const rawExif = aiMeta.exif || fileRecord.metadata?.exif || {};
    const hasLocation = Boolean(rawExif.latitude && rawExif.longitude);

    return {
      width,
      height,
      orientation,
      aspectRatio,
      camera: rawExif.camera || rawExif.model || null,
      dateTaken: rawExif.dateTaken || rawExif.dateTimeOriginal || null,
      hasLocation,
      isScreenshot: Boolean(aiMeta.isScreenshot || fileRecord.name?.toLowerCase().includes("screenshot")),
    };
  }
}

module.exports = {
  ImageMetadata,
};
