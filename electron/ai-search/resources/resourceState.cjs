"use strict";

/**
 * System Resource Load State
 */
const ResourceState = Object.freeze({
  NORMAL: "NORMAL",
  THROTTLED: "THROTTLED",
  PAUSED: "PAUSED",
  CRITICAL: "CRITICAL",
  UNKNOWN: "UNKNOWN",
});

/**
 * Recommended Indexer Action
 */
const ResourceAction = Object.freeze({
  RUN: "RUN",
  THROTTLE: "THROTTLE",
  PAUSE: "PAUSE",
});

/**
 * Explicit Pause Attribution (distinguishes user vs automated pause)
 */
const PauseReason = Object.freeze({
  NONE: "NONE",
  USER_PAUSED: "USER_PAUSED",
  AUTO_PAUSED: "AUTO_PAUSED",
});

/**
 * User-Facing Impact Level
 */
const ImpactLevel = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
});

module.exports = {
  ResourceState,
  ResourceAction,
  PauseReason,
  ImpactLevel,
};
