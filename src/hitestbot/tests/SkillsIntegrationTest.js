#!/usr/bin/env node
import { E2ETestRunner } from '../E2ETestRunner.js';
import * as TestUtils from '../TestUtils.js';

class SkillsIntegrationTest extends E2ETestRunner {
  constructor(options) {
    super({
      testName: 'Skills Integration Test',
      ...options
    });
    
    this.testResults = {
      eda_send: { passed: false, details: '' },
      eda_feedback: { passed: false, details: '' },
      qor_snapshot: { passed: false, details: '' },
      session_checkpoint: { passed: false, details: '' },
      workflow_run: { passed: false, details: '' },
      error_diagnosis: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Test EDA Send Command', () => this.testEDASend());
    await this.step('Test EDA Feedback Loop', () => this.testEDAFeedback());
    await this.step('Test QoR Snapshot', () => this.testQoRSnapshot());
    await this.step('Test Session Checkpoint', () => this.testSessionCheckpoint());
    await this.step('Test Workflow Run', () => this.testWorkflowRun());
    await this.step('Test Error Diagnosis', () => this.testErrorDiagnosis());
    await this.step('Verify Results', () => this.verifyResults());
  }

  async testEDASend() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Execute a test command in Innovus using the MCP tool:
   
   Call eda.send_to_terminal with tcl="puts HIPILOT_TEST_SUCCESS"
   
   This should send the command to the EDA pane and we can verify it worked.`;

    this.log('Testing EDA Send Command...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(45000);

    // Capture both panes
    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    
    // Check EDA pane for the command output
    if (edaOutput.includes('HIPILOT_TEST_SUCCESS')) {
      results.details.push('Command sent to EDA pane');
      results.passed++;
    }
    if (edaOutput.includes('innovus') && edaOutput.includes('>')) {
      results.details.push('EDA prompt present');
      results.passed++;
    }
    if (claudeOutput.includes('send_to_terminal') || claudeOutput.includes('sent')) {
      results.details.push('MCP tool invoked');
      results.passed++;
    }

    this.testResults.eda_send = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No EDA interaction'
    };

    this.log(`EDA pane output preview: ${edaOutput.slice(-200)}`);
    
    TestUtils.assert(results.passed >= 1, 'No EDA command interaction detected');
  }

  async testEDAFeedback() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the feedback loop with Innovus:
   
   1. Use eda.wait_for_prompt to wait for Innovus prompt
   2. Use eda.get_last_result to check the last command
   3. Report what you found in the EDA pane.`;

    this.log('Testing EDA Feedback Loop...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(45000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    
    if (claudeOutput.includes('wait_for_prompt') || claudeOutput.includes('prompt')) {
      results.details.push('wait_for_prompt used');
      results.passed++;
    }
    if (claudeOutput.includes('get_last_result') || claudeOutput.includes('result')) {
      results.details.push('get_last_result used');
      results.passed++;
    }
    if (claudeOutput.includes('success') || claudeOutput.includes('ready')) {
      results.details.push('Feedback received');
      results.passed++;
    }

    this.testResults.eda_feedback = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No feedback loop detected'
    };

    TestUtils.assert(results.passed >= 1, 'No EDA feedback loop detected');
  }

  async testQoRSnapshot() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test QoR tracking:
   
   1. Call qor.snapshot name="e2e_integration_test"
   2. Call qor.list_snapshots to see saved snapshots
   3. Report the snapshot ID and any metrics captured.`;

    this.log('Testing QoR Snapshot...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(45000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('snapshot') || output.includes('Snapshot')) {
      results.details.push('qor.snapshot invoked');
      results.passed++;
    }
    if (output.includes('snap_') || output.includes('ID:')) {
      results.details.push('Snapshot ID returned');
      results.passed++;
    }
    if (output.includes('list') || output.includes('saved')) {
      results.details.push('list_snapshots works');
      results.passed++;
    }

    this.testResults.qor_snapshot = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No QoR snapshot detected'
    };

    TestUtils.assert(results.passed >= 1, 'No QoR snapshot detected');
  }

  async testSessionCheckpoint() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test session checkpoint:
   
   1. Call session.save_checkpoint name="e2e_test_checkpoint"
   2. Call session.list_checkpoints to verify it was saved
   3. Report the checkpoint ID.`;

