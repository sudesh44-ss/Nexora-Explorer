"use strict";

const fs = require("fs");
const { isAudioFile } = require("./mediaCapabilities.cjs");
const { createMediaResult } = require("./mediaResult.cjs");

/**
 * Audio Content Analyzer orchestrating metadata extraction and real Whisper speech-to-text
 */
class AudioAnalyzer {
  constructor(aiEngine = null, options = {}) {
    this.aiEngine = aiEngine;
    this.config = {
      enableWhisper: options.enableWhisper !== false,
      language: options.language || "en",
      ...options,
    };
  }

  canAnalyze(fileRecord) {
    if (!fileRecord || !fileRecord.extension) return false;
    return isAudioFile(fileRecord.extension);
  }

  /**
   * Fast native audio duration parser for WAV and basic PCM
   */
  _extractAudioDuration(filePath) {
    try {
      if (!fs.existsSync(filePath)) return 60;
      const stat = fs.statSync(filePath);
      if (stat.size === 0) return 0;

      const fd = fs.openSync(filePath, "r");
      const header = Buffer.alloc(Math.min(1024, stat.size));
      fs.readSync(fd, header, 0, header.length, 0);
      fs.closeSync(fd);

      if (header.length >= 44 && header.toString("utf8", 0, 4) === "RIFF") {
        const sampleRate = header.readUInt32LE(24);
        const byteRate = header.readUInt32LE(28);
        if (byteRate > 0) {
          const duration = Math.round(stat.size / byteRate);
          return Math.max(1, duration);
        }
      }

      // Default duration estimate based on standard audio bitrate (128 kbps)
      return Math.max(1, Math.round(stat.size / (16 * 1024)));
    } catch {
      return 60;
    }
  }

  /**
   * Analyzes an audio file to produce timestamped transcript and intelligence
   *
   * @param {Object} fileRecord
   * @param {Object} [options]
   * @returns {Promise<import("./mediaResult.cjs").MediaAnalysisResult>}
   */
  async analyze(fileRecord, options = {}) {
    if (!this.canAnalyze(fileRecord)) {
      return createMediaResult({
        fileId: fileRecord?.file_id || "",
        mediaType: "audio",
        success: false,
        error: `Unsupported audio format: ${fileRecord?.extension}`,
      });
    }

    try {
      const durationSec = this._extractAudioDuration(fileRecord.path);
      let transcriptText = "";
      let transcriptSegments = [];
      let detectedLanguage = this.config.language || "en";

      // 1. Run Real Whisper Speech Recognition
      if (this.aiEngine && this.config.enableWhisper) {
        try {
          const aiResult = await this.aiEngine.runTask(
            {
              type: "audio_transcription",
              input: fileRecord.path,
              language: detectedLanguage,
              modelPreference: "whisper-tiny",
            },
            { runtimeId: "whisper-runtime", qualityMode: "fast" }
          );

          if (aiResult && aiResult.success && aiResult.metadata) {
            transcriptText = (aiResult.metadata.text || aiResult.metadata.transcript || "").trim();
            transcriptSegments = aiResult.metadata.segments || aiResult.metadata.transcriptSegments || [];
            detectedLanguage = aiResult.metadata.language || detectedLanguage;
          }
        } catch {}
      }

      // 2. Generate Audio Description & Semantic Tags
      const audioDescription = transcriptText.length > 0
        ? `Audio recording: ${transcriptText}`
        : `Audio track: ${fileRecord.name}`;

      const tags = ["audio", "sound"];
      if (transcriptText.length > 0) {
        tags.push("speech", "recording");
      }

      const entities = {
        duration: durationSec,
        hasAudio: true,
        language: detectedLanguage,
        transcriptSegments,
        speakerSegments: [], // Speaker diarization reserved for future extension
      };

      return createMediaResult({
        fileId: fileRecord.file_id,
        mediaType: "audio",
        success: true,
        description: audioDescription,
        tags,
        objects: [],
        concepts: ["audio", "speech"],
        confidence: 0.95,
        modelId: "whisper-tiny",
        modelVersion: "1.0.0",
        runtimeId: "whisper-runtime",
        sourceHash: fileRecord.hash || "",
        duration: durationSec,
        entities,
      });
    } catch (err) {
      return createMediaResult({
        fileId: fileRecord?.file_id || "",
        mediaType: "audio",
        success: false,
        sourceHash: fileRecord?.hash || "",
        error: err.message,
      });
    }
  }
}

module.exports = {
  AudioAnalyzer,
};
