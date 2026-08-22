"use strict";

const FILE_TYPE_MAP = {
  pdf: "pdf",
  pdfs: "pdf",
  photo: "image",
  photos: "image",
  image: "image",
  images: "image",
  picture: "image",
  pictures: "image",
  pic: "image",
  pics: "image",
  "फोटो": "image",
  "तस्वीर": "image",
  "तस्वीरें": "image",

  video: "video",
  videos: "video",
  movie: "video",
  movies: "video",
  clip: "video",
  clips: "video",
  "वीडियो": "video",

  audio: "audio",
  song: "audio",
  songs: "audio",
  music: "audio",
  "गाना": "audio",
  "गाने": "audio",

  doc: "document",
  docs: "document",
  docx: "document",
  document: "document",
  documents: "document",
  word: "document",
  "दस्तावेज़": "document",

  code: "code",
  script: "code",
  scripts: "code",
  zip: "archive",
  archive: "archive",
  rar: "archive",
};

class FileTypeDetector {
  /**
   * Detects explicit requested file types from query tokens
   *
   * @param {string} normalizedQuery
   * @returns {{fileTypes: Array<string>, confidence: number}}
   */
  static detect(normalizedQuery) {
    if (!normalizedQuery) {
      return { fileTypes: [], confidence: 1.0 };
    }

    const tokens = normalizedQuery.replace(/[^\w\s\u0900-\u097F]/g, " ").split(/\s+/).filter(Boolean);
    const types = new Set();

    for (const t of tokens) {
      const lower = t.toLowerCase();
      if (FILE_TYPE_MAP[lower]) {
        types.add(FILE_TYPE_MAP[lower]);
      }
    }

    const detected = Array.from(types);
    return {
      fileTypes: detected,
      confidence: detected.length > 0 ? 0.95 : 1.0,
    };
  }
}

module.exports = {
  FILE_TYPE_MAP,
  FileTypeDetector,
};
