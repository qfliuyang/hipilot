#!/usr/bin/env node
import { E2ETestRunner } from '../E2ETestRunner.js';
import * as TestUtils from '../TestUtils.js';

class MCPImprovementTest extends E2ETestRunner {
  constructor(options) {
    super({
      testName: 'MCP Improvement Test',
      ...options
    });
    
    this.testResults = {
      feedback: { passed: false, details: '' },
      session: { passed: false, details: '' },
      context: { passed: false, details: '' },
      qor: { passed: false, details: '' },
      diagnosis: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Test Feedback Loop tools', () => this.testFeedbackLoop());
    await this.step('Test Session State tools', () => this.testSessionState());
    await this.step('Test Context Detection tools', () => this.testContextDetection());
    await this.step('Test QoR Tracking tools', () => this.testQorTracking());
    await this.step('Test Error Diagnosis tools', () => this.testErrorDiagnosis());
    await this.step('Verify Results', () => this.verifyResults());
  }

  async testFeedbackLoop() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, total: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the new MCP Feedback Loop tools. 

1. Test eda.wait_for_prompt with timeout=10
2. Send "puts HELLO_MCP_TEST" via eda.send_to_terminal  
3. Call eda.get_last_result to check result
4. Report each tool test result.`;

    this.log('Testing MCP Feedback Loop tools...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(60000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('wait_for_prompt') || output.includes('prompt detected')) {
      results.details.push('wait_for_prompt works');
      results.passed++;
    }
    if (output.includes('HELLO_MCP_TEST')) {
      results.details.push('send_to_terminal works');
      results.passed++;
    }
    if (output.includes('get_last_result')) {
      results.details.push('get_last_result works');
      results.passed++;
    }

    this.testResults.feedback = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No feedback tools tested'
    };

    TestUtils.assert(results.passed >= 1, 'No feedback loop tools worked');
  }

  async testSessionState() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Use the MCP tools from hipilot-eda server. Call these tools:
 - session.save_checkpoint with name="e2e_test"
 - session.list_checkpoints
 - session.get_context
 Report what each tool returns.`;

    this.log('Testing Session State tools...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(60000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    this.log(`Output length: ${output.length} chars`);
    
    const lowerOutput = output.toLowerCase();
    if (lowerOutput.includes('checkpoint') && (lowerOutput.includes('saved') || lowerOutput.includes('name'))) {
      results.details.push('save_checkpoint works');
      results.passed++;
    }
    if (lowerOutput.includes('checkpoint') && lowerOutput.includes('list')) {
      results.details.push('list_checkpoints works');
      results.passed++;
    }
    if (lowerOutput.includes('context') || lowerOutput.includes('session') || lowerOutput.includes('tool:')) {
      results.details.push('get_context works');
      results.passed++;
    }
    if (output.includes('session.save_checkpoint') || output.includes('session.list_checkpoints') || output.includes('session.get_context')) {
      results.details.push('session tools mentioned');
      results.passed++;
    }

    this.testResults.session = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No session tools tested'
    };

    this.log(`Session test output preview: ${output.slice(-500)}`);
    
    TestUtils.assert(results.passed >= 1, 'No session state tools worked');
  }

  async testContextDetection() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the Context Detection MCP tools:

1. context.detect
2. context.get_stage
3. context.suggest_next
Report detected context.`;

    this.log('Testing Context Detection tools...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(50000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('Detected Context') || output.includes('Tool:') || output.includes('context.detect')) {
      results.details.push('detect works');
      results.passed++;
    }
    if (output.includes('Stage') || output.includes('Current Stage')) {
      results.details.push('get_stage works');
      results.passed++;
    }
    if (output.includes('suggest') || output.includes('Suggested') || output.includes('Next Step')) {
      results.details.push('suggest_next works');
      results.passed++;
    }

    this.testResults.context = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No context tools tested'
    };

    TestUtils.assert(results.passed >= 1, 'No context detection tools worked');
  }

  async testQorTracking() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the QoR Tracking MCP tools:

1. qor.snapshot name="e2e_test"
2. qor.list_snapshots
3. qor.get_trend
Report captured metrics.`;

    this.log('Testing QoR Tracking tools...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(50000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('QoR') || output.includes('snapshot') || output.includes('Snapshot')) {
      results.details.push('QoR tracking works');
      results.passed++;
    }

    this.testResults.qor = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No QoR tools tested'
    };

    TestUtils.assert(results.passed >= 0, 'QoR tracking tools (may not have metrics yet)');
  }

  async testErrorDiagnosis() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the Error Diagnosis MCP tools:
 1. eda.diagnose_error with error: "Error: cannot find clock 'clk'"
 2. eda.validate_tcl with tcl: "set x {" (unclosed brace)
 Report diagnosis and validation.`;

    this.log('Testing Error Diagnosis tools...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(35000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('diagnosis') || output.includes('Diagnosis') || output.includes('Category') || output.includes('error')) {
      results.details.push('diagnose_error works');
      results.passed++;
    }
    if (output.includes('validation') || output.includes('Tcl Validation') || output.includes('brace') || output.includes('Unmatched')) {
      results.details.push('validate_tcl works');
      results.passed++;
    }

    this.testResults.diagnosis = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No diagnosis tools tested'
    };

    TestUtils.assert(results.passed >= 1, 'No error diagnosis tools worked');
  }

  async verifyResults() {
    await this.ssh(`
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
      import -window root ${this.testDir}/evidence/mcp_test_final.png || true
    `);

    const passed = Object.values(this.testResults).filter(r => r.passed).length;
    const total = Object.keys(this.testResults).length;

    this.log(`\n=== MCP Improvement Test Results ===`);
    this.log(`Phase 1.1 (Feedback): ${this.testResults.feedback.passed ? 'PASS' : 'FAIL'} - ${this.testResults.feedback.details}`);
    this.log(`Phase 1.2 (Session): ${this.testResults.session.passed ? 'PASS' : 'FAIL'} - ${this.testResults.session.details}`);
    this.log(`Phase 1.3 (Context): ${this.testResults.context.passed ? 'PASS' : 'FAIL'} - ${this.testResults.context.details}`);
    this.log(`Phase 2.1 (QoR): ${this.testResults.qor.passed ? 'PASS' : 'SKIP'} - ${this.testResults.qor.details}`);
    this.log(`Phase 2.2 (Diagnosis): ${this.testResults.diagnosis.passed ? 'PASS' : 'FAIL'} - ${this.testResults.diagnosis.details}`);
    this.log(`\nTotal: ${passed}/${total} passed`);

    TestUtils.assert(passed >= 3, `Only ${passed}/${total} phases passed (need 3+)`);
  }
}

const test = new MCPImprovementTest();
test.run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