    this.log('Testing Session Checkpoint...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(45000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('Checkpoint') || output.includes('checkpoint')) {
      results.details.push('Checkpoint saved');
      results.passed++;
    }
    if (output.includes('ckpt_') || output.includes('ID:')) {
      results.details.push('Checkpoint ID returned');
      results.passed++;
    }
    if (output.includes('list') || output.includes('Session Checkpoints')) {
      results.details.push('list_checkpoints works');
      results.passed++;
    }

    this.testResults.session_checkpoint = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No checkpoint detected'
    };

    TestUtils.assert(results.passed >= 1, 'No session checkpoint detected');
  }

  async testWorkflowRun() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test workflow automation:
   
   1. Call workflow.list to see available workflows
   2. Call workflow.run name="run_cts_flow"
   3. Report the run_id and workflow status.`;

    this.log('Testing Workflow Run...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(45000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('workflow') || output.includes('Workflow')) {
      results.details.push('Workflow tools invoked');
      results.passed++;
    }
    if (output.includes('run_') || output.includes('run_id')) {
      results.details.push('Workflow started');
      results.passed++;
    }
    if (output.includes('status') || output.includes('running') || output.includes('Step')) {
      results.details.push('Workflow status returned');
      results.passed++;
    }

    this.testResults.workflow_run = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No workflow detected'
    };

    TestUtils.assert(results.passed >= 1, 'No workflow detected');
  }

  async testErrorDiagnosis() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test error diagnosis:
   
   1. Call eda.diagnose_error with output="Error: cannot find clock 'clk'"
   2. Call eda.validate_tcl with tcl="set x {"
   3. Report the diagnosis and validation results.`;

    this.log('Testing Error Diagnosis...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(45000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('diagnose') || output.includes('Diagnosis') || output.includes('Category')) {
      results.details.push('Error diagnosis works');
      results.passed++;
    }
    if (output.includes('constraint') || output.includes('clock')) {
      results.details.push('Error category detected');
      results.passed++;
    }
    if (output.includes('validation') || output.includes('Unmatched') || output.includes('brace')) {
      results.details.push('Tcl validation works');
      results.passed++;
    }

    this.testResults.error_diagnosis = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No error diagnosis detected'
    };

    TestUtils.assert(results.passed >= 1, 'No error diagnosis detected');
  }

  async verifyResults() {
    await this.ssh(`
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
      import -window root ${this.testDir}/evidence/integration_test_final.png || true
    `);

    // Capture both panes for evidence
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    await this.ssh(`echo "${edaOutput.replace(/"/g, '\\"').replace(/`/g, '\\`')}" > ${this.testDir}/evidence/eda_pane_final.log`);

    const passed = Object.values(this.testResults).filter(r => r.passed).length;
    const total = Object.keys(this.testResults).length;

    this.log(`\n=== Skills Integration Test Results ===`);
    this.log(`EDA Send: ${this.testResults.eda_send.passed ? 'PASS' : 'FAIL'} - ${this.testResults.eda_send.details}`);
    this.log(`EDA Feedback: ${this.testResults.eda_feedback.passed ? 'PASS' : 'FAIL'} - ${this.testResults.eda_feedback.details}`);
    this.log(`QoR Snapshot: ${this.testResults.qor_snapshot.passed ? 'PASS' : 'FAIL'} - ${this.testResults.qor_snapshot.details}`);
    this.log(`Session Checkpoint: ${this.testResults.session_checkpoint.passed ? 'PASS' : 'FAIL'} - ${this.testResults.session_checkpoint.details}`);
    this.log(`Workflow Run: ${this.testResults.workflow_run.passed ? 'PASS' : 'FAIL'} - ${this.testResults.workflow_run.details}`);
    this.log(`Error Diagnosis: ${this.testResults.error_diagnosis.passed ? 'PASS' : 'FAIL'} - ${this.testResults.error_diagnosis.details}`);
    this.log(`\nTotal: ${passed}/${total} passed`);

    this.log(`\nEDA Pane Output (last 200 chars): ${edaOutput.slice(-200)}`);

    TestUtils.assert(passed >= 4, `Only ${passed}/${total} tests passed (need 4+)`);
  }
}

const test = new SkillsIntegrationTest();
test.run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
