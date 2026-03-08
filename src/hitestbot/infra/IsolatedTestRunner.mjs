#!/usr/bin/env node
/**
 * IsolatedTestRunner — Creates a completely isolated test environment.
 *
 * For each test run:
 * 1. Creates unique test directory: /home/EDA/hipilot_test/runs/TIMESTAMP/
 * 2. Deploys HiPilot code to test directory (isolated from shared deployment)
 * 3. Extracts clean Ibex design to test directory
 * 4. Configures MCP servers to use test directory
 * 5. Runs HiTestBot with isolated environment
 * 6. Collects all evidence in test directory
 *
 * This ensures:
 * - No contamination from previous test results
 * - Can test new code without affecting shared deployment
 * - Each test is fully reproducible with its own environment
 */

import { execSync } from 'child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const EDA_SERVER = {
  host: 'EDA@192.168.112.163',
  password: 'eda2020',
  baseDir: '/home/EDA',
  designTarball: '/home/EDA/ibex_demo.tar',
};

export class IsolatedTestRunner {
  constructor(options = {}) {
    this.timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    this.testBaseDir = options.testBaseDir || `${EDA_SERVER.baseDir}/hipilot_test/runs`;
    this.testDir = join(this.testBaseDir, this.timestamp);
    this.hipilotDir = join(this.testDir, 'hipilot');
    this.designDir = join(this.testDir, 'design');
    this.evidenceDir = join(this.testDir, 'evidence');
    this.logDir = join(this.testDir, 'logs');
    this.sourceDir = options.sourceDir || join(__dirname, '..', '..', '..', '..');
    this.command = options.command || '/rtl2gds';
    this.maxWaitMs = options.maxWaitMs || parseInt(process.env.HITESTBOT_MAX_WAIT || '900000', 10);

    this.nodePath = '/home/EDA/hipilot_test/node-v20.18.3-linux-x64-glibc-217/bin';

    // Detect if running on EDA server (local) or from dev machine (remote)
    // If HIPILOT_EDA_SERVER is set, we're on the EDA server - use direct commands
    this.isLocal = process.env.HIPILOT_EDA_SERVER === '1' || process.env.USER === 'EDA';

    // When running locally on EDA server, use the deployed HiPilot as source
    if (this.isLocal) {
      this.sourceDir = '/home/EDA/hipilot/current';
    }
  }

  /**
   * Execute command (SSH if remote, direct if local)
   */
  _exec(command, timeout = 30000) {
    if (this.isLocal) {
      // Running on EDA server - use direct exec
      return execSync(command, { encoding: 'utf-8', timeout, shell: true });
    } else {
      // Running from dev machine - use SSH
      const sshCmd = `sshpass -p '${EDA_SERVER.password}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${EDA_SERVER.host} '${command}'`;
      return execSync(sshCmd, { encoding: 'utf-8', timeout, shell: true });
    }
  }

  /**
   * Copy files (SCP if remote, direct cp if local)
   */
  _copy(src, dest, timeout = 60000) {
    if (this.isLocal) {
      // Running on EDA server - use direct cp
      return execSync(`cp -r ${src} ${dest}`, { encoding: 'utf-8', timeout, shell: true });
    } else {
      // Running from dev machine - use SCP
      const scpCmd = `sshpass -p '${EDA_SERVER.password}' scp -o StrictHostKeyChecking=no -r ${src} ${EDA_SERVER.host}:${dest}`;
      return execSync(scpCmd, { encoding: 'utf-8', timeout, shell: true });
    }
  }

  /**
   * Create isolated test directory structure on EDA server
   */
  async createTestEnvironment() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  IsolatedTestRunner — Creating Clean Test Environment');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Test ID:     ${this.timestamp}`);
    console.log(`Test Dir:    ${this.testDir}`);
    console.log(`HiPilot:     ${this.hipilotDir}`);
    console.log(`Design:      ${this.designDir}`);
    console.log(`Evidence:    ${this.evidenceDir}`);
    console.log('');

