/**
 * FlowCertifier - Orchestrates flow certification tests (human-like mode only)
 *
 * HiTestBot acts like a human: types prompts into the Claude Code pane (left),
 * then observes both panes and MCP logs. It NEVER sends commands to the EDA
 * pane or calls MCP tools directly.
 *
 * Single execution mode:
 *   prompt-driven: sends prompts to Claude Code, observes response
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { McpLogCollector } from './McpLogCollector.js';
import { ObservationPoint } from './ObservationPoint.js';
import { StageVerifier } from './StageVerifier.js';
import { FlowReporter } from './FlowReporter.js';

export class FlowCertifier {
  constructor(options = {}) {
    this.session = options.session || 'hipilot';
    this.socket = options.socket || this.session;
    this.evidenceBaseDir = options.evidenceDir || '/tmp/hipilot-test-evidence';
    this.mcpLogPath = options.mcpLogPath || '/tmp/hipilot_test_mcp.jsonl';
    this.display = options.display || ':0';
    this.sshFn = options.sshFn || null;

    this.timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    this.evidenceDir = join(this.evidenceBaseDir, this.timestamp);
    this.observations = [];
    this.stageResults = [];
    this.recordingStartTime = null;
  }

  /**
   * Run flow certification in prompt-driven mode.
   * Sends a slash command or natural language prompt to HiPilot (Claude in pane 0)
   * via tmux, then observes and scores based on MCP log and pane output.
   */
  async certifyWorkflowPrompt(workflowName, prompt = null, options = {}) {
    const waitMs = options.waitMs || 120000;
    const promptText = prompt || `/rtl2gds`;
    mkdirSync(this.evidenceDir, { recursive: true });
    this.mcpLogPath = join(this.evidenceDir, 'mcp_calls.jsonl');
    this._runLogLines = [];

    const flowStart = Date.now();
    this._runLog(`FlowCertifier.certifyWorkflowPrompt("${workflowName}") started`);
    this.recordingStartTime = flowStart;

    const startObs = await ObservationPoint.capture('PROMPT_SENT', {
      evidenceDir: this.evidenceDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
      context: { workflow: workflowName, prompt: promptText },
    });
    this.observations.push(startObs);
    this._runLog(`PROMPT_SENT: "${promptText}"`);

    this.sendPromptToHiPilot(promptText);
    this._runLog(`Waiting ${waitMs}ms for flow...`);
    await new Promise(r => setTimeout(r, waitMs));

    this._runLog('Capturing FLOW_COMPLETE observation...');
    const endObs = await ObservationPoint.capture('FLOW_COMPLETE', {
      evidenceDir: this.evidenceDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
    });
    this.observations.push(endObs);

    const mcpLog = new McpLogCollector(this.mcpLogPath);
    const verifier = new StageVerifier(mcpLog);
    const toolSequence = mcpLog.getToolSequence();
    const stageConfig = { expected_tools: ['eda.generate_tcl', 'eda.execute_and_verify', 'eda.rtl2gds.run_full_flow', 'workflow.run'] };
    const scorecard = verifier.verify('prompt_driven', stageConfig, { start: startObs, complete: endObs }, { tool_sequence: toolSequence });

    this.stageResults = [scorecard];

    const reporter = new FlowReporter();
    const reports = reporter.generate({
      workflowName: `${workflowName}_prompt`,
      timestamp: this.timestamp,
      totalElapsedMs: Date.now() - flowStart,
      stageResults: this.stageResults,
      mcpStats: mcpLog.getStats(),
      mcpDiagnostics: mcpLog.getDiagnostics(),
      workflowResult: null,
      observations: this.observations,
    });

    writeFileSync(join(this.evidenceDir, 'FLOW_REPORT.md'), reports.markdown);
    writeFileSync(join(this.evidenceDir, 'flow_progress.json'), JSON.stringify(reports.json, null, 2));
    writeFileSync(join(this.evidenceDir, 'stage_scorecards.json'), JSON.stringify(this.stageResults, null, 2));
    writeFileSync(join(this.evidenceDir, 'observation_points.json'), JSON.stringify(this.observations, null, 2));
    if (existsSync(this.mcpLogPath) && !this.mcpLogPath.startsWith(this.evidenceDir)) {
      writeFileSync(join(this.evidenceDir, 'mcp_calls.jsonl'), readFileSync(this.mcpLogPath, 'utf-8'));
    }
    if (this._runLogLines?.length) {
      writeFileSync(join(this.evidenceDir, 'run_log.txt'), this._runLogLines.join('\n'));
    }

    return {
      evidenceDir: this.evidenceDir,
      progress: reports.json,
      stageResults: this.stageResults,
      reportPath: join(this.evidenceDir, 'FLOW_REPORT.md'),
    };
  }

  _runLog(lines) {
    this._runLogLines = this._runLogLines || [];
    const ts = new Date().toISOString();
    if (Array.isArray(lines)) {
      this._runLogLines.push(...lines.map(l => `[${ts}] ${l}`));
    } else {
      this._runLogLines.push(`[${ts}] ${lines}`);
    }
  }

  /**
   * Send a prompt/command to HiPilot (Claude in pane 0) via tmux send-keys.
   * Use this for prompt-driven flow certification: HiTestBot sends "/rtl2gds"
   * and observes how Claude executes the workflow.
   */
  sendPromptToHiPilot(prompt) {
    const target = `${this.session}:0.0`;
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    // Send text literally with -l, then C-m as a real keypress
    const textCmd = `tmux -L ${this.socket} send-keys -t ${target} -l '${escapedPrompt}'`;
    const enterCmd = `tmux -L ${this.socket} send-keys -t ${target} C-m`;
    try {
      execSync(textCmd, { encoding: 'utf-8', timeout: 5000 });
      execSync(enterCmd, { encoding: 'utf-8', timeout: 5000 });
      return true;
    } catch (e) {
      return false;
    }
  }

}
