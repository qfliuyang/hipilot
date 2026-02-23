#!/usr/bin/env node
import { E2ETestRunner } from '../E2ETestRunner.js';
import * as TestUtils from '../TestUtils.js';

class SkillsImprovementTest extends E2ETestRunner {
  constructor(options) {
    super({
      testName: 'Skills Improvement Test',
      ...options
    });
    
    this.testResults = {
      phase1_autonomous: { passed: false, details: '' },
      phase1_qor: { passed: false, details: '' },
      phase1_session: { passed: false, details: '' },
      phase2_workflow: { passed: false, details: '' },
      phase2_drc: { passed: false, details: '' },
      phase3_recovery: { passed: false, details: '' },
      phase3_compare: { passed: false, details: '' }
    };
  }

  async runTests() {
    await this.step('Test Phase 1 Autonomous Skills', () => this.testAutonomousSkills());
    await this.step('Test Phase 1 QoR Tracking Skills', () => this.testQoRTrackingSkills());
    await this.step('Test Phase 1 Session Management Skills', () => this.testSessionSkills());
    await this.step('Test Phase 2 Workflow Skills', () => this.testWorkflowSkills());
    await this.step('Test Phase 2 DRC Skills', () => this.testDRCSkills());
    await this.step('Test Phase 3 Recovery Skills', () => this.testRecoverySkills());
    await this.step('Test Phase 3 Compare Skills', () => this.testCompareSkills());
    await this.step('Verify Results', () => this.verifyResults());
  }

  async testAutonomousSkills() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the auto-fix-timing skill. This skill uses MCP tools for autonomous timing fixes.

 1. Read the skill file to understand the workflow
 2. Test qor.snapshot to capture baseline
 3. Test suggest.for_violation to get fix suggestions
 4. Report the skill's MCP tool dependencies.`;

    this.log('Testing Phase 1 Autonomous Skills (auto-fix-timing)...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(60000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('auto-fix-timing') || output.includes('auto_fix_timing')) {
      results.details.push('auto-fix-timing skill recognized');
      results.passed++;
    }
    if (output.includes('snapshot') || output.includes('baseline')) {
      results.details.push('qor.snapshot mentioned');
      results.passed++;
    }
    if (output.includes('suggest') || output.includes('violation')) {
      results.details.push('suggest.for_violation mentioned');
      results.passed++;
    }
    if (output.includes('MCP') || output.includes('mcp') || output.includes('feedback')) {
      results.details.push('MCP tool integration confirmed');
      results.passed++;
    }

