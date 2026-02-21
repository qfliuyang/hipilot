/**
 * Tmux Test Helpers
 *
 * Utilities for testing tmux interactions
 */

import { execSync } from 'child_process';

const TMUX_SESSION = process.env.HIPILOT_TEST_SESSION || 'hipilot-test';

/**
 * Start a test tmux session
 */
export function startTestSession() {
  try {
    // Kill existing session
    try { execSync(`tmux kill-session -t ${TMUX_SESSION} 2>/dev/null`); } catch {}

    // Create new session
    execSync(`tmux new-session -d -s ${TMUX_SESSION} -x 120 -y 40`);
    execSync(`tmux split-window -h -t ${TMUX_SESSION}`);

    return { success: true, session: TMUX_SESSION };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Kill test tmux session
 */
export function killTestSession() {
  try {
    execSync(`tmux kill-session -t ${TMUX_SESSION} 2>/dev/null`);
    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * Send keys to a pane
 */
export function sendKeys(pane, keys) {
  const paneTarget = pane === 'eda' || pane === '1'
    ? `${TMUX_SESSION}:0.1`
    : `${TMUX_SESSION}:0.0`;

  try {
    execSync(`tmux send-keys -t ${paneTarget} ${keys}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Capture pane output
 */
export function capturePane(pane, lines = 50) {
  const paneTarget = pane === 'eda' || pane === '1'
    ? `${TMUX_SESSION}:0.1`
    : `${TMUX_SESSION}:0.0`;

  try {
    const output = execSync(
      `tmux capture-pane -t ${paneTarget} -p -S -${lines}`,
      { encoding: 'utf-8' }
    );
    return { success: true, output };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Wait for output pattern in pane
 */
export async function waitForPattern(pane, pattern, timeoutMs = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const { success, output } = capturePane(pane, 100);
    if (success && output.match(pattern)) {
      return { success: true, output };
    }
    await new Promise(r => setTimeout(r, 100));
  }

  return { success: false, error: 'Timeout waiting for pattern' };
}

/**
 * Clear pane history
 */
export function clearPane(pane) {
  const paneTarget = pane === 'eda' || pane === '1'
    ? `${TMUX_SESSION}:0.1`
    : `${TMUX_SESSION}:0.0`;

  try {
    execSync(`tmux send-keys -t ${paneTarget} C-l`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default {
  startTestSession,
  killTestSession,
  sendKeys,
  capturePane,
  waitForPattern,
  clearPane,
  TMUX_SESSION,
};
