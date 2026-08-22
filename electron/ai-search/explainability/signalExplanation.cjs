"use strict";

class SignalExplanation {
  /**
   * Translates an evidence item into a concise human-readable explanation line
   */
  static describe(evidence = {}) {
    const src = evidence.source || "retrieval";
    const term = evidence.term || evidence.text || "";

    switch (src) {
      case "exact_phrase":
      case "phrase":
        return term ? `Exact phrase matched: "${term}"` : "Exact phrase matched in content";
      case "transcript":
        return term ? `Transcript contains: "${term}"` : "Speech transcript matched";
      case "ocr":
      case "video_ocr":
      case "image_ocr":
        return term ? `Detected text: "${term}"` : "Text recognized in visual content";
      case "vision_object":
      case "object":
        return term ? `Visual object detected: ${term}` : "Visual object matched";
      case "scene":
        return term ? `Scene recognized: ${term}` : "Scene setting matched";
      case "filename":
        return term ? `File name matches: "${term}"` : "File name matches query";
      case "fts":
      case "text":
        return term ? `Document text contains: "${term}"` : "Document text matched";
      case "semantic":
      case "vector":
        return "Semantically related to query concept";
      case "speaker":
        return term ? `Spoken by: ${term}` : "Speaker identified";
      case "music_metadata":
        return term ? `Music metadata matches: ${term}` : "Audio metadata matched";
      default:
        return term ? `Matched keyword: "${term}"` : "Matched query criteria";
    }
  }
}

module.exports = {
  SignalExplanation,
};
