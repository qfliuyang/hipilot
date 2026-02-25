/**
 * TestRunner - Base class for all HiTestBot test runners
 *
 * HiTestBot runs ONLY on the EDA server ("test like real human").
 * Commands (tmux, ffmpeg, MCP) run locally. Use bin/hitestbot-pull to download
 * evidence to dev machine and bin/hitestbot-push for test plan upload.
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { TestReporter } from './TestReporter.js';

class TestRunner {
  constructor(options = {}) {
    this.timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    this.testName = options.testName || 'test';
    this.localDir = options.localDir || process.cwd();
    this.steps = [];
    this.config = {
      sshHost: options.sshHost || 'EDA@192.168.112.163',
      sshPass: options.sshPass || 'eda2020',
      ...options
    };

    this.reporter = new TestReporter({
      testName: this.testName,
      localDir: this.localDir,
      timestamp: this.timestamp
    });
    this._runLogLines = [];
  }

  _runLog(msg) {
    if (!this._runLogLines) this._runLogLines = [];
    const ts = new Date().toISOString();
    this._runLogLines.push(`[${ts}] ${msg}`);
  }

  _writeRunLog(evidenceDir) {
    if (!this._runLogLines?.length) return;
    try {
      const p = path.join(evidenceDir, 'run_log.txt');
      fs.mkdirSync(path.dirname(p) || '.', { recursive: true });
      fs.writeFileSync(p, this._runLogLines.join('\n'));
    } catch {}
  }

  /**
   * Main test execution - override in subclasses
   */
  async run() {
    const evidenceDir = path.join(this.localDir || process.cwd(), 'e2e_evidence', this.timestamp);
    try {
      require('fs').mkdirSync(evidenceDir, { recursive: true });
    } catch {}
    this._runLog(`HiTestBot - ${this.testName}`);
    this._runLog(`Timestamp: ${this.timestamp}`);
    this._runLog(`Evidence dir: ${evidenceDir}`);

    console.log(`HiTestBot - ${this.testName}`);
    console.log(`Timestamp: ${this.timestamp}`);
    console.log('');

    try {
      await this.execute();

      console.log('');
      console.log('All tests passed!');
      const evidencePath = `${this.localDir || process.cwd()}/e2e_evidence/${this.timestamp}/`;
      console.log(`Evidence: ${evidencePath}`);
      this._runLog('All tests passed');
      this._writeRunLog(evidencePath);

      return true;
    } catch (err) {
      console.error('Test failed:', err.message);
      this._runLog(`FAILED: ${err.message}`);
      this._runLog(err.stack || '');
      this._writeRunLog(path.join(this.localDir || process.cwd(), 'e2e_evidence', this.timestamp));
      await this.onFailure();
      throw err;
    }
  }

  /**
   * Override this method in subclasses to define test flow
   */
  async execute() {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Override this for cleanup on failure
   */
  async onFailure() {
    // Default: no-op
  }

  /**
   * Execute a test step with timing and status tracking
   */
  async step(name, fn, options = {}) {
    const stepNum = this.steps.length + 1;
    const start = Date.now();
    process.stdout.write(`[${stepNum}] ${name}... `);

    try {
      const result = await fn();
      const duration = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`✓ (${duration}s)`);
      this._runLog(`[${stepNum}] ${name} PASS (${duration}s)`);
      this.steps.push({ name, status: 'passed', duration, result });
      return result;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      this._runLog(`[${stepNum}] ${name} FAIL: ${err.message}`);
      this.steps.push({ name, status: 'failed', error: err.message });
      if (!options.continueOnError) {
        throw err;
      }
    }
  }

  /**
   * Execute command locally (HiTestBot runs only on EDA server).
   */
  async ssh(command, timeout = 30000, returnOutput = false) {
    try {
      const result = execSync(command, {
        encoding: 'utf-8',
        timeout: Math.min(timeout, 600000),
        maxBuffer: 10 * 1024 * 1024,
      });
      return returnOutput ? (result || '') : true;
    } catch (err) {
      if (returnOutput) return (err.stdout || err.stderr || err.message || '');
      throw new Error(err.stderr || err.message || 'Command failed');
    }
  }

  /**
   * SCP upload
   */
  async scp(localPath, remotePath) {
    return new Promise((resolve, reject) => {
      const scp = spawn('sshpass', [
        '-p', this.config.sshPass,
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

  /**
   * Copy evidence from test dir to local dir (HiTestBot runs on EDA server).
   * remotePath format: "host:path" — host is stripped, path is used for local copy.
   */
  async scpFrom(remotePath, localDir) {
    try {
      const { cpSync, mkdirSync, existsSync, readdirSync } = await import('fs');
      mkdirSync(localDir, { recursive: true });
      const srcPath = remotePath.replace(/^[\w@.]+:/, '').replace(/\/\*$/, '');
      if (existsSync(srcPath)) {
        const entries = readdirSync(srcPath);
        for (const e of entries) {
          cpSync(path.join(srcPath, e), path.join(localDir, e), { recursive: true });
        }
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Local shell command
   */
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

  /**
   * Sleep/delay utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(message) {
    console.log(`   ${message}`);
  }

  async generateReport() {
    return this.reporter.generate(this.steps, this.config);
  }
}

export { TestRunner };
