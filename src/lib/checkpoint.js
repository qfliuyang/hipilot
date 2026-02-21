/**
 * HiPilot QoR Checkpoint System
 *
 * Tracks and compares QoR metrics across iterations
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { info, debug } from './logger.js';

const CHECKPOINTS_DIR = join(homedir(), '.hipilot', 'checkpoints');

/**
 * Ensure checkpoints directory exists
 */
function ensureCheckpointDir() {
  if (!existsSync(CHECKPOINTS_DIR)) {
    try {
      mkdirSync(CHECKPOINTS_DIR, { recursive: true });
    } catch (err) {
      debug('Failed to create checkpoints directory', { error: err.message });
    }
  }
}

/**
 * Get checkpoint file path
 */
function getCheckpointPath(name) {
  ensureCheckpointDir();
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(CHECKPOINTS_DIR, `${safeName}.json`);
}

/**
 * Save a QoR checkpoint
 */
export function saveCheckpoint(name, metrics, metadata = {}) {
  const checkpoint = {
    name,
    timestamp: new Date().toISOString(),
    metrics: {
      wns: metrics.wns ?? null,
      tns: metrics.tns ?? null,
      setupViolations: metrics.setup_violations ?? metrics.setupViolations ?? 0,
      holdViolations: metrics.hold_violations ?? metrics.holdViolations ?? 0,
      drcViolations: metrics.drc_violations ?? metrics.drcViolations ?? 0,
      totalPower: metrics.total_power ?? metrics.totalPower ?? null,
      leakagePower: metrics.leakage_power ?? metrics.leakagePower ?? null,
      area: metrics.area ?? null,
      utilization: metrics.utilization ?? null,
      cellCount: metrics.cell_count ?? metrics.cellCount ?? null,
    },
    metadata: {
      tool: metadata.tool ?? 'unknown',
      design: metadata.design ?? 'unknown',
      stage: metadata.stage ?? 'unknown',
      corner: metadata.corner ?? 'unknown',
      ...metadata,
    },
  };

  const path = getCheckpointPath(name);
  try {
    writeFileSync(path, JSON.stringify(checkpoint, null, 2));
    info('Checkpoint saved', { name, path });
    return { success: true, checkpoint };
  } catch (err) {
    debug('Failed to save checkpoint', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Load a checkpoint
 */
export function loadCheckpoint(name) {
  const path = getCheckpointPath(name);
  try {
    if (!existsSync(path)) {
      return { success: false, error: `Checkpoint '${name}' not found` };
    }
    const data = readFileSync(path, 'utf-8');
    const checkpoint = JSON.parse(data);
    return { success: true, checkpoint };
  } catch (err) {
    debug('Failed to load checkpoint', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * List all checkpoints
 */
export function listCheckpoints() {
  ensureCheckpointDir();
  try {
    const files = readdirSync(CHECKPOINTS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const name = f.replace('.json', '');
        const result = loadCheckpoint(name);
        return result.success ? {
          name: result.checkpoint.name,
          timestamp: result.checkpoint.timestamp,
          stage: result.checkpoint.metadata.stage,
          tool: result.checkpoint.metadata.tool,
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return { success: true, checkpoints: files };
  } catch (err) {
    debug('Failed to list checkpoints', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Compare two checkpoints
 */
export function compareCheckpoints(baselineName, currentName = null) {
  // Load baseline
  const baselineResult = loadCheckpoint(baselineName);
  if (!baselineResult.success) {
    return baselineResult;
  }

  // Load current (or use most recent if not specified)
  let currentResult;
  if (currentName) {
    currentResult = loadCheckpoint(currentName);
  } else {
    // Find most recent checkpoint that's not the baseline
    const list = listCheckpoints();
    const recent = list.checkpoints?.find(c => c.name !== baselineName);
    if (recent) {
      currentResult = loadCheckpoint(recent.name);
    } else {
      return { success: false, error: 'No current checkpoint to compare against' };
    }
  }

  if (!currentResult.success) {
    return currentResult;
  }

  const baseline = baselineResult.checkpoint;
  const current = currentResult.checkpoint;

  // Calculate deltas
  const calcDelta = (curr, base) => {
    if (curr === null || base === null) return null;
    const delta = curr - base;
    const percent = base !== 0 ? ((delta / Math.abs(base)) * 100).toFixed(2) : null;
    return { delta, percent: percent ? parseFloat(percent) : null };
  };

  const comparison = {
    baseline: {
      name: baseline.name,
      timestamp: baseline.timestamp,
      metrics: baseline.metrics,
    },
    current: {
      name: current.name,
      timestamp: current.timestamp,
      metrics: current.metrics,
    },
    deltas: {
      wns: calcDelta(current.metrics.wns, baseline.metrics.wns),
      tns: calcDelta(current.metrics.tns, baseline.metrics.tns),
      setupViolations: calcDelta(current.metrics.setupViolations, baseline.metrics.setupViolations),
      holdViolations: calcDelta(current.metrics.holdViolations, baseline.metrics.holdViolations),
      drcViolations: calcDelta(current.metrics.drcViolations, baseline.metrics.drcViolations),
      totalPower: calcDelta(current.metrics.totalPower, baseline.metrics.totalPower),
      area: calcDelta(current.metrics.area, baseline.metrics.area),
    },
    summary: {
      improved: 0,
      regressed: 0,
      unchanged: 0,
    },
  };

  // Count improvements/regressions
  const metricsToCheck = ['wns', 'tns', 'setupViolations', 'holdViolations', 'drcViolations'];
  metricsToCheck.forEach(metric => {
    const delta = comparison.deltas[metric];
    if (delta && delta.delta !== null) {
      // For violations and negative metrics, lower is better
      // For WNS/TNS (negative values), closer to 0 is better
      if (metric === 'wns' || metric === 'tns') {
        if (delta.delta > 0) comparison.summary.improved++;
        else if (delta.delta < 0) comparison.summary.regressed++;
        else comparison.summary.unchanged++;
      } else {
        if (delta.delta < 0) comparison.summary.improved++;
        else if (delta.delta > 0) comparison.summary.regressed++;
        else comparison.summary.unchanged++;
      }
    }
  });

  return { success: true, comparison };
}

/**
 * Format comparison for display
 */
export function formatComparison(comparison) {
  const { baseline, current, deltas, summary } = comparison;

  let output = '';
  output += `📊 QoR Comparison\n`;
  output += `==================\n\n`;
  output += `Baseline: ${baseline.name} (${new Date(baseline.timestamp).toLocaleString()})\n`;
  output += `Current:  ${current.name} (${new Date(current.timestamp).toLocaleString()})\n\n`;

  output += `Metrics:\n`;
  output += `--------\n`;

  const formatMetric = (name, value, delta) => {
    if (value === null) return `  ${name}: N/A\n`;

    let deltaStr = '';
    if (delta && delta.delta !== null) {
      const sign = delta.delta > 0 ? '+' : '';
      const percentStr = delta.percent !== null ? ` (${sign}${delta.percent}%)` : '';
      deltaStr = ` [${sign}${delta.delta.toFixed(3)}${percentStr}]`;

      // Color coding
      const isViolation = ['setupViolations', 'holdViolations', 'drcViolations'].includes(name);
      const isTiming = ['wns', 'tns'].includes(name);

      if (isViolation || isTiming) {
        // For these, lower/less negative is better
        if (delta.delta < 0 || (isTiming && delta.delta > 0)) {
          deltaStr = ` 📈${deltaStr}`;
        } else if (delta.delta > 0 || (isTiming && delta.delta < 0)) {
          deltaStr = ` 📉${deltaStr}`;
        } else {
          deltaStr = ` ➡️${deltaStr}`;
        }
      }
    }

    return `  ${name}: ${value}${deltaStr}\n`;
  };

  output += formatMetric('WNS', current.metrics.wns, deltas.wns);
  output += formatMetric('TNS', current.metrics.tns, deltas.tns);
  output += formatMetric('Setup Violations', current.metrics.setupViolations, deltas.setupViolations);
  output += formatMetric('Hold Violations', current.metrics.holdViolations, deltas.holdViolations);
  output += formatMetric('DRC Violations', current.metrics.drcViolations, deltas.drcViolations);
  output += formatMetric('Total Power', current.metrics.totalPower, deltas.totalPower);
  output += formatMetric('Area', current.metrics.area, deltas.area);

  output += `\nSummary:\n`;
  output += `--------\n`;
  output += `  📈 Improved: ${summary.improved}\n`;
  output += `  📉 Regressed: ${summary.regressed}\n`;
  output += `  ➡️ Unchanged: ${summary.unchanged}\n`;

  return output;
}

/**
 * Delete a checkpoint
 */
export function deleteCheckpoint(name) {
  const path = getCheckpointPath(name);
  try {
    if (!existsSync(path)) {
      return { success: false, error: `Checkpoint '${name}' not found` };
    }
    writeFileSync(path, ''); // Clear content
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default {
  saveCheckpoint,
  loadCheckpoint,
  listCheckpoints,
  compareCheckpoints,
  formatComparison,
  deleteCheckpoint,
};
