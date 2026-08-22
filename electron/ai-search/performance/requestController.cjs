"use strict";

class RequestController {
  constructor() {
    this._activeRequests = new Map(); // scope -> requestId
  }

  /**
   * Registers a new request for a given UI scope
   */
  startRequest(scope = "global", requestId = null) {
    const id = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this._activeRequests.set(scope, id);
    return id;
  }

  /**
   * Checks whether a request is still current (latest)
   */
  isCurrent(scope = "global", requestId) {
    if (!requestId) return true;
    return this._activeRequests.get(scope) === requestId;
  }

  /**
   * Cancels any active request for a given scope
   */
  cancel(scope = "global") {
    this._activeRequests.delete(scope);
  }
}

module.exports = {
  RequestController,
};
