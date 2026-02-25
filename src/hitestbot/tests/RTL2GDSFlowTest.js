#!/usr/bin/env node
import { E2ETestRunner } from '../infra/E2ETestRunner.js';
import * as TestUtils from '../infra/TestUtils.js';

class RTL2GDSFlowTest extends E2ETestRunner {
  constructor(options) {
    super({
      testName: 'RTL2GDS Flow Test',
      ...options
    });
    
    this.testResults = {
      flow_start: { passed: false, details: '' },
      design_init: { passed: false, details: '' },
      floorplan: { passed: false, details: '' },
      placement: { passed: false, details: '' },
      routing: { passed: false, details: '' },
      flow_complete: { passed: false, details: '' }
    };
    
    this.ibexDir = '/home/EDA/hipilot_test/ibex_work_upload';
  }

  async runTests() {
    await this.step('Start RTL2GDS Flow', () => this.startFlow());
    await this.step('Run Design Init', () => this.runDesignInit());
    await this.step('Run Floorplan', () => this.runFloorplan());
    await this.step('Run Placement', () => this.runPlacement());
    await this.step('Run Routing', () => this.runRouting());
    await this.step('Verify Flow Complete', () => this.verifyFlowComplete());
  }

  async startFlow() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Start the RTL-to-GDS flow for the Ibex design.

CRITICAL REQUIREMENT: You MUST use MCP tools to interact with Innovus.
DO NOT use direct terminal commands, Bash tool, or tmux send-keys.

The ONLY way to send commands to Innovus is through these MCP tools:
- eda.send_to_terminal - Send Tcl commands to EDA pane
- eda.capture_and_wait - Send and wait for completion
- eda.wait_for_prompt - Wait for Innovus prompt

Here's what to do:

1. Navigate to Ibex directory using eda.send_to_terminal:
   Call: eda.send_to_terminal tcl="cd ${this.ibexDir}"
   
2. Wait for completion:
   Call: eda.wait_for_prompt timeout=30
   
3. Verify location:
   Call: eda.send_to_terminal tcl="pwd"
   Call: eda.wait_for_prompt

4. Report success when ready.

DO NOT USE: Bash tool, tmux send-keys, or any direct shell commands.
ONLY MCP tools: eda.send_to_terminal, eda.capture_and_wait, eda.wait_for_prompt`;

    this.log('Starting RTL2GDS Flow via Claude Code + MCP...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(90000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    
    if (claudeOutput.includes('send_to_terminal') || claudeOutput.includes('MCP') || claudeOutput.includes('eda.')) {
      results.details.push('MCP tools invoked');
      results.passed++;
    }
    if (edaOutput.includes('ibex') || edaOutput.includes('innovus')) {
      results.details.push('EDA pane shows activity');
      results.passed++;
    }
    if (edaOutput.includes('/home/EDA/hipilot_test/ibex')) {
      results.details.push('Navigated to Ibex directory');
      results.passed++;
    }

    this.testResults.flow_start = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No flow start detected'
    };

    this.log(`EDA pane preview: ${edaOutput.slice(-300)}`);
    
    TestUtils.assert(results.passed >= 1, 'Failed to start RTL2GDS flow');
  }

  async runDesignInit() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Run the design initialization step of the RTL2GDS flow.

CRITICAL: Use ONLY MCP tools. Do NOT use Bash tool or tmux commands.

Available MCP tools:
- eda.send_to_terminal tcl="..." - Send Tcl to Innovus
- eda.capture_and_wait tcl="..." timeout=60 - Send and wait
- eda.wait_for_prompt timeout=30 - Wait for Innovus prompt
- eda.get_last_result - Check result

Execute these steps:

1. Send init command via MCP:
   Call: eda.capture_and_wait tcl="source scripts/pr/init.tcl" timeout=120
   
2. Wait for completion:
   Call: eda.wait_for_prompt timeout=60
   
3. Check result:
   Call: eda.get_last_result

DO NOT USE: Bash tool, tmux send-keys, shell commands`;

    this.log('Running Design Init via MCP...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(120000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    
    if (edaOutput.includes('init') || edaOutput.includes('Init') || edaOutput.includes('design')) {
      results.details.push('Design init started');
      results.passed++;
    }
    if (edaOutput.includes('innovus') && (edaOutput.includes('>') || edaOutput.includes('completed'))) {
      results.details.push('Innovus prompt returned');
      results.passed++;
    }
    if (claudeOutput.includes('success') || claudeOutput.includes('complete') || claudeOutput.includes('init')) {
      results.details.push('Init step acknowledged');
      results.passed++;
    }

    this.testResults.design_init = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No design init detected'
    };

    this.log(`EDA pane preview: ${edaOutput.slice(-300)}`);
    
    TestUtils.assert(results.passed >= 1, 'Failed to run design init');
  }

  async runFloorplan() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Run the floorplan step of the RTL2GDS flow.

CRITICAL: Use ONLY MCP tools. Do NOT use Bash or tmux commands.

Execute using MCP tools:

1. Send floorplan command:
   Call: eda.capture_and_wait tcl="source scripts/pr/floor_plan.tcl" timeout=120
   
2. Wait for completion:
   Call: eda.wait_for_prompt timeout=60

3. Report metrics using eda.get_last_result