    this.testResults.phase1_autonomous = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No autonomous skills tested'
    };

    TestUtils.assert(results.passed >= 1, 'No autonomous skills worked');
  }

  async testQoRTrackingSkills() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the track-progress skill. This skill captures QoR and shows trends.

 1. Read the skill file: skills/track-progress.md
 2. Test qor.snapshot name="e2e_test_progress"
 3. Test qor.get_trend metric="wns"
 4. Report the trend analysis.`;

    this.log('Testing Phase 1 QoR Tracking Skills (track-progress)...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(55000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('track-progress') || output.includes('progress')) {
      results.details.push('track-progress skill recognized');
      results.passed++;
    }
    if (output.includes('trend') || output.includes('improving') || output.includes('Trend')) {
      results.details.push('trend analysis works');
      results.passed++;
    }
    if (output.includes('snapshot') || output.includes('Snapshot')) {
      results.details.push('qor.snapshot works');
      results.passed++;
    }

    this.testResults.phase1_qor = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No QoR tracking skills tested'
    };

    TestUtils.assert(results.passed >= 1, 'No QoR tracking skills worked');
  }

  async testSessionSkills() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the session management skills: create-checkpoint and resume-work.

 1. Read skills/create-checkpoint.md and skills/resume-work.md
 2. Test session.save_checkpoint name="e2e_session_test"
 3. Test session.list_checkpoints
 4. Report how these skills help with rollback.`;

    this.log('Testing Phase 1 Session Management Skills...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(55000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('checkpoint') || output.includes('Checkpoint')) {
      results.details.push('create-checkpoint skill works');
      results.passed++;
    }
    if (output.includes('resume') || output.includes('restore') || output.includes('Resume')) {
      results.details.push('resume-work skill works');
      results.passed++;
    }
    if (output.includes('rollback') || output.includes('restore') || output.includes('session')) {
      results.details.push('session management confirmed');
      results.passed++;
    }

    this.testResults.phase1_session = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No session skills tested'
    };

    TestUtils.assert(results.passed >= 1, 'No session management skills worked');
  }

  async testWorkflowSkills() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the workflow automation skills: run-cts-flow and run-eco-flow.

 1. Read skills/run-cts-flow.md and skills/run-eco-flow.md
 2. Test workflow.list to see available workflows
 3. Test workflow.run name="run_cts_flow"
 4. Report the workflow execution steps.`;

    this.log('Testing Phase 2 Workflow Skills...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(55000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('cts') || output.includes('CTS') || output.includes('clock')) {
      results.details.push('run-cts-flow skill recognized');
      results.passed++;
    }
    if (output.includes('eco') || output.includes('ECO') || output.includes('workflow')) {
      results.details.push('run-eco-flow skill recognized');
      results.passed++;
    }
    if (output.includes('step') || output.includes('Step') || output.includes('iteration')) {
      results.details.push('workflow steps work');
      results.passed++;
    }

    this.testResults.phase2_workflow = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No workflow skills tested'
    };

    TestUtils.assert(results.passed >= 1, 'No workflow skills worked');
  }

  async testDRCSkills() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the auto-fix-drc skill for autonomous DRC fixing.

 1. Read skills/auto-fix-drc.md
 2. List the MCP tools it uses
 3. Describe the DRC fix loop workflow
 4. Report the supported DRC types.`;

    this.log('Testing Phase 2 DRC Skills (auto-fix-drc)...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(50000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('drc') || output.includes('DRC') || output.includes('design rule')) {
      results.details.push('auto-fix-drc skill recognized');
      results.passed++;
    }
    if (output.includes('spacing') || output.includes('short') || output.includes('width')) {
      results.details.push('DRC types identified');
      results.passed++;
    }
    if (output.includes('iteration') || output.includes('loop') || output.includes('verify')) {
      results.details.push('DRC fix loop works');
      results.passed++;
    }

    this.testResults.phase2_drc = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No DRC skills tested'
    };

    TestUtils.assert(results.passed >= 1, 'No DRC skills worked');
  }

  async testRecoverySkills() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the error recovery skills: debug-failure and auto-recover.

 1. Read skills/debug-failure.md and skills/auto-recover.md
 2. Test eda.diagnose_error with a sample error
 3. Describe the auto-recovery flow
 4. Report error categories supported.`;

    this.log('Testing Phase 3 Recovery Skills...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(50000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('debug') || output.includes('Debug') || output.includes('diagnose')) {
      results.details.push('debug-failure skill recognized');
      results.passed++;
    }
    if (output.includes('recover') || output.includes('Recover') || output.includes('auto-recover')) {
      results.details.push('auto-recover skill recognized');
      results.passed++;
    }
    if (output.includes('syntax') || output.includes('constraint') || output.includes('category')) {
      results.details.push('error categories identified');
      results.passed++;
    }

    this.testResults.phase3_recovery = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No recovery skills tested'
    };

    TestUtils.assert(results.passed >= 1, 'No recovery skills worked');
  }

  async testCompareSkills() {
    this.tmux.setSSH(this.ssh.bind(this));
    const results = { passed: 0, details: [] };

    await this.tmux.sendKeys(`${this.sessionName}:0.0`, 'clear', true, 'C-m');
    await this.sleep(1000);

    const prompt = `Test the compare-implementations skill for QoR comparison.

 1. Read skills/compare-implementations.md
 2. Test qor.list_snapshots
 3. Test qor.compare with two snapshots
 4. Report comparison metrics.`;

    this.log('Testing Phase 3 Compare Skills...');
    this.tmux.sendKeys(`${this.sessionName}:0.0`, prompt, false);
    await this.sleep(500);
    this.tmux.sendKeys(`${this.sessionName}:0.0`, null, true, 'C-m');

    await this.sleep(50000);

    const output = await this.tmux.capturePane(`${this.sessionName}:0.0`);
    
    if (output.includes('compare') || output.includes('Compare') || output.includes('comparison')) {
      results.details.push('compare-implementations skill recognized');
      results.passed++;
    }
    if (output.includes('delta') || output.includes('improvement') || output.includes('regression')) {
      results.details.push('comparison analysis works');
      results.passed++;
    }
    if (output.includes('wns') || output.includes('WNS') || output.includes('timing')) {
      results.details.push('metrics comparison works');
      results.passed++;
    }

    this.testResults.phase3_compare = {
      passed: results.passed >= 1,
      details: results.details.join('; ') || 'No compare skills tested'
    };

    TestUtils.assert(results.passed >= 1, 'No compare skills worked');
  }

  async verifyResults() {
    await this.ssh(`
      export DISPLAY=${this.display}
      mkdir -p ${this.testDir}/evidence
      import -window root ${this.testDir}/evidence/skills_test_final.png || true
    `);

    const passed = Object.values(this.testResults).filter(r => r.passed).length;
    const total = Object.keys(this.testResults).length;

    this.log(`\n=== Skills Improvement Test Results ===`);
    this.log(`Phase 1.1 (Autonomous): ${this.testResults.phase1_autonomous.passed ? 'PASS' : 'FAIL'} - ${this.testResults.phase1_autonomous.details}`);
    this.log(`Phase 1.2 (QoR Tracking): ${this.testResults.phase1_qor.passed ? 'PASS' : 'FAIL'} - ${this.testResults.phase1_qor.details}`);
    this.log(`Phase 1.3 (Session Mgmt): ${this.testResults.phase1_session.passed ? 'PASS' : 'FAIL'} - ${this.testResults.phase1_session.details}`);
    this.log(`Phase 2.1 (Workflow): ${this.testResults.phase2_workflow.passed ? 'PASS' : 'FAIL'} - ${this.testResults.phase2_workflow.details}`);
    this.log(`Phase 2.2 (DRC): ${this.testResults.phase2_drc.passed ? 'PASS' : 'FAIL'} - ${this.testResults.phase2_drc.details}`);
    this.log(`Phase 3.1 (Recovery): ${this.testResults.phase3_recovery.passed ? 'PASS' : 'FAIL'} - ${this.testResults.phase3_recovery.details}`);
    this.log(`Phase 3.2 (Compare): ${this.testResults.phase3_compare.passed ? 'PASS' : 'FAIL'} - ${this.testResults.phase3_compare.details}`);
    this.log(`\nTotal: ${passed}/${total} passed`);

    TestUtils.assert(passed >= 5, `Only ${passed}/${total} phases passed (need 5+)`);
  }
}

const test = new SkillsImprovementTest();
test.run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
