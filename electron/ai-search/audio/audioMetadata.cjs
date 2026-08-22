"use strict";

class AudioMetadata {
  /**
   * Extracts indexed audio metadata safely from FileRecord and AIRecord
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
    const bitrate = fileRecord.bitrate || aiMeta.bitrate || null;
    const sampleRate = fileRecord.sampleRate || aiMeta.sampleRate || null;
    const channels = fileRecord.channels || aiMeta.channels || null;
    const codec = fileRecord.codec || aiMeta.codec || null;

    // Music/ID3 metadata
    const music = aiMeta.musicMetadata || aiMeta.music || fileRecord.music || {};
    const title = music.title || null;
    const artist = music.artist || null;
    const album = music.album || null;
    const genre = music.genre || null;
    const year = music.year || null;

    return {
      duration,
      bitrate,
      sampleRate,
      channels,
      codec,
      title,
      artist,
      album,
      genre,
      year,
    };
  }
}

module.exports = {
  AudioMetadata,
};