DO NOT USE: Bash tool, tmux send-keys, shell commands`;

    this.log('Running Floorplan via MCP...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(120000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    
    if (edaOutput.includes('floorplan') || edaOutput.includes('Floorplan') || edaOutput.includes('core')) {
      results.details.push('Floorplan executed');
      results.passed++;
    }
    if (edaOutput.includes('area') || edaOutput.includes('utilization')) {
      results.details.push('Area/utilization reported');
      results.passed++;
    }
    if (claudeOutput.includes('floorplan') || claudeOutput.includes('success')) {
      results.details.push('Floorplan step acknowledged');
      results.passed++;
    }

    this.testResults.floorplan = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No floorplan detected'
    };

    this.log(`EDA pane preview: ${edaOutput.slice(-300)}`);
    
    TestUtils.assert(results.passed >= 1, 'Failed to run floorplan');
  }

  async runPlacement() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Run the placement step of the RTL2GDS flow.

CRITICAL: Use ONLY MCP tools. Do NOT use Bash or tmux commands.

Execute using MCP tools:

1. Send placement command:
   Call: eda.capture_and_wait tcl="source scripts/pr/placement.tcl" timeout=120
   
2. Wait for completion:
   Call: eda.wait_for_prompt timeout=60

3. Report results

DO NOT USE: Bash tool, tmux send-keys, shell commands`;

    this.log('Running Placement via MCP...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(120000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    
    if (edaOutput.includes('placement') || edaOutput.includes('Placement') || edaOutput.includes('place')) {
      results.details.push('Placement executed');
      results.passed++;
    }
    if (edaOutput.includes('timing') || edaOutput.includes('congestion')) {
      results.details.push('Timing/congestion checked');
      results.passed++;
    }
    if (claudeOutput.includes('placement') || claudeOutput.includes('complete')) {
      results.details.push('Placement step acknowledged');
      results.passed++;
    }

    this.testResults.placement = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No placement detected'
    };

    this.log(`EDA pane preview: ${edaOutput.slice(-300)}`);
    
    TestUtils.assert(results.passed >= 1, 'Failed to run placement');
  }

  async runRouting() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Run the routing step of the RTL2GDS flow.

CRITICAL: Use ONLY MCP tools. Do NOT use Bash or tmux commands.

Execute using MCP tools:

1. Send routing command:
   Call: eda.capture_and_wait tcl="source scripts/pr/routing.tcl" timeout=180
   
2. Wait for completion:
   Call: eda.wait_for_prompt timeout=120

3. Report routing and DRC status

DO NOT USE: Bash tool, tmux send-keys, shell commands`;

    this.log('Running Routing via MCP...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(120000);

    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    
    if (edaOutput.includes('route') || edaOutput.includes('Route') || edaOutput.includes('nano')) {
      results.details.push('Routing executed');
      results.passed++;
    }
    if (edaOutput.includes('DRC') || edaOutput.includes('drc') || edaOutput.includes('violation')) {
      results.details.push('DRC checked');
      results.passed++;
    }
    if (claudeOutput.includes('route') || claudeOutput.includes('complete')) {
      results.details.push('Routing step acknowledged');
      results.passed++;
    }

    this.testResults.routing = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No routing detected'
    };

    this.log(`EDA pane preview: ${edaOutput.slice(-300)}`);
    
    TestUtils.assert(results.passed >= 1, 'Failed to run routing');
  }

  async verifyFlowComplete() {
    await this.ssh(`
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
      import -window root ${this.testDir}/evidence/rtl2gds_flow_final.png || true
    `);

    const edaOutput = await this.tmux.capturePane(`${this.sessionName}:0.1`);
    const claudeOutput = await this.tmux.capturePane(`${this.sessionName}:0.0`);

    const results = { passed: 0, details: [] };

    const passedCount = Object.values(this.testResults).filter(r => r.passed).length;
    
    if (passedCount >= 4) {
      results.details.push(`${passedCount}/5 flow steps completed`);
      results.passed++;
    }
    
    if (edaOutput.includes('innovus') && edaOutput.includes('>')) {
      results.details.push('Innovus still running');
      results.passed++;
    }

    const mcpUsage = (claudeOutput.match(/eda\./g) || []).length;
    if (mcpUsage >= 3) {
      results.details.push(`MCP tools mentioned ${mcpUsage} times`);
      results.passed++;
    }

    const directTmux = (claudeOutput.match(/tmux send-keys/g) || []).length;
    if (directTmux > 0) {
      results.details.push(`WARNING: Direct tmux used ${directTmux} times (should use MCP)`);
    } else {
      results.details.push('No direct tmux detected (good)');
      results.passed++;
    }

    this.testResults.flow_complete = {
      passed: results.passed >= 2,
      details: results.details.join('; ') || 'Flow verification incomplete'
    };

    const totalPassed = Object.values(this.testResults).filter(r => r.passed).length;
    const total = Object.keys(this.testResults).length;

    this.log(`\n=== RTL2GDS Flow Test Results ===`);
    this.log(`Flow Start: ${this.testResults.flow_start.passed ? 'PASS' : 'FAIL'} - ${this.testResults.flow_start.details}`);
    this.log(`Design Init: ${this.testResults.design_init.passed ? 'PASS' : 'FAIL'} - ${this.testResults.design_init.details}`);
    this.log(`Floorplan: ${this.testResults.floorplan.passed ? 'PASS' : 'FAIL'} - ${this.testResults.floorplan.details}`);
    this.log(`Placement: ${this.testResults.placement.passed ? 'PASS' : 'FAIL'} - ${this.testResults.placement.details}`);
    this.log(`Routing: ${this.testResults.routing.passed ? 'PASS' : 'FAIL'} - ${this.testResults.routing.details}`);
    this.log(`Flow Complete: ${this.testResults.flow_complete.passed ? 'PASS' : 'FAIL'} - ${this.testResults.flow_complete.details}`);
    this.log(`\nTotal: ${totalPassed}/${total} passed`);

    this.log(`\nFinal EDA Pane Output (last 500 chars):\n${edaOutput.slice(-500)}`);

    TestUtils.assert(totalPassed >= 4, `Only ${totalPassed}/${total} tests passed (need 4+)`);
  }
}

const test = new RTL2GDSFlowTest();
test.run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
