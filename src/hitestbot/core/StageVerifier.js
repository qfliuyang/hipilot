/**
 * StageVerifier - 5-layer evidence scoring for a single flow stage
 *
 * Evaluates a stage across all evidence layers per TESTING_RULES.md:
 *   L1: Prompt Delivery
 *   L2: Intent Recognition
 *   L3: MCP Tool Usage
 *   L4: EDA Execution
 *   L5: QoR Assessment
 *
 * Also classifies failures into HIPILOT_BUG, AI_BEHAVIOR, or ENVIRONMENT.
 */

export class StageVerifier {
  /**
   * @param {import('./McpLogCollector.js').McpLogCollector} mcpLog
   */
  constructor(mcpLog) {
    this.mcpLog = mcpLog;
  }

  /**
   * Verify a stage and produce a scorecard.
   * @param {string} stageName
   * @param {object} config - Stage configuration
   * @param {string[]} config.expected_tools - MCP tools expected to be called
   * @param {string} config.expected_operation - Expected operation parameter
   * @param {object} observations - { start, complete, error } ObservationPoint results
   * @param {object} workflowStepResult - Result from workflow.run step (if available)
   */
  verify(stageName, config, observations, workflowStepResult = null) {
    const startObs = observations.start || {};
    const completeObs = observations.complete || {};
    const errorObs = observations.error || null;

    // Get MCP calls during this stage's time window
    const stageCalls = this.getStageCalls(startObs, completeObs);

    const scores = {
      L1_prompt_delivery: this.scoreL1(startObs, completeObs),
      L2_intent_recognition: this.scoreL2(stageCalls, config),
      L3_mcp_tool_usage: this.scoreL3(stageCalls, config, completeObs),
      L4_eda_execution: this.scoreL4(completeObs, errorObs, workflowStepResult),
      L5_qor_assessment: this.scoreL5(stageCalls, workflowStepResult),
    };

    const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
    const status = totalScore >= 4.0 ? 'pass' : totalScore >= 2.0 ? 'partial' : 'fail';

    const classification = status !== 'pass'
      ? this.classifyFailure(scores, stageCalls, completeObs, errorObs)
      : null;

    return {
      stage: stageName,
      scores,
      total_score: totalScore,
      max_score: 5.0,
      status,
      failure_classification: classification,
      mcp_calls_count: stageCalls.length,
      evidence_summary: this.summarizeEvidence(stageCalls, completeObs),
    };
  }

  getStageCalls(startObs, completeObs) {
    if (!startObs.epoch_ms || !completeObs.epoch_ms) return this.mcpLog.calls;
    return this.mcpLog.getCallsInRange(startObs.epoch_ms, completeObs.epoch_ms);
  }

  // --- Layer Scoring ---

  scoreL1(startObs, completeObs) {
    // L1: Did the AI receive and respond to the prompt?
    const claudeStart = startObs.content?.claude_pane_last50 || '';
    const claudeEnd = completeObs.content?.claude_pane_last50 || '';

    if (!claudeEnd || claudeEnd.length < 10) {
      return { score: 0.0, detail: 'No Claude pane output captured' };
    }
    if (claudeEnd === claudeStart) {
      return { score: 0.0, detail: 'Claude pane did not change (no response)' };
    }
    return { score: 1.0, detail: 'Claude responded to prompt' };
  }

  scoreL2(stageCalls, config) {
    // L2: Did the AI understand the intent and pick the right skill/operation?
    if (!config.expected_operation) {
      return { score: 1.0, detail: 'No specific operation expected' };
    }

    // Check if match_skill was called
    const skillMatch = stageCalls.find(c => c.tool === 'knowledge.match_skill');
    // Check if generate_tcl was called with right operation
    const genTcl = stageCalls.find(c => c.tool === 'eda.generate_tcl');
    // Check if execute_and_verify or workflow.run was called
    const execVerify = stageCalls.find(c => c.tool === 'eda.execute_and_verify');
    const workflowRun = stageCalls.find(c => c.tool === 'workflow.run');

    if (genTcl && genTcl.args?.operation === config.expected_operation) {
      return { score: 1.0, detail: `Correct operation: ${config.expected_operation}` };
    }
    if (execVerify || workflowRun) {
      return { score: 0.5, detail: 'Used execution tool but operation not verified' };
    }
    if (genTcl) {
      return { score: 0.5, detail: `Called generate_tcl but with operation: ${genTcl.args?.operation} (expected: ${config.expected_operation})` };
    }
    if (skillMatch) {
      return { score: 0.5, detail: 'Searched for skill but did not generate Tcl' };
    }
    return { score: 0.0, detail: 'No intent recognition detected in MCP calls' };
  }

