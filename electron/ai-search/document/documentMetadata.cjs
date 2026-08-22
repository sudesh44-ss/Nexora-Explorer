"use strict";

const DocumentType = Object.freeze({
  INVOICE: "invoice",
  RECEIPT: "receipt",
  RESUME: "resume",
  LETTER: "letter",
  REPORT: "report",
  NOTES: "notes",
  BOOK: "book",
  FORM: "form",
  PRESENTATION: "presentation",
  UNKNOWN: "unknown",
});

const EntityType = Object.freeze({
  ORGANIZATION: "organization",
  DATE: "date",
  MONEY: "money",
  EMAIL: "email",
  PHONE: "phone",
  DOCUMENT_ID: "document_id",
});

module.exports = {
  DocumentType,
  EntityType,
};
