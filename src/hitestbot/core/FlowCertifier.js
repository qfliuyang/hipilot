/**
 * FlowCertifier — Uses HiPilot like a human, then scores the result.
 *
 * HiTestBot is a virtual human. It:
 *   1. Launches HiPilot (bin/hipilot)
 *   2. Waits for Claude Code to be ready
 *   3. Types a command (e.g., /rtl2gds)
 *   4. Watches Claude work, approves when asked
 *   5. Reads Claude's final report
 *   6. Scores based on what a human would see
 *
 * It NEVER calls MCP tools, sends commands to the EDA pane, or reads
 * internal logs during the test. It uses HiPilot exactly as shipped.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ObservationPoint } from './ObservationPoint.js';
import { FlowReporter } from './FlowReporter.js';

const POLL_INTERVAL_MS = 5000;
const IDLE_THRESHOLD_MS = 30000;
const CLAUDE_READY_TIMEOUT_MS = 120000;

export class FlowCertifier {
  constructor(options = {}) {
    this.session = options.session || 'hipilot';
    this.socket = options.socket || this.session;
    this.hipilotBin = options.hipilotBin || null;
    this.evidenceBaseDir = options.evidenceDir || '/tmp/hipilot-test-evidence';

    this.timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    this.evidenceDir = join(this.evidenceBaseDir, this.timestamp);
    this.observations = [];
    this.stageResults = [];
    this.recordingStartTime = null;
    this._runLogLines = [];
  }

  // ─── Phase 1: Launch HiPilot ──────────────────────────────────────

  /**
   * Start HiPilot by running bin/hipilot, just like a human would.
   * Kills any existing session first for a clean test.
   */
  async launchHiPilot() {
    this._runLog('Phase 1: Launching HiPilot...');

    // Kill old session if it exists (clean slate)
    try {
      execSync(`tmux -L ${this.socket} kill-server 2>/dev/null || true`, {
        encoding: 'utf-8', timeout: 5000,
      });
      this._runLog('Killed old tmux session');
      await this._sleep(2000);
    } catch { /* ignore */ }

    // Launch HiPilot with --no-terminal (detached, so we can observe)
    const binPath = this.hipilotBin || join(this._projectRoot(), 'bin', 'hipilot');
    try {
      const output = execSync(`bash ${binPath} --no-terminal 2>&1`, {
        encoding: 'utf-8', timeout: 30000,
        env: { ...process.env, HIPILOT_SESSION: this.session },
      });
      this._runLog(`bin/hipilot output:\n${output}`);
    } catch (e) {
      this._runLog(`bin/hipilot failed: ${e.message}`);
      throw new Error(`Failed to launch HiPilot: ${e.message}`);
    }

    // Verify session exists
    try {
      execSync(`tmux -L ${this.socket} has-session -t ${this.session}`, {
        encoding: 'utf-8', timeout: 5000,
      });
      this._runLog('tmux session verified');
    } catch {
      throw new Error('HiPilot tmux session not found after launch');
    }

    return true;
  }

  // ─── Phase 2: Wait for Claude Code ────────────────────────────────

  /**
   * Wait for Claude Code to finish initializing in the left pane.
   * A human would see the Claude Code prompt appear and know it's ready.
   */
  async waitForClaudeReady() {
    this._runLog('Phase 2: Waiting for Claude Code to be ready...');
    const start = Date.now();

    while (Date.now() - start < CLAUDE_READY_TIMEOUT_MS) {
      const claudeOutput = this._capturePane('0.0');

      // Claude Code shows a ">" prompt or "❯" when ready for input
      // It also shows "MCP" connection messages during startup
      const lines = claudeOutput.split('\n').filter(l => l.trim());
      const lastLine = lines[lines.length - 1] || '';

      // Detect Claude Code ready states
      const isReady =
        lastLine.includes('>') ||
        lastLine.includes('❯') ||
        claudeOutput.includes('What can I help') ||
        claudeOutput.includes('How can I help') ||
        claudeOutput.includes('Claude');

      if (isReady && claudeOutput.length > 50) {
        this._runLog(`Claude Code ready (${((Date.now() - start) / 1000).toFixed(1)}s)`);
        return true;
      }

      // If claude CLI is not installed, check for fallback message
      if (claudeOutput.includes('Claude CLI not found')) {
        this._runLog('Claude CLI not installed — left pane shows fallback');
        return false;
      }

      await this._sleep(3000);
    }

    this._runLog(`Claude Code not ready after ${CLAUDE_READY_TIMEOUT_MS / 1000}s`);
    return false;
  }

  // ─── Phase 3: Type command ────────────────────────────────────────

  /**
   * Type a command into Claude Code's input, like a human would.
   */
  typeInHiPilot(text) {
    const target = `${this.session}:0.0`;
    const escaped = text.replace(/'/g, "'\\''");
    try {
      execSync(`tmux -L ${this.socket} send-keys -t ${target} -l '${escaped}'`, {
        encoding: 'utf-8', timeout: 5000,
      });
      execSync(`tmux -L ${this.socket} send-keys -t ${target} C-m`, {
        encoding: 'utf-8', timeout: 5000,
      });
      this._runLog(`Typed: "${text}"`);
      return true;
    } catch (e) {
      this._runLog(`Failed to type: ${e.message}`);
      return false;
    }
  }

  // ─── Phase 4: Watch and interact ──────────────────────────────────

  /**
   * Monitor HiPilot like a human watching the screen.
   * - Polls both panes periodically
   * - Detects when Claude is asking for approval → auto-approves
   * - Detects when Claude has finished (output stops changing)
   * - Captures observations at key moments
   */
  async watchFlow(options = {}) {
    const maxWaitMs = options.maxWaitMs || 300000;
    this._runLog(`Phase 4: Watching flow (max ${maxWaitMs / 1000}s)...`);

    const start = Date.now();
    let lastClaudeOutput = '';
    let lastChangeTime = start;
    let approvalCount = 0;
    let pollCount = 0;

    while (Date.now() - start < maxWaitMs) {
      await this._sleep(POLL_INTERVAL_MS);
      pollCount++;

      const claudeOutput = this._capturePane('0.0');
      const edaOutput = this._capturePane('0.1');

      // Detect change
      if (claudeOutput !== lastClaudeOutput) {
        lastChangeTime = Date.now();
        lastClaudeOutput = claudeOutput;
      }

      // Capture periodic observation (every 30s)
      if (pollCount % 6 === 0) {
        const obs = await ObservationPoint.capture(`PROGRESS_${pollCount}`, {
          evidenceDir: this.evidenceDir,
          session: this.session,
          socket: this.socket,
          recordingStartTime: this.recordingStartTime,
          context: { poll: pollCount, elapsed_s: Math.round((Date.now() - start) / 1000) },
        });
        this.observations.push(obs);
      }

      // Detect approval requests — a human would press prefix+y
      if (this._needsApproval(claudeOutput)) {
        this._runLog('Detected approval request — pressing prefix+y');
        this._pressApproval();
        approvalCount++;
        lastChangeTime = Date.now();
        continue;
      }

      // Detect completion — Claude stopped producing output
      const idleTime = Date.now() - lastChangeTime;
      if (idleTime > IDLE_THRESHOLD_MS && pollCount > 3) {
        this._runLog(`Claude idle for ${(idleTime / 1000).toFixed(0)}s — flow appears complete`);
        break;
      }

      // Log progress
      if (pollCount % 3 === 0) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        const idle = (idleTime / 1000).toFixed(0);
        this._runLog(`Poll ${pollCount}: ${elapsed}s elapsed, ${idle}s idle, ${approvalCount} approvals`);
      }
    }

    const totalTime = Date.now() - start;
    this._runLog(`Watch complete: ${(totalTime / 1000).toFixed(1)}s, ${approvalCount} approvals`);

    return { elapsed_ms: totalTime, approvals: approvalCount, polls: pollCount };
  }

  // ─── Phase 5: Evaluate like a human ───────────────────────────────

  /**
   * Read what's on screen and judge the result like a human would.
   * A human looks at:
   * - Did Claude respond at all?
   * - Did Claude report progress on each stage?
   * - Did the EDA tool run (is there output in right pane)?
   * - Were there errors?
   * - Did Claude give a final summary with QoR numbers?
   */
  evaluate(beforeObs, afterObs) {
    const claudeBefore = beforeObs.content?.claude_pane_last50 || '';
    const claudeAfter = afterObs.content?.claude_pane_last50 || '';
    const edaAfter = afterObs.content?.eda_pane_last50 || '';

    const scores = {
      L1_prompt_delivery: this._scoreResponse(claudeBefore, claudeAfter),
      L2_intent_recognition: this._scoreIntent(claudeAfter),
      L3_mcp_tool_usage: this._scoreToolUsage(claudeAfter, edaAfter),
      L4_eda_execution: this._scoreEdaExecution(edaAfter),
      L5_qor_assessment: this._scoreQoR(claudeAfter),
    };

    const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
    const status = totalScore >= 4.0 ? 'pass' : totalScore >= 2.0 ? 'partial' : 'fail';

    const classification = status !== 'pass'
      ? this._classifyFailure(scores, claudeAfter, edaAfter)
      : null;

    return {
      stage: 'full_flow',
      scores,
      total_score: totalScore,
      max_score: 5.0,
      status,
      failure_classification: classification,
      mcp_calls_count: null,
      evidence_summary: {
        claude_output_lines: claudeAfter.split('\n').length,
        eda_output_lines: edaAfter.split('\n').length,
      },
    };
  }

  // ─── Scoring (what a human would judge) ───────────────────────────

  _scoreResponse(before, after) {
    if (!after || after.length < 20) {
      return { score: 0.0, detail: 'No output from Claude Code' };
    }
    if (after === before) {
      return { score: 0.0, detail: 'Claude did not respond (output unchanged)' };
    }
    return { score: 1.0, detail: 'Claude responded to the command' };
  }

  _scoreIntent(claudeOutput) {
    const keywords = ['rtl2gds', 'design', 'innovus', 'flow', 'stage', 'skill', 'placement', 'routing', 'cts'];
    const found = keywords.filter(k => claudeOutput.toLowerCase().includes(k));
    if (found.length >= 3) {
      return { score: 1.0, detail: `Claude understood the task (mentions: ${found.join(', ')})` };
    }
    if (found.length >= 1) {
      return { score: 0.5, detail: `Partial recognition (mentions: ${found.join(', ')})` };
    }
    return { score: 0.0, detail: 'No evidence Claude understood the RTL2GDS task' };
  }

  _scoreToolUsage(claudeOutput, edaOutput) {
    // A human can see: did Claude use MCP tools? (Claude shows tool calls in its output)
    // Did the EDA tool receive commands? (right pane has activity)
    const mcpIndicators = ['execute_and_verify', 'generate_tcl', 'detect_tool', 'start_tool',
      'get_skill', 'match_skill', 'diagnose_error', 'qor.snapshot', 'Template'];
    const found = mcpIndicators.filter(k => claudeOutput.includes(k));

    // Check if EDA pane has tool activity (not just the welcome message)
    const edaHasActivity = edaOutput.includes('innovus') || edaOutput.includes('icc2') ||
      edaOutput.includes('source ') || edaOutput.includes('report_timing') ||
      edaOutput.length > 500;

    if (found.length >= 2 && edaHasActivity) {
      return { score: 1.0, detail: `MCP tools used (${found.join(', ')}), EDA tool active` };
    }
    if (found.length >= 1 || edaHasActivity) {
      return { score: 0.5, detail: `Partial: MCP(${found.join(',') || 'none'}), EDA(${edaHasActivity ? 'active' : 'idle'})` };
    }

    // Check if Claude bypassed MCP and used bash directly
    if (claudeOutput.includes('tmux send-keys') || claudeOutput.includes('bash:')) {
      return { score: 0.0, detail: 'Claude used direct bash/tmux instead of MCP tools' };
    }

    return { score: 0.0, detail: 'No MCP tool usage or EDA activity detected' };
  }

  _scoreEdaExecution(edaOutput) {
    const errorPatterns = [/\*\*ERROR/i, /FATAL/i, /syntax error/i, /unknown command/i];
    for (const pat of errorPatterns) {
      if (pat.test(edaOutput)) {
        return { score: 0.0, detail: `EDA error: ${edaOutput.match(pat)[0]}` };
      }
    }

    if (edaOutput.length < 100) {
      return { score: 0.0, detail: 'No significant EDA tool output' };
    }

    // Check for EDA prompt (tool ran and returned)
    const promptPatterns = [/innovus\s*\d+>/i, /icc2_shell>/i, /pt_shell>/i];
    for (const pat of promptPatterns) {
      if (pat.test(edaOutput)) {
        return { score: 1.0, detail: 'EDA tool ran and returned to prompt' };
      }
    }

    return { score: 0.5, detail: 'EDA pane has output but no prompt detected' };
  }

  _scoreQoR(claudeOutput) {
    const wnsMatch = claudeOutput.match(/WNS[:\s]*(-?[\d.]+)/i);
    const tnsMatch = claudeOutput.match(/TNS[:\s]*(-?[\d.]+)/i);

    if (wnsMatch && tnsMatch) {
      return { score: 1.0, detail: `QoR reported: WNS=${wnsMatch[1]}, TNS=${tnsMatch[1]}` };
    }
    if (wnsMatch || tnsMatch) {
      return { score: 0.5, detail: `Partial QoR: WNS=${wnsMatch?.[1] ?? 'N/A'}, TNS=${tnsMatch?.[1] ?? 'N/A'}` };
    }

    // Check for any timing/metrics language
    const metricsKeywords = ['timing', 'violation', 'slack', 'pass', 'fail', 'score'];
    const found = metricsKeywords.filter(k => claudeOutput.toLowerCase().includes(k));
    if (found.length >= 2) {
      return { score: 0.5, detail: `Claude discussed metrics (${found.join(', ')}) but no WNS/TNS numbers` };
    }

    return { score: 0.0, detail: 'No QoR assessment in Claude output' };
  }

  _classifyFailure(scores, claudeOutput, edaOutput) {
    if (scores.L1_prompt_delivery.score === 0.0) {
      return { category: 'ENVIRONMENT', summary: 'Claude Code did not respond', action: 'Check Claude Code is running and MCP servers are connected' };
    }
    if (scores.L3_mcp_tool_usage.score === 0.0 && scores.L3_mcp_tool_usage.detail.includes('direct bash')) {
      return { category: 'AI_BEHAVIOR', summary: 'Claude bypassed MCP tools', action: 'Improve CLAUDE.md to enforce MCP-only usage' };
    }
    if (scores.L3_mcp_tool_usage.score === 0.0) {
      return { category: 'ENVIRONMENT', summary: 'MCP tools not available', action: 'Check settings.json MCP server registration' };
    }
    if (scores.L4_eda_execution.score === 0.0) {
      const isEnv = /license|not found|missing|no design/i.test(edaOutput);
      return isEnv
        ? { category: 'ENVIRONMENT', summary: scores.L4_eda_execution.detail, action: 'Fix EDA server setup' }
        : { category: 'HIPILOT_BUG', summary: scores.L4_eda_execution.detail, action: 'Fix Tcl template or generation' };
    }
    return { category: 'AI_BEHAVIOR', summary: `Score ${Object.values(scores).reduce((s, l) => s + l.score, 0).toFixed(1)}/5.0`, action: 'Review Claude behavior in evidence' };
  }

  // ─── Main entry point ─────────────────────────────────────────────

  /**
   * Run a complete HiPilot test: launch → type → watch → evaluate.
   */
  async runTest(command, options = {}) {
    const maxWaitMs = options.maxWaitMs || 300000;
    mkdirSync(this.evidenceDir, { recursive: true });
    this.recordingStartTime = Date.now();

    // Phase 1: Launch HiPilot
    await this.launchHiPilot();

    // Phase 2: Wait for Claude Code
    const claudeReady = await this.waitForClaudeReady();
    if (!claudeReady) {
      this._runLog('Claude Code not ready — will still attempt the command');
    }

    // Capture before state
    const beforeObs = await ObservationPoint.capture('BEFORE_COMMAND', {
      evidenceDir: this.evidenceDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
      context: { command, claude_ready: claudeReady },
    });
    this.observations.push(beforeObs);

    // Phase 3: Type command
    const typed = this.typeInHiPilot(command);
    if (!typed) {
      throw new Error('Failed to type command into HiPilot');
    }

    // Phase 4: Watch and interact
    const watchResult = await this.watchFlow({ maxWaitMs });

    // Capture after state
    const afterObs = await ObservationPoint.capture('AFTER_FLOW', {
      evidenceDir: this.evidenceDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
      context: { elapsed_ms: watchResult.elapsed_ms, approvals: watchResult.approvals },
    });
    this.observations.push(afterObs);

    // Phase 5: Evaluate
    const scorecard = this.evaluate(beforeObs, afterObs);
    this.stageResults = [scorecard];

    // Generate reports
    const reporter = new FlowReporter();
    const reports = reporter.generate({
      workflowName: command,
      timestamp: this.timestamp,
      totalElapsedMs: watchResult.elapsed_ms,
      stageResults: this.stageResults,
      mcpStats: null,
      mcpDiagnostics: null,
      workflowResult: null,
      observations: this.observations,
    });

    // Save everything
    writeFileSync(join(this.evidenceDir, 'FLOW_REPORT.md'), reports.markdown);
    writeFileSync(join(this.evidenceDir, 'flow_progress.json'), JSON.stringify(reports.json, null, 2));
    writeFileSync(join(this.evidenceDir, 'stage_scorecards.json'), JSON.stringify(this.stageResults, null, 2));
    writeFileSync(join(this.evidenceDir, 'observation_points.json'), JSON.stringify(this.observations, null, 2));
    writeFileSync(join(this.evidenceDir, 'run_log.txt'), this._runLogLines.join('\n'));

    return {
      evidenceDir: this.evidenceDir,
      progress: reports.json,
      stageResults: this.stageResults,
      reportPath: join(this.evidenceDir, 'FLOW_REPORT.md'),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  _capturePane(paneId) {
    try {
      return execSync(
        `tmux -L ${this.socket} capture-pane -t ${this.session}:0.${paneId} -p -S -200 2>/dev/null || echo ""`,
        { encoding: 'utf-8', timeout: 5000 }
      );
    } catch {
      return '';
    }
  }

  _needsApproval(claudeOutput) {
    const approvalPatterns = [
      /pending.?approval/i,
      /approve.*pending/i,
      /prefix\+y/i,
      /manual.*mode.*queued/i,
      /⏳.*pending/i,
      /approval required/i,
    ];
    return approvalPatterns.some(p => p.test(claudeOutput));
  }

  _pressApproval() {
    // Press prefix+y, just like a human would
    try {
      // Send tmux prefix (Ctrl+B by default) then 'y'
      execSync(`tmux -L ${this.socket} send-keys -t ${this.session}:0.0 C-b`, {
        encoding: 'utf-8', timeout: 2000,
      });
      execSync(`tmux -L ${this.socket} send-keys -t ${this.session}:0.0 y`, {
        encoding: 'utf-8', timeout: 2000,
      });
      this._runLog('Pressed prefix+y (approval)');
    } catch (e) {
      this._runLog(`Approval keypress failed: ${e.message}`);
    }
  }

  _projectRoot() {
    return join(new URL(import.meta.url).pathname, '..', '..', '..', '..');
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  _runLog(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}`;
    this._runLogLines.push(line);
  }
}
