"use strict";

const { WorkloadEstimator } = require("./workloadEstimator.cjs");

class PriorityScheduler {
  constructor(config = {}) {
    this.agingRatePerMinute = config.agingRatePerMinute || 5;
    this.maxWorkers = config.maxWorkers || 2;
    this.maxHeavyWorkers = config.maxHeavyWorkers || 1;
    this.taskCosts = config.taskCosts || {};
  }

  /**
   * Calculates effective priority with starvation aging
   */
  calculateEffectivePriority(task, now = Date.now()) {
    const base = task.priority || 60;
    const createdMs = task.createdAt ? Date.parse(task.createdAt) : now;
    const waitMinutes = Math.max(0, (now - createdMs) / 60000);
    const ageBonus = Math.floor(waitMinutes * this.agingRatePerMinute);

    return base + ageBonus;
  }

  /**
   * Sorts candidate tasks by effective priority descending, then FIFO by created_at
   */
  rankCandidates(tasks, now = Date.now()) {
    return [...tasks].sort((a, b) => {
      const prioA = this.calculateEffectivePriority(a, now);
      const prioB = this.calculateEffectivePriority(b, now);

      if (prioB !== prioA) {
        return prioB - prioA;
      }
      return (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
    });
  }

  /**
   * Selects executable tasks respecting worker concurrency and resource throttle
   *
   * @param {Array<Object>} candidateTasks
   * @param {number} activeWorkerCount
   * @param {number} activeHeavyCount
   * @param {string} resourceState - "NORMAL" | "THROTTLED" | "PAUSED"
   * @returns {Array<Object>} Tasks ready to dispatch
   */
  selectTasksToDispatch(candidateTasks, activeWorkerCount, activeHeavyCount, resourceState = "NORMAL") {
    if (resourceState === "PAUSED") {
      return [];
    }

    const availableSlots = resourceState === "THROTTLED"
      ? Math.max(1, Math.floor(this.maxWorkers / 2)) - activeWorkerCount
      : this.maxWorkers - activeWorkerCount;

    if (availableSlots <= 0) {
      return [];
    }

    const maxHeavy = resourceState === "THROTTLED" ? 0 : this.maxHeavyWorkers;
    const ranked = this.rankCandidates(candidateTasks);
    const selected = [];
    let currentHeavy = activeHeavyCount;

    for (const task of ranked) {
      if (selected.length >= availableSlots) break;

      const isHeavy = WorkloadEstimator.isHeavyTask(task.taskType);
      if (isHeavy) {
        if (currentHeavy >= maxHeavy) {
          // Skip heavy task for now if heavy budget reached
          continue;
        }
        currentHeavy++;
      }

      selected.push(task);
    }

    return selected;
  }
}

module.exports = {
  PriorityScheduler,
};
