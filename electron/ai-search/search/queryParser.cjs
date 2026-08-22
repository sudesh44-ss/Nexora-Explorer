"use strict";

const FILE_TYPE_MAP = {
  pdf: ["pdf"],
  pdfs: ["pdf"],
  photo: ["image"],
  photos: ["image"],
  image: ["image"],
  images: ["image"],
  pic: ["image"],
  pics: ["image"],
  picture: ["image"],
  pictures: ["image"],
  video: ["video"],
  videos: ["video"],
  movie: ["video"],
  movies: ["video"],
  audio: ["audio"],
  song: ["audio"],
  songs: ["audio"],
  music: ["audio"],
  doc: ["docx", "doc"],
  docs: ["docx", "doc"],
  docx: ["docx"],
  word: ["docx", "doc"],
  code: ["code"],
  script: ["code"],
  scripts: ["code"],
  zip: ["archive"],
  archive: ["archive"],
};

// Conversational filler & framing words (English + Hindi / Hinglish common search stop words)
const STOP_WORDS = new Set([
  "mere", "meri", "mera", "ke", "ki", "ka", "ko", "se", "mein", "par",
  "wali", "wale", "wala", "do", "dikhaye", "karo", "hai", "hain", "aur",
  "find", "show", "get", "please", "search", "give", "me", "all", "my",
  "files", "file", "document", "documents", "the", "a", "an", "and", "or", "in", "of", "to", "for", "with"
]);

/**
 * Lightweight token and pattern-based query parser
 */
class QueryParser {
  static parse(rawQuery) {
    if (!rawQuery || typeof rawQuery !== "string") {
      return { keywords: [], fileTypes: [], semanticQuery: "" };
    }

    const cleaned = rawQuery.trim().toLowerCase();
    const tokens = cleaned.replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);

    const detectedTypes = new Set();
    const meaningfulKeywords = [];

    for (const t of tokens) {
      if (FILE_TYPE_MAP[t]) {
        for (const type of FILE_TYPE_MAP[t]) {
          detectedTypes.add(type);
        }
      } else if (!STOP_WORDS.has(t)) {
        meaningfulKeywords.push(t);
      }
    }

    // Fallback: If all tokens were filtered as stop words, keep original non-punctuation tokens
    const finalKeywords = meaningfulKeywords.length > 0
      ? meaningfulKeywords
      : tokens.filter((t) => !FILE_TYPE_MAP[t]);

    const semanticQuery = finalKeywords.join(" ").trim() || cleaned;

    return {
      keywords: finalKeywords,
      fileTypes: Array.from(detectedTypes),
      semanticQuery,
    };
  }
}

module.exports = {
  QueryParser,
  FILE_TYPE_MAP,
  STOP_WORDS,
};
