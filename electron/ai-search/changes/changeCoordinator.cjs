"use strict";

const EventEmitter = require("events");
const path = require("path");
const { ChangeType } = require("./changeEvents.cjs");
const { ChangeClassifier } = require("./changeClassifier.cjs");
const { ChangeCoalescer } = require("./changeCoalescer.cjs");
const { IndexInvalidator } = require("./indexInvalidator.cjs");
const { ReconciliationManager } = require("./reconciliationManager.cjs");
const { TaskType, TaskPriority } = require("../indexing/taskState.cjs");
const { isImageFile, isAudioFile, isVideoFile } = require("../media/mediaCapabilities.cjs");
const { computeFileHash } = require("../discovery/fileHash.cjs");
const { readMetadata } = require("../discovery/metadataReader.cjs");
const { generateFileId } = require("../discovery/fileId.cjs");

class ChangeCoordinator extends EventEmitter {
  constructor(services = {}, options = {}) {
    super();
    this.db = services.databaseManager || null;
    this.vectors = services.embeddingManager || null;
    this.indexCoordinator = services.indexCoordinator || null;

    this.coalescer = new ChangeCoalescer(options);
    this.reconciliation = new ReconciliationManager(this.db, this);

    this.coalescer.on("change_ready", (evt) => this.processChangeEvent(evt));
  }

  /**
   * Pushes a raw change event into debounced coalescer
   */
  handleEvent(changeEvent) {
    this.coalescer.push(changeEvent);
  }

  /**
   * Processes a finalized, debounced ChangeEvent
   */
  async processChangeEvent(event) {
    if (!event || !event.path) return { success: false, error: "Missing event path" };

    try {
      const lookupPath = event.oldPath || event.path;
      const existingRec = this.db && this.db.files ? this.db.files.findByPath(lookupPath) : null;
      const classification = await ChangeClassifier.classify(
        event.path,
        existingRec,
        computeFileHash
      );

      let changeType = classification.changeType;
      if (event.type === ChangeType.DELETE || event.type === "delete") {
        changeType = ChangeType.DELETE;
      } else if (event.type === ChangeType.PATH_CHANGED || event.type === "path_changed") {
        changeType = ChangeType.PATH_CHANGED;
      }

      switch (changeType) {
        case ChangeType.CREATE: {
          const metaRes = await readMetadata(event.path);
          const meta = metaRes?.record || {};
          const fileId = meta.file_id || generateFileId(event.path);
          const fileRec = {
            file_id: fileId,
            name: meta.name || path.basename(event.path),
            path: event.path,
            extension: meta.extension || path.extname(event.path),
            size: meta.size || 0,
            created_at: meta.created_at || new Date().toISOString(),
            modified_at: meta.modified_at || new Date().toISOString(),
            hash: classification.newHash || (await computeFileHash(event.path)),
            mime_type: meta.mime_type || null,
            status: "discovered",
          };

          if (this.db && this.db.files) {
            this.db.files.upsert(fileRec);
          }

          // Enqueue appropriate processing in Part 12 Background Queue
          this._enqueueTasksForFile(fileRec);
          this.emit("file_created", { fileRecord: fileRec });
          break;
        }

        case ChangeType.CONTENT_MODIFIED: {
          if (!existingRec) break;
          const updatedRec = {
            ...existingRec,
            hash: classification.newHash,
            modified_at: new Date().toISOString(),
          };

          // 1. Invalidate stale derived text, vectors, and AI data
          IndexInvalidator.invalidateDerivedData(existingRec.file_id, this.db, this.vectors);

          // 2. Update FileRecord in DB
          if (this.db && this.db.files) {
            this.db.files.upsert(updatedRec);
          }

          // 3. Re-queue fresh analysis tasks
          this._enqueueTasksForFile(updatedRec);
          this.emit("file_modified", { fileRecord: updatedRec });
          break;
        }

        case ChangeType.PATH_CHANGED: {
          if (!existingRec) break;
          const metaRes = await readMetadata(event.path);
          const meta = metaRes?.record || {};
          const updatedRec = {
            ...existingRec,
            name: meta.name || path.basename(event.path),
            path: event.path,
            extension: meta.extension || path.extname(event.path),
          };

          if (this.db && this.db.files) {
            this.db.files.update(updatedRec);
            // Update FTS path/name
            if (this.db.fts) {
              this.db.fts.updateSearchableContent(updatedRec.file_id, {
                name: updatedRec.name,
                path: updatedRec.path,
              });
            }
          }
          this.emit("file_renamed", { fileRecord: updatedRec, oldPath: event.oldPath });
          break;
        }

        case ChangeType.DELETE: {
          const fileId = existingRec ? existingRec.file_id : event.extra?.fileId;
          if (fileId) {
            // Completely purge across SQLite, FTS, Vectors, and AI metadata
            IndexInvalidator.purgeDeletedFile(fileId, this.db, this.vectors);

            // Cancel any pending queue tasks in Part 12 queue
            if (this.indexCoordinator && this.indexCoordinator.queue) {
              const activeTask = this.indexCoordinator.persistence.findActiveTask(fileId, TaskType.IMAGE_ANALYSIS);
              if (activeTask) {
                this.indexCoordinator.queue.cancelTask(activeTask.taskId);
              }
            }
            this.emit("file_deleted", { fileId, path: event.path });
          }
          break;
        }

        case ChangeType.UNCHANGED:
        default:
          break;
      }

      return { success: true, changeType };
    } catch (err) {
      this.emit("change_failed", { event, error: err.message });
      return { success: false, error: err.message };
    }
  }

  _enqueueTasksForFile(fileRec) {
    if (!this.indexCoordinator) return;

    if (isImageFile(fileRec.extension)) {
      this.indexCoordinator.queueTask({
        fileId: fileRec.file_id,
        taskType: TaskType.IMAGE_ANALYSIS,
        priority: TaskPriority.LOW,
        sourceHash: fileRec.hash,
        payload: { fileRecord: fileRec },
      });
    } else if (isAudioFile(fileRec.extension)) {
      this.indexCoordinator.queueTask({
        fileId: fileRec.file_id,
        taskType: TaskType.AUDIO_ANALYSIS,
        priority: TaskPriority.BACKGROUND,
        sourceHash: fileRec.hash,
        payload: { fileRecord: fileRec },
      });
    } else if (isVideoFile(fileRec.extension)) {
      this.indexCoordinator.queueTask({
        fileId: fileRec.file_id,
        taskType: TaskType.VIDEO_ANALYSIS,
        priority: TaskPriority.BACKGROUND,
        sourceHash: fileRec.hash,
        payload: { fileRecord: fileRec },
      });
    } else {
      // Document / Text files
      this.indexCoordinator.queueTask({
        fileId: fileRec.file_id,
        taskType: TaskType.TEXT_EXTRACTION,
        priority: TaskPriority.NORMAL,
        sourceHash: fileRec.hash,
        payload: { fileRecord: fileRec },
      });
    }
  }

  /**
   * Reindexes a single file
   */
  async reindexFile(fileId, options = {}) {
    if (!this.db || !this.db.files) return;
    const fileRec = this.db.files.findByFileId(fileId);
    if (!fileRec) return;

    if (options.force) {
      IndexInvalidator.invalidateDerivedData(fileId, this.db, this.vectors);
    }
    this._enqueueTasksForFile(fileRec);
  }

  /**
   * Runs reconciliation on a directory
   */
  async reconcileDirectory(targetDir, options = {}) {
    return this.reconciliation.reconcileDirectory(targetDir, options);
  }
}

module.exports = {
  ChangeCoordinator,
};
