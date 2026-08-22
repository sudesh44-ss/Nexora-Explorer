"use strict";

const { QueryNormalizer } = require("./queryNormalizer.cjs");
const { QueryLanguageDetector } = require("./queryLanguage.cjs");
const { QueryParser } = require("./queryParser.cjs");
const { QuerySizeParser } = require("./querySizeParser.cjs");
const { QueryDateParser } = require("./queryDateParser.cjs");
const { QueryEntitiesExtractor } = require("./queryEntities.cjs");
const { QueryFallback, MAX_QUERY_LENGTH } = require("./queryFallback.cjs");
const { IntentDetector } = require("./intentDetector.cjs");
const { FileTypeDetector } = require("./fileTypeDetector.cjs");
const { ConceptExtractor } = require("./conceptExtractor.cjs");
const { FolderHintDetector } = require("./folderHintDetector.cjs");
const { SemanticQueryBuilder } = require("./semanticQueryBuilder.cjs");
const { QueryValidator } = require("./queryValidator.cjs");
const { createStructuredQuery, QueryIntent } = require("./querySchema.cjs");
const { LLMQueryAdapter } = require("./llmQueryAdapter.cjs");

/**
 * Central Query Understanding Engine converting natural language into structured search parameters
 */
class QueryUnderstanding {
  constructor(options = {}) {
    this.llmAdapter = new LLMQueryAdapter(options.llm);
    this.options = options;
  }

  /**
   * Understands and parses a natural language query into a validated StructuredQuery
   *
   * @param {string} rawQuery - Natural user input
   * @param {Object} [options]
   * @returns {Object} StructuredQuery
   */
  understand(rawQuery, options = {}) {
    const startTime = Date.now();

    // 1. Sanitize & Length Protect
    const sanitized = QueryFallback.sanitizeInput(rawQuery);
    if (!sanitized) {
      return createStructuredQuery({ rawQuery: "", normalizedQuery: "" });
    }

    // 2. Normalize query
    const { rawQuery: raw, normalizedQuery } = QueryNormalizer.normalize(sanitized);

    // 3. Detect Language (English, Hindi, Hinglish, Mixed)
    const language = QueryLanguageDetector.detect(raw);

    // 4. Parse Boolean expressions, quoted phrases, and explicit search operators
    const parsed = QueryParser.parse(raw);

    // 5. Extract File Types & Extensions
    const typeDetect = FileTypeDetector.detect(parsed.cleanedQuery || normalizedQuery);
    let fileTypes = [...typeDetect.fileTypes];
    if (parsed.operators.type) {
      fileTypes.push(parsed.operators.type.toLowerCase());
    }
    if (parsed.operators.ext) {
      const ext = parsed.operators.ext.startsWith(".") ? parsed.operators.ext : `.${parsed.operators.ext}`;
      fileTypes.push(ext.toLowerCase());
    }
    fileTypes = Array.from(new Set(fileTypes));

    // 6. Parse Sizes
    const sizeFilter = QuerySizeParser.parse(raw);

    // 7. Parse Dates (Explicit + Relative + Created vs Modified)
    const dateFilter = QueryDateParser.parse(raw, options.referenceDate || new Date());

    // 8. Extract Multimodal Entities, Objects, Scenes, People
    const entitiesResult = QueryEntitiesExtractor.extract(raw);

    // 9. Extract Search Concepts & Keywords
    const { concepts, keywords } = ConceptExtractor.extract(parsed.cleanedQuery || normalizedQuery);

    // 10. Detect Folder Context Hints
    let folderHints = FolderHintDetector.detect(parsed.cleanedQuery || normalizedQuery, concepts);
    if (parsed.operators.folder) {
      folderHints.push(parsed.operators.folder);
    }
    folderHints = Array.from(new Set(folderHints));

    // 11. Detect Search Intent
    let { intent, confidence: intentConfidence } = IntentDetector.detect(normalizedQuery, fileTypes);
    if (sizeFilter) intent = QueryIntent.FILTERED_SEARCH;
    if (parsed.operators.name) intent = QueryIntent.EXACT_SEARCH;

    // 12. Construct focused Semantic Query for Vector Search
    const semanticQuery = SemanticQueryBuilder.build(concepts, fileTypes, raw);

    // 13. Build Structured Query
    const structured = createStructuredQuery({
      rawQuery: raw,
      normalizedQuery,
      language,
      intent,
      concepts,
      keywords,
      phrases: parsed.phrases,
      fileTypes,
      folderHints,
      dateFilter,
      sizeFilter,
      metadataFilters: {
        ...(options.metadataFilters || {}),
        ...parsed.operators,
      },
      semanticQuery,
      objects: entitiesResult.objects,
      scenes: entitiesResult.scenes,
      entities: {
        organization: entitiesResult.organization,
        documentType: entitiesResult.documentType,
        money: entitiesResult.money,
      },
      containsPeople: entitiesResult.containsPeople,
      boolean: parsed.boolean,
      confidence: {
        intent: intentConfidence,
        fileTypes: typeDetect.confidence,
        date: dateFilter?.confidence || 1.0,
        overall: Number(((intentConfidence + typeDetect.confidence + (dateFilter?.confidence || 1.0)) / 3).toFixed(2)),
      },
      diagnostics: {
        parseMode: "local",
        tookMs: Date.now() - startTime,
      },
    });

    // 14. Strict schema validation
    QueryValidator.assertValid(structured);

    return structured;
  }

  /**
   * Convenient alias for understand
   */
  parse(rawQuery, options = {}) {
    return this.understand(rawQuery, options);
  }

  /**
   * Bridges StructuredQuery to Part 9/15 SearchQuery contract for direct SearchEngine execution
   */
  toSearchQuery(rawQuery, options = {}) {
    const understood = this.understand(rawQuery, options);

    return {
      rawQuery: understood.rawQuery,
      keywords: understood.keywords,
      semanticQuery: understood.semanticQuery,
      filters: {
        fileTypes: understood.fileTypes,
        folderHints: understood.folderHints,
        dateFilter: understood.dateFilter,
        sizeFilter: understood.sizeFilter,
        boolean: understood.boolean,
        ...(options.filters || {}),
      },
      limit: Math.min(options.limit || 20, 100),
      options: {
        useFts: options.useFts !== false,
        useVector: options.useVector !== false,
        useMetadata: options.useMetadata !== false,
        ...options,
      },
      _understood: understood,
    };
  }
}

module.exports = {
  QueryUnderstanding,
};
