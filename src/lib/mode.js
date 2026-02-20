/**
 * HiPilot Mode Management
 * 
 * Implements the "Claude has the conn" safety system:
 * - MANUAL mode (default): Each Tcl command requires user approval
 * - AUTO mode ("Claude has the conn"): Commands execute immediately
 * 
 * Mode is stored in /tmp/hipilot_mode file
 * Pending Tcl is stored in /tmp/hipilot_pending.tcl
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { homedir } from 'os';

export const MODE_FILE = '/tmp/hipilot_mode';
export const PENDING_FILE = '/tmp/hipilot_pending.tcl';
export const PENDING_META_FILE = '/tmp/hipilot_pending_meta.json';

export const MODES = {
  MANUAL: 'manual',   // User must approve each command
  AUTO: 'auto',       // "Claude has the conn" - auto-execute
};

/**
 * Get current mode (defaults to MANUAL for safety)
 */
export function getMode() {
  try {
    if (existsSync(MODE_FILE)) {
      const mode = readFileSync(MODE_FILE, 'utf-8').trim();
      if (mode === MODES.AUTO || mode === MODES.MANUAL) {
        return mode;
      }
    }
  } catch {
    // Ignore errors, default to manual
  }
  return MODES.MANUAL;
}

/**
 * Set mode
 */
export function setMode(mode) {
  if (mode !== MODES.MANUAL && mode !== MODES.AUTO) {
    throw new Error(`Invalid mode: ${mode}`);
  }
  writeFileSync(MODE_FILE, mode);
  return mode;
}

/**
 * Toggle between manual and auto mode
 */
export function toggleMode() {
  const current = getMode();
  const newMode = current === MODES.MANUAL ? MODES.AUTO : MODES.MANUAL;
  setMode(newMode);
  return newMode;
}

/**
 * Check if Claude has the conn (auto mode)
 */
export function isAutoMode() {
  return getMode() === MODES.AUTO;
}

/**
 * Check if manual approval is required
 */
export function isManualMode() {
  return getMode() === MODES.MANUAL;
}

/**
 * Queue Tcl for pending approval (manual mode)
 */
export function queuePending(tcl, metadata = {}) {
  writeFileSync(PENDING_FILE, tcl);
  writeFileSync(PENDING_META_FILE, JSON.stringify({
    queuedAt: new Date().toISOString(),
    ...metadata,
  }, null, 2));
  return PENDING_FILE;
}

/**
 * Get pending Tcl (if any)
 */
export function getPending() {
  try {
    if (existsSync(PENDING_FILE)) {
      const tcl = readFileSync(PENDING_FILE, 'utf-8');
      let meta = {};
      if (existsSync(PENDING_META_FILE)) {
        meta = JSON.parse(readFileSync(PENDING_META_FILE, 'utf-8'));
      }
      return { tcl, meta, exists: true };
    }
  } catch {
    // Ignore errors
  }
  return { tcl: null, meta: {}, exists: false };
}

/**
 * Clear pending Tcl
 */
export function clearPending() {
  try {
    if (existsSync(PENDING_FILE)) unlinkSync(PENDING_FILE);
    if (existsSync(PENDING_META_FILE)) unlinkSync(PENDING_META_FILE);
  } catch {
    // Ignore errors
  }
}

/**
 * Approve pending Tcl (returns the Tcl content)
 */
export function approvePending() {
  const pending = getPending();
  if (pending.exists) {
    clearPending();
    return { approved: true, tcl: pending.tcl, meta: pending.meta };
  }
  return { approved: false, tcl: null, meta: {} };
}

/**
 * Reject pending Tcl
 */
export function rejectPending() {
  clearPending();
  return { rejected: true };
}

/**
 * Get mode status for display
 */
export function getModeStatus() {
  const mode = getMode();
  const pending = getPending();
  
  if (mode === MODES.AUTO) {
    return {
      mode,
      icon: '⚡',
      label: 'Claude has conn',
      color: '#00ff88',
      description: 'Auto-execute mode - Claude can send commands directly',
      pending: false,
    };
  } else {
    return {
      mode,
      icon: '🔒',
      label: 'Manual approval',
      color: '#ffd700',
      description: 'Manual mode - Each command requires approval',
      pending: pending.exists,
      pendingInfo: pending.exists ? {
        queuedAt: pending.meta.queuedAt,
        lines: pending.tcl.split('\n').length,
      } : null,
    };
  }
}
