"use strict";

const { QualityMode, ModelStatus, AITaskType } = require("./modelProfile.cjs");

/**
 * Hardware and Quality-Aware Model Selection Engine
 */
class ModelSelector {
  constructor(modelRegistry) {
    this.registry = modelRegistry;
  }

  /**
   * Generates the recommended AI Model Pack based on hardware and enabled features
   */
  selectRecommended(hardwareProfile = {}, capabilities = { text: true, image: true, ocr: true, audio: true }) {
    const totalRamBytes = hardwareProfile.totalMemBytes || (8 * 1024 * 1024 * 1024);
    const tier = hardwareProfile.tier || "MEDIUM";

    const recommended = [];
    const capabilityList = [];

    // 1. Text & Document Embedding (Mandatory core)
    if (capabilities.text !== false) {
      let textModelId = "bge-small-en-v1.5";
      if (tier === "LOW") {
        textModelId = "all-minilm-l6-v2";
      } else if (tier === "HIGH" && totalRamBytes >= 16 * 1024 * 1024 * 1024) {
        textModelId = "nomic-embed-text-v1.5";
      }
      const textModel = this.registry.getById(textModelId) || this.registry.getById("bge-small-en-v1.5");
      if (textModel) {
        recommended.push(textModel);
        capabilityList.push({
          id: "text",
          title: "Text & Document Search",
          description: "Search PDF, DOCX, TXT, and code files using natural language",
          modelId: textModel.id,
          modelName: textModel.name,
          sizeBytes: textModel.sizeBytes,
        });
      }
    }

    // 2. Image Understanding & Vision
    if (capabilities.image !== false && hardwareProfile.canRunVision !== false) {
      const visionModel = this.registry.getById("clip-vit-base-patch32");
      if (visionModel) {
        recommended.push(visionModel);
        capabilityList.push({
          id: "image",
          title: "Image Search",
          description: "Search photos and images by what is inside them",
          modelId: visionModel.id,
          modelName: visionModel.name,
          sizeBytes: visionModel.sizeBytes,
        });
      }
    }

    // 3. OCR / Scanned Documents
    if (capabilities.ocr !== false && hardwareProfile.canRunOCR !== false) {
      const ocrModel = this.registry.getById("trocr-small-printed");
      if (ocrModel) {
        recommended.push(ocrModel);
        capabilityList.push({
          id: "ocr",
          title: "Scanned Document Search",
          description: "Extract text from scanned invoices, receipts, and images",
          modelId: ocrModel.id,
          modelName: ocrModel.name,
          sizeBytes: ocrModel.sizeBytes,
        });
      }
    }

    // 4. Audio Transcription & Media Search
    if (capabilities.audio !== false && hardwareProfile.canRunAudio !== false) {
      const audioModel = this.registry.getById("whisper-tiny");
      if (audioModel) {
        recommended.push(audioModel);
        capabilityList.push({
          id: "audio",
          title: "Audio & Video Search",
          description: "Transcribe spoken words and find moments in media files",
          modelId: audioModel.id,
          modelName: audioModel.name,
          sizeBytes: audioModel.sizeBytes,
        });
      }
    }

    let totalSize = 0;
    for (const m of recommended) {
      totalSize += m.sizeBytes || 0;
    }

    const estimatedDownloadMb = Math.round(totalSize / (1024 * 1024));

    return {
      tier,
      hardwareSummary: hardwareProfile.summary || "Standard PC",
      models: recommended,
      capabilities: capabilityList,
      totalSizeBytes: totalSize,
      estimatedDownloadMb,
      estimatedDownloadFormatted: `~${estimatedDownloadMb} MB`,
    };
  }

  /**
   * Selects the best compatible model profile for a specific query
   */
  selectModel(query = {}) {
    const task = query.task;
    if (!task) return null;

    const candidates = this.registry.findByTask(task);
    if (candidates.length === 0) return null;

    const totalRam = query.hardware?.totalMemBytes || query.hardware?.totalRamBytes || (8 * 1024 * 1024 * 1024);
    const hasGpu = Boolean(query.hardware?.hasGpu);
    const qualityMode = query.qualityMode || QualityMode.BALANCED;
    const installedOnly = Boolean(query.installedOnly);

    // Filter compatible models
    const compatible = candidates.filter((m) => {
      if (m.ramRequirementBytes > totalRam) {
        return false;
      }
      if (m.gpuRequirement && !hasGpu) {
        return false;
      }
      if (installedOnly && m.status !== ModelStatus.INSTALLED && m.status !== ModelStatus.READY && m.status !== ModelStatus.VERIFIED) {
        return false;
      }
      return true;
    });

    if (compatible.length === 0) return null;

    // Prefer installed/verified models first
    compatible.sort((a, b) => {
      const aReady = a.status === ModelStatus.READY || a.status === ModelStatus.VERIFIED ? 1 : 0;
      const bReady = b.status === ModelStatus.READY || b.status === ModelStatus.VERIFIED ? 1 : 0;
      if (aReady !== bReady) return bReady - aReady;

      if (qualityMode === QualityMode.FAST) {
        return a.sizeBytes - b.sizeBytes;
      }

      if (qualityMode === QualityMode.ACCURATE) {
        return (b.dimensions || 0) - (a.dimensions || 0) || b.sizeBytes - a.sizeBytes;
      }

      const aTierMatch = a.qualityTier === QualityMode.BALANCED ? 1 : 0;
      const bTierMatch = b.qualityTier === QualityMode.BALANCED ? 1 : 0;
      if (aTierMatch !== bTierMatch) {
        return bTierMatch - aTierMatch;
      }
      return a.sizeBytes - b.sizeBytes;
    });

    return compatible[0];
  }
}

module.exports = {
  ModelSelector,
};
