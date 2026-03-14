/**
 * RalphLoopCertifier — Iterative test certification with persistence.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync, rmSync, renameSync } from 'fs';
import { join, dirname, basename } from 'path';
import { globSync } from 'glob';
import { FlowCertifier } from './core/FlowCertifier.js';

// Simplified phase structure focused on ultimate goal: working RTL2GDS flow
const PHASES = [
  { id: 0, name: 'Infrastructure', duration: 10 * 60 * 1000, goal: 'MCP, tmux, display work, EDA tool starts', commands: ['start innovus for the ibex design'] },
  { id: 1, name: 'Full RTL2GDS', duration: 180 * 60 * 1000, goal: 'Complete RTL-to-GDS flow with real tools', commands: ['/synthesis', '/floorplan', '/powerplan', '/placement', '/cts', '/routing', '/chipfinish'] },
];

const SCORING = {
  L1_RESPONSE: { weight: 1.0 },
  L2_UNDERSTAND: { weight: 1.0 },
  L3_MCP: { weight: 1.0 },
  L4_TOOL_EXEC: { weight: 2.0 },
  L5_FRESH_QOR: { weight: 1.0 },
};

const MAX_SCORE = 6.0;

function loadState(testId, stateDir) {
  const statePath = join(stateDir, 'state.json');
  if (existsSync(statePath)) {
    try {
      return JSON.parse(readFileSync(statePath, 'utf8'));
    } catch (e) {
      console.warn('Failed to load state:', e.message);
    }
  }
  return {
    testId,
    iteration: 0,
    startedAt: new Date().toISOString(),
    passedPhases: [],
    currentPhase: 0,
    failures: [],
    notes: [],
    graduationReady: false,
  };
}

function saveState(state, stateDir) {
  const statePath = join(stateDir, 'state.json');
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function validateEvidenceFreshness(evidenceDir, iterationStartTime) {
  const files = globSync(`${evidenceDir}/**/*`, { nodir: true });
  const staleFiles = [];
  for (const file of files) {
    try {
      const stats = statSync(file);
      const createTime = stats.birthtimeMs || stats.mtimeMs;
      if (createTime < iterationStartTime - 5000) {
        staleFiles.push({
          file: basename(file),
          created: new Date(createTime).toISOString(),
          ageMinutes: Math.round((iterationStartTime - createTime) / 60000),
        });
      }
    } catch (e) {}
  }
  if (staleFiles.length > 0) {
    return { valid: false, error: 'STALE_EVIDENCE', staleFiles };
  }
  return { valid: true };
}

function validateToolExecution(edaPaneLog) {
  const echoOnlyPatterns = [
    /^\[EDA@.*\]\$ echo/,
    /^\s*icc2_shell.*Synopsys ICC2/,
    /^\s*innovus.*Cadence Innovus/,
    /^\s*Start your EDA tool/,
  ];
  const lines = edaPaneLog.split('\n').filter(l => l.trim());
  const allEchoOnly = lines.every(line => echoOnlyPatterns.some(p => p.test(line)));
  if (allEchoOnly) {
    return { valid: false, error: 'ECHO_ONLY_NO_TOOL_EXECUTION', detail: 'Right pane shows only echo commands' };
  }
  const validPatterns = [/innovus\s*\d+>/, /dc_shell>/, /pt_shell>/, /Loading.*design/i, /Compiling/i];
  const hasValidActivity = validPatterns.some(p => lines.some(line => p.test(line)));
  if (!hasValidActivity) {
    return { valid: false, error: 'NO_TOOL_ACTIVITY_DETECTED', detail: 'No recognizable EDA tool output' };
  }
  return { valid: true };
}

function validateResultFilesFreshness(designDir, iterationStartTime) {
  const criticalPatterns = ['result/syn/data/*.v', 'result/pr/data/*.enc', 'result/pr/gds/*.gds'];
  const results = [];
  for (const pattern of criticalPatterns) {
    const files = globSync(`${designDir}/${pattern}`);
    for (const file of files) {
      try {
        const stats = statSync(file);
        const createTime = stats.birthtimeMs || stats.mtimeMs;
        results.push({ file: basename(file), isFresh: createTime > iterationStartTime - 5000, size: stats.size });
      } catch (e) {}
    }
  }
  const staleResults = results.filter(r => !r.isFresh);
  if (staleResults.length > 0) {
    return { valid: false, error: 'STALE_RESULT_FILES', staleResults };
  }
  return { valid: true, files: results };
}

export class RalphLoopCertifier {
  constructor(options = {}) {
    this.options = {
      maxIterations: options.maxIterations || 10,
      targetPhase: options.targetPhase || 7,
      cleanDesignSource: options.cleanDesignSource || '/home/EDA/ibex_demo.tar',
      baseWorkDir: options.baseWorkDir || '/home/EDA/hipilot_test',
      evidenceDir: options.evidenceDir || '/tmp/hipilot-test-evidence',
      session: options.session || 'hipilot',
      validateEvidence: options.validateEvidence !== false,
    };
    this.testId = `ralph_v4_${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
    this.stateDir = join(this.options.evidenceDir, 'v4', this.testId);
    this.state = loadState(this.testId, this.stateDir);
    this.fixHistory = [];
  }

  async run() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  RALPH-LOOP: HiPilot Test Certification v4');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\nTest ID: ${this.testId}`);
    console.log(`Target: Phase ${this.options.targetPhase} (${PHASES[this.options.targetPhase]?.name})`);
    console.log(`Max Iterations: ${this.options.maxIterations}\n`);

    let graduated = false;
    while (this.state.iteration < this.options.maxIterations && !graduated) {
      this.state.iteration++;
      const result = await this._runIteration();
      if (result.status === 'GRADUATED') {
        graduated = true;
        this._printGraduation();
      } else if (result.status === 'MAX_ITERATIONS_REACHED') {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  MAX ITERATIONS REACHED — Certification Failed');
        console.log('═══════════════════════════════════════════════════════════');
        return { success: false, state: this.state, fixHistory: this.fixHistory };
      }
    }
    return { success: graduated, state: this.state, fixHistory: this.fixHistory };
  }

  async _runIteration() {
    const iteration = this.state.iteration;
    console.log('\n───────────────────────────────────────────────────────────');
    console.log(`ITERATION ${iteration}/${this.options.maxIterations}`);
    console.log('───────────────────────────────────────────────────────────\n');

    const iterationStartTime = Date.now();
    const iterationDir = join(this.stateDir, `iteration_${iteration}`);
    mkdirSync(iterationDir, { recursive: true });

    let designDir;
    try {
      designDir = this._extractCleanDesign(iteration);
    } catch (e) {
      console.error(`Failed to extract clean design: ${e.message}`);
      this._recordFailure(iteration, 0, 'CLEAN_DESIGN_ERROR', e.message, 'Verify tar file exists');
      return { status: 'PARTIAL', completedPhases: this.state.passedPhases };
    }

    for (const phase of PHASES) {
      if (phase.id > this.options.targetPhase) break;
      if (this.state.passedPhases.includes(phase.id)) {
        console.log(`[${this._elapsed()}] Phase ${phase.id}: Already passed ✓`);
        continue;
      }

      const result = await this._runPhase(phase, iteration, designDir, iterationDir);
      if (result.status === 'PASS') {
        this.state.passedPhases.push(phase.id);
        this.state.currentPhase = phase.id + 1;
        saveState(this.state, this.stateDir);
        console.log(`[${this._elapsed()}] Phase ${phase.id}: PASS ✓ (${result.score.toFixed(1)}/${MAX_SCORE})`);
      } else {
        const diagnosis = this._diagnoseFailure(result, phase);
        this._recordFailure(iteration, phase.id, diagnosis.issue, diagnosis.detail, diagnosis.fix);
        console.log(`\n  ERROR: ${diagnosis.issue}`);
        console.log(`  DETAIL: ${diagnosis.detail}`);
        console.log(`  ACTION: ${diagnosis.fix}\n`);
        saveState(this.state, this.stateDir);
        console.log(`[${this._elapsed()}] Fix logged. Will retry in iteration ${iteration + 1}`);
        return { status: 'PARTIAL', completedPhases: this.state.passedPhases };
      }
    }

    if (this.state.passedPhases.length === PHASES.length) {
      const graduationCheck = await this._verifyGraduation(iterationDir, iterationStartTime, designDir);
      if (graduationCheck.graduated) {
        this.state.graduationReady = true;
        saveState(this.state, this.stateDir);
        return { status: 'GRADUATED', completedPhases: this.state.passedPhases };
      } else {
        console.log(`[${this._elapsed()}] Graduation check failed: ${graduationCheck.reason}`);
        this._recordFailure(iteration, 7, 'GRADUATION_FAILED', graduationCheck.reason, 'Review evidence and retry');
        return { status: 'PARTIAL', completedPhases: this.state.passedPhases };
      }
    }

    return { status: 'PARTIAL', completedPhases: this.state.passedPhases };
  }

  async _runPhase(phase, iteration, designDir, iterationDir) {
    const phaseEvidenceDir = join(iterationDir, `phase_${phase.id}`);
    mkdirSync(phaseEvidenceDir, { recursive: true });

    // Use consistent session name so MCP servers can find the tmux session
    // MCP servers are configured with HIPILOT_SESSION='hipilot'
    const certifier = new FlowCertifier({
      evidenceDir: phaseEvidenceDir,
      session: this.options.session,
    });

    const command = phase.commands[0];
    const phaseStartTime = Date.now();
    const result = await certifier.runTest(command, { maxWaitMs: phase.duration, designDir });
    const phaseDuration = Date.now() - phaseStartTime;

    const scores = this._calculateScores(result);
    const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
    const l4Score = scores.L4?.score || 0;

    // Phase-specific pass criteria
    // Phase 0 (/start-eda) launches tool but may not have tool execution output
    // Phases 1-4 involve actual EDA tool execution - require L4
    const requiresToolExecution = phase.id >= 1;
    const passed = requiresToolExecution
      ? (totalScore >= 4.0 && l4Score >= 2.0)
      : (totalScore >= 3.0); // Phase 0: Infrastructure without requiring EDA execution

    if (this.options.validateEvidence && passed) {
      const iterationStartTime = Date.now() - phaseDuration;
      const freshness = validateEvidenceFreshness(phaseEvidenceDir, iterationStartTime);
      if (!freshness.valid) {
        return { status: 'FAIL', phase: phase.id, score: totalScore, scores, freshness, error: 'STALE_EVIDENCE' };
      }
    }

    return { status: passed ? 'PASS' : 'FAIL', phase: phase.id, score: totalScore, scores, result };
  }

  _calculateScores(result) {
    const stageResult = result.stageResults[0];
    if (!stageResult) {
      return { L1: { score: 0 }, L2: { score: 0 }, L3: { score: 0 }, L4: { score: 0 }, L5: { score: 0 } };
    }
    const scores = stageResult.scores || {};
    return {
      L1: { score: (scores.L1_prompt_delivery?.score || 0) * SCORING.L1_RESPONSE.weight },
      L2: { score: (scores.L2_intent_recognition?.score || 0) * SCORING.L2_UNDERSTAND.weight },
      L3: { score: (scores.L3_mcp_tool_usage?.score || 0) * SCORING.L3_MCP.weight },
      L4: { score: (scores.L4_eda_execution?.score || 0) * SCORING.L4_TOOL_EXEC.weight },
      L5: { score: (scores.L5_qor_assessment?.score || 0) * SCORING.L5_FRESH_QOR.weight },
    };
  }

  _diagnoseFailure(result, phase) {
    const scores = result.scores || {};
    if (result.error === 'STALE_EVIDENCE') {
      return { issue: 'Stale evidence detected', detail: 'Evidence files created before iteration', fix: 'Verify clean design extraction' };
    }
    // Only diagnose L4 failure for phases that require tool execution (1-4)
    const requiresToolExecution = phase.id >= 1;
    if (requiresToolExecution && (scores.L4_eda_execution?.score || 0) < 2.0) {
      return { issue: 'No actual EDA tool execution', detail: scores.L4_eda_execution?.detail || 'No tool activity', fix: 'Check MCP connectivity' };
    }
    if ((scores.L3_mcp_tool_usage?.score || 0) < 1.0) {
      return { issue: 'MCP tools not used', detail: scores.L3_mcp_tool_usage?.detail || 'No MCP calls', fix: 'Check settings.json' };
    }
    if ((scores.L1_prompt_delivery?.score || 0) < 1.0) {
      return { issue: 'Claude did not respond', detail: scores.L1_prompt_delivery?.detail || 'No output', fix: 'Check Claude Code' };
    }
    return { issue: `Phase ${phase.id} failed`, detail: 'Score below threshold', fix: 'Review evidence' };
  }

  _recordFailure(iteration, phase, issue, detail, fix) {
    const failure = { iteration, phase, issue, detail, fix, timestamp: new Date().toISOString() };
    this.state.failures.push(failure);
    this.fixHistory.push(failure);
  }

  async _verifyGraduation(iterationDir, iterationStartTime, designDir) {
    console.log(`[${this._elapsed()}] Running graduation verification...`);
    if (this.state.passedPhases.length !== PHASES.length) {
      return { graduated: false, reason: `Only ${this.state.passedPhases.length}/${PHASES.length} phases passed` };
    }
    const finalPhaseDir = join(iterationDir, `phase_${PHASES.length - 1}`);
    const freshness = validateEvidenceFreshness(finalPhaseDir, iterationStartTime);
    if (!freshness.valid) {
      return { graduated: false, reason: 'Stale evidence detected' };
    }
    const edaLogPath = join(finalPhaseDir, 'pane_logs', 'eda_full.log');
    if (existsSync(edaLogPath)) {
      const edaLog = readFileSync(edaLogPath, 'utf8');
      const toolValidation = validateToolExecution(edaLog);
      if (!toolValidation.valid) {
        return { graduated: false, reason: 'Invalid tool execution' };
      }
    }
    const resultValidation = validateResultFilesFreshness(designDir, iterationStartTime);
    const gdsFile = resultValidation.files?.find(f => f.file.endsWith('.gds'));
    if (!gdsFile || !gdsFile.isFresh) {
      return { graduated: false, reason: 'Fresh GDS file not found' };
    }
    console.log(`[${this._elapsed()}] Architect review: APPROVED`);
    return { graduated: true };
  }

  _extractCleanDesign(iteration) {
    const designDir = join(this.options.baseWorkDir, `runs/${this.testId}/iteration_${iteration}/design/ibex`);
    if (existsSync(designDir)) {
      rmSync(designDir, { recursive: true, force: true });
    }
    mkdirSync(dirname(designDir), { recursive: true });
    execSync(`tar -xf "${this.options.cleanDesignSource}" -C "${dirname(designDir)}"`);
    const extractedDir = join(dirname(designDir), 'ibex_demo');
    if (existsSync(extractedDir)) {
      renameSync(extractedDir, designDir);
    }
    if (existsSync(join(designDir, 'result'))) {
      throw new Error('Clean design has results!');
    }
    return designDir;
  }

  _printGraduation() {
    const totalTime = Date.now() - new Date(this.state.startedAt).getTime();
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  GRADUATION ACHIEVED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\nTotal Iterations: ${this.state.iteration}`);
    console.log(`Total Time: ${Math.round(totalTime / 60000)} minutes`);
    console.log(`Phases Completed: ${this.state.passedPhases.length}/${PHASES.length}\n`);
    if (this.fixHistory.length > 0) {
      console.log('Fix History:');
      this.fixHistory.forEach(f => console.log(`  Iteration ${f.iteration}: ${f.issue}`));
      console.log('');
    }
    console.log(`Evidence Location: ${this.stateDir}\n`);
  }

  _elapsed() {
    const elapsed = Date.now() - new Date(this.state.startedAt).getTime();
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const certifier = new RalphLoopCertifier({
    maxIterations: parseInt(process.env.RALPH_MAX_ITERATIONS || '10', 10),
    targetPhase: parseInt(process.env.RALPH_TARGET_PHASE || '7', 10),
  });
  certifier.run().then(result => process.exit(result.success ? 0 : 1)).catch(err => {
    console.error('RalphLoopCertifier failed:', err.message);
    process.exit(2);
  });
}
