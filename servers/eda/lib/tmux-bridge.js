/**
 * tmux-bridge.js - Tmux command execution utilities
 *
 * Provides safe wrappers around execSync for tmux commands.
 */

import { execSync } from 'child_process';
import { CONFIG } from '../../../src/lib/config.js';

/**
 * Execute a shell command with error handling.
 * @param {string} cmd - Command to execute
 * @param {object} options - execSync options
 * @returns {string} Command output
 */
export function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, ...options });
  } catch (error) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

/**
 * Capture pane output from tmux.
 * @param {string} pane - Pane target (e.g., 'eda', 'chat')
 * @param {number} lines - Number of lines to capture from end
 * @returns {string} Captured output
 */
export function capturePane(pane = 'eda', lines = 200) {
  const target = `${CONFIG.TMUX_SESSION}:0.${CONFIG.PANE_LAYOUT[pane.toUpperCase()] || 1}`;
  const cmd = `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${target} -p -S -${lines} 2>/dev/null`;
  return exec(cmd, { timeout: 2000 });
}

/**
 * Send keys to a tmux pane.
 * @param {string} keys - Keys to send
 * @param {string} pane - Pane target (e.g., 'eda', 'chat')
 */
export function sendKeys(keys, pane = 'eda') {
  const target = `${CONFIG.TMUX_SESSION}:0.${CONFIG.PANE_LAYOUT[pane.toUpperCase()] || 1}`;
  exec(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} -l ${keys}`, { stdio: 'pipe' });
}

/**
 * Send Enter key to a tmux pane.
 * @param {string} pane - Pane target (e.g., 'eda', 'chat')
 */
export function sendEnter(pane = 'eda') {
  const target = `${CONFIG.TMUX_SESSION}:0.${CONFIG.PANE_LAYOUT[pane.toUpperCase()] || 1}`;
  exec(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} C-m`, { stdio: 'pipe' });
}

/**
 * Update tmux status bar with current mode.
 * @param {string} mode - 'auto' or 'manual'
 * @param {boolean} pending - Whether there's pending Tcl
 */
export function updateModeStatus(mode, pending = false) {
  try {
    const session = CONFIG.TMUX_SESSION;
    let statusLeft;
    if (mode === 'auto') {
      statusLeft = `#[fg=#000000,bg=#00ff88,bold] ⚡ Claude has conn #[default]#[fg=#666666]│`;
    } else {
      const pendingIndicator = pending ? ' ⏳' : '';
      statusLeft = `#[fg=#00d4ff,bg=#1a1a2e,bold] ⚙ HiPilot #[fg=#666666]│#[fg=#ffd700] 🔒 Manual${pendingIndicator} #[fg=#666666]│`;
    }
    exec(`tmux -L ${CONFIG.TMUX_SOCKET} set-option -t ${session} status-left "${statusLeft}"`, { stdio: 'pipe' });
  } catch {
    // Tmux status update is best-effort
  }
}
