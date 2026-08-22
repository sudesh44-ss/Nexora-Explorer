"use strict";

const { DocumentClassifier } = require("./documentClassifier.cjs");
const { EntityExtractor } = require("./entityExtractor.cjs");
const { createDocumentResult } = require("./documentResult.cjs");

class DocumentAnalyzer {
  /**
   * Performs high-level document analysis on OCR or extracted text
   */
  static analyzeDocument(text, fileName = "") {
    const classification = DocumentClassifier.classify(text, fileName);
    const entities = EntityExtractor.extractEntities(text);

    return createDocumentResult({
      success: true,
      documentType: classification.type,
      confidence: classification.confidence,
      title: fileName || null,
      entities,
      summary: text ? text.slice(0, 200).trim() : null,
    });
  }
}

module.exports = {
  DocumentAnalyzer,
};
