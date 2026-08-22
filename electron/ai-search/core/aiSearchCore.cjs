"use strict";

const { AISearchError, AISearchErrorCodes } = require("../diagnostics/aiSearchErrors.cjs");
const { logger } = require("../diagnostics/aiSearchLogger.cjs");
const { AISearchConfigManager } = require("../config/aiSearchConfig.cjs");
const { HardwareInterface } = require("../hardware/hardwareInterface.cjs");
const { AIProviderRegistry } = require("../providers/providerInterface.cjs");

/**
 * Lifecycle states for AI Search Engine
 */
const CoreState = Object.freeze({
  UNINITIALIZED: "uninitialized",
  INITIALIZING: "initializing",
  READY: "ready",
  INDEXING: "indexing",
  PAUSED: "paused",
  SHUTTING_DOWN: "shutting_down",
  ERROR: "error",
});

/**
 * Nexora AI Search Core Interface
 */
class AISearchCore {
  constructor(options = {}) {
    this.version = "1.0.0";
    this.state = CoreState.UNINITIALIZED;
    this.configManager = new AISearchConfigManager(options.config || {});
    this.hardware = new HardwareInterface();
    this.providerRegistry = new AIProviderRegistry();
    this.stats = {
      totalIndexedFiles: 0,
      queuePending: 0,
      lastIndexTime: null,
      errorCount: 0,
    };
  }

  /**
   * Initializes the AI Search subsystem safely
   * @returns {Promise<{success: boolean, state: string, hardwareTier: string}>}
   */
  async initialize() {
    if (this.state === CoreState.READY || this.state === CoreState.INITIALIZING) {
      logger.warn("AISearchCore is already initialized or initializing.");
      return { success: true, state: this.state };
    }

    try {
      this.state = CoreState.INITIALIZING;
      logger.info(`Initializing Nexora AI Search Core v${this.version}...`);

      const hwProfile = this.hardware.getProfile();
      logger.info(`Hardware profile detected: Tier ${hwProfile.tier} (${hwProfile.cpuCount} CPUs, ${hwProfile.totalMemGb}GB RAM)`);

      // In Part 1, we establish contracts without loading heavy databases or models
      this.state = CoreState.READY;
      logger.info("Nexora AI Search Core initialized successfully.");

      return {
        success: true,
        version: this.version,
        state: this.state,
        hardwareTier: hwProfile.tier,
      };
    } catch (err) {
      this.state = CoreState.ERROR;
      const aiError = new AISearchError(
        AISearchErrorCodes.AI_SEARCH_INIT_FAILED,
        `Failed to initialize AI Search Core: ${err.message}`,
        err
      );
      logger.error("Initialization failure", aiError);
      throw aiError;
    }
  }

  /**
   * Shuts down AI Search processes gracefully
   * @returns {Promise<{success: boolean, state: string}>}
   */
  async shutdown() {
    if (this.state === CoreState.UNINITIALIZED) {
      return { success: true, state: this.state };
    }

    try {
      this.state = CoreState.SHUTTING_DOWN;
      logger.info("Shutting down Nexora AI Search Core...");

      // Release active providers
      const activeProvider = this.providerRegistry.getActive();
      if (activeProvider) {
        await activeProvider.shutdown();
      }

      this.state = CoreState.UNINITIALIZED;
      logger.info("Nexora AI Search Core shutdown complete.");

      return { success: true, state: this.state };
    } catch (err) {
      this.state = CoreState.ERROR;
      const aiError = new AISearchError(
        AISearchErrorCodes.AI_SEARCH_SHUTDOWN_FAILED,
        `Shutdown error: ${err.message}`,
        err
      );
      logger.error("Shutdown failure", aiError);
      throw aiError;
    }
  }

  /**
   * Returns current lifecycle status and basic metrics
   */
  getStatus() {
    return {
      version: this.version,
      state: this.state,
      config: this.configManager.get(),
      hardwareProfile: this.hardware.getProfile(),
      stats: { ...this.stats },
      activeProvider: this.providerRegistry.getActive()?.name || "None",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns supported capabilities
   */
  getCapabilities() {
    return {
      version: this.version,
      state: this.state,
      searchEngine: "Nexora Content-Aware AI Search",
      supportsSemanticSearch: true,
      supportsFts5Search: true,
      supportsOcrSearch: true,
      supportsVisionSearch: true,
      supportsIncrementalWatch: true,
      supportsHardwareAdaptation: true,
      providers: this.providerRegistry.list(),
    };
  }

  getVersion() {
    return this.version;
  }
}

module.exports = {
  CoreState,
  AISearchCore,
};
