#!/usr/bin/env node

import { E2ETestRunner } from '../E2ETestRunner.js';
import * as TestUtils from '../TestUtils.js';

class EvidenceOutputTest extends E2ETestRunner {
  constructor(options = {}) {
    super({
      testName: 'Evidence Output Test',
      ...options
    });
    
    this.testResults = {
      hasAnalysisSection: { passed: false, details: '' },
      hasSourceAttribution: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Generate Tcl', () => this.testGenerateTcl());
    await this.step('Verify Format', () => this.verifyEvidenceFormat());
  }

  async testGenerateTcl() {
    this.tmux.setSSH(this.ssh.bind(this));

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    this.log('Testing evidence-based output format...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 
      'Call the eda.generate_tcl MCP tool with intent "report timing", operation "report_timing", tool "cadence". Show me the full response with Analysis and Source sections.', false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(70000);

    this.capturedOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    this.log(`Captured ${this.capturedOutput.length} characters`);
  }

  async verifyEvidenceFormat() {
    const output = this.capturedOutput || await this.tmux.capturePane(`${this.sessionName}:0.0`);

    const hasAnalysis = 
      output.toLowerCase().includes('analysis') ||
      output.toLowerCase().includes('intent:') ||
      output.toLowerCase().includes('operation:');

    const hasSource = 
      output.toLowerCase().includes('source') ||
      output.toLowerCase().includes('template:') ||
      output.toLowerCase().includes('type:');

    this.testResults.hasAnalysisSection = {
      passed: hasAnalysis,
      details: hasAnalysis ? 'Analysis found' : 'No analysis'
    };

    this.testResults.hasSourceAttribution = {
      passed: hasSource,
      details: hasSource ? 'Source found' : 'No source'
    };

    TestUtils.assert(hasAnalysis, 'No analysis section in output');
    TestUtils.assert(hasSource, 'No source attribution in output');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new EvidenceOutputTest();
  runner.run().catch(err => {
    console.error('EvidenceOutputTest failed:', err);
    process.exit(1);
  });
}

export { EvidenceOutputTest };
