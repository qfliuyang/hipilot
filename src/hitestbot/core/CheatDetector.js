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
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyClaudeProcesses() {
    try {
      // Check for claude CLI processes
      const psOutput = execSync('ps aux | grep -E "claude|Claude" | grep -v grep', {
        encoding: 'utf8',
        timeout: 5000,
      });

      const claudeLines = psOutput.trim().split('\n').filter(line => line.includes('claude'));

      // Expected: 5 Claude processes for 5 agents
      const expectedCount = 5;
      const actualCount = claudeLines.length;

      if (actualCount === 0) {
        return this._logCheat('process', 'critical',
          'NO Claude processes found — HiPilot is not running!',
          { psOutput: 'empty', expected: expectedCount, actual: 0 }
        );
      }

      if (actualCount < expectedCount) {
        return this._logCheat('process', 'warning',
          `Only ${actualCount}/${expectedCount} Claude processes found — some agents may not be running`,
          { processes: claudeLines.map(l => l.trim()) }
        );
      }

      // Verify they're real Node.js processes, not shell scripts faking output
      const nodeProcesses = claudeLines.filter(line => line.includes('node') || line.includes('claude'));

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
   * CHEAT PREVENTION 4: MCP Log Integrity Check
   * Verify MCP logs are real, not fabricated
   * ═══════════════════════════════════════════════════════════════════
   */
  verifyMcpLogIntegrity(mcpLogPath) {
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

    return {
      valid: inconsistencies.length === 0,
      inconsistencies,
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
  verifyEvidenceFreshness(evidenceFiles) {
    const testStartTime = Date.now() - 3600000; // Assume test started within last hour
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

    // Check 4: MCP log integrity
    if (mcpLogPath) {
      results.checks.mcp = this.verifyMcpLogIntegrity(mcpLogPath);
      if (!results.checks.mcp.valid) results.criticalCheats++;
    }

    // Check 5: Video motion
    if (videoPath) {
      results.checks.video = this.verifyVideoMotion(videoPath);
      if (!results.checks.video?.valid) results.criticalCheats++;
    }

    // Check 6: Evidence freshness
    if (evidenceFiles.length > 0) {
      results.checks.freshness = this.verifyEvidenceFreshness(evidenceFiles);
      if (!results.checks.freshness.valid) results.criticalCheats++;
    }

    // Check 7: Interactive verification (if functions provided)
    if (sendCommandFn && capturePaneFn) {
      results.checks.interactive = await this.performInteractiveVerification(
        sendCommandFn, capturePaneFn
      );
      if (!results.checks.interactive.valid) results.criticalCheats++;
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
}
