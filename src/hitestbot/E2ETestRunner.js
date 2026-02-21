import { TestRunner } from './TestRunner.js';
import { VideoRecorder } from './VideoRecorder.js';
import { TmuxController } from './TmuxController.js';
import path from 'path';
import fs from 'fs';

/**
 * E2ETestRunner - End-to-end testing for HiPilot on EDA server
 *
 * Tests the complete HiPilot workflow:
 * - Upload code to EDA server
 * - Start video recording
 * - Setup tmux workspace (Claude Code + Innovus)
 * - Execute HiPilot commands
 * - Capture evidence
 */
class E2ETestRunner extends TestRunner {
  constructor(options = {}) {
    super({
      testName: 'HiPilot E2E Test',
      ...options
    });

    this.testDir = options.testDir || `/home/EDA/hipilot_test/test_${this.timestamp}`;
    this.display = options.display || ':0';

    this.recorder = new VideoRecorder({
      testDir: this.testDir,
      display: this.display,
      resolution: options.resolution || '2560x1558',
      framerate: options.framerate || 20
    });

    this.tmux = new TmuxController({
      sessionName: 'hipilot',
      socketName: 'hipilot'
    });
  }

  async execute() {
    await this.step('Cleanup', () => this.cleanup());
    await this.step('Start Video Recording', () => this.recorder.start(this.ssh.bind(this)));
    await this.step('Upload Code', () => this.uploadCode());
    await this.step('Install Dependencies', () => this.installDependencies());
    await this.step('Configure MCP', () => this.configureMCP());
    await this.step('Setup Tmux', () => this.setupTmux());
    await this.step('Start Innovus', () => this.startInnovus());
    await this.step('Open Windowed Terminal', () => this.openTerminal());
    await this.step('Start Claude Code', () => this.startClaudeCode());
    await this.step('Execute HiPilot Command', () => this.executeHiPilotCommand());
    await this.step('Execute EDA Commands', () => this.executeEDACommands());
    await this.step('Capture Evidence', () => this.captureEvidence());
    await this.step('Stop Recording', () => this.recorder.stop(this.ssh.bind(this)));
    await this.step('Download Evidence', () => this.downloadEvidence());
    await this.step('Generate Report', () => this.generateReport());
  }

  async onFailure() {
    await this.recorder.stop(this.ssh.bind(this)).catch(() => {});
  }

  async cleanup() {
    await this.ssh('pkill -9 ffmpeg 2>/dev/null || true');
    await this.ssh('pkill -f tmux 2>/dev/null || true');
    await this.ssh('pkill -f claude 2>/dev/null || true');
    await this.ssh('pkill -9 innovus 2>/dev/null || true');
    await this.sleep(2000);
  }

  async uploadCode() {
    const remoteDir = `${this.testDir}/hipilot`;

    const tarCmd = `tar czf /tmp/hipilot_${this.timestamp}.tar.gz -C "${this.localDir}" --exclude='node_modules' --exclude='.git' --exclude='e2e_evidence' .`;
    await this.exec(tarCmd);

    await this.ssh(`mkdir -p ${remoteDir}`);
    await this.scp(`/tmp/hipilot_${this.timestamp}.tar.gz`, `${this.config.sshHost}:${remoteDir}/`);
    await this.ssh(`cd ${remoteDir} && tar xzf hipilot_${this.timestamp}.tar.gz && rm hipilot_${this.timestamp}.tar.gz`);

    fs.unlinkSync(`/tmp/hipilot_${this.timestamp}.tar.gz`);
  }

  async installDependencies() {
    const testDir = `${this.testDir}/hipilot`;
    await this.ssh(`
      export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
      cd ${testDir}
      npm install > /tmp/npm_${this.timestamp}.log 2>&1
    `, 120000);
  }

