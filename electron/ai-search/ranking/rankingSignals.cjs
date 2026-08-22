"use strict";

const path = require("path");

class RankingSignals {
  /**
   * Evaluates filename signals (exact, stem, partial substring, token overlap)
   */
  static computeFilenameScores(fileRecord, rawQuery, keywords = []) {
    if (!fileRecord || !fileRecord.name || !rawQuery) {
      return { exact: 0.0, partial: 0.0, matchedName: false };
    }

    const name = fileRecord.name.toLowerCase().trim();
    const query = rawQuery.toLowerCase().trim();
    const stem = path.parse(fileRecord.name).name.toLowerCase();

    // 1. Exact Full Match: "birthday.jpg" === "birthday.jpg"
    if (name === query) {
      return { exact: 1.0, partial: 1.0, matchedName: true };
    }

    // 2. Stem Match (Exact name without extension): "invoice" === "invoice.pdf"
    if (stem === query) {
      return { exact: 0.95, partial: 0.95, matchedName: true };
    }

    // 3. Substring match: "invoice" inside "Amazon_Invoice_2025.pdf"
    if (name.includes(query) || stem.includes(query)) {
      return { exact: 0.0, partial: 0.85, matchedName: true };
    }

    // 4. Token Overlap
    const nameTokens = stem.split(/[\s_\-\.]+/).filter(Boolean);
    let matchedTokens = 0;
    const queryTokens = keywords.length > 0 ? keywords : query.split(/[\s_\-\.]+/).filter(Boolean);

    for (const qt of queryTokens) {
      if (nameTokens.some((nt) => nt.includes(qt.toLowerCase()) || qt.toLowerCase().includes(nt))) {
        matchedTokens++;
      }
    }

    const tokenScore = queryTokens.length > 0 ? (matchedTokens / queryTokens.length) * 0.70 : 0.0;
    return {
      exact: 0.0,
      partial: tokenScore,
      matchedName: tokenScore > 0,
    };
  }

  /**
   * Evaluates exact phrase matches
   */
  static computePhraseScore(searchableText, phrases = []) {
    if (!searchableText || !Array.isArray(phrases) || phrases.length === 0) {
      return 0.0;
    }

    const text = searchableText.toLowerCase();
    let matchedPhrases = 0;

    for (const p of phrases) {
      if (text.includes(p.toLowerCase())) {
        matchedPhrases++;
      }
    }

    return matchedPhrases / phrases.length;
  }

  /**
   * Evaluates query term coverage (how many query concepts/keywords appear in the item)
   */
  static computeCoverage(searchableText, queryTerms = []) {
    if (!searchableText || !Array.isArray(queryTerms) || queryTerms.length === 0) {
      return 0.5;
    }

    const text = searchableText.toLowerCase();
    let matches = 0;

    for (const term of queryTerms) {
      if (text.includes(term.toLowerCase())) {
        matches++;
      }
    }

    return matches / queryTerms.length;
  }

  /**
   * Evaluates folder match
   */
  static computeFolderScore(fileRecord, folderHints = []) {
    if (!fileRecord || !fileRecord.path || !Array.isArray(folderHints) || folderHints.length === 0) {
      return 0.0;
    }

    const dir = path.dirname(fileRecord.path).toLowerCase();
    for (const hint of folderHints) {
      if (dir.includes(hint.toLowerCase())) {
        return 1.0;
      }
    }

    return 0.0;
  }

  /**
   * Evaluates file type match
   */
  static computeFileTypeScore(fileRecord, requestedTypes = []) {
    if (!fileRecord || !Array.isArray(requestedTypes) || requestedTypes.length === 0) {
      return 1.0; // No filter requested -> neutral pass
    }

    const ext = (fileRecord.extension || path.extname(fileRecord.name || "")).toLowerCase();
    const cleanExt = ext.replace(/^\./, "");
    const mime = (fileRecord.mime_type || "").toLowerCase();

    for (const req of requestedTypes) {
      const r = req.toLowerCase().replace(/^\./, "");
      if (cleanExt === r || ext === `.${r}`) return 1.0;

      if (r === "image" && (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(cleanExt))) return 1.0;
      if (r === "video" && (mime.startsWith("video/") || ["mp4", "mkv", "avi", "mov", "webm"].includes(cleanExt))) return 1.0;
      if (r === "audio" && (mime.startsWith("audio/") || ["mp3", "wav", "flac", "m4a", "ogg"].includes(cleanExt))) return 1.0;
      if (r === "pdf" && (cleanExt === "pdf" || mime === "application/pdf")) return 1.0;
      if (r === "document" && ["pdf", "docx", "doc", "txt", "rtf", "odt", "md"].includes(cleanExt)) return 1.0;
    }

    return 0.0;
  }
}

module.exports = {
  RankingSignals,
};
