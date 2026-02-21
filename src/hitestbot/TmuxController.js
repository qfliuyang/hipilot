/**
 * TmuxController - Standardized tmux operations for E2E testing
 *
 * Handles tmux session management with correct key sequences.
 * Uses C-m (Ctrl+M) for sending commands to avoid the "Enter vs C-m" mistake.
 */

class TmuxController {
  constructor(options = {}) {
    this.sessionName = options.sessionName || 'hipilot';
    this.socketName = options.socketName || 'hipilot';
    this.tmuxBin = options.tmuxBin || '/home/EDA/hipilot_test/.local/bin/tmux';
  }

  /**
   * Create a new tmux session with proper configuration
   */
  async createSession(sshFn) {
    const commands = [
      // Kill existing session
      `${this.tmuxBin} -L ${this.socketName} kill-server 2>/dev/null || true`,
      'sleep 2',

      // Create new session
      `${this.tmuxBin} -L ${this.socketName} new-session -d -s ${this.sessionName} -x 160 -y 45`,

      // Split window horizontally 50/50
      `${this.tmuxBin} -L ${this.socketName} split-window -h -l 50%`,

      // Configure status bar
      `${this.tmuxBin} -L ${this.socketName} set-option -g status on`,
      `${this.tmuxBin} -L ${this.socketName} set-option -g status-style 'bg=#1a1a2e,fg=#00d4ff'`,
      `${this.tmuxBin} -L ${this.socketName} set-option -g status-left '#[fg=#00d4ff,bold] HiPilot #[fg=#ffd700]| HiTestBot '`,
      `${this.tmuxBin} -L ${this.socketName} set-option -g status-right '#[fg=#00ff00]%H:%M:%S#[default]'`
    ];

    for (const cmd of commands) {
      await sshFn(cmd, 10000);
    }
  }

  /**
   * Send keys to a tmux pane
   * @param {string} target - Pane target (e.g., 'hipilot:0.0')
   * @param {string|null} text - Text to type (null if only sending key)
   * @param {boolean} sendKey - Whether to send C-m after text
   * @param {string} key - Key to send (default: 'C-m' for Ctrl+M)
   */
  async sendKeys(target, text, sendKey = true, key = 'C-m') {
    const ssh = this.sshFn;

    if (text) {
      // Type the text without executing
      await ssh(`${this.tmuxBin} -L ${this.socketName} send-keys -t ${target} '${this.escapeShell(text)}'`);
    }

    if (sendKey) {
      // Send the key (C-m for Claude Code, C-m for Innovus)
      await ssh(`${this.tmuxBin} -L ${this.socketName} send-keys -t ${target} ${key}`);
    }
  }

  /**
   * Capture pane content to file
   */
  async capturePane(target, outputPath, lines = 100) {
    await this.sshFn(
      `${this.tmuxBin} -L ${this.socketName} capture-pane -t ${target} -p -S -${lines} > ${outputPath}`
    );
  }

  /**
   * List all sessions
   */
  async listSessions() {
    return await this.sshFn(
      `${this.tmuxBin} -L ${this.socketName} list-sessions 2>/dev/null || echo 'No sessions'`,
      5000,
      true
    );
  }

  /**
   * Check if session exists
   */
  async sessionExists() {
    try {
      await this.sshFn(
        `${this.tmuxBin} -L ${this.socketName} has-session -t ${this.sessionName}`,
        5000
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Escape shell special characters
   */
  escapeShell(str) {
    return str.replace(/'/g, "'\\''");
  }

  /**
   * Set the SSH function for remote execution
   */
  setSSH(fn) {
    this.sshFn = fn;
  }
}

module.exports = { TmuxController };
