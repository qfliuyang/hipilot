/**
 * MissionPackCertifier - Test certification with mission pack validation
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadMissionPack, hasMissionPack, MissionPack } from '../../mission-pack/index.js';
import { autoDetectMissionPack, canAutoDetect } from '../../mission-pack/auto-detect.js';

const GAP_SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  MINOR: 'minor',
  PASSED: 'passed',
};

export class MissionPackCertifier {
  constructor(options = {}) {
    this.designDir = options.designDir || process.env.HIPILOT_DESIGN_DIR;
    this.missionPack = null;
    this.gaps = [];
    this.recommendations = [];
  }

  loadMissionPack() {
    if (!this.designDir) {
      return { success: false, error: 'No design directory' };
    }

    if (hasMissionPack(this.designDir)) {
      this.missionPack = loadMissionPack(this.designDir);
    } else if (canAutoDetect(this.designDir).canDetect) {
      const autoData = autoDetectMissionPack(this.designDir);
      this.missionPack = new MissionPack(autoData, null, this.designDir);
    }

    return { success: true, missionPack: this.missionPack };
  }

  checkQoRAgainstTargets(stage, metrics) {
    if (!this.missionPack) {
      return { error: 'Mission pack not loaded' };
    }

    const targets = this.missionPack.targets || this.missionPack.flow?.targets || {};
    const gaps = [];

    if (targets.timing && metrics.timing) {
      const timing = metrics.timing;
      if (targets.timing.wns !== undefined && timing.wns !== undefined) {
        if (timing.wns < targets.timing.wns) {
          gaps.push({ metric: 'WNS', stage, actual: timing.wns, target: targets.timing.wns });
        }
      }
    }

    this.gaps.push(...gaps);
    return { stage, targetsMet: gaps.length === 0, gaps };
  }

  calculateGap(actual, target, direction = 'lower') {
    let percentageDiff = direction === 'lower'
      ? ((actual - target) / Math.abs(target || 1)) * 100
      : ((target - actual) / Math.abs(target || 1)) * 100;

    let severity = GAP_SEVERITY.PASSED;
    if (percentageDiff > 0) {
      if (percentageDiff < 10) severity = GAP_SEVERITY.MINOR;
      else if (percentageDiff < 20) severity = GAP_SEVERITY.WARNING;
      else severity = GAP_SEVERITY.CRITICAL;
    }

    return { percentage: Math.abs(percentageDiff).toFixed(2), severity, direction };
  }

  getFlowProgress(completedStages = []) {
    if (!this.missionPack) {
      return { error: 'Mission pack not loaded' };
    }

    const stages = this.missionPack.stages || this.missionPack.flow?.stages || [];
    const completed = stages.filter(s => completedStages.includes(s));
    const remaining = stages.filter(s => !completedStages.includes(s));
    const progress = stages.length > 0 ? (completed.length / stages.length) * 100 : 0;

    return {
      totalStages: stages.length,
      completedStages: completed.length,
      remainingStages: remaining.length,
      progress: progress.toFixed(1),
      stages,
      completed,
      remaining,
      nextStage: remaining[0] || null,
    };
  }
}

export default { MissionPackCertifier, GAP_SEVERITY };
