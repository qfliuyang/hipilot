/**
 * McpLogCollector - Parse and query MCP call logs (JSONL format)
 *
 * Provides structured access to the MCP tool call log produced by
 * src/lib/mcp-logger.js when HIPILOT_TEST_LOG is set.
 *
 * Primary evidence source for Layer 3 (MCP Tool Usage) in TESTING_RULES.md.
 */

import { readFileSync, existsSync } from 'fs';

export class McpLogCollector {
  constructor(logPath) {
    this.logPath = logPath;
    this.calls = [];
    if (logPath && existsSync(logPath)) {
      this.load();
    }
  }

  load() {
    const content = readFileSync(this.logPath, 'utf-8');
    this.calls = content
      .split('\n')
      .filter(line => line.trim())
      .map((line, idx) => {
        try {
          const entry = JSON.parse(line);
          entry._index = idx;
          entry._ts = new Date(entry.ts).getTime();
          return entry;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  /** Get all calls within a time range (ISO strings or epoch ms) */
  getCallsInRange(startTime, endTime) {
    const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime;
    const end = typeof endTime === 'string' ? new Date(endTime).getTime() : endTime;
    return this.calls.filter(c => c._ts >= start && c._ts <= end);
  }

  /** Get all calls for a specific tool */
  getCallsByTool(toolName) {
    return this.calls.filter(c => c.tool === toolName);
  }

  /** Get all calls for a specific server */
  getCallsByServer(serverName) {
    return this.calls.filter(c => c.server === serverName);
  }

  /** Check if a tool was called, optionally matching args */
  wasToolCalled(toolName, expectedArgs = null) {
    const matching = this.getCallsByTool(toolName);
    if (matching.length === 0) {
      return { called: false, call: null, match_quality: 0 };
    }

    if (!expectedArgs) {
      return { called: true, call: matching[0], match_quality: 1.0 };
    }

    for (const call of matching) {
      let matches = 0;
      let total = Object.keys(expectedArgs).length;
      for (const [key, val] of Object.entries(expectedArgs)) {
        if (call.args && call.args[key] === val) matches++;
      }
      if (matches === total) {
        return { called: true, call, match_quality: 1.0 };
      }
      if (matches > 0) {
        return { called: true, call, match_quality: matches / total };
      }
    }

    return { called: true, call: matching[0], match_quality: 0 };
  }

  /** Get the ordered sequence of tool names called */
  getToolSequence() {
    return this.calls.map(c => c.tool);
  }

  /** Get calls that resulted in errors */
  getErrors() {
    return this.calls.filter(c => c.status === 'error');
  }

  /** Get summary statistics */
  getStats() {
    const byServer = {};
    const byStatus = { ok: 0, error: 0 };
    let totalDuration = 0;

    for (const call of this.calls) {
      byServer[call.server] = (byServer[call.server] || 0) + 1;
      byStatus[call.status] = (byStatus[call.status] || 0) + 1;
      totalDuration += call.duration_ms || 0;
    }

    return {
      total_calls: this.calls.length,
      by_server: byServer,
      by_status: byStatus,
      total_duration_ms: totalDuration,
      errors: this.getErrors().length,
    };
  }

  /** Check if Claude bypassed MCP and used direct tmux/bash */
  detectDirectTmuxUsage(claudePaneOutput) {
    const directPatterns = [
      /tmux send-keys/g,
      /tmux capture-pane/g,
      /bash.*-c.*tmux/g,
    ];
    const violations = [];
    for (const pat of directPatterns) {
      const matches = claudePaneOutput.match(pat);
      if (matches) {
        violations.push({ pattern: pat.source, count: matches.length });
      }
    }
    return { clean: violations.length === 0, violations };
  }
}
