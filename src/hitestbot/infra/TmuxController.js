class TmuxController {
  constructor(options = {}) {
    this.sessionName = options.sessionName || 'hipilot';
    this.socketName = options.socketName || 'hipilot';
    this.tmuxBin = options.tmuxBin || '/home/EDA/hipilot_test/.local/bin/tmux';
  }

  async createSession(sshFn) {
    const commands = [
      `${this.tmuxBin} -L ${this.socketName} kill-server 2>/dev/null || true`,
      'sleep 2',
      `${this.tmuxBin} -L ${this.socketName} new-session -d -s ${this.sessionName} -x 160 -y 45`,
      `${this.tmuxBin} -L ${this.socketName} split-window -h -l 50%`,
      `${this.tmuxBin} -L ${this.socketName} set-option -g status on`,
      `${this.tmuxBin} -L ${this.socketName} set-option -g status-style 'bg=#1a1a2e,fg=#00d4ff'`,
      `${this.tmuxBin} -L ${this.socketName} set-option -g status-left '#[fg=#00d4ff,bold] HiPilot #[fg=#ffd700]| HiTestBot '`,
      `${this.tmuxBin} -L ${this.socketName} set-option -g status-right '#[fg=#00ff00]%H:%M:%S#[default]'`
    ];

    for (const cmd of commands) {
      await sshFn(cmd, 10000);
    }
  }

  async sendKeys(target, text, sendKey = true, key = 'C-m') {
    const ssh = this.sshFn;

    if (text) {
      // Use -l for literal text so tmux doesn't interpret key names in the text
      await ssh(`${this.tmuxBin} -L ${this.socketName} send-keys -t ${target} -l '${this.escapeShell(text)}'`);
    }

    if (sendKey) {
      // Send key (e.g., C-m for Enter) as an unquoted tmux key name
      await ssh(`${this.tmuxBin} -L ${this.socketName} send-keys -t ${target} ${key}`);
    }
  }

  async capturePane(target, outputPath, lines = 100) {
    if (outputPath) {
      await this.sshFn(
        `${this.tmuxBin} -L ${this.socketName} capture-pane -t ${target} -p -S -${lines} > ${outputPath}`
      );
    } else {
      return await this.sshFn(
        `${this.tmuxBin} -L ${this.socketName} capture-pane -t ${target} -p -S -${lines}`,
        10000,
        true
      );
    }
  }

  async listSessions() {
    return await this.sshFn(
      `${this.tmuxBin} -L ${this.socketName} list-sessions 2>/dev/null || echo 'No sessions'`,
      5000,
      true
    );
  }

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

  escapeShell(str) {
    return str.replace(/'/g, "'\\''");
  }

  setSSH(fn) {
    this.sshFn = fn;
  }
}

export { TmuxController };
