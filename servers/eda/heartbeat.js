/**
 * HiPilot Heartbeat System
 *
 * Provides file-based heartbeat emission for event-driven state monitoring.
 * Replaces polling with fs.watch()-based notifications for zero CPU idle usage.
 *
 * @module heartbeat
 */

import { writeFileSync, readFileSync, unlinkSync, existsSync, watch, renameSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Get the heartbeat file path for a session
 * @param {string} session - Session name (default: process.env.HIPILOT_SESSION or 'hipilot')
 * @returns {string} Path to heartbeat file
 */
export function getHeartbeatPath(session = null) {
  const sessionName = session || process.env.HIPILOT_SESSION || 'hipilot';
  const username = process.env.USER || process.env.USERNAME || 'unknown';
  return join(tmpdir(), `hipilot-${sessionName}-heartbeat.json`);
}

/**
 * Current heartbeat state structure
 * @typedef {Object} HeartbeatState
 * @property {number} timestamp - Unix timestamp (ms)
 * @property {string} state - 'running' | 'idle' | 'error' | 'complete' | 'waiting'
 * @property {string} [tool] - Current EDA tool (e.g., 'innovus', 'dc_shell')
 * @property {string} [stage] - Current flow stage name
 * @property {number} [progress] - Progress percentage (0-100)
 * @property {string} [lastOutput] - Last significant output from tool
 * @property {number} [eta_seconds] - Estimated time remaining
 * @property {Object} [metadata] - Additional context-specific data
 */

let lastEmittedState = null;
let lastEmittedTime = 0;
const MIN_EMIT_INTERVAL_MS = 50; // Throttle rapid state changes

/**
 * Emit a heartbeat to the filesystem
 *
 * @param {string} state - Current state ('running', 'idle', 'error', 'complete', 'waiting')
 * @param {Object} data - Additional heartbeat data
 * @param {string} [data.tool] - EDA tool name
 * @param {string} [data.stage] - Flow stage
 * @param {number} [data.progress] - Progress (0-100)
 * @param {string} [data.lastOutput] - Last output snippet
 * @param {number} [data.eta_seconds] - ETA in seconds
 * @param {Object} [data.metadata] - Extra metadata
 * @param {string} [session] - Session name override
 * @returns {boolean} True if heartbeat was written
 */
export function emitHeartbeat(state, data = {}, session = null) {
  const now = Date.now();
  const heartbeatPath = getHeartbeatPath(session);

  // Throttle: don't emit same state too rapidly
  const stateKey = `${state}:${data.tool || ''}:${data.stage || ''}:${data.progress || ''}`;
  if (stateKey === lastEmittedState && (now - lastEmittedTime) < MIN_EMIT_INTERVAL_MS) {
    return false;
  }

  const heartbeat = {
    timestamp: now,
    state,
    ...data,
  };

  try {
    // Atomic write: write to temp file, then rename
    const tempPath = `${heartbeatPath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(heartbeat, null, 2), { mode: 0o644 });
    // Rename is atomic on POSIX
    renameSync(tempPath, heartbeatPath);

    lastEmittedState = stateKey;
    lastEmittedTime = now;
    return true;
  } catch (err) {
    // Fail silently - heartbeat is best-effort
    return false;
  }
}

/**
 * Read the latest heartbeat from filesystem
 *
 * @param {string} [session] - Session name override
 * @returns {HeartbeatState|null} The latest heartbeat or null if none exists
 */
export function getLatestHeartbeat(session = null) {
  const heartbeatPath = getHeartbeatPath(session);

  try {
    if (!existsSync(heartbeatPath)) {
      return null;
    }
    const content = readFileSync(heartbeatPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

/**
 * Clear (delete) the heartbeat file
 *
 * @param {string} [session] - Session name override
 * @returns {boolean} True if file was deleted or didn't exist
 */
export function clearHeartbeat(session = null) {
  const heartbeatPath = getHeartbeatPath(session);

  try {
    if (existsSync(heartbeatPath)) {
      unlinkSync(heartbeatPath);
    }
    lastEmittedState = null;
    lastEmittedTime = 0;
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Check if heartbeat file exists and is recent
 *
 * @param {number} [maxAgeMs=5000] - Maximum age in milliseconds
 * @param {string} [session] - Session name override
 * @returns {boolean} True if heartbeat exists and is fresh
 */
export function isHeartbeatFresh(maxAgeMs = 5000, session = null) {
  const heartbeat = getLatestHeartbeat(session);
  if (!heartbeat) return false;

  const age = Date.now() - heartbeat.timestamp;
  return age <= maxAgeMs;
}

/**
 * Watch for heartbeat changes using fs.watch()
 *
 * @param {Function} callback - Called when heartbeat changes
 * @param {string} [session] - Session name override
 * @returns {Object} Watcher control object with stop() method
 */
export function watchHeartbeat(callback, session = null) {
  const heartbeatPath = getHeartbeatPath(session);
  let watcher = null;
  let lastContent = null;
  let isStopped = false;

  const handleChange = () => {
    if (isStopped) return;

    try {
      const heartbeat = getLatestHeartbeat(session);
      if (!heartbeat) return;

      const content = JSON.stringify(heartbeat);
      if (content === lastContent) return; // Dedupe

      lastContent = content;
      callback(heartbeat);
    } catch (err) {
      // Ignore read errors during watch
    }
  };

  // Start watching
  try {
    watcher = watch(heartbeatPath, (eventType) => {
      if (eventType === 'change' || eventType === 'rename') {
        handleChange();
      }
    });

    // Also check immediately in case file already exists
    handleChange();
  } catch (err) {
    // File may not exist yet, that's ok - we'll create it on first emit
  }

  return {
    /**
     * Stop watching for heartbeats
     */
    stop() {
      isStopped = true;
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    },

    /**
     * Check if watcher is active
     */
    get isActive() {
      return !isStopped && watcher !== null;
    },

    /**
     * Force a manual check
     */
    check: handleChange,
  };
}

/**
 * Wait for a specific state via heartbeat (promise-based)
 *
 * @param {string|string[]} targetStates - State(s) to wait for
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs=300000] - Timeout in milliseconds
 * @param {string} [options.session] - Session name
 * @returns {Promise<HeartbeatState>} Resolves with heartbeat when target state reached
 */
export function waitForState(targetStates, options = {}) {
  const states = Array.isArray(targetStates) ? targetStates : [targetStates];
  const timeoutMs = options.timeoutMs || 300000;
  const session = options.session || null;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let watcher = null;
    let timeoutId = null;

    const cleanup = () => {
      if (watcher) {
        watcher.stop();
        watcher = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // Set timeout
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for state: ${states.join('|')}`));
    }, timeoutMs);

    // Check current state first
    const current = getLatestHeartbeat(session);
    if (current && states.includes(current.state)) {
      cleanup();
      resolve(current);
      return;
    }

    // Watch for changes
    watcher = watchHeartbeat((heartbeat) => {
      if (states.includes(heartbeat.state)) {
        cleanup();
        resolve(heartbeat);
      }
    }, session);
  });
}

/**
 * Create a heartbeat emitter bound to a specific session and stage
 *
 * @param {string} session - Session name
 * @param {string} stage - Stage name
 * @param {string} tool - Tool name
 * @returns {Object} Bound emitter methods
 */
export function createEmitter(session, stage, tool) {
  const baseData = { stage, tool };

  return {
    running: (progress, metadata) =>
      emitHeartbeat('running', { ...baseData, progress, ...metadata }, session),

    idle: (metadata) =>
      emitHeartbeat('idle', { ...baseData, ...metadata }, session),

    error: (error, metadata) =>
      emitHeartbeat('error', { ...baseData, lastOutput: error, ...metadata }, session),

    complete: (metadata) =>
      emitHeartbeat('complete', { ...baseData, ...metadata }, session),

    waiting: (eta_seconds, metadata) =>
      emitHeartbeat('waiting', { ...baseData, eta_seconds, ...metadata }, session),
  };
}

export default {
  getHeartbeatPath,
  emitHeartbeat,
  getLatestHeartbeat,
  clearHeartbeat,
  isHeartbeatFresh,
  watchHeartbeat,
  waitForState,
  createEmitter,
};
