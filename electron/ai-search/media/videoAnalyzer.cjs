"use strict";

const { isVideoFile } = require("./mediaCapabilities.cjs");
const { createMediaResult } = require("./mediaResult.cjs");
const { VideoMetadataParser } = require("./videoMetadataParser.cjs");
const { VideoFrameExtractor } = require("./videoFrameExtractor.cjs");

/**
 * Video Content Analyzer orchestrating metadata, keyframe extraction, Vision AI and OCR
 */
class VideoAnalyzer {
  constructor(aiEngine = null, ocrEngine = null, options = {}) {
    this.aiEngine = aiEngine;
    this.ocrEngine = ocrEngine;
    this.config = {
      maxFrames: options.maxFrames || 5,
      enableOCR: options.enableOCR !== false,
      ...options,
    };
  }

  canAnalyze(fileRecord) {
    if (!fileRecord || !fileRecord.extension) return false;
    return isVideoFile(fileRecord.extension);
  }

  /**
   * Analyzes a video file to produce structured multi-modal intelligence
   *
   * @param {Object} fileRecord
   * @param {Object} [options]
   * @returns {Promise<import("./mediaResult.cjs").MediaAnalysisResult>}
   */
  async analyze(fileRecord, options = {}) {
    if (!this.canAnalyze(fileRecord)) {
      return createMediaResult({
        fileId: fileRecord?.file_id || "",
        mediaType: "video",
        success: false,
        error: `Unsupported video format: ${fileRecord?.extension}`,
      });
    }

    let extractedFrames = [];

    try {
      // 1. Video Metadata & Duration Extraction
      const meta = await VideoMetadataParser.parse(fileRecord.path);

      // 2. Adaptive Keyframe Sampling
      const maxFrames = options.maxFrames || this.config.maxFrames || 5;
      const sampleTimestamps = VideoFrameExtractor.getSampleTimestamps(meta.duration, maxFrames);

      // 3. Extract representative frames
      extractedFrames = await VideoFrameExtractor.extractFrames(fileRecord.path, sampleTimestamps, options);

      const frameConcepts = [];
      const frameTags = [];
      const frameObjects = [];
      const frameScenes = [];
      const ocrFrames = [];
      const frameDescriptions = [];
      let containsPeople = false;

      // 4. Analyze each frame with Real Image AI (Part 3) & Real OCR (Part 4)
      for (const frame of extractedFrames) {
        // A. Real Vision AI
        if (this.aiEngine) {
          try {
            const visionRes = await this.aiEngine.runTask(
              {
                type: "image_understanding",
                input: frame.framePath || frame.buffer,
                modelPreference: "clip-vit-base-patch32",
              },
              { runtimeId: "vision-runtime", qualityMode: "balanced" }
            );

            if (visionRes && visionRes.success && visionRes.metadata) {
              const metaData = visionRes.metadata;
              if (metaData.description) frameDescriptions.push(metaData.description);
              if (Array.isArray(metaData.concepts)) frameConcepts.push(...metaData.concepts);
              if (Array.isArray(metaData.tags)) frameTags.push(...metaData.tags);
              if (Array.isArray(metaData.objects)) frameObjects.push(...metaData.objects);

              if (metaData.tags?.some((t) => ["person", "people", "boy", "girl", "portrait"].includes(t.toLowerCase()))) {
                containsPeople = true;
              }
            }
          } catch {}
        }

        // B. Real OCR on Selected Frames
        if (this.ocrEngine && this.config.enableOCR) {
          try {
            const ocrRes = await this.ocrEngine.analyze(
              { path: frame.framePath || fileRecord.path, hash: fileRecord.hash },
              { providerId: "local_ocr" }
            );

            if (ocrRes && ocrRes.success && ocrRes.text && ocrRes.text.length > 0) {
              ocrFrames.push({
                text: ocrRes.text,
                timestamp: frame.timestamp,
                timestampFormatted: frame.timestampFormatted,
              });
            }
          } catch {}
        }
      }

      // 5. Real Whisper Speech Recognition on Video Audio Stream (Part 6)
      let transcriptSegments = [];
      if (this.aiEngine && meta.hasAudio && this.config.enableWhisper !== false) {
        try {
          const audioRes = await this.aiEngine.runTask(
            {
              type: "audio_transcription",
              input: fileRecord.path,
              modelPreference: "whisper-tiny",
            },
            { runtimeId: "whisper-runtime", qualityMode: "fast" }
          );

          if (audioRes && audioRes.success && audioRes.metadata) {
            transcriptSegments = audioRes.metadata.segments || audioRes.metadata.transcriptSegments || [];
          }
        } catch {}
      }

      // 6. Aggregate Video Intelligence
      const uniqueTags = Array.from(new Set(frameTags));
      const uniqueConcepts = Array.from(new Set(frameConcepts));
      const videoDescription = frameDescriptions.length > 0
        ? `Video recording showing ${frameDescriptions[0].replace(/^Image showing\s*/i, "")}`
        : `Video recording: ${fileRecord.name}`;

      const entities = {
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        fps: meta.fps,
        codec: meta.codec,
        hasAudio: meta.hasAudio,
        containsPeople,
        scenes: frameScenes,
        objects: frameObjects,
        ocrFrames,
        transcriptSegments,
      };

      return createMediaResult({
        fileId: fileRecord.file_id,
        mediaType: "video",
        success: true,
        description: videoDescription,
        tags: uniqueTags.length > 0 ? uniqueTags : ["video", "clip"],
        objects: frameObjects,
        concepts: uniqueConcepts.length > 0 ? uniqueConcepts : ["video"],
        confidence: 0.95,
        modelId: "clip_trocr_video_v1",
        modelVersion: "1.0.0",
        runtimeId: "video_pipeline",
        sourceHash: fileRecord.hash || "",
        dimensions: { width: meta.width, height: meta.height },
        entities,
      });
    } catch (err) {
      return createMediaResult({
        fileId: fileRecord?.file_id || "",
        mediaType: "video",
        success: false,
        sourceHash: fileRecord?.hash || "",
        error: err.message,
      });
    } finally {
      // 6. Guarantee cleanup of temporary frame files
      await VideoFrameExtractor.cleanupFrames(extractedFrames);
    }
  }
}

module.exports = {
  VideoAnalyzer,
};