  async configureMCP() {
    const testDir = `${this.testDir}/hipilot`;

    const settings = await this.ssh(`cat ~/.claude/settings.json 2>/dev/null || echo '{}'`, 5000, true);
    const existing = JSON.parse(settings);

    existing.mcpServers = {
      'hipilot-eda': {
        command: '/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node',
        args: [`${testDir}/servers/eda/index.js`],
        env: { HIPILOT_SESSION: 'hipilot' }
      },
      'hipilot-tmux': {
        command: '/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node',
        args: [`${testDir}/servers/tmux/index.js`],
        env: { HIPILOT_SESSION: 'hipilot' }
      },
      'hipilot-knowledge': {
        command: '/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin/node',
        args: [`${testDir}/servers/knowledge/index.js`],
        env: {}
      }
    };

    existing.skipDangerousModePermissionPrompt = true;

    await this.ssh(`mkdir -p ~/.claude && cat > ~/.claude/settings.json << 'EOF'\n${JSON.stringify(existing, null, 2)}\nEOF`);
  }

  async setupTmux() {
    this.tmux.setSSH(this.ssh.bind(this));
    await this.tmux.createSession(this.ssh.bind(this));
  }

  async startInnovus() {
    this.tmux.setSSH(this.ssh.bind(this));
    await this.tmux.sendKeys('hipilot:0.1', 'export PATH=/opt/cadence/INNOVUS20.10/bin:$PATH && innovus -nowin', true);
    await this.sleep(15000);
  }

  async openTerminal() {
    await this.ssh(`
      export DISPLAY=${this.display}
      export PATH=/home/EDA/hipilot_test/.local/bin:$PATH
      gnome-terminal --title='HiTestBot E2E - ${this.timestamp}' --geometry=160x45+320+186 \\
        -- /home/EDA/hipilot_test/.local/bin/tmux -L hipilot attach -t hipilot &
    `);
    await this.sleep(2000);
  }

  async startClaudeCode() {
    const testDir = `${this.testDir}/hipilot`;
    this.tmux.setSSH(this.ssh.bind(this));

    await this.tmux.sendKeys('hipilot:0.0', 'clear', true);
    await this.tmux.sendKeys('hipilot:0.0', 'echo "========================================"', true);
    await this.tmux.sendKeys('hipilot:0.0', 'echo "  HiTestBot E2E Test"', true);
    await this.tmux.sendKeys('hipilot:0.0', 'echo "========================================"', true);
    await this.tmux.sendKeys('hipilot:0.0', `cd ${testDir} && claude --dangerously-skip-permissions`, true);
    await this.sleep(35000);
  }

  async executeHiPilotCommand() {
    this.tmux.setSSH(this.ssh.bind(this));
    await this.tmux.sendKeys('hipilot:0.0', 'list all HiPilot skills', false);
    await this.sleep(1000);
    await this.tmux.sendKeys('hipilot:0.0', null, true, 'C-m');
    await this.sleep(30000);
  }

  async executeEDACommands() {
    this.tmux.setSSH(this.ssh.bind(this));
    await this.tmux.sendKeys('hipilot:0.1', 'puts "=== HiTestBot E2E ==="', true);
    await this.sleep(1000);
    await this.tmux.sendKeys('hipilot:0.1', 'help report_timing', true);
    await this.sleep(10000);
  }

  async captureEvidence() {
    const evidenceDir = `${this.testDir}/evidence`;
    this.tmux.setSSH(this.ssh.bind(this));

    await this.ssh(`
      export PATH=/home/EDA/hipilot_test/.local/bin:$PATH
      export DISPLAY=${this.display}

      mkdir -p ${evidenceDir}

      /home/EDA/hipilot_test/.local/bin/tmux -L hipilot capture-pane -t hipilot:0.0 -p -S -100 > ${evidenceDir}/claude_pane.log
      /home/EDA/hipilot_test/.local/bin/tmux -L hipilot capture-pane -t hipilot:0.1 -p -S -100 > ${evidenceDir}/innovus_pane.log

      import -window root ${evidenceDir}/final.png
    `);
  }

  async downloadEvidence() {
    const localEvidenceDir = path.join(this.localDir, 'e2e_evidence', this.timestamp);

    if (!fs.existsSync(localEvidenceDir)) {
      fs.mkdirSync(localEvidenceDir, { recursive: true });
    }

    await this.scpFrom(`${this.config.sshHost}:${this.testDir}/evidence/*`, localEvidenceDir);
    await this.scpFrom(`${this.config.sshHost}:${this.testDir}/recordings/*.mp4`, localEvidenceDir);
  }
}

export { E2ETestRunner };
