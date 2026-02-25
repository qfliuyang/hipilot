#!/usr/bin/env node

import { E2ETestRunner } from '../infra/E2ETestRunner.js';
import * as TestUtils from '../infra/TestUtils.js';

class OneShotFixTest extends E2ETestRunner {
  constructor(options = {}) {
    super({
      testName: 'One-Shot Fix Test',
      ...options
    });
    
    this.testResults = {
      singleCommand: { passed: false, details: '' },
      completeFlow: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Test One-Command Fix', () => this.testOneCommandFix());
    await this.step('Verify Complete Flow', () => this.verifyCompleteFlow());
  }

  async testOneCommandFix() {
    this.tmux.setSSH(this.ssh.bind(this));

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    this.log('Testing one-command fix flow...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, '/fix-setup reg2reg', false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(100000);

    this.claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    this.edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);

    this.testResults.singleCommand = {
      passed: true,
      details: 'Single command sent'
    };
  }

  async verifyCompleteFlow() {
    const claude = this.claudeOutput.toLowerCase();
    const eda = this.edaOutput.toLowerCase();

    const hasTimingReport = 
      claude.includes('timing') || 
      claude.includes('wns') ||
      eda.includes('report_timing');

    const hasAnalysis = 
      claude.includes('violation') ||
      claude.includes('root cause') ||
      claude.includes('analysis');

    const hasFixTcl = 
      claude.includes('size_cell') ||
      claude.includes('insert_buffer') ||
      claude.includes('generated') ||
      claude.includes('tcl');

    const complete = hasTimingReport && hasAnalysis && hasFixTcl;

    this.testResults.completeFlow = {
      passed: complete,
      details: `Timing: ${hasTimingReport}, Analysis: ${hasAnalysis}, Fix: ${hasFixTcl}`
    };

    TestUtils.assert(hasTimingReport, 'No timing report in flow');
    TestUtils.assert(hasAnalysis, 'No analysis in flow');
    TestUtils.assert(hasFixTcl, 'No fix Tcl in flow');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new OneShotFixTest();
  runner.run().catch(err => {
    console.error('OneShotFixTest failed:', err);
    process.exit(1);
  });
}

export { OneShotFixTest };
