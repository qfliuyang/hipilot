/**
 * TestRunner - Base class for all HiTestBot test runners
 *
 * Provides common infrastructure: step tracking, reporting, SSH, timing.
 * Extend this class to create specific test types (E2E, Skills, UI, etc.)
 */

import { spawn } from 'child_process';
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
  }

  /**
   * Main test execution - override in subclasses
   */
  async run() {
    console.log(`HiTestBot - ${this.testName}`);
    console.log(`Timestamp: ${this.timestamp}`);
    console.log('');

    try {
      await this.execute();

      console.log('');
      console.log('All tests passed!');
      console.log(`Evidence: e2e_evidence/${this.timestamp}/`);

      return true;
    } catch (err) {
      console.error('Test failed:', err.message);
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
      this.steps.push({ name, status: 'passed', duration, result });
      return result;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      this.steps.push({ name, status: 'failed', error: err.message });
      if (!options.continueOnError) {
        throw err;
      }
    }
  }

  /**
   * SSH command execution
   */
  async ssh(command, timeout = 30000, returnOutput = false) {
    return new Promise((resolve, reject) => {
      const sshpass = spawn('sshpass', [
        '-p', this.config.sshPass,
        'ssh',
        '-o', 'StrictHostKeyChecking=no',
        this.config.sshHost,
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
        // Exit code 255 typically means SSH connection issue, not command failure
        // For cleanup commands (|| true), we should be more tolerant
        if (code !== 0 && code !== 255 && !returnOutput) {
          reject(new Error(`SSH failed: ${error || 'exit code ' + code}`));
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
   * SCP download
   */
  async scpFrom(remotePath, localDir) {
    return new Promise((resolve) => {
      const scp = spawn('sshpass', [
        '-p', this.config.sshPass,
        'scp',
        '-o', 'StrictHostKeyChecking=no',
        remotePath,
        localDir
      ]);

      scp.on('close', () => {
        resolve(true);
      });

      setTimeout(() => {
        scp.kill();
        resolve(true);
      }, 120000);
    });
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
