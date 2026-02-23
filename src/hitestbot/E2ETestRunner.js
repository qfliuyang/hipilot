import { TestRunner } from './TestRunner.js';
import { VideoRecorder } from './VideoRecorder.js';
import { TmuxController } from './TmuxController.js';
import path from 'path';
import fs from 'fs';

const DEPLOYED_HIPILOT = '/home/EDA/hipilot/current';
const NODE_PATH = '/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin';

class E2ETestRunner extends TestRunner {
  constructor(options = {}) {
    super({
      testName: 'HiPilot E2E Test',
      ...options
    });

    this.testDir = options.testDir || `/home/EDA/hipilot_test/sessions/${this.testName.toLowerCase().replace(/\s+/g, '_')}_${this.timestamp}`;
    this.display = options.display || ':0';
    this.sessionName = `hipilot_${this.timestamp}`;

    this.recorder = new VideoRecorder({
      testDir: this.testDir,
      display: this.display,
      resolution: options.resolution || 'auto',
      framerate: options.framerate || 15
    });

    this.tmux = new TmuxController({
      sessionName: this.sessionName,
      socketName: this.sessionName,
      tmuxBin: '/home/EDA/hipilot_test/.local/bin/tmux'
    });
  }

  async execute() {
    await this.step('Cleanup Old Sessions', () => this.cleanup());
    await this.step('Create Test Session Dir', () => this.createSessionDir());
    await this.step('Start Video Recording', () => this.recorder.start(this.ssh.bind(this)));
    await this.step('Setup Tmux Workspace', () => this.setupTmuxWorkspace());
    await this.step('Start Innovus', () => this.startInnovus());
    await this.step('Open Terminal Window', () => this.openTerminal());
    await this.step('Start Claude Code', () => this.startClaudeCode());

    await this.runTests();

    await this.step('Wait for EDA Completion', () => this.waitForEDA(30000));
    await this.step('Capture Evidence', () => this.captureEvidence());
    await this.step('Stop Recording', () => this.recorder.stop(this.ssh.bind(this)));
    await this.step('Download Evidence', () => this.downloadEvidence());
    await this.step('Generate Report', () => this.generateReport());
  }

  async runTests() {
    throw new Error('runTests() must be implemented by subclass');
  }

  async cleanup() {
    await this.ssh('pkill -9 ffmpeg 2>/dev/null || true');
    await this.ssh('pkill -f tmux 2>/dev/null || true');
    await this.ssh('pkill -f claude 2>/dev/null || true');
    await this.ssh('pkill -9 innovus 2>/dev/null || true');
    await this.sleep(3000);
  }

  async createSessionDir() {
    await this.ssh(`mkdir -p ${this.testDir}/evidence`);
    await this.ssh(`mkdir -p ${this.testDir}/recordings`);
  }

  async setupTmuxWorkspace() {
    this.tmux.setSSH(this.ssh.bind(this));
    const tmuxBin = this.tmux.tmuxBin;
    
    await this.ssh(`${tmuxBin} -L ${this.sessionName} kill-server 2>/dev/null || true`);
    await this.sleep(2000);

    await this.ssh(`
      ${tmuxBin} -L ${this.sessionName} new-session -d -s ${this.sessionName} -x 200 -y 50
      ${tmuxBin} -L ${this.sessionName} split-window -h -l 50%
      ${tmuxBin} -L ${this.sessionName} set-option -g status on
      ${tmuxBin} -L ${this.sessionName} set-option -g status-style 'bg=#1a1a2e,fg=#00d4ff'
    `);
    await this.sleep(2000);
  }

  async startInnovus() {
    this.tmux.setSSH(this.ssh.bind(this));
    await this.tmux.sendKeys(`${this.sessionName}:0.1`, 
      'export PATH=/opt/cadence/INNOVUS20.10/bin:$PATH && innovus -nowin', true);
    await this.sleep(20000);
  }

  async openTerminal() {
    await this.ssh(`
      export DISPLAY=${this.display}
      export PATH=/home/EDA/hipilot_test/.local/bin:$PATH
      gnome-terminal --title='HiTestBot - ${this.testName}' --geometry=160x45+320+186 \\
        -- /home/EDA/hipilot_test/.local/bin/tmux -L ${this.sessionName} attach -t ${this.sessionName} &
    `);
    await this.sleep(3000);
  }

  async startClaudeCode() {
    this.tmux.setSSH(this.ssh.bind(this));

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(500);

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 
      `cd ${DEPLOYED_HIPILOT} && CLAUDE_CODE_MCP=1 claude --dangerously-skip-permissions`, true);
    await this.sleep(50000);
  }

  async waitForEDA(additionalMs = 0) {
    this.log(`Waiting ${additionalMs/1000}s for EDA operations to complete...`);
    await this.sleep(additionalMs);
  }

  async captureEvidence() {
    const evidenceDir = `${this.testDir}/evidence`;
    this.tmux.setSSH(this.ssh.bind(this));

    await this.ssh(`
      export PATH=/home/EDA/hipilot_test/.local/bin:$PATH
      export DISPLAY=${this.display}

      mkdir -p ${evidenceDir}

      /home/EDA/hipilot_test/.local/bin/tmux -L ${this.sessionName} capture-pane -t ${this.sessionName}:0.0 -p -S -300 > ${evidenceDir}/claude_pane.log
      /home/EDA/hipilot_test/.local/bin/tmux -L ${this.sessionName} capture-pane -t ${this.sessionName}:0.1 -p -S -300 > ${evidenceDir}/eda_pane.log

      import -window root ${evidenceDir}/final.png
    `, 30000);
  }

  async downloadEvidence() {
    const localEvidenceDir = path.join(this.localDir, 'e2e_evidence', this.timestamp);

    if (!fs.existsSync(localEvidenceDir)) {
      fs.mkdirSync(localEvidenceDir, { recursive: true });
    }

    await this.scpFrom(`${this.config.sshHost}:${this.testDir}/evidence/*`, localEvidenceDir);
    await this.scpFrom(`${this.config.sshHost}:${this.testDir}/recordings/*.mp4`, localEvidenceDir);
  }

  async onFailure() {
    await this.recorder.stop(this.ssh.bind(this)).catch(() => {});
  }
}

export { E2ETestRunner };
