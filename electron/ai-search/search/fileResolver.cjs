"use strict";

const fs = require("fs");
const { createSearchResult } = require("./searchResult.cjs");

/**
 * Resolves file IDs through SQLite and validates actual filesystem presence
 */
class FileResolver {
  /**
   * Resolves ranked candidates to verified SearchResult items
   *
   * @param {Array<Object>} rankedCandidates
   * @param {import("../database/databaseManager.cjs").DatabaseManager} db
   * @param {Object} [options]
   * @returns {Array<import("./searchResult.cjs").SearchResult>}
   */
  static resolve(rankedCandidates = [], db, options = {}) {
    if (!Array.isArray(rankedCandidates) || rankedCandidates.length === 0) {
      return [];
    }

    const verifyDisk = options.verifyFilesystem !== false;
    const finalLimit = Math.min(options.limit || 20, 100);
    const results = [];

    for (const c of rankedCandidates) {
      let fileRecord = c.fileRecord;

      // 1. Fetch file record from SQLite if missing
      if (!fileRecord && db && db.isOpen && db.files) {
        fileRecord = db.files.findByFileId(c.fileId);
      }

      if (!fileRecord) {
        continue;
      }

      // 2. Validate filesystem existence
      if (verifyDisk && fileRecord.path) {
        if (!fs.existsSync(fileRecord.path)) {
          // File was deleted on disk -> exclude from results
          continue;
        }
      }

      // 3. Construct SearchResult
      results.push(
        createSearchResult({
          fileId: fileRecord.file_id,
          name: fileRecord.name,
          path: fileRecord.path,
          extension: fileRecord.extension,
          mimeType: fileRecord.mime_type,
          size: fileRecord.size,
          modifiedAt: fileRecord.modified_at,
          score: c.score,
          matchedBy: c.matchedBy,
          scoreBreakdown: c.scoreBreakdown,
        })
      );

      if (results.length >= finalLimit) {
        break;
      }
    }

    return results;
  }
}

module.exports = {
  FileResolver,
};