    // 1. Create directory structure
    console.log('[1/5] Creating test directory structure...');
    this._exec(`mkdir -p ${this.hipilotDir} ${this.designDir} ${this.evidenceDir} ${this.logDir}`);

    // 2. Extract clean design
    console.log('[2/5] Extracting clean design...');
    // Use remote tarball directly
    this._exec(`cd ${this.designDir} && tar xf ${EDA_SERVER.designTarball}`);

    // Find the extracted design directory
    const designContents = this._exec(`ls ${this.designDir}`).trim();
    const designSubdir = designContents.split('\n')[0];
    this.actualDesignDir = join(this.designDir, designSubdir);
    console.log(`      Design extracted to: ${this.actualDesignDir}`);

    // 3. Deploy HiPilot code to test directory
    console.log('[3/5] Deploying HiPilot code...');
    this._deployHiPilot();

    // 4. Configure MCP servers for isolated environment
    console.log('[4/5] Configuring MCP servers...');
    this._configureMcpServers();

    // 5. Write test metadata
    console.log('[5/5] Writing test metadata...');
    const metadata = {
      test_id: this.timestamp,
      created_at: new Date().toISOString(),
      test_dir: this.testDir,
      hipilot_dir: this.hipilotDir,
      design_dir: this.actualDesignDir,
      evidence_dir: this.evidenceDir,
      command: this.command,
      max_wait_ms: this.maxWaitMs,
    };
    writeFileSync(join(this.testDir, 'test_metadata.json'), JSON.stringify(metadata, null, 2));

    console.log('');
    console.log('✅ Isolated test environment created');
    console.log('');

