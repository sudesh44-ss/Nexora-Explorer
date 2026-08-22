"use strict";

const { InputValidator } = require("./inputValidator.cjs");
const { QuerySanitizer } = require("./querySanitizer.cjs");
const { FtsGuard } = require("./ftsGuard.cjs");
const { PathGuard } = require("./pathGuard.cjs");
const { SymlinkGuard } = require("./symlinkGuard.cjs");
const { FilesystemGuard } = require("./filesystemGuard.cjs");
const { IpcGuard } = require("./ipcGuard.cjs");
const { ErrorBoundary, ERROR_CATEGORIES } = require("./errorBoundary.cjs");
const { WorkerGuard } = require("./workerGuard.cjs");
const { CacheIntegrityGuard } = require("./cacheIntegrityGuard.cjs");
const { DatabaseRecovery } = require("./databaseRecovery.cjs");
const { SecurityDiagnostics } = require("./securityDiagnostics.cjs");

class HardeningAdapter {
  constructor(options = {}) {
    this.symlinkGuard = new SymlinkGuard();
    this.workerGuard = new WorkerGuard(options);
    this.diagnostics = new SecurityDiagnostics();
  }

  /**
   * Hardens raw search input before parsing
   */
  hardenQuery(rawQuery) {
    const valResult = InputValidator.validateQuery(rawQuery);
    if (!valResult.valid) {
      this.diagnostics.recordBlockedQuery();
      return "";
    }

    const sanitized = QuerySanitizer.sanitize(valResult.query);
    const ftsClean = FtsGuard.cleanFtsExpression(sanitized);

    if (ftsClean !== rawQuery) {
      this.diagnostics.recordFtsRepair();
    }

    return ftsClean;
  }

  /**
   * Checks if folder scope escapes root
   */
  isSafePath(targetPath, rootPath) {
    const isSafe = PathGuard.isPathInsideRoot(targetPath, rootPath);
    if (!isSafe) {
      this.diagnostics.recordPathTraversalAttempt();
    }
    return isSafe;
  }
}

module.exports = {
  HardeningAdapter,
  InputValidator,
  QuerySanitizer,
  FtsGuard,
  PathGuard,
  SymlinkGuard,
  FilesystemGuard,
  IpcGuard,
  ErrorBoundary,
  ERROR_CATEGORIES,
  WorkerGuard,
  CacheIntegrityGuard,
  DatabaseRecovery,
  SecurityDiagnostics,
};
