/**
 * FlowCertifier - Orchestrates complete flow certification tests
 *
 * Runs a workflow (via MCP or Claude prompt), captures observation points
 * at each stage, scores with StageVerifier, generates FLOW_REPORT.md.
 *
 * Three execution modes:
 *   1. workflow-driven: calls workflow.run via MCP wrapper
 *   2. prompt-driven: sends natural language prompts to Claude per stage
 *   3. mcp-direct: calls execute_and_verify for each stage (no AI)
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
   * Run flow certification in MCP-direct mode.
   * Calls workflow.run via the MCP wrapper, then analyzes the result.
   */
  async certifyWorkflow(workflowName, params = {}) {
    mkdirSync(this.evidenceDir, { recursive: true });

    const flowStart = Date.now();
    this.recordingStartTime = flowStart;

    // Capture initial state
    const startObs = await ObservationPoint.capture('FLOW_START', {
      evidenceDir: this.evidenceDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
      context: { workflow: workflowName, params },
    });
    this.observations.push(startObs);

    // Run workflow via MCP wrapper
    const mcpResult = this.callMcp('eda', 'workflow.run', { name: workflowName, ...params });

    // Parse workflow result
    let workflowResult = null;
    try {
      const parsed = JSON.parse(mcpResult);
      workflowResult = parsed.result?._metadata || null;
    } catch {}

    // Capture final state
    const endObs = await ObservationPoint.capture('FLOW_COMPLETE', {
      evidenceDir: this.evidenceDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
      context: { workflow_result: workflowResult?.status },
    });
    this.observations.push(endObs);

    // Load MCP log
    const mcpLog = new McpLogCollector(this.mcpLogPath);

    // Score each stage using workflow step results
    const verifier = new StageVerifier(mcpLog);
    if (workflowResult?.step_results) {
      for (const stepResult of workflowResult.step_results) {
        const stageDir = join(this.evidenceDir, `stage_${String(stepResult.step).padStart(2, '0')}_${stepResult.name.replace(/\s+/g, '_').toLowerCase()}`);
        mkdirSync(stageDir, { recursive: true });

        // Capture per-stage observation
        const stageObs = await ObservationPoint.capture('STAGE_COMPLETE', {
          evidenceDir: stageDir,
          session: this.session,
          socket: this.socket,
          recordingStartTime: this.recordingStartTime,
          context: { step: stepResult.step, name: stepResult.name, status: stepResult.status },
        });

        const stageConfig = {
          expected_tools: ['eda.generate_tcl', 'eda.execute_and_verify'],
          expected_operation: null,
        };

        const scorecard = verifier.verify(
          stepResult.name,
          stageConfig,
          { start: startObs, complete: stageObs },
          stepResult
        );

        // Save scorecard
        writeFileSync(join(stageDir, 'scorecard.json'), JSON.stringify(scorecard, null, 2));

        if (scorecard.failure_classification) {
          writeFileSync(join(stageDir, 'failure_classification.json'),
            JSON.stringify(scorecard.failure_classification, null, 2));
        }

        this.stageResults.push(scorecard);
      }
    }

    // Generate reports
    const reporter = new FlowReporter();
    const reports = reporter.generate({
      workflowName,
      timestamp: this.timestamp,
      totalElapsedMs: Date.now() - flowStart,
      stageResults: this.stageResults,
      mcpStats: mcpLog.getStats(),
      workflowResult,
      observations: this.observations,
    });

    writeFileSync(join(this.evidenceDir, 'FLOW_REPORT.md'), reports.markdown);
    writeFileSync(join(this.evidenceDir, 'flow_progress.json'), JSON.stringify(reports.json, null, 2));
    writeFileSync(join(this.evidenceDir, 'stage_scorecards.json'), JSON.stringify(this.stageResults, null, 2));
    writeFileSync(join(this.evidenceDir, 'observation_points.json'), JSON.stringify(this.observations, null, 2));

    // Copy MCP log to evidence
    if (existsSync(this.mcpLogPath)) {
      const logContent = readFileSync(this.mcpLogPath, 'utf-8');
      writeFileSync(join(this.evidenceDir, 'mcp_calls.jsonl'), logContent);
    }

    return {
      evidenceDir: this.evidenceDir,
      progress: reports.json,
      stageResults: this.stageResults,
      reportPath: join(this.evidenceDir, 'FLOW_REPORT.md'),
    };
  }

  /**
   * Run a single-stage certification test.
   * Useful for testing individual stages without full flow.
   */
  async certifyStage(stageName, tcl, options = {}) {
    mkdirSync(this.evidenceDir, { recursive: true });
    const stageDir = join(this.evidenceDir, `stage_${stageName}`);
    mkdirSync(stageDir, { recursive: true });

    this.recordingStartTime = Date.now();

    const startObs = await ObservationPoint.capture('STAGE_START', {
      evidenceDir: stageDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
    });

    // Execute via MCP
    const mcpResult = this.callMcp('eda', 'eda.execute_and_verify', {
      tcl,
      description: stageName,
      timeout: options.timeout || 120,
    });

    let stepResult = null;
    try {
      const parsed = JSON.parse(mcpResult);
      stepResult = parsed.result?._metadata || null;
    } catch {}

    const completeObs = await ObservationPoint.capture('STAGE_COMPLETE', {
      evidenceDir: stageDir,
      session: this.session,
      socket: this.socket,
      recordingStartTime: this.recordingStartTime,
      context: { status: stepResult?.status },
    });

    const mcpLog = new McpLogCollector(this.mcpLogPath);
    const verifier = new StageVerifier(mcpLog);
    const scorecard = verifier.verify(
      stageName,
      { expected_tools: ['eda.execute_and_verify'] },
      { start: startObs, complete: completeObs },
      stepResult
    );

    writeFileSync(join(stageDir, 'scorecard.json'), JSON.stringify(scorecard, null, 2));
    return scorecard;
  }

  /**
   * Call an MCP tool via the wrapper script or direct JSON-RPC.
   */
  callMcp(server, tool, args = {}) {
    const projectRoot = join(new URL(import.meta.url).pathname, '..', '..', '..', '..');
    const serverPath = {
      eda: join(projectRoot, 'servers/eda/index.js'),
      tmux: join(projectRoot, 'servers/tmux/index.js'),
      knowledge: join(projectRoot, 'servers/knowledge/index.js'),
    }[server] || server;

    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: tool, arguments: args },
    });

    const env = {
      ...process.env,
      HIPILOT_SESSION: this.session,
      HIPILOT_TEST_LOG: this.mcpLogPath,
    };

    try {
      return execSync(`echo '${request.replace(/'/g, "'\\''")}' | node ${serverPath}`, {
        encoding: 'utf-8',
        timeout: 600000,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  }
}
