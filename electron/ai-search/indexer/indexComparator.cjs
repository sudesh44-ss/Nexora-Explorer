"use strict";

const { IndexOperation } = require("./indexState.cjs");

/**
 * Compares incoming FileRecord with database state to determine operation
 */
class IndexComparator {
  /**
   * Evaluates incoming file metadata against existing database row
   *
   * @param {Object} incomingRecord - FileRecord from Part 2 Scanner
   * @param {Object|null} existingRecord - Record fetched from SQLite files table
   * @returns {{operation: string, reason: string}}
   */
  static compare(incomingRecord, existingRecord) {
    if (!existingRecord) {
      return {
        operation: IndexOperation.NEW,
        reason: "File does not exist in local index",
      };
    }

    // 1. Check size
    const sizeChanged = existingRecord.size !== incomingRecord.size;

    // 2. Check modified_at timestamp
    const mtimeChanged = existingRecord.modified_at !== incomingRecord.modified_at;

    // 3. Check hash (if available on both)
    const hashChanged =
      Boolean(incomingRecord.hash) &&
      Boolean(existingRecord.hash) &&
      incomingRecord.hash !== existingRecord.hash;

    // If neither size, mtime, nor hash changed, and file is already indexed
    if (!sizeChanged && !mtimeChanged && !hashChanged && existingRecord.status === "indexed") {
      return {
        operation: IndexOperation.UNCHANGED,
        reason: "File metadata and hash are identical to indexed record",
      };
    }

    // If status was in error, re-indexing is warranted even if timestamps look similar
    if (existingRecord.status === "error" || existingRecord.status === "discovered") {
      return {
        operation: IndexOperation.UPDATE,
        reason: `Previous status was '${existingRecord.status}', refreshing record`,
      };
    }

    return {
      operation: IndexOperation.UPDATE,
      reason: `File attributes modified (sizeChanged=${sizeChanged}, mtimeChanged=${mtimeChanged}, hashChanged=${hashChanged})`,
    };
  }

  /**
   * Checks whether the file was moved or renamed by matching content hash
   *
   * @param {Object} incomingRecord
   * @param {import("../database/repositories/fileRepository.cjs").FileRepository} fileRepo
   * @returns {Object|null} Matching previous record if detected as moved
   */
  static detectMovedFile(incomingRecord, fileRepo) {
    if (!incomingRecord.hash || !fileRepo) return null;

    const candidates = fileRepo.findByHash(incomingRecord.hash);
    if (!candidates || candidates.length === 0) return null;

    // Match candidate with same size and different path
    const match = candidates.find(
      (c) => c.size === incomingRecord.size && c.path !== incomingRecord.path
    );

    return match || null;
  }
}

module.exports = {
  IndexComparator,
};
