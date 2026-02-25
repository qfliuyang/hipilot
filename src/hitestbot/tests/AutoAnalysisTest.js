#!/usr/bin/env node

import { E2ETestRunner } from '../infra/E2ETestRunner.js';
import * as TestUtils from '../infra/TestUtils.js';

class AutoAnalysisTest extends E2ETestRunner {
  constructor(options = {}) {
    super({
      testName: 'Auto Analysis Test',
      ...options
    });
    
    this.testResults = {
      autoAnalysisNoManualPrompt: { passed: false, details: '' },
      analysisShowsInsights: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Test Auto Analysis', () => this.testAutoAnalysis());
    await this.step('Verify No Manual Prompt', () => this.verifyNoManualPrompt());
    await this.step('Verify Insights', () => this.verifyInsightsShown());
  }

  async testAutoAnalysis() {
    this.tmux.setSSH(this.ssh.bind(this));

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    this.log('Testing auto-analysis workflow...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, '/timing', false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(70000);

    this.capturedOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
  }

  async verifyNoManualPrompt() {
    const output = this.capturedOutput || await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    const hasManualPrompt = 
      output.includes('ask Claude to analyze') ||
      output.includes('To get AI analysis, ask') ||
      output.includes('provide the prompt above');

    this.testResults.autoAnalysisNoManualPrompt = {
      passed: !hasManualPrompt,
      details: hasManualPrompt ? 'Has manual prompt' : 'No manual prompt found'
    };

    TestUtils.assert(!hasManualPrompt, 'Output still contains manual prompt instruction');
  }

  async verifyInsightsShown() {
    const output = this.capturedOutput || await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    const hasInsights = 
      output.toLowerCase().includes('root cause') ||
      output.toLowerCase().includes('recommendation') ||
      output.toLowerCase().includes('suggest') ||
      output.toLowerCase().includes('analysis') ||
      output.toLowerCase().includes('summary');

    this.testResults.analysisShowsInsights = {
      passed: hasInsights,
      details: hasInsights ? 'Insights found' : 'No insights found'
    };

    TestUtils.assert(hasInsights, 'No analysis insights found in output');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new AutoAnalysisTest();
  runner.run().catch(err => {
    console.error('AutoAnalysisTest failed:', err);
    process.exit(1);
  });
}

export { AutoAnalysisTest };
