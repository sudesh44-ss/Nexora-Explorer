"use strict";

const path = require("path");
const os = require("os");

/**
 * Quality Modes for AI Search
 */
const AIQualityMode = Object.freeze({
  BALANCED: "balanced",
  PERFORMANCE: "performance",
  ACCURACY: "accuracy",
  MAX_QUALITY: "max_quality",
});

/**
 * Indexing Priorities
 */
const IndexingPriority = Object.freeze({
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  IDLE_ONLY: "idle_only",
});

/**
 * Default AI Search Configuration
 */
function getDefaultConfig() {
  const userHome = os.homedir();
  
  return {
    enabled: true,
    version: "1.0.0",
    storagePath: path.join(userHome, ".nexora", "ai-search"),
    databaseFilename: "nexora_ai_search.db",
    
    // Indexing Targets
    indexedLocations: [
      path.join(userHome, "Documents"),
      path.join(userHome, "Downloads"),
      path.join(userHome, "Desktop"),
    ],
    excludedLocations: [
      "**/node_modules/**",
      "**/.git/**",
      "**/AppData/**",
      "**/Temp/**",
      "**/$Recycle.Bin/**",
    ],
    
    // File Type Inclusions
    fileTypes: {
      documents: true,
      code: true,
      images: true,
      audio: true,
      videos: true,
      archives: false,
    },
    
    // Resource Limits
    resourceLimits: {
      maxCpuUsagePercent: 40,
      maxMemoryMb: 1024,
      indexingPriority: IndexingPriority.NORMAL,
      pauseOnBattery: true,
      pauseOnHighSystemLoad: true,
    },
    
    // AI & Model Settings
    ai: {
      qualityMode: AIQualityMode.BALANCED,
      preferredProvider: "local", // local, ollama, cloud
      activeModel: "all-MiniLM-L6-v2",
      enableOcr: true,
      enableVision: true,
      enableAudioTranscription: false,
      similarityThreshold: 0.25,
      maxResultsLimit: 100,
    },
    
    // Privacy Controls
    privacy: {
      allowCloudFallbacks: false,
      telemetryEnabled: false,
      excludeEncryptedFiles: true,
      anonymizeFilePathsInLogs: false,
    },
  };
}

class AISearchConfigManager {
  constructor(initialConfig = {}) {
    this.config = { ...getDefaultConfig(), ...initialConfig };
  }

  get() {
    return { ...this.config };
  }

  getSection(sectionKey) {
    return this.config[sectionKey] ? { ...this.config[sectionKey] } : null;
  }

  update(newPartialConfig = {}) {
    this.config = {
      ...this.config,
      ...newPartialConfig,
      resourceLimits: {
        ...this.config.resourceLimits,
        ...(newPartialConfig.resourceLimits || {}),
      },
      ai: {
        ...this.config.ai,
        ...(newPartialConfig.ai || {}),
      },
      privacy: {
        ...this.config.privacy,
        ...(newPartialConfig.privacy || {}),
      },
    };
    return this.get();
  }

  reset() {
    this.config = getDefaultConfig();
    return this.get();
  }
}

module.exports = {
  AIQualityMode,
  IndexingPriority,
  getDefaultConfig,
  AISearchConfigManager,
};
