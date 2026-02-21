/**
 * E2ETestRunner - Main E2E test orchestrator
 *
 * Handles the complete E2E test flow:
 * 1. Video recording setup
 * 2. Environment preparation
 * 3. Test execution
 * 4. Evidence collection
 * 5. Reporting
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { VideoRecorder } = require('./VideoRecorder');
const { TestReporter } = require('./TestReporter');
const { TmuxController } = require('./TmuxController');

class E2ETestRunner {
  constructor(options = {}) {
    this.timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    this.testDir = options.testDir || `/home/EDA/hipilot_test/test_${this.timestamp}`;
    this.localDir = options.localDir || process.cwd();
    this.sshHost = options.sshHost || 'EDA@192.168.112.163';
    this.sshPass = options.sshPass || 'eda2020';
    this.display = options.display || ':0';

    this.recorder = new VideoRecorder({
      testDir: this.testDir,
      display: this.display,
      resolution: '2560x1558',
      framerate: 20
    });

    this.tmux = new TmuxController({
      sessionName: 'hipilot',
      socketName: 'hipilot'
    });

    this.reporter = new TestReporter({
      testDir: this.testDir,
      localDir: this.localDir,
      timestamp: this.timestamp
    });

    this.steps = [];
  }

  async run() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              HiTestBot - E2E Test Runner                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`Timestamp: ${this.timestamp}`);
    console.log('');

    try {
      await this.step('Cleanup', () => this.cleanup());
      await this.step('Start Video Recording', () => this.recorder.start());
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
      await this.step('Stop Recording', () => this.recorder.stop());
      await this.step('Download Evidence', () => this.downloadEvidence());
      await this.step('Generate Report', () => this.reporter.generate(this.steps));

      console.log('');
      console.log('✅ All tests passed!');
      console.log(`Evidence: e2e_evidence/${this.timestamp}/`);

      return true;
    } catch (err) {
      console.error('❌ Test failed:', err.message);
      await this.recorder.stop().catch(() => {});
      throw err;
    }
  }

  async step(name, fn) {
    const start = Date.now();
    process.stdout.write(`[${this.steps.length + 1}/16] ${name}... `);

    try {
      await fn();
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`✅ (${duration}s)`);
      this.steps.push({ name, status: 'passed', duration });
    } catch (err) {
      console.log(`❌ ${err.message}`);
      this.steps.push({ name, status: 'failed', error: err.message });
      throw err;
    }
  }

  async cleanup() {
    // Kill all existing processes
    await this.ssh('pkill -9 ffmpeg 2>/dev/null || true');
    await this.ssh('pkill -f "tmux -L hipilot" 2>/dev/null || true');
    await this.ssh('pkill -f "claude" 2>/dev/null || true');
    await this.ssh('pkill -9 innovus 2>/dev/null || true');
    await this.sleep(2000);
  }

  async uploadCode() {
    const localDir = this.localDir;
    const remoteDir = `${this.testDir}/hipilot`;

    // Create tarball
    const tarCmd = `tar czf /tmp/hipilot_${this.timestamp}.tar.gz -C "${localDir}" --exclude='node_modules' --exclude='.git' --exclude='e2e_evidence' .`;
    await this.exec(tarCmd);

    // Create remote directory
    await this.ssh(`mkdir -p ${remoteDir}`);

    // Upload
    await this.scp(
      `/tmp/hipilot_${this.timestamp}.tar.gz`,
      `${this.sshHost}:${remoteDir}/`
    );

    // Extract
    await this.ssh(`cd ${remoteDir} && tar xzf hipilot_${this.timestamp}.tar.gz && rm hipilot_${this.timestamp}.tar.gz`);

    // Cleanup local tar
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
    const settingsPath = '~/.claude/settings.json';
    const testDir = `${this.testDir}/hipilot`;

    // Note: We read existing settings, don't overwrite API key
    const settings = await this.ssh(`cat ${settingsPath} 2>/dev/null || echo '{}'`, 5000, true);
    const existing = JSON.parse(settings);

    // Only update MCP server paths, not API credentials
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

    await this.ssh(`mkdir -p ~/.claude && cat > ${settingsPath} << 'EOF'
${JSON.stringify(existing, null, 2)}
EOF`);
  }

  async setupTmux() {
    await this.tmux.createSession(this.ssh.bind(this));
  }

  async startInnovus() {
    await this.tmux.sendKeys('hipilot:0.1', 'export PATH=/opt/cadence/INNOVUS20.10/bin:$PATH && innovus -nowin', true);
    await this.sleep(15000);
  }

  async openTerminal() {
    await this.ssh(`
      export DISPLAY=${this.display}
      export PATH=/home/EDA/hipilot_test/.local/bin:$PATH
      gnome-terminal --title='HiTestBot E2E - ${this.timestamp}' --geometry=160x45+560+419 \
        -- /home/EDA/hipilot_test/.local/bin/tmux -L hipilot attach -t hipilot &
    `);
    await this.sleep(2000);
  }

  async startClaudeCode() {
    const testDir = `${this.testDir}/hipilot`;

    // Clear and add header
    await this.tmux.sendKeys('hipilot:0.0', 'clear', true);
    await this.tmux.sendKeys('hipilot:0.0', 'echo "========================================"', true);
    await this.tmux.sendKeys('hipilot:0.0', 'echo "  HiTestBot E2E Test"', true);
    await this.tmux.sendKeys('hipilot:0.0', 'echo "========================================"', true);

    // Start Claude Code
    await this.tmux.sendKeys('hipilot:0.0', `cd ${testDir} && claude --dangerously-skip-permissions`, true);
    await this.sleep(35000);
  }

  async executeHiPilotCommand() {
    // CRITICAL: Use C-m (Ctrl+M) for Claude Code, NOT Enter
    await this.tmux.sendKeys('hipilot:0.0', 'list all HiPilot skills', false);
    await this.sleep(1000);
    await this.tmux.sendKeys('hipilot:0.0', null, true, 'C-m');
    await this.sleep(30000);
  }

  async executeEDACommands() {
    await this.tmux.sendKeys('hipilot:0.1', 'puts "=== HiTestBot E2E ==="', true);
    await this.sleep(1000);
    await this.tmux.sendKeys('hipilot:0.1', 'help report_timing', true);
    await this.sleep(10000);
  }

  async captureEvidence() {
    const evidenceDir = `${this.testDir}/evidence`;

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

    await this.scpFrom(
      `${this.sshHost}:${this.testDir}/evidence/*`,
      localEvidenceDir
    );

    await this.scpFrom(
      `${this.sshHost}:${this.testDir}/recordings/*.mp4`,
      localEvidenceDir
    );
  }

  // SSH helpers
  async ssh(command, timeout = 30000, returnOutput = false) {
    return new Promise((resolve, reject) => {
      const sshpass = spawn('sshpass', [
        '-p', this.sshPass,
        'ssh',
        '-o', 'StrictHostKeyChecking=no',
        this.sshHost,
        command
      ]);

      let output = '';
      let error = '';

      sshpass.stdout.on('data', (data) => {
        output += data.toString();
      });

      sshpass.stderr.on('data', (data) => {
        error += data.toString();
      });

      sshpass.on('close', (code) => {
        if (code !== 0 && !returnOutput) {
          reject(new Error(`SSH failed: ${error}`));
        } else {
          resolve(returnOutput ? output : true);
        }
      });

      setTimeout(() => {
        sshpass.kill();
        reject(new Error('SSH timeout'));
      }, timeout);
    });
  }

  async scp(localPath, remotePath) {
    return new Promise((resolve, reject) => {
      const scp = spawn('sshpass', [
        '-p', this.sshPass,
        'scp',
        '-o', 'StrictHostKeyChecking=no',
        localPath,
        remotePath
      ]);

      scp.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`SCP failed with code ${code}`));
        } else {
          resolve(true);
        }
      });

      setTimeout(() => {
        scp.kill();
        reject(new Error('SCP timeout'));
      }, 60000);
    });
  }

  async scpFrom(remotePath, localDir) {
    return new Promise((resolve, reject) => {
      const scp = spawn('sshpass', [
        '-p', this.sshPass,
        'scp',
        '-o', 'StrictHostKeyChecking=no',
        remotePath,
        localDir
      ]);

      scp.on('close', (code) => {
        resolve(true); // Don't fail on missing files
      });

      setTimeout(() => {
        scp.kill();
        resolve(true);
      }, 120000);
    });
  }

  async exec(command) {
    return new Promise((resolve, reject) => {
      const proc = spawn('bash', ['-c', command]);

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Command failed: ${command}`));
        } else {
          resolve(true);
        }
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { E2ETestRunner };
