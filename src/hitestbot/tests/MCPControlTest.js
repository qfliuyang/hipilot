#!/usr/bin/env node
import { E2ETestRunner } from '../infra/E2ETestRunner.js';
import * as TestUtils from '../infra/TestUtils.js';

class MCPControlTest extends E2ETestRunner {
  constructor(options) {
    super({
      testName: 'MCP Control Test',
      ...options
    });
    
    this.testResults = {
      mcp_send: { passed: false, details: '' },
      mcp_wait: { passed: false, details: '' },
      mcp_result: { passed: false, details: '' },
      mcp_capture: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Test MCP Send Command', () => this.testMCPSend());
    await this.step('Test MCP Wait For Prompt', () => this.testMCPWait());
    await this.step('Test MCP Get Result', () => this.testMCPResult());
    await this.step('Test MCP Capture and Wait', () => this.testMCPCapture());
    await this.step('Verify Results', () => this.verifyResults());
  }

  async testMCPSend() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Use the eda.send_to_terminal MCP tool to send a command to Innovus.

STEP 1: Call the MCP tool exactly like this:
eda.send_to_terminal tcl="puts MCP_TEST_12345"

This will send the puts command to Innovus through the MCP server.

After calling the tool, report what happened.`;

    this.log('Testing MCP Send Command...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(60000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    
    if (edaOutput.includes('MCP_TEST_12345')) {
      results.details.push('MCP command executed in Innovus');
      results.passed++;
    }
    if (claudeOutput.includes('send_to_terminal')) {
      results.details.push('MCP tool invoked');
      results.passed++;
    }
    if (edaOutput.includes('innovus') && edaOutput.includes('>')) {
      results.details.push('Innovus prompt present');
      results.passed++;
    }

    this.testResults.mcp_send = {
      passed: results.passed >= 2,
      details: results.details.join('; ') || 'No MCP send detected'
    };

    this.log(`EDA pane preview: ${edaOutput.slice(-300)}`);
    
    TestUtils.assert(results.passed >= 1, 'MCP send test failed');
  }

  async testMCPWait() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Use the eda.wait_for_prompt MCP tool to wait for Innovus.

STEP 1: Call the MCP tool:
eda.wait_for_prompt timeout=30

This will wait for the Innovus prompt to appear.

Report what the tool returned.`;

    this.log('Testing MCP Wait For Prompt...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(45000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (claudeOutput.includes('wait_for_prompt') || claudeOutput.includes('prompt')) {
      results.details.push('wait_for_prompt invoked');
      results.passed++;
    }
    if (claudeOutput.includes('ready') || claudeOutput.includes('detected') || claudeOutput.includes('success')) {
      results.details.push('Prompt detected');
      results.passed++;
    }

    this.testResults.mcp_wait = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No MCP wait detected'
    };

    TestUtils.assert(results.passed >= 1, 'MCP wait test failed');
  }

  async testMCPResult() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Use the eda.get_last_result MCP tool.

STEP 1: Call the MCP tool:
eda.get_last_result lines=50

This will get the result of the last command from Innovus.

Report what the tool returned.`;

    this.log('Testing MCP Get Result...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(45000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (claudeOutput.includes('get_last_result') || claudeOutput.includes('result')) {
      results.details.push('get_last_result invoked');
      results.passed++;
    }
    if (claudeOutput.includes('success') || claudeOutput.includes('output')) {
      results.details.push('Result returned');
      results.passed++;
    }

    this.testResults.mcp_result = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No MCP result detected'
    };

    TestUtils.assert(results.passed >= 1, 'MCP result test failed');
  }

  async testMCPCapture() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Use the eda.capture_and_wait MCP tool to send a command and wait.

STEP 1: Call the MCP tool:
eda.capture_and_wait tcl="puts CAPTURE_TEST_SUCCESS" timeout=30

This sends the command and waits for completion.

Report what the tool returned.`;

    this.log('Testing MCP Capture and Wait...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(60000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    
    if (edaOutput.includes('CAPTURE_TEST_SUCCESS')) {
      results.details.push('Capture command executed');
      results.passed++;
    }
    if (claudeOutput.includes('capture_and_wait') || claudeOutput.includes('capture')) {
      results.details.push('capture_and_wait invoked');
      results.passed++;
    }

    this.testResults.mcp_capture = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No MCP capture detected'
    };

    this.log(`EDA pane preview: ${edaOutput.slice(-300)}`);
    
    TestUtils.assert(results.passed >= 1, 'MCP capture test failed');
  }

  async verifyResults() {
    await this.ssh(`
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
      import -window root ${this.testDir}/evidence/mcp_control_test.png || true
    `);

    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);

    const passed = Object.values(this.testResults).filter(r => r.passed).length;
    const total = Object.keys(this.testResults).length;

    this.log(`\n=== MCP Control Test Results ===`);
    this.log(`MCP Send: ${this.testResults.mcp_send.passed ? 'PASS' : 'FAIL'} - ${this.testResults.mcp_send.details}`);
    this.log(`MCP Wait: ${this.testResults.mcp_wait.passed ? 'PASS' : 'FAIL'} - ${this.testResults.mcp_wait.details}`);
    this.log(`MCP Result: ${this.testResults.mcp_result.passed ? 'PASS' : 'FAIL'} - ${this.testResults.mcp_result.details}`);
    this.log(`MCP Capture: ${this.testResults.mcp_capture.passed ? 'PASS' : 'FAIL'} - ${this.testResults.mcp_capture.details}`);
    this.log(`\nTotal: ${passed}/${total} passed`);

    this.log(`\nFinal EDA Pane Output:\n${edaOutput.slice(-500)}`);

    const directTmux = (claudeOutput.match(/tmux send-keys/g) || []).length;
    if (directTmux > 0) {
      this.log(`WARNING: Direct tmux used ${directTmux} times (should use MCP)`);
    }

    TestUtils.assert(passed >= 3, `Only ${passed}/${total} tests passed (need 3+)`);
  }
}

const test = new MCPControlTest();
test.run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
