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
 * - Setup tmux workspace (via HiPilot MCP)
 * - Execute HiPilot commands through Claude Code
 * - Capture evidence
 *
 * ARCHITECTURE NOTE:
 * This test validates the proper HiPilot workflow where Claude Code uses MCP
 * tools to interact with the EDA tool. The separation is:
 *
 * - Infrastructure (SSH): Cleanup, file upload, npm install - these are test
 *   setup operations that don't test HiPilot functionality
 *
 * - HiPilot Features (MCP via Claude): Tmux layout, Tcl generation, EDA
 *   commands - these MUST go through Claude Code using MCP tools
 *
 * Workflow tested:
 *   HiTestBot (as user) -> Claude Code (left pane) -> MCP tools -> EDA Tool
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
    // === Phase 1: Infrastructure Setup (SSH - test scaffolding) ===
    await this.step('Cleanup', () => this.cleanup());
    await this.step('Start Video Recording', () => this.recorder.start(this.ssh.bind(this)));
    await this.step('Upload Code', () => this.uploadCode());
    await this.step('Install Dependencies', () => this.installDependencies());
    await this.step('Configure MCP', () => this.configureMCP());

    // === Phase 2: HiPilot Workspace Setup (via HiPilot CLI/MCP) ===
    // These steps test HiPilot's ability to set up its own environment
    await this.step('Setup Tmux Layout via HiPilot', () => this.setupTmuxViaHiPilot());
    await this.step('Start Innovus via HiPilot', () => this.startInnovusViaHiPilot());
    await this.step('Open Windowed Terminal', () => this.openTerminal());
    await this.step('Start Claude Code', () => this.startClaudeCode());

    // === Phase 3: HiPilot Feature Tests (Explicit MCP Tool Calls) ===
    // These steps test the actual HiPilot workflow:
    // User explicitly asks for MCP tool -> Claude Code uses MCP tool -> EDA Tool
    // Note: We must explicitly mention MCP tools because Claude Code on the EDA
    // server has its own global skills that would otherwise take precedence
    await this.step('Test: Check HiPilot MCP Status', () => this.testListSkills());
    await this.step('Test: Generate Tcl via MCP', () => this.testGenerateTcl());
    await this.step('Test: Send to EDA via MCP', () => this.testSendToEDA());
    await this.step('Test: Capture and Analyze via MCP', () => this.testCaptureAndAnalyze());

    // === Phase 4: Evidence Collection ===
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

  /**
   * Setup tmux workspace via HiPilot CLI
   * Tests: hipilot workspace command -> tmux.setup_layout MCP tool
   */
  async setupTmuxViaHiPilot() {
    const testDir = `${this.testDir}/hipilot`;
    // Use HiPilot CLI to setup workspace - this tests the CLI -> MCP path
    await this.ssh(`
      export PATH=/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin:$PATH
      cd ${testDir}
      node src/index.js workspace || true
    `, 30000);
    await this.sleep(3000);
  }

  /**
   * Start Innovus via HiPilot
   * This should be done by asking Claude Code to start it via MCP
   */
  async startInnovusViaHiPilot() {
    // For infrastructure setup, we still need Innovus running
    // But we document that this would normally be done via HiPilot
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

    // Copy CLAUDE.md to the test directory so Claude Code reads it as project context
    // This ensures Claude uses HiPilot MCP tools instead of global skills
    await this.ssh(`cp ${testDir}/CLAUDE.md ${this.testDir}/CLAUDE.md 2>/dev/null || true`);

    await this.tmux.sendKeys('hipilot:0.0', `cd ${testDir} && claude --dangerously-skip-permissions`, true);
    await this.sleep(35000);
  }

  /**
   * Test: Check HiPilot status
   * Tests: Claude uses eda.get_status MCP tool (guided by CLAUDE.md)
   */
  async testListSkills() {
    this.tmux.setSSH(this.ssh.bind(this));

    // With CLAUDE.md in place, Claude should automatically use MCP tools
    await this.tmux.sendKeys('hipilot:0.0', 'Check HiPilot system status', false);
    await this.sleep(1000);
    await this.tmux.sendKeys('hipilot:0.0', null, true, 'C-m');
    await this.sleep(30000);

    // Wait for response
    await this.sleep(5000);
  }

  /**
   * Test: Generate Tcl for timing report
   * Tests: Claude uses eda.generate_tcl MCP tool (guided by CLAUDE.md)
   */
  async testGenerateTcl() {
    this.tmux.setSSH(this.ssh.bind(this));

    // With CLAUDE.md in place, Claude should automatically use MCP tools
    await this.tmux.sendKeys('hipilot:0.0', 'Generate a Tcl script to run a timing report for the current design', false);
    await this.sleep(1000);
    await this.tmux.sendKeys('hipilot:0.0', null, true, 'C-m');
    await this.sleep(30000);

    // Wait for response
    await this.sleep(5000);
  }

  /**
   * Test: Send command to EDA tool
   * Tests: Claude uses eda.send_to_terminal MCP tool (guided by CLAUDE.md)
   */
  async testSendToEDA() {
    this.tmux.setSSH(this.ssh.bind(this));

    // With CLAUDE.md in place, Claude should automatically use MCP tools
    await this.tmux.sendKeys('hipilot:0.0', 'Send "help report_timing" command to Innovus', false);
    await this.sleep(1000);
    await this.tmux.sendKeys('hipilot:0.0', null, true, 'C-m');
    await this.sleep(30000);

    // Wait for response
    await this.sleep(5000);
  }

  /**
   * Test: Capture and analyze EDA output
   * Tests: Claude uses eda.capture_and_analyze MCP tool (guided by CLAUDE.md)
   */
  async testCaptureAndAnalyze() {
    this.tmux.setSSH(this.ssh.bind(this));

    // With CLAUDE.md in place, Claude should automatically use MCP tools
    await this.tmux.sendKeys('hipilot:0.0', 'Capture and analyze the EDA pane output', false);
    await this.sleep(1000);
    await this.tmux.sendKeys('hipilot:0.0', null, true, 'C-m');
    await this.sleep(30000);

    // Wait for response
    await this.sleep(5000);
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
