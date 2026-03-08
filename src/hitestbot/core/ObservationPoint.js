/**
 * ObservationPoint - Synchronized multi-view evidence capture
 *
 * Captures a "bookmark" at a defined moment: pane output from both panes,
 * a screenshot, and the video offset. Creates a Three-View Correlation
 * point per TESTING_RULES.md Section 6.3.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export class ObservationPoint {
  /**
   * Capture an observation point.
   * @param {string} name - Observation type: STAGE_START, PROMPT_SENT, AI_RESPONDED, STAGE_COMPLETE, ON_ERROR
   * @param {object} options
   * @param {string} options.evidenceDir - Directory to save artifacts
   * @param {string} options.session - tmux session name
   * @param {string} options.socket - tmux socket name (for -L flag)
   * @param {number} options.recordingStartTime - epoch ms when video recording started
   * @param {string} options.display - X11 display for screenshots
   * @param {object} options.context - custom context data (stage, qor, etc.)
   * @param {Function} options.sshFn - SSH function for remote execution (optional)
   */
  static async capture(name, options = {}) {
    const {
      evidenceDir,
      session = 'hipilot',
      socket = null,
      recordingStartTime = null,
      display = ':0',
      context = {},
      sshFn = null,
    } = options;

    const timestamp = Date.now();
    const isoTime = new Date(timestamp).toISOString();
    const filePrefix = `obs_${name.toLowerCase()}`;

    if (evidenceDir && !existsSync(evidenceDir)) {
      mkdirSync(evidenceDir, { recursive: true });
    }

    const tmuxCmd = socket ? `tmux -L ${socket}` : 'tmux';
    const exec = sshFn || ((cmd) => {
      try { return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }); }
      catch { return ''; }
    });

    // Capture Claude pane (pane 0) - increased scrollback to catch stage completions
    let claudePane = '';
    try {
      claudePane = await Promise.resolve(
        exec(`${tmuxCmd} capture-pane -t ${session}:0.0 -p -S -1000 2>/dev/null || echo ""`)
      );
    } catch {}

    // Capture EDA pane (pane 1) - increased scrollback to catch stage completions
    let edaPane = '';
    try {
      edaPane = await Promise.resolve(
        exec(`${tmuxCmd} capture-pane -t ${session}:0.1 -p -S -1000 2>/dev/null || echo ""`)
      );
    } catch {}

    // Save pane captures
    if (evidenceDir) {
      writeFileSync(join(evidenceDir, `${filePrefix}_claude.log`), claudePane);
      writeFileSync(join(evidenceDir, `${filePrefix}_eda.log`), edaPane);
    }

    // Take screenshot (local only, skip on remote/no display)
    let screenshotPath = null;
    if (evidenceDir && !sshFn) {
      try {
        screenshotPath = join(evidenceDir, `${filePrefix}.png`);
        execSync(`import -window root -display ${display} ${screenshotPath} 2>/dev/null`, { timeout: 10000 });
      } catch {
        screenshotPath = null;
      }
    }

    // Calculate video offset
    const videoOffsetS = recordingStartTime
      ? (timestamp - recordingStartTime) / 1000
      : null;

    const observation = {
      name,
      timestamp: isoTime,
      epoch_ms: timestamp,
      video_offset_s: videoOffsetS,
      artifacts: {
        claude_pane: evidenceDir ? `${filePrefix}_claude.log` : null,
        eda_pane: evidenceDir ? `${filePrefix}_eda.log` : null,
        screenshot: screenshotPath ? `${filePrefix}.png` : null,
      },
      content: {
        claude_pane_lines: claudePane.split('\n').length,
        eda_pane_lines: edaPane.split('\n').length,
        claude_pane_last50: claudePane.split('\n').slice(-200).join('\n'),
        eda_pane_last50: edaPane.split('\n').slice(-200).join('\n'),
      },
      context,
    };

    return observation;
  }

  /**
   * Capture a series of observation points with names matching TESTING_RULES.md mandatory points.
   */
  static get MANDATORY_POINTS() {
    return ['STAGE_START', 'PROMPT_SENT', 'AI_RESPONDED', 'EDA_EXECUTING', 'STAGE_COMPLETE', 'ON_ERROR'];
  }
}
