/**
 * CheatDetector — Prevents and detects cheating in HiPilot tests
 *
 * This module implements multiple verification layers to ensure tests
 * measure real behavior, not fake/simulated outputs.
 *
 * Cheat Prevention Strategies:
 *   1. Process Verification — Check real Claude processes exist
 *   2. Pane Content Verification — Verify pane shows real Claude interface
 *   3. MCP Log Integrity — Verify logs are real (not fabricated)
 *   4. Interactive Verification — Send test commands, verify real responses
 *   5. Timestamp Verification — Ensure evidence files are recent
 *   6. Cross-Reference Validation — Correlate pane logs with MCP logs
 *   7. Echo Detection — Detect "echo" command usage (cheating signature)
 *   8. Video Motion Analysis — Verify video shows actual activity
 *   9. Evidence Location — Ensure evidence is on EDA server
 *  10. Minimum Duration — Reject tests that complete too quickly
 *  11. Desktop Visibility — Verify screenshots show EDA server desktop
 *  12. SSH Remote Verification — Verify evidence exists via SSH
 *  13. Active Video Stream — Verify ffmpeg is recording
 *  14. Agent Delegation Bypass — Detect Supervisor bypassing Executor (CRITICAL for 5-Agent Team)
 *  15. Team Protocol Verification — verifyFiveAgentProcesses, validateSendMessageStructure, verifyKnowledgeAsHub, verifyMessageSequence
 *  16. EDA Log Verification — extractQorMetrics, verifyCheckpointFiles, parseErrors, verifyToolExecutionDuration, verifyEdaPaneLogEnhanced
 *  17. Cross-Reference Verification — verifyProcessStateDuringMcpCall, verifyStageOrder
 *  18. Skill Orchestration Bypass — CRITICAL: Must use knowledge.get_skill, not source TCL directly
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';
import { createHash } from 'crypto';

export class CheatDetector {
  constructor(options = {}) {
    this.socket = options.socket || 'hipilot';
    this.session = options.session || 'hipilot';
    this.designDir = options.designDir;
    this.cheatLog = [];
    this.suspiciousPatterns = [];
  }

  /**
   * Log a potential cheat detection
   */
  _logCheat(type, severity, message, evidence = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      severity, // 'critical', 'warning', 'info'
      message,
      evidence,
    };
    this.cheatLog.push(entry);
    return entry;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 1: Process Verification
   * Verify real Claude Code processes are running
   *
   * STRICT: Must have exact expected count, not just minimum
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyClaudeProcesses(expectedCount = null) {
    try {
      // Check for claude CLI processes
      const psOutput = execSync('ps aux | grep -E "claude|Claude" | grep -v grep', {
        encoding: 'utf8',
        timeout: 5000,
      });

      const claudeLines = psOutput.trim().split('\n').filter(line => line.includes('claude'));

      // Expected: 5 Claude processes for 5 agents (or override for dynamic team creation)
      const expected = expectedCount || 5;
      const actualCount = claudeLines.length;

      if (actualCount === 0) {
        return this._logCheat('process', 'critical',
          'NO Claude processes found — HiPilot is not running!',
          { psOutput: 'empty', expected: expected, actual: 0 }
        );
      }

      // STRICT: Must have at least the expected number of processes
      // No exceptions - team must be fully formed before test starts
      if (actualCount < expected) {
        return this._logCheat('process', 'critical',
          `INSUFFICIENT Claude processes: ${actualCount}/${expected} found — 5-Agent Team not complete`,
          { processes: claudeLines.map(l => l.trim()), expected, actual: actualCount }
        );
      }

      // Verify they're real Node.js processes, not shell scripts faking output
      const nodeProcesses = claudeLines.filter(line => line.includes('node') || line.includes('claude'));

      if (nodeProcesses.length < actualCount) {
        return this._logCheat('process', 'critical',
          `Some Claude processes are not real Node.js processes — possible fake processes`,
          { nodeProcesses: nodeProcesses.length, total: actualCount }
        );
      }

      return {
        valid: true,
        count: actualCount,
        processes: claudeLines.map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parts[1],
            cmd: parts.slice(10).join(' '),
          };
        }),
      };
    } catch (e) {
      return this._logCheat('process', 'critical',
        'Failed to check Claude processes — possible process hiding',
        { error: e.message }
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 2: Echo Command Detection
   * Detect the "echo" cheat pattern (faking output without real execution)
   * ═══════════════════════════════════════════════════════════════════
   */
  detectEchoCommands(paneText) {
    const echoPatterns = [
      // Shell echo commands used to fake output
      /echo\s+-e?\s+['"].*?(Status|Supervisor|Knowledge|Planner|Executor|Archivist)/i,
      /echo\s+.*?'.*?running.*?'/i,
      /echo\s+.*?'.*?ready.*?'/i,
      /echo\s+.*\$\(.*?(status|running|ready)/i,

      // Fake status messages from echo
      /\[.*\$\s*echo.*?Status:/i,

      // Suspicious: multiple status lines that look too similar
      /Status:\s*\w+\s*\n.*Status:\s*\w+\s*\n.*Status:\s*\w+/i,

      // BYPASS ATTACKS: Obfuscated echo commands
      /e\s*c\s*h\s*o/i,                    // Character splitting: e c h o
      /'\s*e\s*c\s*h\s*o\s*'/i,          // Quoted split echo
      /eval\s+.*echo/i,                      // eval with echo

      // BYPASS: Direct terminal writes (bypass tmux/screen)
      /tee\s+\/dev\/tty/i,                 // Write directly to terminal
      /cat\s+.*\s*>\s*\/dev\/tty/i,      // Redirect to terminal
      /printf\s+.*>\s*\/dev\/tty/i,     // printf to terminal

      // BYPASS: Alternative output commands
      /printf\s+['"].*?(Status|Supervisor)/i,
      /print\s+['"].*?(running|ready)/i,
    ];

    const detections = [];
    for (const pattern of echoPatterns) {
      const matches = paneText.match(pattern);
      if (matches) {
        detections.push({ pattern: pattern.toString(), match: matches[0] });
      }
    }

    if (detections.length > 0) {
      return this._logCheat('echo', 'critical',
        `ECHO CHEAT DETECTED: ${detections.length} fake output patterns found`,
        { detections, sample: detections[0]?.match }
      );
    }

    return { valid: true, detections: 0 };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 3: Pane Content Verification
   * Verify pane shows real Claude Code interface, not fake output
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyPaneContentAuthenticity(paneText) {
    const checks = {
      // Real Claude Code indicators
      hasClaudeVersion: /Claude Code v?\d+\.\d+/.test(paneText),
      hasAnthropic: /anthropic/i.test(paneText),
      hasRealPrompt: /[⎿┌└]/.test(paneText), // Unicode box drawing chars in real prompt

      // Suspicious patterns (potential cheating)
      hasFakePrompt: /^\s*\$\s+/m.test(paneText), // Simple $ prompt (fake)
      hasTooManyStatusLines: (paneText.match(/Status:/g) || []).length > 10,
      hasIdenticalRepeats: /(.{50,})\1/.test(paneText), // Repeated content

      // Agent indicators (real agents have varied output)
      hasAgentVariety: [
        /Supervisor/i, /Knowledge/i, /Planner/i, /Executor/i, /Archivist/i
      ].filter(p => p.test(paneText)).length >= 2,
    };

    // Critical: Must have real Claude indicators
    if (!checks.hasClaudeVersion && !checks.hasAnthropic) {
      return this._logCheat('pane_content', 'critical',
        'Pane does NOT show real Claude Code interface — possible fake/replay',
        { checks, sample: paneText.substring(0, 500) }
      );
    }

    // Warning: Suspicious patterns
    if (checks.hasIdenticalRepeats) {
      this._logCheat('pane_content', 'warning',
        'Repeated identical content detected — possible replay attack',
        { pattern: 'identical_repeats' }
      );
    }

    return {
      valid: true,
      checks,
      authenticityScore: Object.values(checks).filter(Boolean).length / Object.keys(checks).length,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 4: Temporal Verification
   * Verify pane content CHANGES over time (detects idle panes with stale output)
   *
   * CRITICAL: This prevents testers from claiming completion when the
   * EDA pane is just sitting idle with old/stale output.
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyTemporalActivity(observations = []) {
    // Need at least 3 observations to detect meaningful activity
    if (observations.length < 3) {
      return this._logCheat('temporal', 'warning',
        `Insufficient observations for temporal verification (${observations.length} < 3)`,
        { observationCount: observations.length }
      );
    }

    // Filter to EDA pane observations with content
    const edaObservations = observations.filter(obs =>
      obs.content?.eda_pane && obs.content.eda_pane.length > 50
    );

    if (edaObservations.length < 3) {
      return this._logCheat('temporal', 'critical',
        `Less than 3 EDA pane observations — cannot verify activity`,
        { edaObservationCount: edaObservations.length }
      );
    }

    // Sort by timestamp
    edaObservations.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate content hashes and detect changes
    let changeCount = 0;
    let previousHash = null;
    let firstTimestamp = null;
    let lastTimestamp = null;

    for (const obs of edaObservations) {
      // Create hash of last 200 chars (captures recent activity)
      const content = obs.content.eda_pane.slice(-200);
      const hash = createHash('md5').update(content).digest('hex');

      if (previousHash !== null && hash !== previousHash) {
        changeCount++;
      }

      if (firstTimestamp === null) firstTimestamp = obs.timestamp;
      lastTimestamp = obs.timestamp;
      previousHash = hash;
    }

    const duration = lastTimestamp - firstTimestamp;

    // CRITICAL: Require at least 3 content changes AND minimum duration
    if (changeCount < 3) {
      return this._logCheat('temporal', 'critical',
        `EDA pane nearly IDLE: only ${changeCount} content changes over ${(duration/1000).toFixed(1)}s. ` +
        `Active tools show continuous updates (need 3+ changes). Possible CHEAT: reported completion without execution.`,
        {
          changeCount,
          observationCount: edaObservations.length,
          duration: duration + 'ms',
          durationSec: (duration / 1000).toFixed(1),
        }
      );
    }

    // STRICT: Minimum duration check - tests that complete too fast are fake
    const MIN_DURATION_MS = 300000; // 5 minutes absolute minimum for any real test
    if (duration < MIN_DURATION_MS) {
      return this._logCheat('temporal', 'critical',
        `Test completed TOO FAST: ${(duration/1000).toFixed(1)}s (min: ${MIN_DURATION_MS/1000}s). ` +
        `Real EDA tool execution takes significant time. Possible CHEAT: faked results.`,
        { duration: duration + 'ms', minRequired: MIN_DURATION_MS, changeCount }
      );
    }

    return {
      valid: true,
      changeCount,
      observationCount: edaObservations.length,
      duration,
      durationSec: (duration / 1000).toFixed(1),
      activityRate: (changeCount / (duration / 1000) * 60).toFixed(2) + ' changes/min',
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 5: MCP Log Integrity Check
   * Verify MCP logs are real, not fabricated
   *
   * STRICT: Minimum 50 MCP calls required for any real test
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyMcpLogIntegrity(mcpLogPath, options = {}) {
    // STRICT by default: minimum 50 MCP calls required for any real test
    const minCalls = options.minCalls !== undefined ? options.minCalls : 50;

    if (!existsSync(mcpLogPath)) {
      return this._logCheat('mcp_integrity', 'critical',
        'MCP log file does not exist — cannot verify tool execution',
        { path: mcpLogPath }
      );
    }

    try {
      const content = readFileSync(mcpLogPath, 'utf8');
      const lines = content.trim().split('\n').filter(l => l.trim());

      // Check 1: File has actual content
      if (lines.length === 0) {
        return this._logCheat('mcp_integrity', 'critical',
          'MCP log is empty — no tool calls recorded',
          { path: mcpLogPath }
        );
      }

      // STRICT: Minimum call count check
      if (lines.length < minCalls) {
        return this._logCheat('mcp_integrity', 'critical',
          `INSUFFICIENT MCP calls: ${lines.length} calls (min: ${minCalls}). ` +
          `Real EDA tests require many tool interactions.`,
          { path: mcpLogPath, actual: lines.length, required: minCalls }
        );
      }

      // Check 2: Valid JSON structure
      const validEntries = [];
      const invalidEntries = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          validEntries.push(entry);
        } catch (e) {
          invalidEntries.push(line.substring(0, 100));
        }
      }

      if (validEntries.length === 0) {
        return this._logCheat('mcp_integrity', 'critical',
          'MCP log contains no valid JSON entries — possible corruption/fabrication',
          { totalLines: lines.length, invalidSamples: invalidEntries.slice(0, 3) }
        );
      }

      // Check 3: Required fields present in real MCP logs
      const requiredFields = ['timestamp', 'tool', 'method'];
      const entriesWithFields = validEntries.filter(e =>
        requiredFields.some(f => e[f] !== undefined)
      );

      if (entriesWithFields.length === 0) {
        return this._logCheat('mcp_integrity', 'critical',
          'MCP log entries missing required fields — possible fake log',
          { sample: validEntries[0] }
        );
      }

      // Check 4: Timestamp consistency (all timestamps should be recent)
      const now = Date.now();
      const timestamps = validEntries
        .map(e => new Date(e.timestamp).getTime())
        .filter(t => !isNaN(t));

      const oldTimestamps = timestamps.filter(t => now - t > 3600000); // Older than 1 hour
      if (oldTimestamps.length > timestamps.length / 2) {
        return this._logCheat('mcp_integrity', 'critical',
          `MCP log contains ${oldTimestamps.length} stale entries — possible replay`,
          { oldestTimestamp: new Date(Math.min(...timestamps)), now: new Date() }
        );
      }

      // Check 5: Content hash diversity (fabricated logs often repeat)
      const hashes = validEntries.map(e =>
        createHash('md5').update(JSON.stringify(e)).digest('hex')
      );
      const uniqueHashes = new Set(hashes);
      const diversity = uniqueHashes.size / hashes.length;

      if (diversity < 0.5) {
        return this._logCheat('mcp_integrity', 'warning',
          `Low log diversity (${(diversity * 100).toFixed(1)}%) — possible repeated/fabricated entries`,
          { unique: uniqueHashes.size, total: hashes.length }
        );
      }

      return {
        valid: true,
        entries: validEntries.length,
        diversity,
        timestampRange: {
          start: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
          end: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
        },
      };
    } catch (e) {
      return this._logCheat('mcp_integrity', 'critical',
        'Failed to read MCP log — possible file tampering',
        { error: e.message, path: mcpLogPath }
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 5: Cross-Reference Validation
   * Correlate pane logs with MCP logs to detect inconsistencies
   * ═══════════════════════════════════════════════════════════════════
   */
  validateCrossReferences(paneLog, mcpLog) {
    const inconsistencies = [];

    // Check 1: If pane shows tool execution, MCP log must show execute_and_verify
    const paneShowsExecution = /execute_and_verify|EDA Tool|innovus|dc_shell/i.test(paneLog);
    const mcpShowsExecution = mcpLog.some(e =>
      e.tool === 'execute_and_verify' || e.method === 'execute_and_verify'
    );

    if (paneShowsExecution && !mcpShowsExecution) {
      inconsistencies.push({
        type: 'execution_mismatch',
        severity: 'critical',
        message: 'Pane shows execution but MCP log has no execute_and_verify call',
      });
    }

    // Check 2: If pane shows agent status, MCP should show knowledge queries
    const paneShowsAgentActivity = /Supervisor|Knowledge|Planner|Executor|Archivist/i.test(paneLog);
    const mcpShowsAgentActivity = mcpLog.some(e =>
      e.tool?.startsWith('knowledge.') || e.params?.brain !== undefined
    );

    if (paneShowsAgentActivity && !mcpShowsAgentActivity) {
      inconsistencies.push({
        type: 'agent_mismatch',
        severity: 'warning',
        message: 'Pane shows agent activity but MCP log has no knowledge queries',
      });
    }

    // Check 3: Timing correlation
    const paneTimestamps = [...paneLog.matchAll(/\[(\d{4}-\d{2}-\d{2}[T\s]\d{2:\d{2}:\d{2})/g)]
      .map(m => new Date(m[1]).getTime())
      .filter(t => !isNaN(t));

    const mcpTimestamps = mcpLog
      .map(e => new Date(e.timestamp).getTime())
      .filter(t => !isNaN(t));

    if (paneTimestamps.length > 0 && mcpTimestamps.length > 0) {
      const paneTimeRange = Math.max(...paneTimestamps) - Math.min(...paneTimestamps);
      const mcpTimeRange = Math.max(...mcpTimestamps) - Math.min(...mcpTimestamps);

      // Pane and MCP logs should cover similar time ranges
      if (Math.abs(paneTimeRange - mcpTimeRange) > 60000) { // > 1 minute difference
        inconsistencies.push({
          type: 'timing_mismatch',
          severity: 'warning',
          message: `Pane and MCP logs cover different time ranges (${Math.abs(paneTimeRange - mcpTimeRange)}ms diff)`,
        });
      }
    }

    if (inconsistencies.length > 0) {
      for (const inc of inconsistencies) {
        this._logCheat('cross_reference', inc.severity, inc.message, inc);
      }
    }

    // Enhanced: Use new Cross-Reference verification methods
    let stageOrderCheck = null;
    let processStateChecks = null;

    if (mcpLog && mcpLog.length > 0 && paneLog) {
      // Verify stage order
      stageOrderCheck = this.verifyStageOrder(mcpLog, paneLog);

      // Verify process state during MCP calls (sample a few entries)
      if (mcpLog.length > 0) {
        const sampleSize = Math.min(5, mcpLog.length);
        const sampleEntries = [];
        for (let i = 0; i < sampleSize; i++) {
          sampleEntries.push(mcpLog[Math.floor(i * mcpLog.length / sampleSize)]);
        }
        processStateChecks = sampleEntries.map(entry =>
          this.verifyProcessStateDuringMcpCall(entry, paneLog)
        );
      }
    }

    return {
      valid: inconsistencies.length === 0,
      inconsistencies,
      enhanced: {
        stageOrderCheck,
        processStateChecks,
      },
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CROSS-REFERENCE VERIFICATION 1: Verify EDA Process Running During MCP Call
   */
  verifyProcessStateDuringMcpCall(mcpEntry, paneLog) {
    if (!mcpEntry || !paneLog) {
      return { valid: false, error: 'Missing MCP entry or pane log' };
    }

    const mcpTimestamp = new Date(mcpEntry.timestamp).getTime();
    if (isNaN(mcpTimestamp)) {
      return { valid: false, error: 'Invalid MCP timestamp' };
    }

    // Find EDA tool prompts in the pane log
    const toolPrompts = [
      { pattern: /innovus\s*\d+\s*>/, name: 'innovus' },
      { pattern: /dc_shell[\w-]*>/, name: 'dc_shell' },
      { pattern: /pt_shell[\w-]*>/, name: 'pt_shell' },
    ];

    // Extract timestamps from pane log entries near the MCP call
    const nearbyLines = [];
    const lines = paneLog.split('\n');

    // Simple approach: look for timestamps in the log and correlate
    const logTimestamps = [];
    for (const line of lines) {
      const tsMatch = line.match(/\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})/);
      if (tsMatch) {
        const ts = new Date(tsMatch[1]).getTime();
        if (!isNaN(ts)) {
          logTimestamps.push({ ts, line });
        }
      }
    }

    // Find if any tool was running around the MCP call time
    const toolRunning = [];
    for (const { pattern, name } of toolPrompts) {
      const hasTool = pattern.test(paneLog);
      if (hasTool) {
        toolRunning.push(name);
      }
    }

    if (toolRunning.length === 0) {
      return this._logCheat('cross_ref_process', 'warning',
        'No EDA tool prompt found in pane log during MCP call',
        { mcpMethod: mcpEntry.method, mcpTool: mcpEntry.tool }
      );
    }

    return {
      valid: true,
      toolsRunning: toolRunning,
      mcpTimestamp: new Date(mcpTimestamp).toISOString(),
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CROSS-REFERENCE VERIFICATION 2: Verify Stage Order Completed Before Next Started
   */
  verifyStageOrder(mcpLog, paneLog) {
    const violations = [];

    // Stage markers in MCP calls
    const stagePatterns = [
      { stage: 0, pattern: /synthesis|dc_shell|compile_ultra/i },
      { stage: 1, pattern: /init_design|init\s+design/i },
      { stage: 2, pattern: /floorplan/i },
      { stage: 3, pattern: /power[_\s]?plan/i },
      { stage: 4, pattern: /placement|place_opt/i },
      { stage: 5, pattern: /cts|clock[_\s]?tree|ccopt/i },
      { stage: 6, pattern: /post[_\s]?cts/i },
      { stage: 7, pattern: /routing|routeDesign/i },
      { stage: 8, pattern: /routing[_\s]?opt/i },
      { stage: 9, pattern: /chip[_\s]?finish|stream[_\s]?out/i },
    ];

    // Extract stage events from MCP log
    const stageEvents = [];
    for (const entry of mcpLog) {
      for (const { stage, pattern } of stagePatterns) {
        if (pattern.test(entry.method || '') || pattern.test(entry.tool || '') || pattern.test(JSON.stringify(entry.params || {}))) {
          stageEvents.push({
            stage,
            timestamp: new Date(entry.timestamp).getTime(),
            method: entry.method,
          });
        }
      }
    }

    // Sort by timestamp
    stageEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Verify stages are in order
    let maxStage = -1;
    for (const event of stageEvents) {
      if (event.stage < maxStage) {
        violations.push({
          issue: `Stage ${event.stage} started before stage ${maxStage} completed`,
          stage: event.stage,
          timestamp: new Date(event.timestamp).toISOString(),
        });
      }
      if (event.stage > maxStage) {
        maxStage = event.stage;
      }
    }

    // Also check pane log for stage markers
    const paneStageMatches = [];
    for (const { stage, pattern } of stagePatterns) {
      if (pattern.test(paneLog)) {
        paneStageMatches.push(stage);
      }
    }

    if (paneStageMatches.length > 0) {
      paneStageMatches.sort((a, b) => a - b);

      // Check if stages are in order in pane log too
      let maxPaneStage = -1;
      for (const stage of paneStageMatches) {
        if (stage < maxPaneStage) {
          violations.push({
            issue: `Pane log shows stage ${stage} before stage ${maxPaneStage} completed`,
            source: 'pane',
          });
        }
        maxPaneStage = stage;
      }
    }

    if (violations.length > 0) {
      return this._logCheat('cross_ref_stage', 'critical',
        'Stage order violation detected',
        { violations }
      );
    }

    return {
      valid: true,
      stagesDetected: [...new Set(stageEvents.map(e => e.stage))].sort((a, b) => a - b),
      stageCount: stageEvents.length,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 5.5: Continuous Process Verification
   * Prevents TOCTOU (Time-of-Check to Time-of-Use) attacks by verifying
   * processes multiple times throughout the test.
   * ═══════════════════════════════════════════════════════════════════
   */
  async verifyClaudeProcessesContinuous(checkCount = 5, intervalMs = 2000) {
    const results = [];

    for (let i = 0; i < checkCount; i++) {
      const check = this.verifyClaudeProcesses();
      results.push(check);

      if (!check.valid) {
        return this._logCheat('process_continuous', 'critical',
          `Process verification failed at check ${i + 1}/${checkCount}`,
          { checkNumber: i + 1, totalChecks: checkCount, result: check }
        );
      }

      if (i < checkCount - 1) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }

    // Verify consistency across all checks
    const counts = results.map(r => r.count);
    const allSameCount = counts.every(c => c === counts[0]);

    if (!allSameCount) {
      return this._logCheat('process_continuous', 'critical',
        'Process count changed during verification — possible process substitution',
        { counts, results }
      );
    }

    return {
      valid: true,
      checks: checkCount,
      processCount: counts[0],
      consistency: 'verified',
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 6: Interactive Verification
   * Send a test command and verify we get a real, unique response
   * ═══════════════════════════════════════════════════════════════════
   */
  async performInteractiveVerification(sendCommandFn, capturePaneFn) {
    // Generate a unique test phrase (timestamp + random)
    const testPhrase = `VERIFICATION_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      // Capture state before
      const beforeText = await capturePaneFn();

      // Send verification command
      await sendCommandFn(`echo "${testPhrase}"`);

      // Wait for response
      await new Promise(r => setTimeout(r, 2000));

      // Capture state after
      const afterText = await capturePaneFn();

      // Verify the test phrase appears in the pane
      if (!afterText.includes(testPhrase)) {
        return this._logCheat('interactive', 'critical',
          'Interactive verification FAILED — command did not reach pane or no response',
          { testPhrase, beforeLength: beforeText.length, afterLength: afterText.length }
        );
      }

      // Verify content changed (not a static image)
      if (beforeText === afterText) {
        return this._logCheat('interactive', 'critical',
          'Pane content did not change after command — possible static image/replay',
          { testPhrase }
        );
      }

      return {
        valid: true,
        testPhrase,
        responseReceived: true,
        contentChanged: beforeText !== afterText,
      };
    } catch (e) {
      return this._logCheat('interactive', 'critical',
        'Interactive verification threw exception — possible system manipulation',
        { error: e.message, testPhrase }
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 7: Video Motion Detection
   * Verify video shows actual activity, not static image
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyVideoMotion(videoPath) {
    if (!existsSync(videoPath)) {
      return this._logCheat('video', 'critical',
        'Video file does not exist — cannot verify visual activity',
        { path: videoPath }
      );
    }

    try {
      const stats = statSync(videoPath);

      // Check 1: File has content
      if (stats.size < 10000) { // Less than 10KB is suspicious
        return this._logCheat('video', 'critical',
          `Video file too small (${stats.size} bytes) — possible static image`,
          { path: videoPath, size: stats.size }
        );
      }

      // Check 2: File was created recently
      const age = Date.now() - stats.mtimeMs;
      if (age > 3600000) { // Older than 1 hour
        return this._logCheat('video', 'critical',
          `Video file is ${(age / 60000).toFixed(1)} minutes old — possible reuse`,
          { path: videoPath, age, mtime: stats.mtime }
        );
      }

      // Check 3: Use ffprobe to verify video has multiple frames
      try {
        const ffprobeOutput = execSync(
          `ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=s=x:p=0 "${videoPath}" 2>&1 || echo "N/A"`,
          { encoding: 'utf8', timeout: 10000 }
        );

        const frameMatch = ffprobeOutput.match(/(\d+)/);
        if (frameMatch) {
          const frames = parseInt(frameMatch[1], 10);
          if (frames < 10) {
            return this._logCheat('video', 'critical',
              `Video has only ${frames} frames — possible static image`,
              { path: videoPath, frames }
            );
          }
        }
      } catch (e) {
        // ffprobe failed, but that's ok — we still have file size check
      }

      return {
        valid: true,
        size: stats.size,
        age,
        path: videoPath,
      };
    } catch (e) {
      return this._logCheat('video', 'warning',
        'Failed to verify video — continuing with other checks',
        { error: e.message, path: videoPath }
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 8: Timestamp Consistency Check
   * Ensure all evidence files were created during this test run
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyEvidenceFreshness(evidenceFiles, options = {}) {
    // STRICT by default: 15 minutes max age (not 1 hour)
    const maxAgeMinutes = options.maxAgeMinutes !== undefined ? options.maxAgeMinutes : 15;
    const testStartTime = Date.now() - (maxAgeMinutes * 60000);
    const staleFiles = [];
    const freshFiles = [];

    for (const file of evidenceFiles) {
      if (!existsSync(file)) {
        staleFiles.push({ file, reason: 'missing' });
        continue;
      }

      try {
        const stats = statSync(file);
        const age = Date.now() - stats.mtimeMs;

        if (stats.mtimeMs < testStartTime) {
          staleFiles.push({
            file,
            reason: 'too_old',
            age: `${(age / 60000).toFixed(1)} minutes old`,
            mtime: stats.mtime,
          });
        } else {
          freshFiles.push({
            file,
            age: `${(age / 1000).toFixed(1)} seconds old`,
          });
        }
      } catch (e) {
        staleFiles.push({ file, reason: 'error', error: e.message });
      }
    }

    if (staleFiles.length > 0) {
      this._logCheat('freshness', 'critical',
        `${staleFiles.length} evidence files are stale — possible evidence reuse`,
        { staleFiles }
      );
    }

    return {
      valid: staleFiles.length === 0,
      freshCount: freshFiles.length,
      staleCount: staleFiles.length,
      staleFiles: staleFiles.slice(0, 5), // Limit detail
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 8.5: EDA Pane Log Verification
   * Verify EDA pane log exists and contains real tool output
   *
   * STRICT: Must have EDA pane log with real tool content
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyEdaPaneLog(edaLogPath) {
    if (!edaLogPath) {
      return this._logCheat('eda_log', 'critical',
        'No EDA pane log path provided — cannot verify tool execution',
        { path: null }
      );
    }

    if (!existsSync(edaLogPath)) {
      return this._logCheat('eda_log', 'critical',
        'EDA pane log does not exist — no proof of tool execution',
        { path: edaLogPath }
      );
    }

    try {
      const content = readFileSync(edaLogPath, 'utf8');

      // Check 1: Log has substantial content (not empty or tiny)
      if (content.length < 500) {
        return this._logCheat('eda_log', 'critical',
          `EDA pane log too small (${content.length} bytes) — no real tool output`,
          { path: edaLogPath, size: content.length }
        );
      }

      // Check 2: Contains real EDA tool indicators (not just echo)
      const toolIndicators = [
        /innovus\s*\d+\s*>/i,           // Innovus prompt
        /dc_shell[\w-]*>/i,              // DC Shell prompt
        /pt_shell[\w-]*>/i,              // PrimeTime prompt
        /\*\*\s*(INFO|WARN|ERROR)/i,     // Tool messages
        /Loading\s+.*\.lef/i,            // LEF loading
        /Loading\s+.*\.lib/i,            // Liberty loading
        /source\s+.*\.enc/i,             // Checkpoint loading
        /saveDesign/i,                   // Checkpoint saving
        /compile_ultra/i,                // Synthesis
        /place_opt_design/i,             // Placement
        /routeDesign/i,                  // Routing
      ];

      const foundIndicators = toolIndicators.filter(pattern => pattern.test(content));

      if (foundIndicators.length === 0) {
        return this._logCheat('eda_log', 'critical',
          'EDA pane log contains NO real tool indicators — possible fake/simulated output',
          { path: edaLogPath, contentSample: content.substring(0, 200) }
        );
      }

      // Check 3: Not just echo commands
      const echoOnlyPattern = /^(echo|printf|puts)\s+/im;
      if (echoOnlyPattern.test(content) && foundIndicators.length < 3) {
        return this._logCheat('eda_log', 'critical',
          'EDA pane log appears to be mostly echo commands — FAKE TOOL OUTPUT',
          { path: edaLogPath }
        );
      }

      return {
        valid: true,
        size: content.length,
        indicators: foundIndicators.length,
        path: edaLogPath,
      };
    } catch (e) {
      return this._logCheat('eda_log', 'critical',
        'Failed to read EDA pane log — possible tampering',
        { error: e.message, path: edaLogPath }
      );
    }
  }

  /**
   * Enhanced verifyEdaPaneLog that also calls EDA-specific verification methods
   */
  verifyEdaPaneLogEnhanced(edaLogPath, designDir = null) {
    // First call the basic verification
    const basicResult = this.verifyEdaPaneLog(edaLogPath);

    if (!basicResult.valid) {
      return basicResult;
    }

    // Read the content for further analysis
    const content = readFileSync(edaLogPath, 'utf8');

    // Run additional EDA verification methods
    const qorMetrics = this.extractQorMetrics(content);
    const errorAnalysis = this.parseErrors(content);
    const durationCheck = this.verifyToolExecutionDuration(content);

    // Run checkpoint verification if design dir provided
    let checkpointResult = null;
    if (designDir) {
      checkpointResult = this.verifyCheckpointFiles(content, designDir);
    }

    // Aggregate results
    const issues = [];

    if (!qorMetrics.valid) issues.push('qor_extraction');
    if (!errorAnalysis.valid) issues.push('error_parsing');
    if (!durationCheck.valid) issues.push('duration_check');
    if (checkpointResult && !checkpointResult.valid) issues.push('checkpoint_verification');

    return {
      valid: issues.length === 0,
      basicResult,
      qorMetrics,
      errorAnalysis,
      durationCheck,
      checkpointResult,
      issues,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * EDA LOG VERIFICATION 1: Extract QoR Metrics from EDA Log
   */
  extractQorMetrics(edaLog) {
    if (!edaLog || edaLog.length === 0) {
      return { valid: false, error: 'No EDA log provided' };
    }

    const metrics = {
      wns: null,
      tns: null,
      area: null,
      cellCount: null,
      power: null,
    };

    // Extract WNS (Worst Negative Slack)
    const wnsMatch = edaLog.match(/WNS:?[\s=]*(-?\d+\.?\d*)/i);
    if (wnsMatch) metrics.wns = parseFloat(wnsMatch[1]);

    // Extract TNS (Total Negative Slack)
    const tnsMatch = edaLog.match(/TNS:?[\s=]*(-?\d+\.?\d*)/i);
    if (tnsMatch) metrics.tns = parseFloat(tnsMatch[1]);

    // Extract Total Area
    const areaMatch = edaLog.match(/Total Area:?[\s=]*(\d+\.?\d*)/i);
    if (areaMatch) metrics.area = parseFloat(areaMatch[1]);

    // Extract Cell Count
    const cellMatch = edaLog.match(/Cell Count:?[\s=]*(\d+)/i);
    if (cellMatch) metrics.cellCount = parseInt(cellMatch[1], 10);

    // Extract Power
    const powerMatch = edaLog.match(/(?:Total |Switching |Internal |Leakage )?Power:?[\s=]*(\d+\.?\d*)/i);
    if (powerMatch) metrics.power = parseFloat(powerMatch[1]);

    // Check if we got at least some metrics
    const hasMetrics = Object.values(metrics).some(v => v !== null);

    if (!hasMetrics) {
      return this._logCheat('eda_qor', 'warning',
        'No QoR metrics found in EDA log',
        { sample: edaLog.substring(0, 200) }
      );
    }

    return {
      valid: true,
      metrics,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * EDA LOG VERIFICATION 2: Verify Checkpoint Files Exist After saveDesign
   */
  verifyCheckpointFiles(edaLog, designDir) {
    if (!edaLog || edaLog.length === 0) {
      return { valid: false, error: 'No EDA log provided' };
    }

    if (!designDir || !existsSync(designDir)) {
      return this._logCheat('eda_checkpoint', 'warning',
        'Design directory not provided or does not exist',
        { designDir }
      );
    }

    // Extract saveDesign filenames from log
    const saveDesignMatches = edaLog.match(/saveDesign[^\n]*/gi) || [];
    const checkpointFiles = [];

    for (const match of saveDesignMatches) {
      // Extract filename from saveDesign command
      const filenameMatch = match.match(/saveDesign\s+([^\s;]+)/i);
      if (filenameMatch) {
        checkpointFiles.push(filenameMatch[1]);
      }
    }

    if (checkpointFiles.length === 0) {
      return this._logCheat('eda_checkpoint', 'warning',
        'No saveDesign commands found in EDA log',
        { designDir }
      );
    }

    // Verify each checkpoint file exists and has reasonable size
    const verifiedCheckpoints = [];
    const missingCheckpoints = [];

    for (const filename of checkpointFiles) {
      // Handle relative paths
      const fullPath = filename.startsWith('/') ? filename : join(designDir, filename);
      const encPath = fullPath + '.enc';

      if (existsSync(encPath)) {
        const stats = statSync(encPath);
        verifiedCheckpoints.push({
          file: filename,
          path: encPath,
          size: stats.size,
        });
      } else if (existsSync(fullPath)) {
        const stats = statSync(fullPath);
        verifiedCheckpoints.push({
          file: filename,
          path: fullPath,
          size: stats.size,
        });
      } else {
        missingCheckpoints.push(filename);
      }
    }

    if (missingCheckpoints.length > 0) {
      return this._logCheat('eda_checkpoint', 'critical',
        `Checkpoint files missing: ${missingCheckpoints.join(', ')}`,
        { missing: missingCheckpoints, verified: verifiedCheckpoints.length }
      );
    }

    return {
      valid: true,
      checkpointCount: checkpointFiles.length,
      verifiedCheckpoints,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * EDA LOG VERIFICATION 3: Parse Error Messages from EDA Log
   */
  parseErrors(edaLog) {
    if (!edaLog || edaLog.length === 0) {
      return { valid: false, error: 'No EDA log provided' };
    }

    const errorMessages = [];
    const warningMessages = [];

    // Extract ERROR messages
    const errorPattern = /\*\*\s*ERROR\s*\*\*[:\s]*([^\n]+)/gi;
    let match;
    while ((match = errorPattern.exec(edaLog)) !== null) {
      errorMessages.push(match[1].trim());
    }

    // Also catch "Error:" patterns
    const errorPattern2 = /Error:?\s*([^\n]+)/gi;
    while ((match = errorPattern2.exec(edaLog)) !== null) {
      const msg = match[1].trim();
      if (!errorMessages.includes(msg)) {
        errorMessages.push(msg);
      }
    }

    // Extract Warning messages
    const warningPattern = /\*\*\s*WARNING\s*\*\*[:\s]*([^\n]+)/gi;
    while ((match = warningPattern.exec(edaLog)) !== null) {
      warningMessages.push(match[1].trim());
    }

    // Also catch "Warning:" patterns
    const warningPattern2 = /Warning:?\s*([^\n]+)/gi;
    while ((match = warningPattern2.exec(edaLog)) !== null) {
      const msg = match[1].trim();
      if (!warningMessages.includes(msg)) {
        warningMessages.push(msg);
      }
    }

    return {
      valid: true,
      errorCount: errorMessages.length,
      warningCount: warningMessages.length,
      errorMessages: errorMessages.slice(0, 10), // Limit detail
      warningMessages: warningMessages.slice(0, 10),
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * EDA LOG VERIFICATION 4: Verify Tool Ran for Reasonable Duration
   */
  verifyToolExecutionDuration(edaLog) {
    if (!edaLog || edaLog.length === 0) {
      return { valid: false, error: 'No EDA log provided' };
    }

    // Extract timestamps from log entries
    // Pattern: [YYYY-MM-DD HH:MM:SS] or similar timestamp formats
    const timestampPatterns = [
      /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/g,
      /(\d{2}:\d{2}:\d{2})\s+(?:AM|PM)/gi,
    ];

    const timestamps = [];
    for (const pattern of timestampPatterns) {
      let match;
      while ((match = pattern.exec(edaLog)) !== null) {
        try {
          const ts = new Date(match[1]);
          if (!isNaN(ts.getTime())) {
            timestamps.push(ts.getTime());
          }
        } catch (e) {
          // Invalid date, skip
        }
      }
    }

    if (timestamps.length < 2) {
      return this._logCheat('eda_duration', 'warning',
        'Cannot extract sufficient timestamps from EDA log',
        { timestampCount: timestamps.length }
      );
    }

    timestamps.sort((a, b) => a - b);
    const durationMs = timestamps[timestamps.length - 1] - timestamps[0];
    const durationSec = durationMs / 1000;

    // Typical EDA stages should run at least 30 seconds
    const MIN_DURATION_SEC = 30;

    if (durationSec < MIN_DURATION_SEC) {
      return this._logCheat('eda_duration', 'warning',
        `EDA tool execution too fast: ${durationSec.toFixed(1)}s (expected >${MIN_DURATION_SEC}s)`,
        { durationSec, minRequired: MIN_DURATION_SEC }
      );
    }

    return {
      valid: true,
      durationMs,
      durationSec: durationSec.toFixed(1),
      timestampCount: timestamps.length,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * MASTER VERIFICATION: Run all cheat detection checks
   * ═══════════════════════════════════════════════════════════════════
   */
  async runFullVerification(options = {}) {
    const {
      paneText,
      mcpLogPath,
      videoPath,
      evidenceFiles = [],
      sendCommandFn,
      capturePaneFn,
    } = options;

    const results = {
      timestamp: new Date().toISOString(),
      checks: {},
      cheatDetected: false,
      criticalCheats: 0,
      warnings: 0,
    };

    // Check 1: Process verification
    results.checks.processes = this.verifyClaudeProcesses();
    if (!results.checks.processes.valid) results.criticalCheats++;

    // Check 2: Echo detection (if pane text provided)
    if (paneText) {
      results.checks.echo = this.detectEchoCommands(paneText);
      if (!results.checks.echo.valid) results.criticalCheats++;

      // Check 3: Pane content authenticity
      results.checks.pane = this.verifyPaneContentAuthenticity(paneText);
      if (!results.checks.pane.valid) results.criticalCheats++;
    }

    // Check 4: MCP log integrity (STRICT: min 50 calls for real test)
    // STRICT MODE: MCP log is REQUIRED unless explicitly disabled
    if (mcpLogPath) {
      results.checks.mcp = this.verifyMcpLogIntegrity(mcpLogPath, { minCalls: options.minMcpCalls });
      if (!results.checks.mcp.valid) results.criticalCheats++;
    } else if (options.requireMcpLog !== false) {
      // STRICT: Missing MCP log is a critical failure by default
      results.checks.mcp = this._logCheat('mcp_integrity', 'critical',
        'MCP log path not provided — tool execution cannot be verified',
        { requireMcpLog: options.requireMcpLog }
      );
      results.criticalCheats++;
    }

    // Check 4b: EDA pane log verification (CRITICAL - must have real EDA output)
    // STRICT MODE: EDA log is REQUIRED unless explicitly disabled
    if (options.edaLogPath) {
      results.checks.edaLog = this.verifyEdaPaneLog(options.edaLogPath);
      if (!results.checks.edaLog?.valid) results.criticalCheats++;
    } else if (options.requireEdaLog !== false) {
      // STRICT: Missing EDA log is a critical failure by default
      results.checks.edaLog = this._logCheat('eda_log', 'critical',
        'EDA pane log path not provided — EDA tool execution cannot be verified',
        { requireEdaLog: options.requireEdaLog }
      );
      results.criticalCheats++;
    }

    // Check 5: Temporal Activity Verification (CRITICAL - detects idle panes)
    if (options.observations && options.observations.length > 0) {
      results.checks.temporal = this.verifyTemporalActivity(options.observations);
      if (!results.checks.temporal.valid) results.criticalCheats++;
    }

    // Check 6: Video motion
    if (videoPath) {
      results.checks.video = this.verifyVideoMotion(videoPath);
      if (!results.checks.video?.valid) results.criticalCheats++;
    }

    // Check 7: Evidence freshness (STRICT: 15 min max age by default)
    // STRICT MODE: Evidence files are REQUIRED unless explicitly disabled
    if (evidenceFiles.length > 0) {
      results.checks.freshness = this.verifyEvidenceFreshness(evidenceFiles, {
        maxAgeMinutes: options.maxEvidenceAgeMinutes
      });
      if (!results.checks.freshness.valid) results.criticalCheats++;
    } else if (options.requireEvidenceFiles !== false) {
      // STRICT: No evidence files is a critical failure by default
      results.checks.freshness = this._logCheat('freshness', 'critical',
        'No evidence files provided — test execution cannot be verified',
        { requireEvidenceFiles: options.requireEvidenceFiles }
      );
      results.criticalCheats++;
    }

    // Check 8: Interactive verification (if functions provided)
    if (sendCommandFn && capturePaneFn) {
      results.checks.interactive = await this.performInteractiveVerification(
        sendCommandFn, capturePaneFn
      );
      if (!results.checks.interactive.valid) results.criticalCheats++;
    }

    // Check 9: Agent Delegation Bypass Detection (CRITICAL for 5-Agent Team Mode)
    // Detects when Supervisor directly executes MCP tools without delegating to Executor
    if (paneText) {
      results.checks.agentDelegation = this.detectAgentDelegationBypass(paneText);
      if (!results.checks.agentDelegation.valid) results.criticalCheats++;
    }

    // Calculate warnings
    results.warnings = this.cheatLog.filter(c => c.severity === 'warning').length;
    results.cheatDetected = results.criticalCheats > 0 || results.warnings > 0;

    return results;
  }

  /**
   * Generate a cheat detection report
   *
   * VETO POWER: If any critical cheat is detected, the test is immediately failed
   * regardless of any other scoring. The CheatDetector has absolute veto authority.
   */
  generateReport() {
    const critical = this.cheatLog.filter(c => c.severity === 'critical');
    const warnings = this.cheatLog.filter(c => c.severity === 'warning');

    // VETO: Any critical issue = immediate test failure
    const hasVeto = critical.length > 0;

    return {
      summary: {
        totalIssues: this.cheatLog.length,
        critical: critical.length,
        warnings: warnings.length,
        passed: !hasVeto,
        veto: hasVeto,
        vetoMessage: hasVeto
          ? `CHEAT DETECTOR VETO: ${critical.length} critical issue(s) detected. Test automatically FAILED regardless of other scores.`
          : null,
      },
      veto: hasVeto,
      criticalIssues: critical,
      warnings: warnings,
      allIssues: this.cheatLog,
    };
  }

  /**
   * Check if CheatDetector exercises its veto power
   * Returns true if any critical cheat was detected
   */
  hasVeto() {
    return this.cheatLog.some(c => c.severity === 'critical');
  }

  /**
   * Assert no cheats detected — throw if veto power would be exercised
   */
  assertClean() {
    if (this.hasVeto()) {
      const critical = this.cheatLog.filter(c => c.severity === 'critical');
      throw new Error(
        `CHEAT DETECTOR VETO: Test failed due to ${critical.length} critical issue(s): ` +
        critical.map(c => `${c.type}: ${c.message}`).join('; ')
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 14: Agent Delegation Bypass Detection
   * Detect when Supervisor directly executes MCP tools without delegating
   * to Executor via SendMessage - CRITICAL for 5-Agent Team Mode
   *
   * Expected flow:
   *   1. Supervisor SendMessage to Executor: {type: "execute_stage", stage: "synthesis"}
   *   2. Executor responds via SendMessage with execution plan
   *   3. Supervisor executes MCP tools on behalf of Executor
   *
   * Cheating pattern (bypassing delegation):
   *   1. Supervisor directly calls eda.start_tool / eda.send_tcl_nonblocking
   *   2. NO SendMessage to Executor before MCP execution
   *   3. All 4 teammates are idle while Supervisor does all the work
   * ═══════════════════════════════════════════════════════════════════
   */
  detectAgentDelegationBypass(claudePaneLog) {
    const violations = [];

    // Pattern 1: Direct MCP execution without SendMessage delegation
    const directMcpPatterns = [
      { pattern: /eda\.start_tool|eda\.send_tcl|eda\.execute_and_verify/i, name: 'direct_mcp_call' },
      { pattern: /hipilot-eda\s+-\s+eda\.(start_tool|send_tcl|execute_and_verify)/i, name: 'mcp_tool_invocation' },
    ];

    // Pattern 2: SendMessage to Executor (expected delegation pattern)
    const delegationPatterns = [
      { pattern: /SendMessage.*to.*["']?Executor["']?/i, name: 'send_to_executor' },
      { pattern: /Message sent to Executor/i, name: 'message_sent_executor' },
      { pattern: /delegate.*synthesis.*Executor/i, name: 'delegate_executor' },
      { pattern: /delegat.*to.*Executor/i, name: 'delegation_executor' },
    ];

    // Pattern 3: All teammates idle while Supervisor works alone
    const idleTeammatesPattern = /All \d+ teammates.*idle|teammates.*available.*Executor/i;

    // Check if there's direct MCP execution
    let hasDirectMcpExecution = false;
    for (const { pattern, name } of directMcpPatterns) {
      const matches = claudePaneLog.match(pattern);
      if (matches) {
        hasDirectMcpExecution = true;
        violations.push({
          type: 'direct_mcp_execution',
          pattern: name,
          match: matches[0].substring(0, 100),
        });
      }
    }

    // Check if there was proper delegation via SendMessage
    let hasDelegation = false;
    for (const { pattern, name } of delegationPatterns) {
      if (pattern.test(claudePaneLog)) {
        hasDelegation = true;
        break;
      }
    }

    // Check for idle teammates pattern (indicates Supervisor working alone)
    const hasIdleTeammates = idleTeammatesPattern.test(claudePaneLog);

    // CRITICAL VIOLATION: Direct MCP execution WITHOUT delegation
    if (hasDirectMcpExecution && !hasDelegation) {
      return this._logCheat('agent_delegation_bypass', 'critical',
        'SUPERVISOR BYPASS DETECTED: Supervisor directly executed MCP tools without delegating to Executor via SendMessage. This violates 5-Agent Team Mode architecture.',
        {
          violations,
          hasDirectMcpExecution,
          hasDelegation,
          hasIdleTeammates,
          expectedFlow: 'Supervisor -> SendMessage(Executor) -> Executor plans -> Supervisor executes MCP',
          actualFlow: 'Supervisor -> Direct MCP execution (bypassed Executor)',
        }
      );
    }

    // WARNING: Direct MCP with delegation but teammates idle (partial bypass)
    if (hasDirectMcpExecution && hasDelegation && hasIdleTeammates) {
      return this._logCheat('agent_delegation_bypass', 'warning',
        'Potential delegation bypass: Supervisor executed MCP while all teammates were idle. Verify Executor actually coordinated the work.',
        {
          violations,
          hasDirectMcpExecution,
          hasDelegation,
          hasIdleTeammates,
        }
      );
    }

    // Use new Team Protocol verification methods
    const processCheck = this.verifyFiveAgentProcesses();
    const messageStructureCheck = this.validateSendMessageStructure(claudePaneLog);
    const knowledgeHubCheck = this.verifyKnowledgeAsHub(claudePaneLog);
    const messageSequenceCheck = this.verifyMessageSequence(claudePaneLog);

    // Aggregate all Team Protocol violations
    const teamViolations = [];

    if (!processCheck.valid) {
      teamViolations.push({ type: 'process', ...processCheck });
    }
    if (!messageStructureCheck.valid) {
      teamViolations.push({ type: 'message_structure', ...messageStructureCheck });
    }
    if (!knowledgeHubCheck.valid) {
      teamViolations.push({ type: 'knowledge_hub', ...knowledgeHubCheck });
    }
    if (!messageSequenceCheck.valid) {
      teamViolations.push({ type: 'message_sequence', ...messageSequenceCheck });
    }

    // Return comprehensive result including all Team Protocol checks
    return {
      valid: teamViolations.length === 0,
      hasDirectMcpExecution,
      hasDelegation,
      hasIdleTeammates,
      delegationCompliant: hasDirectMcpExecution ? hasDelegation : true,
      teamProtocol: {
        processCheck,
        messageStructureCheck,
        knowledgeHubCheck,
        messageSequenceCheck,
      },
      teamViolations,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * TEAM PROTOCOL VERIFICATION 1: Verify 5 Separate Claude Processes
   * Uses process tree to verify parent-child relationships for 5-Agent Team
   */
  verifyFiveAgentProcesses() {
    try {
      // Use ps with tree format to verify process relationships
      const psOutput = execSync('ps aux | grep -E "claude|Claude" | grep -v grep', {
        encoding: 'utf8',
        timeout: 5000,
      });

      const claudeLines = psOutput.trim().split('\n').filter(line => line.trim());

      // Verify at least 5 Claude processes exist
      if (claudeLines.length < 5) {
        return this._logCheat('team_process', 'critical',
          `Insufficient Claude processes for 5-Agent Team: ${claudeLines.length}/5 found`,
          { found: claudeLines.length, required: 5 }
        );
      }

      // Extract process info (PID, PPID, command)
      const processes = claudeLines.map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parts[1],
          ppid: parts[2],
          cmd: parts.slice(10).join(' '),
        };
      });

      // Verify each agent is present (check for agent-specific command patterns)
      const agentIndicators = ['Supervisor', 'Knowledge', 'Planner', 'Executor', 'Archivist'];
      const foundAgents = agentIndicators.filter(agent =>
        processes.some(p => p.cmd.toLowerCase().includes(agent.toLowerCase()))
      );

      if (foundAgents.length < 5) {
        this._logCheat('team_process', 'warning',
          `Not all agents detected in process list: ${foundAgents.length}/5`,
          { found: foundAgents, required: agentIndicators }
        );
      }

      return {
        valid: true,
        processCount: claudeLines.length,
        processes,
        foundAgents,
      };
    } catch (e) {
      return this._logCheat('team_process', 'critical',
        'Failed to verify 5-Agent Team processes',
        { error: e.message }
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * TEAM PROTOCOL VERIFICATION 2: Validate SendMessage JSON Structure
   */
  validateSendMessageStructure(paneLog) {
    const violations = [];
    const validAgents = ['Supervisor', 'Knowledge', 'Planner', 'Executor', 'Archivist'];

    // Find SendMessage JSON patterns in the log
    const jsonPatterns = [
      /SendMessage\s*\(\s*\{[^}]+\}/gi,
      /\{[^}]*"to"\s*:\s*"[^"]+"[^}]*\}/gi,
    ];

    const foundMessages = [];
    for (const pattern of jsonPatterns) {
      const matches = paneLog.match(pattern);
      if (matches) {
        for (const match of matches) {
          foundMessages.push(match);
        }
      }
    }

    // Validate each message structure
    for (const msg of foundMessages) {
      try {
        // Try to extract JSON from the message
        const jsonMatch = msg.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;

        const json = JSON.parse(jsonMatch[0]);

        // Check required fields
        if (!json.to) {
          violations.push({ message: msg.substring(0, 50), issue: 'missing "to" field' });
        } else if (!validAgents.includes(json.to)) {
          violations.push({ message: msg.substring(0, 50), issue: `invalid agent: ${json.to}` });
        }

        if (!json.message) {
          violations.push({ message: msg.substring(0, 50), issue: 'missing "message" field' });
        }

        if (!json.summary) {
          violations.push({ message: msg.substring(0, 50), issue: 'missing "summary" field' });
        }
      } catch (e) {
        // Not valid JSON, might be partial match
        violations.push({ message: msg.substring(0, 50), issue: 'invalid JSON structure' });
      }
    }

    if (violations.length > 0) {
      return this._logCheat('team_protocol', 'warning',
        `SendMessage structure issues found: ${violations.length}`,
        { violations: violations.slice(0, 5) }
      );
    }

    return {
      valid: true,
      messageCount: foundMessages.length,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * TEAM PROTOCOL VERIFICATION 3: Verify Knowledge Agent is Hub
   * Hub-and-spoke: All inter-agent messages should go through Knowledge
   */
  verifyKnowledgeAsHub(paneLog) {
    const violations = [];

    // Check for direct messages that bypass Knowledge
    const directMessagePatterns = [
      { pattern: /SendMessage.*to.*["']?Planner["']?.*from.*["']?Supervisor["']?/i, type: 'Supervisor→Planner' },
      { pattern: /SendMessage.*to.*["']?Executor["']?.*from.*["']?Supervisor["']?/i, type: 'Supervisor→Executor' },
      { pattern: /SendMessage.*to.*["']?Archivist["']?.*from.*["']?Supervisor["']?/i, type: 'Supervisor→Archivist' },
      { pattern: /SendMessage.*to.*["']?Planner["']?.*from.*["']?Executor["']?/i, type: 'Executor→Planner' },
    ];

    for (const { pattern, type } of directMessagePatterns) {
      if (pattern.test(paneLog)) {
        violations.push({
          type,
          message: `Direct ${type} message bypasses Knowledge Agent hub`,
        });
      }
    }

    // Verify messages go through Knowledge
    const knowledgeHubPatterns = [
      /SendMessage.*to.*["']?Knowledge["']?/i,
      /Message.*Knowledge.*received/i,
    ];

    const hasKnowledgeHub = knowledgeHubPatterns.some(p => p.test(paneLog));

    if (!hasKnowledgeHub && paneLog.includes('SendMessage')) {
      return this._logCheat('team_protocol', 'warning',
        'No evidence of Knowledge Agent as hub — verify hub-and-spoke communication',
        { violations }
      );
    }

    if (violations.length > 0) {
      return this._logCheat('team_protocol', 'critical',
        'Hub-and-spoke violation: Supervisor bypassed Knowledge Agent',
        { violations }
      );
    }

    return {
      valid: true,
      knowledgeAsHub: hasKnowledgeHub,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * TEAM PROTOCOL VERIFICATION 4: Verify Message Sequence Timestamps
   * Supervisor→Knowledge should happen before Knowledge→Planner
   */
  verifyMessageSequence(paneLog) {
    const violations = [];

    // Extract timestamp sequences
    // Pattern: [TIMESTAMP] followed by SendMessage
    const timestampPattern = /\[(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})[^\]]*\]/g;

    // Find all SendMessage events with their positions
    const sendMessageEvents = [];
    let match;
    const regex = /(\[.*?\]\s*.*?SendMessage.*?to.*?(?:Supervisor|Knowledge|Planner|Executor|Archivist))/gi;
    while ((match = regex.exec(paneLog)) !== null) {
      sendMessageEvents.push({
        text: match[0],
        index: match.index,
      });
    }

    if (sendMessageEvents.length < 2) {
      // Not enough messages to verify sequence
      return { valid: true, messageCount: sendMessageEvents.length };
    }

    // Check if Supervisor→Knowledge happens before Knowledge→other
    const supervisorToKnowledge = sendMessageEvents.find(e =>
      /to.*?Knowledge/i.test(e.text) && /Supervisor/i.test(e.text)
    );
    const knowledgeToPlanner = sendMessageEvents.find(e =>
      /to.*?Planner/i.test(e.text) && /Knowledge/i.test(e.text)
    );
    const supervisorToExecutor = sendMessageEvents.find(e =>
      /to.*?Executor/i.test(e.text) && /Supervisor/i.test(e.text)
    );

    // Verify temporal ordering
    if (supervisorToKnowledge && knowledgeToPlanner) {
      if (supervisorToKnowledge.index > knowledgeToPlanner.index) {
        violations.push({
          issue: 'Supervisor→Knowledge after Knowledge→Planner',
          severity: 'warning',
        });
      }
    }

    if (supervisorToExecutor && !supervisorToKnowledge) {
      violations.push({
        issue: 'Supervisor→Executor without prior Supervisor→Knowledge',
        severity: 'critical',
      });
    }

    if (violations.length > 0) {
      return this._logCheat('team_protocol', violations[0].severity,
        'Message sequence violation detected',
        { violations }
      );
    }

    return {
      valid: true,
      messageCount: sendMessageEvents.length,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 9: Evidence Location Verification
   * Ensure evidence is stored on the EDA server, not locally
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyEvidenceLocation(evidenceDir) {
    // Check if path contains indicators of local development machine
    const localIndicators = [
      '/Users/',           // macOS local path
      '/home/[^/]+/code',  // Local dev path pattern
      'C:\\Users\\',       // Windows local path
      'test-evidence-phase', // Stale local evidence directories
    ];

    for (const pattern of localIndicators) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(evidenceDir)) {
        return this._logCheat('location', 'critical',
          `Evidence located on LOCAL machine (${evidenceDir}) — must be on EDA server`,
          { path: evidenceDir, pattern }
        );
      }
    }

    // Check for EDA server path indicators
    const edaIndicators = [
      '/home/EDA/',
      'EDA@',
      '192.168.112.163',
    ];

    const onEdaServer = edaIndicators.some(ind =>
      evidenceDir.includes(ind)
    );

    if (!onEdaServer) {
      return this._logCheat('location', 'critical',
        `Evidence path does not indicate EDA server location: ${evidenceDir}`,
        { path: evidenceDir, required: '/home/EDA/' }
      );
    }

    return { valid: true, location: evidenceDir, onEdaServer: true };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 10: Minimum Duration Enforcement
   * Reject tests that complete too quickly to be real
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyMinimumDuration(startTime, endTime, expectedMinMinutes = 10) {
    const durationMs = endTime - startTime;
    const durationMinutes = durationMs / 60000;
    const expectedMinMs = expectedMinMinutes * 60000;

    if (durationMs < expectedMinMs) {
      return this._logCheat('duration', 'critical',
        `Test completed in ${durationMinutes.toFixed(1)} minutes — too fast for real EDA execution (min: ${expectedMinMinutes} min)`,
        {
          actualMinutes: durationMinutes.toFixed(2),
          expectedMinMinutes,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        }
      );
    }

    return {
      valid: true,
      durationMinutes: durationMinutes.toFixed(2),
      meetsMinimum: true,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 11: Desktop Visibility Verification
   * Verify screenshots show actual EDA server desktop with tmux session
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyDesktopVisibility(screenshotPath) {
    if (!existsSync(screenshotPath)) {
      return this._logCheat('desktop', 'critical',
        'Desktop screenshot missing — cannot verify EDA server visibility',
        { path: screenshotPath }
      );
    }

    try {
      // Check file size (desktop screenshots should be substantial)
      const stats = statSync(screenshotPath);
      if (stats.size < 50000) { // Less than 50KB is suspicious for desktop
        return this._logCheat('desktop', 'critical',
          `Desktop screenshot too small (${stats.size} bytes) — may be cropped or fake`,
          { path: screenshotPath, size: stats.size }
        );
      }

      // Verify file is recent
      const age = Date.now() - stats.mtimeMs;
      if (age > 300000) { // Older than 5 minutes
        return this._logCheat('desktop', 'critical',
          `Desktop screenshot is ${(age / 60000).toFixed(1)} minutes old — not from current test`,
          { path: screenshotPath, age, mtime: stats.mtime }
        );
      }

      return {
        valid: true,
        size: stats.size,
        age,
        path: screenshotPath,
      };
    } catch (e) {
      return this._logCheat('desktop', 'critical',
        'Failed to verify desktop screenshot',
        { error: e.message, path: screenshotPath }
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 12: SSH Remote Verification
   * Verify evidence exists on EDA server via SSH
   * ═══════════════════════════════════════════════════════════════════
   */
  async verifyRemoteEvidenceExists(sshHost, sshUser, remotePath, password = null) {
    const { execSync } = await import('child_process');

    try {
      // Build SSH command with optional sshpass for password
      const sshPrefix = password ? `sshpass -p '${password}' ` : '';
      const sshCmd = `${sshPrefix}ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${sshUser}@${sshHost} "ls -la ${remotePath}"`;

      const result = execSync(sshCmd, {
        encoding: 'utf8',
        timeout: 15000,
      });

      // If we get here, the path exists on the remote server
      return {
        valid: true,
        host: sshHost,
        remotePath,
        listing: result.trim(),
      };
    } catch (e) {
      return this._logCheat('remote_verify', 'critical',
        `Remote verification FAILED: Cannot confirm evidence exists on EDA server`,
        {
          host: sshHost,
          remotePath,
          error: e.message,
          hint: 'Evidence must be created directly on EDA server, not copied locally'
        }
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 13: Active Video Stream Verification
   * Verify ffmpeg is actively recording during test execution
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyActiveVideoStream(ffmpegPid = null, videoPath = null) {
    try {
      // Check if ffmpeg process is running
      const psOutput = execSync('ps aux | grep ffmpeg | grep -v grep', {
        encoding: 'utf8',
        timeout: 5000,
      });

      if (!psOutput.includes('ffmpeg')) {
        return this._logCheat('video_stream', 'critical',
          'No active ffmpeg process found — video recording not running',
          { ffmpegPid, videoPath }
        );
      }

      // If video path provided, check it's growing
      if (videoPath && existsSync(videoPath)) {
        const stats1 = statSync(videoPath);
        const size1 = stats1.size;

        // Wait 2 seconds and check again
        execSync('sleep 2', { timeout: 3000 });

        if (existsSync(videoPath)) {
          const stats2 = statSync(videoPath);
          const size2 = stats2.size;

          if (size2 <= size1) {
            return this._logCheat('video_stream', 'critical',
              'Video file not growing — ffmpeg may be stalled or recording static image',
              { videoPath, sizeBefore: size1, sizeAfter: size2 }
            );
          }
        }
      }

      return {
        valid: true,
        ffmpegRunning: true,
        pid: ffmpegPid,
        videoPath,
      };
    } catch (e) {
      return this._logCheat('video_stream', 'critical',
        'Failed to verify active video stream',
        { error: e.message, ffmpegPid, videoPath }
      );
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CHEAT PREVENTION 18: Skill Orchestration Bypass Detection
   *
   * CRITICAL for 5-Agent Team: HiPilot must use skills (via knowledge.get_skill)
   * to orchestrate EDA flow, NOT just source TCL scripts directly.
   *
   * This detects when:
   * - EDA tool runs but no skill was loaded via knowledge.get_skill
   * - Executor bypasses skills and just sources flow scripts
   * - Team coordination fails (Knowledge Agent shuts down before execution)
   * ═══════════════════════════════════════════════════════════════════
   */
  verifySkillOrchestration(mcpLog, paneLog, stageName = 'unknown') {
    const violations = [];
    const evidence = {};

    // Check 1: Was knowledge.get_skill or knowledge.match_skill called?
    const skillLoaded = mcpLog.some(entry => {
      const method = entry.method || '';
      const params = JSON.stringify(entry.params || {});
      return method.includes('get_skill') ||
             method.includes('match_skill') ||
             params.includes('get_skill') ||
             params.includes('match_skill');
    });
    evidence.skillLoaded = skillLoaded;

    // Check 2: Was eda.send_tcl_nonblocking called (proper MCP orchestration)?
    const tclSent = mcpLog.some(entry => {
      const method = entry.method || '';
      return method.includes('send_tcl');
    });
    evidence.tclSent = tclSent;

    // Check 3: Was eda.start_tool called?
    const toolStarted = mcpLog.some(entry => {
      const method = entry.method || '';
      return method.includes('start_tool');
    });
    evidence.toolStarted = toolStarted;

    // Check 4: EDA tool evidence in pane log
    const toolPrompts = paneLog.match(/innovus\s*\d+>|dc_shell[\w-]*>|pt_shell[\w-]*>/g) || [];
    evidence.edaToolRunning = toolPrompts.length > 0;
    evidence.edaToolPrompts = toolPrompts.slice(0, 5);

    // CRITICAL VIOLATION: EDA tool ran but no skill was loaded
    if (evidence.edaToolRunning && !skillLoaded) {
      violations.push({
        issue: `EDA tool ran but no skill was loaded via knowledge.get_skill`,
        severity: 'critical',
        category: 'SKILL_BYPASS',
        detail: 'HiPilot bypassed the skills system and sourced TCL directly',
        evidence: {
          toolPrompts: evidence.edaToolPrompts,
          skillLoaded: false,
          tclSent: tclSent,
        }
      });
    }

    // CRITICAL VIOLATION: EDA tool ran but no MCP Tcl commands sent
    if (evidence.edaToolRunning && !tclSent) {
      violations.push({
        issue: `EDA tool was running but no Tcl commands sent via MCP`,
        severity: 'critical',
        category: 'MCP_BYPASS',
        detail: 'HiPilot may have sourced a flow script instead of using MCP orchestration',
        evidence: {
          toolPrompts: evidence.edaToolPrompts,
          tclSent: false,
          skillLoaded: skillLoaded,
        }
      });
    }

    // HIGH VIOLATION: Team coordination failure
    const knowledgeShutdown = mcpLog.some(entry => {
      const msg = JSON.stringify(entry.params || {}) + (entry.message || '');
      return msg.toLowerCase().includes('shutdown') &&
             (entry.method?.includes('knowledge') || msg.includes('knowledge'));
    });

    const executorMessages = mcpLog.filter(entry => {
      const msg = JSON.stringify(entry.params || {}) + (entry.message || '');
      return msg.toLowerCase().includes('executor') ||
             entry.method?.includes('executor');
    });
    evidence.executorMessages = executorMessages.length;
    evidence.knowledgeShutdown = knowledgeShutdown;

    if (knowledgeShutdown && executorMessages.length > 0 && !toolStarted) {
      violations.push({
        issue: `Knowledge Agent shut down before Executor could execute`,
        severity: 'critical',
        category: 'TEAM_COORDINATION_FAILURE',
        detail: 'Team coordination broke down - Knowledge Agent shutdown before execution',
        evidence: {
          executorMessages: executorMessages.length,
          toolStarted: false,
          tclSent: false,
        }
      });
    }

    // HIGH VIOLATION: EDA pane shows tool activity but no MCP calls
    const paneToolActivity = paneLog.match(/(analyze|elaborate|compile_ultra|report_timing|report_area|init_design|floorplan|place_opt)/gi) || [];
    evidence.paneToolActivity = paneToolActivity;

    if (paneToolActivity.length > 0 && !tclSent) {
      violations.push({
        issue: `EDA pane shows tool commands but no MCP send_tcl calls`,
        severity: 'high',
        category: 'MCP_ORCHESTRATION_FAILURE',
        detail: 'TCL commands visible in EDA pane but not sent via MCP - possible direct sourcing',
        evidence: {
          paneCommands: paneToolActivity.slice(0, 10),
          tclSent: false,
        }
      });
    }

    if (violations.length > 0) {
      return this._logCheat('skill_orchestration_bypass', 'critical',
        `Skill orchestration bypass detected: ${violations.length} violation(s)`,
        { violations, stageName, evidence }
      );
    }

    return {
      valid: true,
      skillLoaded,
      tclSent,
      toolStarted,
      edaToolRunning: evidence.edaToolRunning,
      stageName,
    };
  }

}
