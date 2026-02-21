#!/usr/bin/env node

import { E2ETestRunner } from '../E2ETestRunner.js';
import * as TestUtils from '../TestUtils.js';

class SideEffectTest extends E2ETestRunner {
  constructor(options = {}) {
    super({
      testName: 'Side Effect Warning Test',
      ...options
    });
    
    this.testResults = {
      showsSideEffectWarning: { passed: false, details: '' },
      requiresConfirmation: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Test Side Effects', () => this.testSetupFixSideEffects());
    await this.step('Verify Warning', () => this.verifyWarningShown());
    await this.step('Verify Approval', () => this.verifyApprovalRequired());
  }

  async testSetupFixSideEffects() {
    this.tmux.setSSH(this.ssh.bind(this));

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    this.log('Testing side-effect warnings...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 
      'Call the eda.generate_tcl MCP tool with intent "fix setup timing", operation "fix_setup_timing", tool "cadence". Show me the full response including any side effect warnings.', false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(70000);

    this.capturedOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    this.log(`Captured ${this.capturedOutput.length} characters`);
  }

  async verifyWarningShown() {
    const output = this.capturedOutput || await this.tmux.capturePane(`${this.sessionName}:0.0`);

    const hasSideEffectWarning = 
      output.toLowerCase().includes('side effect') ||
      output.toLowerCase().includes('hold') ||
      output.toLowerCase().includes('may cause') ||
      output.toLowerCase().includes('potential') ||
      output.includes('Hold Timing Risk') ||
      output.includes('Clock Skew');

    this.testResults.showsSideEffectWarning = {
      passed: hasSideEffectWarning,
      details: hasSideEffectWarning ? 'Warning found' : 'No warning'
    };

    TestUtils.assert(hasSideEffectWarning, 'No side effect warning shown');
  }

  async verifyApprovalRequired() {
    const output = this.capturedOutput || await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);

    const requiresApproval = 
      output.toLowerCase().includes('approval') ||
      output.toLowerCase().includes('confirm') ||
      output.toLowerCase().includes('[y/n]') ||
      output.toLowerCase().includes('proceed');

    const notAutoExecuted = !edaOutput.includes('size_cell');

    this.testResults.requiresConfirmation = {
      passed: requiresApproval && notAutoExecuted,
      details: `Approval: ${requiresApproval}, Not auto-exec: ${notAutoExecuted}`
    };

    TestUtils.assert(requiresApproval, 'No approval prompt shown');
    TestUtils.assert(notAutoExecuted, 'Tcl was auto-executed without approval');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new SideEffectTest();
  runner.run().catch(err => {
    console.error('SideEffectTest failed:', err);
    process.exit(1);
  });
}

export { SideEffectTest };