    return {
      testDir: this.testDir,
      hipilotDir: this.hipilotDir,
      designDir: this.actualDesignDir,
      evidenceDir: this.evidenceDir,
    };
  }

  /**
   * Deploy HiPilot source code to test directory
   */
  _deployHiPilot() {
    console.log('      Copying HiPilot files...');

    // Copy all files except node_modules, .git, and test evidence
    const excludes = ['node_modules', '.git', 'test/evidence', '.omc'];
    const excludeArgs = excludes.map(e => `--exclude=${e}`).join(' ');

    // Use rsync or cp -r to copy files
    this._exec(`cd ${this.sourceDir} && cp -r . ${this.hipilotDir}/`);

    // Remove excluded directories that were copied
    for (const exclude of excludes) {
      this._exec(`rm -rf ${this.hipilotDir}/${exclude} 2>/dev/null || true`);
    }

    // Link shared node_modules for efficiency
    this._exec(`ln -s /home/EDA/hipilot/current/node_modules ${this.hipilotDir}/node_modules`);

    console.log('      HiPilot deployed successfully');
  }

  /**
   * Configure MCP servers for isolated test
   */
  _configureMcpServers() {
    const settingsPath = `${EDA_SERVER.baseDir}/.claude/settings.json`;

    // Read existing settings to get API keys
    let existingSettings = {};
    try {
      const existing = this._exec(`cat ${settingsPath}`);
      existingSettings = JSON.parse(existing);
    } catch {
      console.log('      Warning: Could not read existing settings, using defaults');
    }

    // Create isolated MCP settings pointing to test directory
    const isolatedSettings = {
      ...existingSettings,
      mcpServers: {
        'hipilot-eda': {
          command: `${this.nodePath}/node`,
          args: [`${this.hipilotDir}/servers/eda/index.js`],
          env: {
            HIPILOT_SESSION: `hipilot_test_${this.timestamp}`,
            HIPILOT_TEST_LOG: `${this.logDir}/mcp.jsonl`,
            HIPILOT_DESIGN_DIR: this.actualDesignDir,
            PATH: `${this.hipilotDir}/bin:${this.nodePath}:/usr/local/bin:/usr/bin:/bin`,
          },
        },
        'hipilot-tmux': {
          command: `${this.nodePath}/node`,
          args: [`${this.hipilotDir}/servers/tmux/index.js`],
          env: {
            HIPILOT_SESSION: `hipilot_test_${this.timestamp}`,
            HIPILOT_DESIGN_DIR: this.actualDesignDir,
            PATH: `${this.hipilotDir}/bin:${this.nodePath}:/usr/local/bin:/usr/bin:/bin`,
          },
        },
        'hipilot-knowledge': {
          command: `${this.nodePath}/node`,
          args: [`${this.hipilotDir}/servers/knowledge/index.js`],
          env: {
            HIPILOT_DESIGN_DIR: this.actualDesignDir,
            PATH: `${this.hipilotDir}/bin:${this.nodePath}:/usr/local/bin:/usr/bin:/bin`,
          },
        },
      },
    };

    // Write settings to test directory (will be used by this test)
    this._exec(`mkdir -p ${EDA_SERVER.baseDir}/.claude`);
    const settingsJson = JSON.stringify(isolatedSettings, null, 2);
    writeFileSync(`/tmp/settings_${this.timestamp}.json`, settingsJson);
    this._exec(`cp /tmp/settings_${this.timestamp}.json ${this.testDir}/settings.json`);
    try { rmSync(`/tmp/settings_${this.timestamp}.json`); } catch {}

    // Backup original settings and install isolated settings
    this._exec(`cp ${settingsPath} ${settingsPath}.backup.${this.timestamp} 2>/dev/null || true`);
    this._exec(`cp ${this.testDir}/settings.json ${settingsPath}`);

    console.log(`      MCP session: hipilot_test_${this.timestamp}`);
  }

  /**
   * Run the test in isolated environment
   */
  async runTest() {
    // Create environment
    const env = await this.createTestEnvironment();

    // Run the test using FlowCertifier with isolated paths
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Running HiTestBot in Isolated Environment');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Import FlowCertifier dynamically from the isolated HiPilot directory
    const { FlowCertifier } = await import(`${this.hipilotDir}/src/hitestbot/core/FlowCertifier.js`);

    // Set environment variable for design directory so HiPilot knows where to find the design
    process.env.HIPILOT_DESIGN_DIR = this.actualDesignDir;

    const certifier = new FlowCertifier({
      session: `hipilot_test_${this.timestamp}`,
      socket: `hipilot_test_${this.timestamp}`,
      hipilotBin: `${this.hipilotDir}/bin/hipilot`,
      evidenceDir: this.evidenceDir,
      designTarball: null, // Already extracted
      testWorkBase: this.designDir,
      display: ':0',
      mcpLogPath: `${this.logDir}/mcp.jsonl`,
    });

    // Override design directory to use our isolated copy
    certifier.actualDesignDir = this.actualDesignDir;

    const result = await certifier.runTest(this.command, { maxWaitMs: this.maxWaitMs });

    // Restore original settings
    console.log('');
    console.log('[Cleanup] Restoring original MCP settings...');
    this._exec(`cp ${EDA_SERVER.baseDir}/.claude/settings.json.backup.${this.timestamp} ${EDA_SERVER.baseDir}/.claude/settings.json 2>/dev/null || true`);

    // Print results
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Test Complete');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Test ID:    ${this.timestamp}`);
    console.log(`Evidence:   ${result.evidenceDir}`);
    console.log(`Score:      ${result.progress.total_score?.toFixed(1)}/5.0`);
    console.log(`Test Dir:   ${this.testDir}`);
    console.log('');

    return {
      ...result,
      testDir: this.testDir,
      timestamp: this.timestamp,
    };
  }

  /**
   * Cleanup test environment
   */
  cleanup() {
    console.log(`[Cleanup] Removing test directory: ${this.testDir}`);
    try {
      this._exec(`rm -rf ${this.testDir}`);
      console.log('✅ Cleanup complete');
    } catch (e) {
      console.log(`⚠️ Cleanup failed: ${e.message}`);
    }
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || '/rtl2gds';
  const maxWaitMs = parseInt(process.argv[3] || '900000', 10);

  const runner = new IsolatedTestRunner({
    command,
    maxWaitMs,
  });

  runner.runTest()
    .then(result => {
      console.log('Test completed successfully');
      process.exit(result.progress.blocking_stage ? 1 : 0);
    })
    .catch(err => {
      console.error('Test failed:', err.message);
      runner.cleanup();
      process.exit(2);
    });
}
