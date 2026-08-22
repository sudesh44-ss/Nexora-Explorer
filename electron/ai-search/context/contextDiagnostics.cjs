"use strict";

class ContextDiagnostics {
  /**
   * Generates a diagnostic report of a context resolution step
   */
  static generateReport(prevState, incomingQuery, actionType, resolvedState) {
    return {
      previousQuery: prevState?.rawQuery || null,
      incomingQuery: incomingQuery || "",
      actionDetected: actionType || "NEW",
      resolvedQuery: resolvedState?.rawQuery || "",
      activeFileTypes: resolvedState?.fileTypes || [],
      hasDurationFilter: Boolean(resolvedState?.durationFilter),
      hasDateFilter: Boolean(resolvedState?.dateFilter),
      hasSizeFilter: Boolean(resolvedState?.sizeFilter),
      hasContradiction: Boolean(resolvedState?.contradiction),
    };
  }
}

module.exports = {
  ContextDiagnostics,
};
