"use strict";

class IpcGuard {
  /**
   * Validates IPC search payload
   */
  static validateSearchPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return { valid: false, error: "Payload must be an object", data: null };
    }

    const query = typeof payload.query === "string" ? payload.query : "";
    const options = typeof payload.options === "object" && payload.options !== null ? payload.options : {};
    const context = typeof payload.context === "object" && payload.context !== null ? payload.context : null;

    return {
      valid: true,
      error: null,
      data: { query, options, context },
    };
  }
}

module.exports = {
  IpcGuard,
};
