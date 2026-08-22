"use strict";

class SecurityDiagnostics {
  constructor() {
    this.blockedQueries = 0;
    this.pathTraversalAttempts = 0;
    this.ftsRepairedQueries = 0;
  }

  recordBlockedQuery() {
    this.blockedQueries++;
  }

  recordPathTraversalAttempt() {
    this.pathTraversalAttempts++;
  }

  recordFtsRepair() {
    this.ftsRepairedQueries++;
  }

  getSummary() {
    return {
      blockedQueries: this.blockedQueries,
      pathTraversalAttempts: this.pathTraversalAttempts,
      ftsRepairedQueries: this.ftsRepairedQueries,
    };
  }
}

module.exports = {
  SecurityDiagnostics,
};
