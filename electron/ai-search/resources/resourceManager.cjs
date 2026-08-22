"use strict";

const EventEmitter = require("events");
const { ResourceState, ResourceAction, ImpactLevel, PauseReason } = require("./resourceState.cjs");
const { getResourcePolicy } = require("./resourcePolicy.cjs");
const { CpuMonitor } = require("./cpuMonitor.cjs");
const { MemoryMonitor } = require("./memoryMonitor.cjs");
const { DiskMonitor } = require("./diskMonitor.cjs");

/**
 * Intelligent Resource Manager coordinating CPU, RAM, and system load monitoring
 */
class ResourceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.policy = getResourcePolicy(options.policy || options);

    // Monitoring components (supports DI / mocks for deterministic testing)
    this.cpuMonitor = options.cpuMonitor || new CpuMonitor();
    this.memoryMonitor = options.memoryMonitor || new MemoryMonitor();
    this.diskMonitor = options.diskMonitor || new DiskMonitor(options.targetDir);

    this.state = ResourceState.NORMAL;
    this.action = ResourceAction.RUN;
    this.pauseReason = PauseReason.NONE;

    // Rolling sample window & hysteresis counters
    this.samples = [];
    this._consecutivePauseCount = 0;
    this._consecutiveThrottleCount = 0;
    this._consecutiveHealthyCount = 0;

    this._timer = null;
    this.isMonitoring = false;
  }

  /**
   * Initializes the resource manager and runs initial sample
   */
  async initialize() {
    await this.sampleNow();
    return { success: true, state: this.state, action: this.action };
  }

  /**
   * Starts periodic background monitoring
   */
  startMonitoring() {
    if (this.isMonitoring || !this.policy.enabled) return;

    this.isMonitoring = true;
    this._timer = setInterval(async () => {
      try {
        await this.sampleNow();
      } catch (err) {
        console.warn("[ResourceManager] Monitoring error:", err.message);
      }
    }, this.policy.samplingIntervalMs);
  }

  /**
   * Stops periodic monitoring
   */
  stopMonitoring() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Performs an immediate synchronous/async resource sampling tick
   */
  async sampleNow() {
    const cpuUsage = this.cpuMonitor.sample();
    const memory = this.memoryMonitor.sample();
    const disk = await this.diskMonitor.sample();

    const sampleData = {
      timestamp: new Date().toISOString(),
      cpu: cpuUsage,
      memory: memory.usagePercent,
      memoryRaw: memory,
      disk,
    };

    this._recordSample(sampleData);
    this._evaluateState(sampleData);

    return this.getSnapshot();
  }

  _recordSample(sample) {
    this.samples.push(sample);
    if (this.samples.length > this.policy.historyWindowSize) {
      this.samples.shift();
    }
  }

  /**
   * Evaluates system state using Hysteresis logic
   */
  _evaluateState(latest) {
    const { cpu: cpuPolicy, memory: memPolicy, hysteresis } = this.policy;
    const reasons = [];

    const isCpuPause = latest.cpu >= cpuPolicy.pauseThreshold;
    const isMemPause = latest.memory >= memPolicy.pauseThreshold;
    const isCpuThrottle = latest.cpu >= cpuPolicy.throttleThreshold;
    const isMemThrottle = latest.memory >= memPolicy.throttleThreshold;

    const isHealthy = latest.cpu <= cpuPolicy.resumeThreshold && latest.memory <= memPolicy.resumeThreshold;

    // 1. Check for PAUSE escalation
    if (isCpuPause || isMemPause) {
      this._consecutivePauseCount++;
      this._consecutiveHealthyCount = 0;
      if (isCpuPause) reasons.push(`CPU sustained at ${latest.cpu}% (>= ${cpuPolicy.pauseThreshold}%)`);
      if (isMemPause) reasons.push(`RAM sustained at ${latest.memory}% (>= ${memPolicy.pauseThreshold}%)`);

      if (this._consecutivePauseCount >= hysteresis.requiredSamples && this.state !== ResourceState.PAUSED) {
        this._transitionTo(ResourceState.PAUSED, ResourceAction.PAUSE, reasons, PauseReason.AUTO_PAUSED);
        return;
      }
    } else {
      this._consecutivePauseCount = 0;
    }

    // 2. Check for THROTTLE escalation
    if ((isCpuThrottle || isMemThrottle) && this.state !== ResourceState.PAUSED) {
      this._consecutiveThrottleCount++;
      this._consecutiveHealthyCount = 0;
      if (isCpuThrottle) reasons.push(`CPU moderate load at ${latest.cpu}% (>= ${cpuPolicy.throttleThreshold}%)`);
      if (isMemThrottle) reasons.push(`RAM moderate pressure at ${latest.memory}% (>= ${memPolicy.throttleThreshold}%)`);

      if (this._consecutiveThrottleCount >= hysteresis.requiredSamples && this.state !== ResourceState.THROTTLED) {
        this._transitionTo(ResourceState.THROTTLED, ResourceAction.THROTTLE, reasons);
        return;
      }
    } else {
      this._consecutiveThrottleCount = 0;
    }

    // 3. Check for Recovery / De-escalation (Hysteresis back to NORMAL)
    if (isHealthy) {
      this._consecutiveHealthyCount++;
      if (this._consecutiveHealthyCount >= hysteresis.recoverySamples) {
        if (this.state === ResourceState.PAUSED || this.state === ResourceState.THROTTLED) {
          const wasAutoPaused = this.state === ResourceState.PAUSED && this.pauseReason === PauseReason.AUTO_PAUSED;
          this._transitionTo(ResourceState.NORMAL, ResourceAction.RUN, ["System resources returned to healthy operating levels."]);
          
          if (wasAutoPaused && this.policy.autoResume) {
            this.emit("auto_resume", this.getDecision());
          }
        }
      }
    }
  }

  _transitionTo(newState, newAction, reasons = [], pauseReason = PauseReason.NONE) {
    const prevState = this.state;
    this.state = newState;
    this.action = newAction;
    this.pauseReason = pauseReason;

    const decision = {
      state: this.state,
      action: this.action,
      reasons,
      pauseReason: this.pauseReason,
      recommendedBatchSize: this.getRecommendedBatchSize(),
      yieldDelayMs: this.action === ResourceAction.THROTTLE ? this.policy.batch.throttledDelayMs : 0,
    };

    this.emit("state_change", { from: prevState, to: newState, decision });

    if (newState === ResourceState.PAUSED && pauseReason === PauseReason.AUTO_PAUSED) {
      this.emit("auto_pause", decision);
    }
  }

  getRecommendedBatchSize() {
    if (this.state === ResourceState.PAUSED) return 0;
    if (this.state === ResourceState.THROTTLED) return this.policy.batch.throttledBatchSize;
    return this.policy.batch.normalBatchSize;
  }

  getImpactLevel() {
    if (this.state === ResourceState.PAUSED || this.state === ResourceState.CRITICAL) {
      return ImpactLevel.HIGH;
    }
    if (this.state === ResourceState.THROTTLED) {
      return ImpactLevel.MEDIUM;
    }
    return ImpactLevel.LOW;
  }

  getDecision() {
    return {
      state: this.state,
      action: this.action,
      impactLevel: this.getImpactLevel(),
      recommendedBatchSize: this.getRecommendedBatchSize(),
      yieldDelayMs: this.action === ResourceAction.THROTTLE ? this.policy.batch.throttledDelayMs : 0,
      pauseReason: this.pauseReason,
    };
  }

  getSnapshot() {
    const latest = this.samples.length > 0 ? this.samples[this.samples.length - 1] : null;

    return {
      timestamp: latest?.timestamp || new Date().toISOString(),
      isMonitoring: this.isMonitoring,
      state: this.state,
      action: this.action,
      impactLevel: this.getImpactLevel(),
      recommendedBatchSize: this.getRecommendedBatchSize(),
      cpuUsage: latest?.cpu || 0,
      memoryUsage: latest?.memory || 0,
      memoryDetails: latest?.memoryRaw || null,
      disk: latest?.disk || null,
    };
  }

  getState() {
    return this.state;
  }

  shutdown() {
    this.stopMonitoring();
    this.samples = [];
  }
}

module.exports = {
  ResourceManager,
};