  scoreL3(stageCalls, config, completeObs) {
    // L3: Did the AI use the correct MCP tools?
    if (stageCalls.length === 0) {
      // Check if Claude used direct tmux commands instead
      const claudeOutput = completeObs.content?.claude_pane_last50 || '';
      const directUsage = this.mcpLog.detectDirectTmuxUsage(claudeOutput);
      if (!directUsage.clean) {
        return { score: 0.0, detail: `Used direct tmux (${directUsage.violations.length} violations) instead of MCP tools` };
      }
      return { score: 0.0, detail: 'No MCP tools called during this stage' };
    }

    const expectedTools = config.expected_tools || [];
    if (expectedTools.length === 0) {
      // No specific tools expected, just check some EDA tools were used
      const edaCalls = stageCalls.filter(c => c.server === 'eda');
      return edaCalls.length > 0
        ? { score: 1.0, detail: `${edaCalls.length} EDA MCP calls made` }
        : { score: 0.5, detail: `${stageCalls.length} MCP calls but none to EDA server` };
    }

    // Check expected tools were called
    let matched = 0;
    const missing = [];
    for (const tool of expectedTools) {
      if (stageCalls.some(c => c.tool === tool)) {
        matched++;
      } else {
        missing.push(tool);
      }
    }

    const ratio = matched / expectedTools.length;
    if (ratio >= 1.0) {
      return { score: 1.0, detail: `All ${expectedTools.length} expected tools called` };
    }
    if (ratio >= 0.5) {
      return { score: 0.5, detail: `${matched}/${expectedTools.length} expected tools called. Missing: ${missing.join(', ')}` };
    }
    return { score: 0.0, detail: `Only ${matched}/${expectedTools.length} expected tools called. Missing: ${missing.join(', ')}` };
  }

  scoreL4(completeObs, errorObs, workflowStepResult) {
    // L4: Did the EDA tool execute successfully?
    if (workflowStepResult) {
      if (workflowStepResult.status === 'completed') {
        const hasWarnings = workflowStepResult.warnings?.length > 0;
        return hasWarnings
          ? { score: 0.5, detail: `Completed with ${workflowStepResult.warnings.length} warnings` }
          : { score: 1.0, detail: 'EDA execution completed successfully' };
      }
      if (workflowStepResult.status === 'timeout') {
        return { score: 0.0, detail: `Timed out: ${workflowStepResult.error}` };
      }
      if (workflowStepResult.status === 'error' || workflowStepResult.status === 'failed') {
        return { score: 0.0, detail: `EDA error: ${(workflowStepResult.errors || [workflowStepResult.error])[0] || 'unknown'}` };
      }
    }

    // Fallback: check pane output for errors
    const edaOutput = completeObs.content?.eda_pane_last50 || '';
    const errorPatterns = [/ERROR:/i, /FATAL/i, /syntax error/i, /unknown command/i, /failed/i];
    for (const pat of errorPatterns) {
      if (pat.test(edaOutput)) {
        return { score: 0.0, detail: `Error detected in EDA output: ${edaOutput.match(pat)[0]}` };
      }
    }

    if (errorObs) {
      return { score: 0.0, detail: 'Error observation point was triggered' };
    }

    if (edaOutput.length < 10) {
      return { score: 0.0, detail: 'No EDA output captured' };
    }

    return { score: 1.0, detail: 'No errors detected in EDA output' };
  }

