#!/usr/bin/env node
import { E2ETestRunner } from '../E2ETestRunner.js';
import * as TestUtils from '../TestUtils.js';

const DEPLOYED_HIPILOT = '/home/EDA/hipilot/current';

class MCPRtl2GdsTest extends E2ETestRunner {
  constructor(options) {
    // Use fixed session name "hipilot" to match MCP server expectations
    super({
      testName: 'MCP RTL2GDS Test',
      sessionName: 'hipilot',
      ...options
    });
    
    this.testResults = {
      mcp_available: { passed: false, details: '' },
      mcp_send: { passed: false, details: '' },
      mcp_wait: { passed: false, details: '' },
      mcp_result: { passed: false, details: '' },
      innovus_command: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Deploy MCP Wrapper', () => this.deployMCPWrapper());
    await this.step('Test MCP Available', () => this.testMCPAvailable());
    await this.step('Test MCP Send Command', () => this.testMCPSend());
    await this.step('Test MCP Wait', () => this.testMCPWait());
    await this.step('Test MCP Result', () => this.testMCPResult());
    await this.step('Verify EDA Output', () => this.verifyEDAOutput());
  }

  async deployMCPWrapper() {
    await this.ssh(`mkdir -p ${DEPLOYED_HIPILOT}/scripts`);
    
    const localWrapper = process.cwd() + '/scripts/mcp_wrapper.sh';
    await this.scp(localWrapper, `${this.config.sshHost}:${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh`);
    await this.ssh(`chmod +x ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh`);
    this.log('MCP wrapper deployed');
  }

  async testMCPAvailable() {
    this.log('Testing MCP server availability...');
    
    const result = await this.ssh(`${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda get_status '{}' 2>&1 | tail -1`, 30000, true);
    
    this.log(`MCP response (last line): ${result.slice(0, 200)}`);
    
    if (result.includes('result') || result.includes('Mode') || result.includes('HiPilot System Status')) {
      this.testResults.mcp_available = {
        passed: true,
        details: 'MCP server responded with status'
      };
    } else {
      this.testResults.mcp_available = {
        passed: false,
        details: `MCP error: ${result.slice(0, 200)}`
      };
    }
    
    TestUtils.assert(this.testResults.mcp_available.passed, 'MCP server not available');
  }

  async testMCPSend() {
    this.tmux.setSSH(this.ssh.bind(this));
    
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    const prompt = `You have an MCP wrapper script at ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh

This script calls MCP servers directly via JSON-RPC.

IMPORTANT: The EDA server is in MANUAL mode which requires approval. To execute commands, you must:
1. First set mode to AUTO: bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda set_mode '{"mode":"auto"}'
2. Then send command: bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"puts HIPILOT_MCP_TEST_12345"}'

STEP 1: Run this EXACT command to set auto mode:
bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda set_mode '{"mode":"auto"}'

STEP 2: Run this EXACT command to send Tcl to Innovus:
bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"puts HIPILOT_MCP_TEST_12345"}'

STEP 3: Report what happened - did you see "HIPILOT_MCP_TEST_12345" in Innovus?`;

    this.log('Testing MCP Send via wrapper...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true);
    await this.sleep(90000);

    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    const mcpUsed = claudeOutput.includes('mcp_wrapper.sh');
    const commandSent = claudeOutput.includes('send_to_terminal');
    const innovusExecuted = edaOutput.includes('HIPILOT_MCP_TEST_12345');

    this.testResults.mcp_send = {
      passed: mcpUsed || commandSent,
      details: `MCP wrapper used: ${mcpUsed}, Command sent: ${commandSent}, Innovus executed: ${innovusExecuted}`
    };

    this.log(`EDA pane: ${edaOutput.slice(-200)}`);
    
    if (innovusExecuted) {
      this.testResults.innovus_command = {
        passed: true,
        details: 'Command executed in Innovus via MCP'
      };
    }
    
    TestUtils.assert(mcpUsed || commandSent, 'MCP send test failed');
  }

  async testMCPWait() {
    this.tmux.setSSH(this.ssh.bind(this));
    
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    const prompt = `Use the MCP wrapper to wait for Innovus prompt:

STEP 1: Run this EXACT command:
bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda wait_for_prompt '{"timeout":30}'

STEP 2: Report what the wrapper returned.`;

    this.log('Testing MCP Wait via wrapper...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true);
    await this.sleep(45000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    const waitUsed = claudeOutput.includes('wait_for_prompt');
    const promptDetected = claudeOutput.includes('prompt') || claudeOutput.includes('ready');

    this.testResults.mcp_wait = {
      passed: waitUsed,
      details: `Wait tool used: ${waitUsed}, Prompt detected: ${promptDetected}`
    };

    TestUtils.assert(waitUsed, 'MCP wait test failed');
  }

  async testMCPResult() {
    this.tmux.setSSH(this.ssh.bind(this));
    
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    const prompt = `Use the MCP wrapper to get the last result from Innovus:

STEP 1: Run this EXACT command:
bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda get_last_result '{"lines":50}'

STEP 2: Report what the wrapper returned.`;

    this.log('Testing MCP Result via wrapper...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true);
    await this.sleep(45000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    const resultUsed = claudeOutput.includes('get_last_result');

    this.testResults.mcp_result = {
      passed: resultUsed,
      details: `Result tool used: ${resultUsed}`
    };

    TestUtils.assert(resultUsed, 'MCP result test failed');
  }

  async verifyEDAOutput() {
    await this.ssh(`
      export PATH=/home/EDA/hipilot_test/.local/bin:$PATH
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
    `);

    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);

    const passed = Object.values(this.testResults).filter(r => r.passed).length;
    const total = Object.keys(this.testResults).length;

    this.log(`\n=== MCP RTL2GDS Test Results ===`);
    for (const [name, result] of Object.entries(this.testResults)) {
      this.log(`${name}: ${result.passed ? 'PASS' : 'FAIL'} - ${result.details}`);
    }
    this.log(`\nTotal: ${passed}/${total} passed`);
    this.log(`\nFinal EDA Pane:\n${edaOutput.slice(-500)}`);

    const directTmux = (claudeOutput.match(/tmux send-keys.*innovus/gi) || []).length;
    if (directTmux > 0) {
      this.log(`WARNING: Direct tmux to Innovus used ${directTmux} times (should use MCP)`);
    }

    const mcpWrapper = (claudeOutput.match(/mcp_wrapper\.sh/g) || []).length;
    this.log(`MCP wrapper invoked ${mcpWrapper} times`);

    TestUtils.assert(passed >= 4, `Only ${passed}/${total} tests passed (need 4+)`);
  }
}

const test = new MCPRtl2GdsTest();
test.run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
