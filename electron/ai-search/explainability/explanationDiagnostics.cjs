"use strict";

class ExplanationDiagnostics {
  /**
   * Generates diagnostic summary for zero-results or overall search execution
   */
  static generateZeroResultReport(structuredQuery = {}, filterDiagnostics = {}) {
    let reason = "No matching files found for the query.";

    if (structuredQuery.fileTypes?.length > 0 && structuredQuery.durationFilter) {
      reason = `No ${structuredQuery.fileTypes.join(", ")} files found matching duration constraint.`;
    } else if (structuredQuery.fileTypes?.length > 0) {
      reason = `No ${structuredQuery.fileTypes.join(", ")} files found matching '${structuredQuery.rawQuery}'.`;
    } else if (structuredQuery.sizeFilter) {
      reason = "No files found satisfying the active size filter.";
    } else if (structuredQuery.dateFilter) {
      reason = "No files found within the specified date range.";
    }

    return {
      zeroResults: true,
      reason,
      activeQuery: structuredQuery.rawQuery || "",
      activeFilters: {
        fileTypes: structuredQuery.fileTypes || [],
        hasDurationFilter: Boolean(structuredQuery.durationFilter),
        hasDateFilter: Boolean(structuredQuery.dateFilter),
        hasSizeFilter: Boolean(structuredQuery.sizeFilter),
      },
    };
  }
}

module.exports = {
  ExplanationDiagnostics,
};
