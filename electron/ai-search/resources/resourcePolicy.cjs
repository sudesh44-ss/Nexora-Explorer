"use strict";

/**
 * Returns default resource policy configuration
 *
 * @param {Object} [customOverrides]
 * @returns {Object} Full policy configuration
 */
function getResourcePolicy(customOverrides = {}) {
  return {
    enabled: customOverrides.enabled !== undefined ? customOverrides.enabled : true,
    samplingIntervalMs: customOverrides.samplingIntervalMs || 2000,
    historyWindowSize: customOverrides.historyWindowSize || 10,

    cpu: {
      normalThreshold: 40,      // Below 40% -> NORMAL / RUN
      throttleThreshold: 65,    // 65% - 80% -> THROTTLED / THROTTLE
      pauseThreshold: 80,       // Above 80% -> PAUSED / PAUSE
      resumeThreshold: 50,      // Must drop below 50% to auto-resume
      ...(customOverrides.cpu || {}),
    },

    memory: {
      throttleThreshold: 80,    // 80% RAM usage -> THROTTLED
      pauseThreshold: 90,       // 90% RAM usage -> PAUSED
      resumeThreshold: 75,      // Drops below 75% -> RESUME
      ...(customOverrides.memory || {}),
    },

    disk: {
      minFreeSpaceBytes: 500 * 1024 * 1024, // 500 MB minimum free storage
      ...(customOverrides.disk || {}),
    },

    hysteresis: {
      requiredSamples: 3,       // 3 consecutive high samples to escalate state
      recoverySamples: 3,       // 3 consecutive healthy samples to de-escalate / resume
      ...(customOverrides.hysteresis || {}),
    },

    batch: {
      normalBatchSize: 100,
      throttledBatchSize: 30,
      throttledDelayMs: 50,     // Delay yielded between batches when throttled
      ...(customOverrides.batch || {}),
    },

    autoResume: customOverrides.autoResume !== undefined ? customOverrides.autoResume : true,
  };
}

module.exports = {
  getResourcePolicy,
};
