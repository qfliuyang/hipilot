#!/usr/bin/env node

import { E2ETestRunner } from '../infra/E2ETestRunner.js';
import * as TestUtils from '../infra/TestUtils.js';

class QuickCommandsTest extends E2ETestRunner {
  constructor(options = {}) {
    super({
      testName: 'Quick Commands Test',
      ...options
    });
    
    this.testResults = {
      timing: { passed: false, details: '' },
      drc: { passed: false, details: '' },
      history: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Test /timing', () => this.testTimingCommand());
    await this.step('Test /drc', () => this.testDrcCommand());
    await this.step('Test /history', () => this.testHistoryCommand());
    await this.step('Verify Results', () => this.verifyResults());
  }

  async testTimingCommand() {
    this.tmux.setSSH(this.ssh.bind(this));

    await this.ssh(`mkdir -p ${this.testDir}/evidence`);

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    this.log('Testing /project:timing command...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, '/project:timing', false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(60000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);

    const claudeUnderstood = 
      (claudeOutput && (claudeOutput.toLowerCase().includes('timing') ||
       claudeOutput.toLowerCase().includes('wns') ||
       claudeOutput.toLowerCase().includes('slack') ||
       claudeOutput.includes('report_timing'))) ||
      false;

    const tclSent = 
      (edaOutput && (edaOutput.includes('report_timing') ||
       edaOutput.includes('timing') ||
       edaOutput.includes('slack'))) ||
      false;

    this.testResults.timing = {
      passed: claudeUnderstood,
      details: `Claude understood: ${claudeUnderstood}, Tcl sent: ${tclSent}`
    };

    if (!this.testResults.timing.passed) {
      this.log('WARNING: /project:timing may not be fully working');
      this.log(`Claude preview: ${(claudeOutput || '').substring(0, 300)}`);
    }

    await this.ssh(`
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
      import -window root ${this.testDir}/evidence/timing_test.png || true
    `);

    TestUtils.assert(claudeUnderstood, 'Claude did not understand /project:timing');
  }

  async testDrcCommand() {
    this.tmux.setSSH(this.ssh.bind(this));

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    this.log('Testing /project:drc command...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, '/project:drc', false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(60000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);

    const drcTriggered = 
      (claudeOutput && (claudeOutput.toLowerCase().includes('drc') ||
       claudeOutput.toLowerCase().includes('violation') ||
       claudeOutput.toLowerCase().includes('design rule'))) ||
      (edaOutput && (edaOutput.toLowerCase().includes('verify_drc') ||
       edaOutput.toLowerCase().includes('drc'))) ||
      false;

    this.testResults.drc = {
      passed: drcTriggered,
      details: `DRC triggered: ${drcTriggered}`
    };

    await this.ssh(`
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
      import -window root ${this.testDir}/evidence/drc_test.png || true
    `);

    TestUtils.assert(drcTriggered, '/project:drc did not trigger DRC');
  }

  async testHistoryCommand() {
    this.tmux.setSSH(this.ssh.bind(this));

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    this.log('Testing /project:history command...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, '/project:history', false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(50000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);

    const historyShown = 
      (claudeOutput && (claudeOutput.toLowerCase().includes('history') ||
       claudeOutput.toLowerCase().includes('session') ||
       claudeOutput.toLowerCase().includes('command') ||
       claudeOutput.includes('/project:timing') ||
       claudeOutput.includes('/project:drc'))) ||
      false;

    this.testResults.history = {
      passed: historyShown,
      details: `History shown: ${historyShown}`
    };

    await this.ssh(`
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
      import -window root ${this.testDir}/evidence/history_test.png || true
    `);

    TestUtils.assert(historyShown, '/project:history did not show history');
  }

  async verifyResults() {
    const allPassed = Object.values(this.testResults).every(r => r.passed);

    this.log('\n=== Test Results ===');
    for (const [test, result] of Object.entries(this.testResults)) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      this.log(`${test}: ${status} - ${result.details}`);
    }

    TestUtils.assert(allPassed, 'Some tests failed');
    return allPassed;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new QuickCommandsTest();
  runner.run().catch(err => {
    console.error('QuickCommandsTest failed:', err);
    process.exit(1);
  });
}

export { QuickCommandsTest };
