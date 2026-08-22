"use strict";

const { DocumentType } = require("./documentMetadata.cjs");

class DocumentClassifier {
  static classify(text, fileName = "") {
    if (!text && !fileName) return { type: DocumentType.UNKNOWN, confidence: 0 };
    const content = `${fileName} ${text || ""}`.toLowerCase();

    // 1. Invoice detection
    if (content.includes("invoice") || content.includes("tax invoice") || content.includes("bill to") || content.includes("gstin")) {
      return { type: DocumentType.INVOICE, confidence: 0.95 };
    }

    // 2. Receipt detection
    if (content.includes("receipt") || content.includes("payment received") || content.includes("total paid") || content.includes("cashier")) {
      return { type: DocumentType.RECEIPT, confidence: 0.90 };
    }

    // 3. Resume / CV detection
    if (content.includes("resume") || content.includes("curriculum vitae") || (content.includes("experience") && content.includes("education") && content.includes("skills"))) {
      return { type: DocumentType.RESUME, confidence: 0.92 };
    }

    // 4. Report detection
    if (content.includes("annual report") || content.includes("quarterly report") || content.includes("executive summary")) {
      return { type: DocumentType.REPORT, confidence: 0.85 };
    }

    return { type: DocumentType.UNKNOWN, confidence: 0.3 };
  }
}

module.exports = {
  DocumentClassifier,
};