  scoreL5(stageCalls, workflowStepResult) {
    // L5: Did the AI capture and report QoR metrics?
    if (workflowStepResult?.qor) {
      const qor = workflowStepResult.qor;
      const hasWns = qor.wns !== null && qor.wns !== undefined;
      const hasTns = qor.tns !== null && qor.tns !== undefined;

      if (hasWns && hasTns) {
        return { score: 1.0, detail: `QoR captured: WNS=${qor.wns}, TNS=${qor.tns}` };
      }
      if (hasWns || hasTns) {
        return { score: 0.5, detail: `Partial QoR: WNS=${qor.wns ?? 'N/A'}, TNS=${qor.tns ?? 'N/A'}` };
      }
    }

    // Check if QoR tools were called
    const qorCalls = stageCalls.filter(c =>
      c.tool === 'eda.extract_qor' ||
      c.tool === 'eda.capture_and_analyze' ||
      c.tool === 'qor.snapshot'
    );

    if (qorCalls.length > 0) {
      return { score: 0.5, detail: `QoR tools called (${qorCalls.map(c => c.tool).join(', ')}) but metrics not extracted` };
    }

    return { score: 0.0, detail: 'No QoR assessment performed' };
  }

  // --- Failure Classification ---

  classifyFailure(scores, stageCalls, completeObs, errorObs) {
    // Check L4 first — environment issues
    if (scores.L4_eda_execution.score === 0.0) {
      const detail = scores.L4_eda_execution.detail;
      const envPatterns = [/no design/i, /no clock/i, /missing/i, /not found/i, /license/i, /timeout/i, /physical.only/i];
      for (const pat of envPatterns) {
        if (pat.test(detail)) {
          return {
            category: 'ENVIRONMENT',
            summary: detail,
            action: 'Fix environment setup (design loading, library paths, licenses)',
          };
        }
      }
    }

    // Check L3 — AI behavior issues
    if (scores.L3_mcp_tool_usage.score === 0.0) {
      const detail = scores.L3_mcp_tool_usage.detail;
      if (detail.includes('direct tmux')) {
        return {
          category: 'AI_BEHAVIOR',
          summary: 'Claude used direct tmux commands instead of MCP tools',
          action: 'Improve system prompt to enforce MCP-only usage',
        };
      }
      if (detail.includes('No MCP tools called')) {
        return {
          category: 'AI_BEHAVIOR',
          summary: 'Claude did not call any MCP tools for this stage',
          action: 'Check if Claude understood the task and has access to MCP tools',
        };
      }
    }

    // Check for MCP errors — HiPilot bugs
    const mcpErrors = stageCalls.filter(c => c.status === 'error');
    if (mcpErrors.length > 0) {
      const firstError = mcpErrors[0];
      return {
        category: 'HIPILOT_BUG',
        summary: `MCP tool ${firstError.tool} returned error: ${firstError.error}`,
        action: 'Fix the MCP server implementation',
      };
    }

    // Check L4 for Tcl errors — could be HiPilot (bad template) or AI behavior (bad inline Tcl)
    if (scores.L4_eda_execution.score === 0.0) {
      const genCalls = stageCalls.filter(c => c.tool === 'eda.generate_tcl');
      if (genCalls.length > 0 && genCalls[0].meta?.badge === '[✓ Template]') {
        return {
          category: 'HIPILOT_BUG',
          summary: `Template-generated Tcl caused EDA error: ${scores.L4_eda_execution.detail}`,
          action: `Fix template: ${genCalls[0].meta?.template_path}`,
        };
      }
      return {
        category: 'AI_BEHAVIOR',
        summary: `EDA execution failed: ${scores.L4_eda_execution.detail}`,
        action: 'Review generated Tcl and AI reasoning',
      };
    }

    // Default
    return {
      category: 'AI_BEHAVIOR',
      summary: `Stage scored ${Object.values(scores).reduce((s, l) => s + l.score, 0).toFixed(1)}/5.0`,
      action: 'Review stage evidence for specific issues',
    };
  }

  // --- Helpers ---

  summarizeEvidence(stageCalls, completeObs) {
    return {
      mcp_tools_called: [...new Set(stageCalls.map(c => c.tool))],
      mcp_errors: stageCalls.filter(c => c.status === 'error').map(c => c.tool),
      eda_output_lines: completeObs.content?.eda_pane_lines || 0,
      claude_output_lines: completeObs.content?.claude_pane_lines || 0,
    };
  }
}
