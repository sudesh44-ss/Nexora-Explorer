"use strict";

class SearchScheduler {
  constructor() {
    this.activeSearchCount = 0;
  }

  /**
   * Called when a user search begins
   */
  startSearch() {
    this.activeSearchCount++;
  }

  /**
   * Called when a user search ends
   */
  endSearch() {
    this.activeSearchCount = Math.max(0, this.activeSearchCount - 1);
  }

  /**
   * Checks if background workers should yield for active user searches
   */
  shouldBackgroundYield() {
    return this.activeSearchCount > 0;
  }
}

module.exports = {
  SearchScheduler,
};
