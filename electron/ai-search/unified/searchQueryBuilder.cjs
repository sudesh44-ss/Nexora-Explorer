"use strict";

class SearchQueryBuilder {
  /**
   * Constructs search options from QueryUnderstanding structured query
   */
  static buildSearchContext(structuredQuery) {
    if (!structuredQuery) {
      return { keywords: [], filters: {}, semanticQuery: "" };
    }

    const keywords = Array.isArray(structuredQuery.keywords) ? structuredQuery.keywords : [];
    const filters = {};

    if (structuredQuery.filters?.fileTypes && structuredQuery.filters.fileTypes.length > 0) {
      filters.fileTypes = structuredQuery.filters.fileTypes;
    }

    if (structuredQuery.filters?.dateRange) {
      filters.dateRange = structuredQuery.filters.dateRange;
    }

    if (structuredQuery.filters?.folderHint) {
      filters.folder = structuredQuery.filters.folderHint;
    }

    const semanticQuery = structuredQuery.semanticQuery || keywords.join(" ");

    return {
      keywords,
      filters,
      semanticQuery,
      concepts: structuredQuery.concepts || [],
    };
  }
}

module.exports = {
  SearchQueryBuilder,
};
