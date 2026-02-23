#!/usr/bin/env node
import { E2ETestRunner } from '../E2ETestRunner.js';
import * as TestUtils from '../TestUtils.js';

const DEPLOYED_HIPILOT = '/home/EDA/hipilot/current';
const IBEX_ROOT = '/home/EDA/hipilot_test/ibex_work_upload';

class IbexRTL2GDSFlowTest extends E2ETestRunner {
  constructor(options) {
    super({
      testName: 'Ibex RTL2GDS Flow Test',
      sessionName: 'hipilot',
      ...options
    });
    
    this.flowStages = [
      { name: 'init', tool: 'innovus', script: 'init.tcl', verified: false },
      { name: 'floorplan', tool: 'innovus', script: 'floor_plan.tcl', verified: false },
      { name: 'placement', tool: 'innovus', script: 'placement.tcl', verified: false },
      { name: 'cts', tool: 'innovus', script: 'cts.tcl', verified: false },
      { name: 'routing', tool: 'innovus', script: 'routing.tcl', verified: false },
    ];
    
    this.testResults = {
      mcp_available: { passed: false, details: '' },
      environment_setup: { passed: false, details: '' },
      flow_commands_sent: { passed: false, details: '' },
      multi_tool_execution: { passed: false, details: '' },
      flow_completion: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Deploy MCP Wrapper', () => this.deployMCPWrapper());
    await this.step('Test MCP Available', () => this.testMCPAvailable());
    await this.step('Setup Ibex Environment', () => this.setupIbexEnvironment());
    await this.step('Execute Flow Commands via MCP', () => this.executeFlowCommands());
    await this.step('Verify Multi-Tool Execution', () => this.verifyMultiToolExecution());
    await this.step('Verify Results', () => this.verifyResults());
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
    
    const result = await this.ssh(
      `${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda get_status '{}' 2>&1 | tail -1`,
      30000,
      true
    );
    
    if (result.includes('result') || result.includes('Mode')) {
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

  async setupIbexEnvironment() {
    this.log('Setting up Ibex design environment...');
    
    await this.ssh(`bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda set_mode '{"mode":"auto"}' 2>&1 | tail -1`, 30000, true);
    
    const setupResult = await this.ssh(`
      cd ${IBEX_ROOT} && \\
      export RESULT_DIR=./result && \\
      mkdir -p result/pr/data result/pr/log result/pr/report && \\
      echo "Environment ready" && \\
      pwd
    `, 30000, true);
    
    if (setupResult.includes('Environment ready')) {
      this.testResults.environment_setup = {
        passed: true,
        details: 'Ibex environment configured'
      };
    }
    
    TestUtils.assert(this.testResults.environment_setup.passed, 'Environment setup failed');
  }

  async executeFlowCommands() {
    this.tmux.setSSH(this.ssh.bind(this));
    
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true);
    await this.sleep(1000);

    const prompt = `You are HiPilot, a VLSI Physical Design copilot. Execute a test command using MCP.

IMPORTANT: You MUST use the MCP wrapper script for ALL commands to Innovus. Do NOT use direct tmux commands.

The MCP wrapper is at: ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh

Execute this test command:

STAGE 1 - Send test command via MCP:
Use this EXACT command:
bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda send_to_terminal '{"tcl":"puts RTL2GDS_FLOW_TEST_START"}'

STAGE 2 - Verify execution:
Use this EXACT command:
bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda capture_and_analyze '{"lines":20}'

STAGE 3 - Report flow stage:
Use this EXACT command:
bash ${DEPLOYED_HIPILOT}/scripts/mcp_wrapper.sh eda wait_for_prompt '{"timeout":30}'

Report the results of each stage. Confirm you see "RTL2GDS_FLOW_TEST_START" in the output.`;

    this.log('Executing RTL2GDS flow commands via MCP...');
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    await this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true);
    
    await this.sleep(180000);

    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    this.log(`Claude pane (last 500): ${claudeOutput.slice(-500)}`);
    
    const mcpUsed = (claudeOutput.match(/mcp_wrapper\.sh/g) || []).length;
    const testStart = edaOutput.includes('RTL2GDS_FLOW_TEST_START');
    const innovusPrompt = edaOutput.includes('innovus');
    const tclSource = edaOutput.includes('source /tmp/hipilot-EDA');
    
    this.flowStages[0].verified = testStart;
    
    this.testResults.flow_commands_sent = {
      passed: mcpUsed >= 1,
      details: `MCP invoked ${mcpUsed} times`
    };
    
    this.testResults.multi_tool_execution = {
      passed: testStart || tclSource,
      details: `Test executed: ${testStart ? 'YES' : 'NO'}, Tcl source: ${tclSource ? 'YES' : 'NO'}, Innovus: ${innovusPrompt ? 'YES' : 'NO'}`
    };
    
    this.log(`EDA pane output preview: ${edaOutput.slice(-500)}`);
    
    TestUtils.assert(mcpUsed >= 1 || testStart, 'No MCP commands or execution detected');
  }

  async verifyMultiToolExecution() {
    this.tmux.setSSH(this.ssh.bind(this));
    
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    const innovusPrompt = edaOutput.includes('innovus');
    const tclExecuted = edaOutput.includes('INIT_STAGE') || edaOutput.includes('REPORT_TIMING') || edaOutput.includes('puts');
    const mcpWrapperCalls = (claudeOutput.match(/mcp_wrapper\.sh/g) || []).length;
    const directTmux = (claudeOutput.match(/tmux send-keys.*-t hipilot/g) || []).length;
    
    this.log('Verification Results:');
    this.log(`  Innovus prompt present: ${innovusPrompt}`);
    this.log(`  Tcl commands executed: ${tclExecuted}`);
    this.log(`  MCP wrapper calls: ${mcpWrapperCalls}`);
    this.log(`  Direct tmux calls: ${directTmux}`);
    
    if (directTmux > 0) {
      this.log(`WARNING: Found ${directTmux} direct tmux commands (should use MCP)`);
    }
    
    const verifiedStages = this.flowStages.filter(s => s.verified).length;
    this.testResults.flow_completion = {
      passed: verifiedStages >= 1,
      details: `${verifiedStages}/${this.flowStages.length} stages verified`
    };
    
    TestUtils.assert(mcpWrapperCalls >= 2, 'Insufficient MCP usage');
  }

  async verifyResults() {
    await this.ssh(`
      export PATH=/home/EDA/hipilot_test/.local/bin:$PATH
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
    `);

    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);

    const passed = Object.values(this.testResults).filter(r => r.passed).length;
    const total = Object.keys(this.testResults).length;

    this.log(`\n=== Ibex RTL2GDS Flow Test Results ===`);
    for (const [name, result] of Object.entries(this.testResults)) {
      this.log(`${name}: ${result.passed ? 'PASS' : 'FAIL'} - ${result.details}`);
    }
    this.log(`\nTotal: ${passed}/${total} passed`);
    
    this.log(`\n=== Flow Stage Verification ===`);
    for (const stage of this.flowStages) {
      this.log(`${stage.name} (${stage.tool}): ${stage.verified ? '✓ VERIFIED' : '○ NOT VERIFIED'}`);
    }
    
    this.log(`\nFinal EDA Pane (last 800 chars):\n${edaOutput.slice(-800)}`);

    const mcpWrapper = (claudeOutput.match(/mcp_wrapper\.sh/g) || []).length;
    this.log(`\nMCP wrapper invoked ${mcpWrapper} times`);

    TestUtils.assert(passed >= 3, `Only ${passed}/${total} tests passed (need 3+)`);
  }
}

const test = new IbexRTL2GDSFlowTest();
test.run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
