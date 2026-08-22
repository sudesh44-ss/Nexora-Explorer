"use strict";

const { ContextResolver } = require("./contextResolver.cjs");
const { ContextResultAdapter } = require("./contextResultAdapter.cjs");
const { QueryState } = require("./queryState.cjs");

class SearchContext {
  constructor(options = {}) {
    this.resolver = new ContextResolver(options.queryUnderstanding);
    this.activeState = QueryState.create();
    this.historyStack = [];
    this.maxHistory = options.maxHistory || 20;
  }

  /**
   * Pushes a new turn into the search context session
   *
   * @param {string} rawQuery - Incoming search or refinement turn
   * @param {Object} [options]
   * @returns {{resolvedState: Object, structuredQuery: Object, diagnostics: Object}}
   */
  pushQuery(rawQuery = "", options = {}) {
    if (this.activeState && this.activeState.rawQuery) {
      this.historyStack.push(this.activeState);
      if (this.historyStack.length > this.maxHistory) {
        this.historyStack.shift();
      }
    }

    const { resolvedState, diagnostics } = this.resolver.resolve(rawQuery, this.activeState, options);
    this.activeState = resolvedState;
    const structuredQuery = ContextResultAdapter.toStructuredQuery(this.activeState);

    return {
      resolvedState: this.activeState,
      structuredQuery,
      diagnostics,
    };
  }

  /**
   * Back navigation: restores previous search state in session
   */
  popQuery() {
    if (this.historyStack.length === 0) {
      this.activeState = QueryState.create();
      return this.activeState;
    }
    this.activeState = this.historyStack.pop();
    return this.activeState;
  }

  /**
   * Resets active search context session
   */
  clear() {
    this.activeState = QueryState.create();
    this.historyStack = [];
    return this.activeState;
  }

  /**
   * Returns current active structured query
   */
  getStructuredQuery() {
    return ContextResultAdapter.toStructuredQuery(this.activeState);
  }
}

module.exports = {
  SearchContext,
};
