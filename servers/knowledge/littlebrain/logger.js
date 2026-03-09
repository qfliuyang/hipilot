/**
 * LittleBrain Activity Logger
 *
 * Tracks all reasoning steps, decisions, and actions for auditability.
 * Logs are written to .hipilot/littlebrain/logs/ and included in evidence.
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * LittleBrain Logger - captures reasoning and decision-making
 */
export class LittleBrainLogger {
  constructor(sessionId = null) {
    this.sessionId = sessionId || `lb_${Date.now()}`;
    this.logDir = join(homedir(), '.hipilot', 'littlebrain', 'logs');
    this.logFile = join(this.logDir, `${this.sessionId}.jsonl`);
    this.decisions = [];
    this.startTime = Date.now();

    // Ensure log directory exists
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }

    // Write session start
    this._write({
      type: 'session_start',
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      version: '1.0.0'
    });
  }

  /**
   * Log a reasoning step
   */
  logReasoning({ component, step, input, reasoning, output, confidence = null, metadata = {} }) {
    const entry = {
      type: 'reasoning',
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      component,
      step,
      input: this._truncate(input),
      reasoning: this._truncate(reasoning),
      output: this._truncate(output),
      confidence,
      metadata
    };

    this.decisions.push(entry);
    this._write(entry);
    return entry;
  }

  /**
   * Log a decision with alternatives considered
   */
  logDecision({ component, context, alternatives, chosen, rationale, confidence }) {
    const entry = {
      type: 'decision',
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      component,
      context: this._truncate(context),
      alternatives,
      chosen,
      rationale: this._truncate(rationale),
      confidence
    };

    this.decisions.push(entry);
    this._write(entry);
    return entry;
  }

  /**
   * Log Tcl generation process
   */
  logTclGeneration({ intent, tool, stage, context, generated_tcl, validation, fixes_applied, can_execute }) {
    const entry = {
      type: 'tcl_generation',
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      intent,
      tool,
      stage,
      context,
      generated_tcl: this._truncate(generated_tcl, 500),
      validation: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      },
      fixes_applied: fixes_applied || [],
      can_execute
    };

    this._write(entry);
    return entry;
  }

  /**
   * Log output parsing
   */
  logOutputParsing({ tool, output_snippet, parsed_state, errors_found, qor_extracted, tool_state }) {
    const entry = {
      type: 'output_parsing',
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      tool,
      output_snippet: this._truncate(output_snippet, 300),
      parsed_state,
      errors_found: errors_found || [],
      qor_extracted: qor_extracted || null,
      tool_state
    };

    this._write(entry);
    return entry;
  }

  /**
   * Log stage planning
   */
  logStagePlanning({ stage_name, prerequisites, plan, prerequisites_met, missing_prerequisites, can_start }) {
    const entry = {
      type: 'stage_planning',
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      stage_name,
      prerequisites,
      plan: {
        steps: plan.steps?.length || 0,
        estimated_duration: plan.estimatedDuration,
        tool: plan.tool
      },
      prerequisites_met,
      missing_prerequisites: missing_prerequisites || [],
      can_start
    };

    this._write(entry);
    return entry;
  }

  /**
   * Log error pattern matching
   */
  logErrorPatternMatching({ error_output, context, patterns_matched, suggested_fix, confidence }) {
    const entry = {
      type: 'error_pattern_matching',
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      error_snippet: this._truncate(error_output, 300),
      context,
      patterns_matched: patterns_matched?.length || 0,
      pattern_ids: patterns_matched?.map(p => p.pattern?.id) || [],
      suggested_fix: suggested_fix ? {
        pattern_id: suggested_fix.pattern_id,
        confidence: suggested_fix.confidence,
        action: suggested_fix.fix?.action
      } : null,
      confidence
    };

    this._write(entry);
    return entry;
  }

  /**
   * Log command analysis before execution
   */
  logCommandAnalysis({ command, tool, stage, validation_result, syntax_info, can_execute }) {
    const entry = {
      type: 'command_analysis',
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      command: this._truncate(command, 200),
      tool,
      stage,
      validation: {
        valid: validation_result.valid,
        errors: validation_result.errors,
        warnings: validation_result.warnings
      },
      syntax_info: syntax_info ? {
        command: syntax_info.command,
        description: syntax_info.description?.substring(0, 100)
      } : null,
      can_execute
    };

    this._write(entry);
    return entry;
  }

  /**
   * Log an action taken
   */
  logAction({ action, params, result, success, error = null }) {
    const entry = {
      type: 'action',
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      action,
      params: this._sanitizeParams(params),
      result: this._truncate(result, 300),
      success,
      error: error ? this._truncate(error, 200) : null
    };

    this._write(entry);
    return entry;
  }

  /**
   * Log session end
   */
  logSessionEnd({ summary, total_decisions, final_state }) {
    const entry = {
      type: 'session_end',
      timestamp: new Date().toISOString(),
      elapsed_ms: Date.now() - this.startTime,
      summary: this._truncate(summary),
      total_decisions: total_decisions || this.decisions.length,
      final_state
    };

    this._write(entry);

    // Also write summary JSON
    const summaryPath = join(this.logDir, `${this.sessionId}_summary.json`);
    writeFileSync(summaryPath, JSON.stringify({
      sessionId: this.sessionId,
      duration_ms: Date.now() - this.startTime,
      total_entries: this.decisions.length + 2,
      decision_breakdown: this._countByType(),
      logFile: this.logFile
    }, null, 2));

    return entry;
  }

  /**
   * Get all logs as structured data for evidence export
   */
  getStructuredLogs() {
    return {
      sessionId: this.sessionId,
      startTime: new Date(this.startTime).toISOString(),
      decisions: this.decisions,
      summary: {
        total_decisions: this.decisions.length,
        by_type: this._countByType()
      }
    };
  }

  /**
   * Export logs to evidence directory
   */
  exportToEvidence(evidenceDir) {
    try {
      const targetDir = join(evidenceDir, 'littlebrain');
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      // Copy main log file
      const targetLog = join(targetDir, 'littlebrain_reasoning.jsonl');
      if (existsSync(this.logFile)) {
        writeFileSync(targetLog, readFileSync(this.logFile, 'utf-8'));
      }

      // Write structured summary
      const structuredPath = join(targetDir, 'littlebrain_decisions.json');
      writeFileSync(structuredPath, JSON.stringify(this.getStructuredLogs(), null, 2));

      // Write human-readable summary
      const readablePath = join(targetDir, 'littlebrain_summary.md');
      writeFileSync(readablePath, this._generateReadableSummary());

      return {
        success: true,
        files: [targetLog, structuredPath, readablePath]
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Private helpers

  _write(entry) {
    try {
      appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
    } catch (e) {
      // Silent fail - logging should not break functionality
    }
  }

  _truncate(str, maxLen = 200) {
    if (!str) return str;
    if (typeof str !== 'string') str = JSON.stringify(str);
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + `... [${str.length - maxLen} more chars]`;
  }

  _sanitizeParams(params) {
    if (!params) return params;
    const sanitized = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  _countByType() {
    const counts = {};
    for (const d of this.decisions) {
      counts[d.type] = (counts[d.type] || 0) + 1;
    }
    return counts;
  }

  _generateReadableSummary() {
    const byType = this._countByType();
    let md = `# LittleBrain Activity Summary\n\n`;
    md += `**Session ID:** ${this.sessionId}\n`;
    md += `**Duration:** ${((Date.now() - this.startTime) / 1000).toFixed(1)}s\n`;
    md += `**Total Decision Points:** ${this.decisions.length}\n\n`;

    md += `## Activity Breakdown\n\n`;
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      md += `- **${type}:** ${count}\n`;
    }

    md += `\n## Key Decisions\n\n`;
    const keyDecisions = this.decisions
      .filter(d => d.type === 'decision' || d.type === 'reasoning')
      .slice(0, 20);

    for (const d of keyDecisions) {
      md += `### ${d.component} - ${d.step || d.type}\n`;
      md += `- **Time:** ${d.timestamp}\n`;
      if (d.rationale) md += `- **Rationale:** ${d.rationale}\n`;
      if (d.confidence) md += `- **Confidence:** ${(d.confidence * 100).toFixed(0)}%\n`;
      md += `\n`;
    }

    return md;
  }
}

// Singleton instance for the session
let globalLogger = null;

export function getLogger(sessionId) {
  if (!globalLogger) {
    globalLogger = new LittleBrainLogger(sessionId);
  }
  return globalLogger;
}

export function resetLogger(sessionId) {
  globalLogger = new LittleBrainLogger(sessionId);
  return globalLogger;
}

// For reading logs back
export function readLogs(sessionId) {
  const logDir = join(homedir(), '.hipilot', 'littlebrain', 'logs');
  const logFile = join(logDir, `${sessionId}.jsonl`);

  if (!existsSync(logFile)) {
    return null;
  }

  const content = readFileSync(logFile, 'utf-8');
  return content
    .split('\n')
    .filter(l => l.trim())
    .map(l => JSON.parse(l));
}

export { LittleBrainLogger };
