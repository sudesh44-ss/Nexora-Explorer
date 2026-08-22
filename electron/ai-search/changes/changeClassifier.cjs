"use strict";

const fs = require("fs");
const { ChangeType } = require("./changeEvents.cjs");

class ChangeClassifier {
  /**
   * Classifies a filesystem change into a definitive ChangeType
   *
   * @param {string} filePath - Absolute path
   * @param {Object|null} existingRecord - SQLite FileRecord
   * @param {Function} [computeHashFn] - Hashing function
   * @returns {Promise<{changeType: string, newHash: string|null, isPathChange: boolean}>}
   */
  static async classify(filePath, existingRecord, computeHashFn = null) {
    const existsOnDisk = fs.existsSync(filePath);

    // 1. File Deleted
    if (!existsOnDisk) {
      return {
        changeType: existingRecord ? ChangeType.DELETE : ChangeType.UNCHANGED,
        newHash: null,
        isPathChange: false,
      };
    }

    // 2. New File Created
    if (!existingRecord) {
      let newHash = null;
      if (computeHashFn) {
        try {
          newHash = await computeHashFn(filePath);
        } catch {
          newHash = null;
        }
      }
      return {
        changeType: ChangeType.CREATE,
        newHash,
        isPathChange: false,
      };
    }

    // 3. Existing Record on Disk -> Compare Content Hash
    let newHash = null;
    if (computeHashFn) {
      try {
        newHash = await computeHashFn(filePath);
      } catch {
        newHash = existingRecord.hash;
      }
    } else {
      newHash = existingRecord.hash;
    }

    // Content Modified
    if (existingRecord.hash && newHash && existingRecord.hash !== newHash) {
      return {
        changeType: ChangeType.CONTENT_MODIFIED,
        newHash,
        isPathChange: false,
      };
    }

    // Path / Name Changed
    if (existingRecord.path && existingRecord.path !== filePath) {
      return {
        changeType: ChangeType.PATH_CHANGED,
        newHash,
        isPathChange: true,
      };
    }

    // Unchanged content and path
    return {
      changeType: ChangeType.UNCHANGED,
      newHash,
      isPathChange: false,
    };
  }
}

module.exports = {
  ChangeClassifier,
};
