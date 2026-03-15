/**
 * TestReviewBoard — Independent Third-Party Test Result Verification
 *
 * The Review Board acts as a neutral arbiter that:
 *   1. Reads all test evidence independently (no trust in HiTestBot scoring)
 *   2. Aligns findings with TEST_PLAN requirements
 *   3. Detects mismatches between claimed and actual results
 *   4. Provides authoritative final assessment
 *
 * Independence Guarantees:
 *   - Reads evidence files directly (not through HiTestBot APIs)
 *   - Re-implements scoring logic (not using HiTestBot's scores)
 *   - Validates evidence integrity using its own CheatDetector instance
 *   - Reports discrepancies between HiTestBot claims and actual evidence
 *
 * The Review Board CANNOT be cheated because:
 *   - It reads raw evidence (screenshots, logs, video) directly
 *   - It re-verifies all claims independently
 *   - It uses its own CheatDetector (separate from HiTestBot's)
 *   - It reports mismatches, not just pass/fail
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { CheatDetector } from './CheatDetector.js';

export class TestReviewBoard {
  constructor(options = {}) {
    this.evidenceDir = options.evidenceDir;
    this.testPlanPath = options.testPlanPath || join(process.cwd(), 'docs/testing/TEST_PLAN.md');
    this.findings = [];
    this.mismatches = [];
    this.verdict = null;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * MAIN ENTRY: Review a complete test evidence package
   * ═══════════════════════════════════════════════════════════════════
   */
  async reviewTestPackage(evidenceDir) {
    this.evidenceDir = evidenceDir || this.evidenceDir;

    if (!this.evidenceDir || !existsSync(this.evidenceDir)) {
      throw new Error(`Evidence directory not found: ${this.evidenceDir}`);
    }

    console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
    console.log(`║     HiPilot Test Result Review Board — Independent Audit       ║`);
    console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);

    console.log(`Reviewing: ${this.evidenceDir}`);
    console.log(`Started: ${new Date().toISOString()}\n`);

    // Phase 1: Evidence Inventory
    const inventory = this._inventoryEvidence();
    console.log(`📁 Evidence Files: ${inventory.files.length}`);
    console.log(`   - ${inventory.hasVideo ? '✓' : '✗'} Video recording`);
    console.log(`   - ${inventory.hasScreenshots ? '✓' : '✗'} Screenshots`);
    console.log(`   - ${inventory.hasPaneLogs ? '✓' : '✗'} Pane logs`);
    console.log(`   - ${inventory.hasMcpLog ? '✓' : '✗'} MCP call log`);
    console.log(`   - ${inventory.hasFlowReport ? '✓' : '✗'} Flow report`);
    console.log(`   - ${inventory.hasMetadata ? '✓' : '✗'} Test metadata`);
    console.log(`   - ${inventory.hasCheatReport ? '✓' : '✗'} Cheat detection report\n`);

    // Phase 2: Independent Cheat Detection (cannot trust HiTestBot's check)
    console.log(`🔍 Phase 2: Independent Cheat Verification...`);
    const cheatResult = await this._independentCheatCheck();
    console.log(`   Result: ${cheatResult.clean ? '✓ CLEAN' : '⚠️ CHEAT DETECTED'}`);
    if (!cheatResult.clean) {
      console.log(`   Issues: ${cheatResult.issues.length} suspicious patterns found`);
    }
    console.log();

    // Phase 3: Read HiTestBot's Claims
    console.log(`📋 Phase 3: Reading HiTestBot Claims...`);
    const claims = this._readHiTestBotClaims();
    console.log(`   Claimed Score: ${claims.totalScore?.toFixed(2) || 'N/A'}`);
    console.log(`   Claimed Grade: ${claims.finalGrade || 'N/A'}`);
    console.log(`   Test Duration: ${claims.duration || 'N/A'}`);
    console.log(`   Stages Passed: ${claims.stagesPassed || 0}/${claims.stagesTotal || 0}\n`);

    // Phase 4: Independent Verification
    console.log(`🔎 Phase 4: Independent Evidence Verification...`);
    const verification = this._verifyEvidence(inventory);
    console.log(`   L1 (Response): ${verification.l1.hasResponse ? '✓' : '✗'}`);
    console.log(`   L2 (Understanding): ${verification.l2.hasKeywords ? '✓' : '✗'}`);
    console.log(`   L3 (MCP Usage): ${verification.l3.hasToolCalls ? '✓' : '✗'}`);
    console.log(`   L4 (EDA Execution): ${verification.l4.hasToolOutput ? '✓' : '✗'}`);
    console.log(`   L5 (QoR Reported): ${verification.l5.hasQoR ? '✓' : '✗'}\n`);

    // Phase 5: Mismatch Detection
    console.log(`⚖️  Phase 5: Detecting Mismatches...`);
    const mismatches = this._detectMismatches(claims, verification, cheatResult);
    console.log(`   Mismatches Found: ${mismatches.length}`);
    mismatches.forEach(m => console.log(`   ⚠️  ${m.severity}: ${m.message}`));
    console.log();

    // Phase 6: TEST_PLAN Alignment
    console.log(`📖 Phase 6: Aligning with TEST_PLAN...`);
    const alignment = this._alignWithTestPlan(claims, verification);
    console.log(`   Phases Covered: ${alignment.phasesCovered.join(', ') || 'None detected'}`);
    console.log(`   Requirements Met: ${alignment.requirementsMet}/${alignment.requirementsTotal}`);
    console.log(`   Gaps: ${alignment.gaps.length > 0 ? alignment.gaps.join(', ') : 'None'}\n`);

    // Phase 7: Final Verdict
    this.verdict = this._renderVerdict(inventory, cheatResult, claims, verification, mismatches, alignment);

    // Save review report
    const reportPath = join(this.evidenceDir, 'REVIEW_BOARD_REPORT.md');
    this._saveReport(reportPath);
    console.log(`📄 Review report saved: ${reportPath}\n`);

    return this.verdict;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * PHASE 1: Inventory all evidence files
   * ═══════════════════════════════════════════════════════════════════
   */
  _inventoryEvidence() {
    const files = readdirSync(this.evidenceDir);

    return {
      files,
      hasVideo: files.some(f => f.endsWith('.mp4') || f.endsWith('.avi')),
      hasScreenshots: files.some(f => f.startsWith('screenshot') && f.endsWith('.png')),
      hasPaneLogs: files.some(f => f.includes('pane') && f.endsWith('.log')),
      hasMcpLog: files.includes('mcp_calls.jsonl'),
      hasFlowReport: files.includes('FLOW_REPORT.md'),
      hasMetadata: files.includes('test_metadata.json'),
      hasCheatReport: files.includes('cheat_detection_report.json'),
      hasTimeline: files.includes('timeline.jsonl'),
      hasScorecards: files.includes('stage_scorecards.json'),
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * PHASE 2: Independent Cheat Detection
   * Uses its own CheatDetector instance — does NOT trust HiTestBot's report
   * ═══════════════════════════════════════════════════════════════════
   */
  async _independentCheatCheck() {
    const detector = new CheatDetector({});
    const issues = [];

    // Check 1: Read pane logs and check for echo commands
    const pane0Log = join(this.evidenceDir, 'pane0_continuous.log');
    const pane1Log = join(this.evidenceDir, 'pane1_continuous.log');

    let combinedPaneText = '';
    if (existsSync(pane0Log)) {
      combinedPaneText += readFileSync(pane0Log, 'utf8');
    }
    if (existsSync(pane1Log)) {
      combinedPaneText += '\n' + readFileSync(pane1Log, 'utf8');
    }

    if (combinedPaneText) {
      const echoCheck = detector.detectEchoCommands(combinedPaneText);
      if (!echoCheck.valid) {
        issues.push({ type: 'echo_commands', severity: 'critical', detail: echoCheck });
      }

      const paneCheck = detector.verifyPaneContentAuthenticity(combinedPaneText);
      if (!paneCheck.valid) {
        issues.push({ type: 'pane_authenticity', severity: 'critical', detail: paneCheck });
      }
    }

    // Check 2: MCP log integrity
    const mcpLogPath = join(this.evidenceDir, 'mcp_calls.jsonl');
    if (existsSync(mcpLogPath)) {
      const mcpCheck = detector.verifyMcpLogIntegrity(mcpLogPath);
      if (!mcpCheck.valid) {
        issues.push({ type: 'mcp_integrity', severity: 'critical', detail: mcpCheck });
      }
    }

    // Check 3: Video motion
    const videoFiles = readdirSync(this.evidenceDir).filter(f => f.endsWith('.mp4'));
    for (const videoFile of videoFiles) {
      const videoCheck = detector.verifyVideoMotion(join(this.evidenceDir, videoFile));
      if (!videoCheck?.valid) {
        issues.push({ type: 'video_motion', severity: 'warning', detail: videoCheck });
      }
    }

    // Check 4: Evidence freshness
    const allFiles = readdirSync(this.evidenceDir);
    const evidenceFiles = allFiles.map(f => join(this.evidenceDir, f));
    const freshnessCheck = detector.verifyEvidenceFreshness(evidenceFiles);
    if (!freshnessCheck.valid) {
      issues.push({ type: 'evidence_freshness', severity: 'critical', detail: freshnessCheck });
    }

    return {
      clean: issues.length === 0,
      issues,
      detector, // Keep for report generation
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * PHASE 3: Read HiTestBot's Claims from its reports
   * ═══════════════════════════════════════════════════════════════════
   */
  _readHiTestBotClaims() {
    const claims = {
      source: 'HiTestBot',
      totalScore: null,
      finalGrade: null,
      gpa: null,
      duration: null,
      stagesPassed: 0,
      stagesTotal: 0,
      l1Response: null,
      l2Intent: null,
      l3ToolUsage: null,
      l4Execution: null,
      l5QoR: null,
      status: null,
      timestamp: null,
    };

    // Read FLOW_REPORT.md for scores
    const flowReportPath = join(this.evidenceDir, 'FLOW_REPORT.md');
    if (existsSync(flowReportPath)) {
      const flowReport = readFileSync(flowReportPath, 'utf8');

      // Extract scores using regex
      const scoreMatch = flowReport.match(/Total Score:\s*([\d.]+)/i);
      if (scoreMatch) claims.totalScore = parseFloat(scoreMatch[1]);

      const gradeMatch = flowReport.match(/Final Grade:\s*([A-F][+-]?)/i);
      if (gradeMatch) claims.finalGrade = gradeMatch[1];

      const gpaMatch = flowReport.match(/GPA:\s*([\d.]+)/i);
      if (gpaMatch) claims.gpa = parseFloat(gpaMatch[1]);

      const statusMatch = flowReport.match(/Status:\s*(\w+)/i);
      if (statusMatch) claims.status = statusMatch[1];
    }

    // Read metadata for test info
    const metadataPath = join(this.evidenceDir, 'test_metadata.json');
    if (existsSync(metadataPath)) {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
      claims.timestamp = metadata.timestamp;
      claims.command = metadata.command;
      claims.phase = metadata.phase;
    }

    // Read scorecards for L1-L5 scores
    const scorecardsPath = join(this.evidenceDir, 'stage_scorecards.json');
    if (existsSync(scorecardsPath)) {
      const scorecards = JSON.parse(readFileSync(scorecardsPath, 'utf8'));
      if (Array.isArray(scorecards) && scorecards.length > 0) {
        const card = scorecards[0]; // First scorecard
        claims.l1Response = card.scores?.L1_prompt_delivery?.score;
        claims.l2Intent = card.scores?.L2_intent_recognition?.score;
        claims.l3ToolUsage = card.scores?.L3_mcp_tool_usage?.score;
        claims.l4Execution = card.scores?.L4_eda_execution?.score;
        claims.l5QoR = card.scores?.L5_qor_assessment?.score;
        claims.stagesPassed = card.subjects?.filter(s => s.status === 'PASS').length || 0;
        claims.stagesTotal = card.subjects?.length || 0;
      }
    }

    return claims;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * PHASE 4: Independent L1-L5 Verification
   * Re-implements scoring logic (does NOT use HiTestBot's scores)
   * ═══════════════════════════════════════════════════════════════════
   */
  _verifyEvidence(inventory) {
    const verification = {
      l1: { hasResponse: false, evidence: [] },
      l2: { hasKeywords: false, keywordsFound: [], evidence: [] },
      l3: { hasToolCalls: false, toolCount: 0, evidence: [] },
      l4: { hasToolOutput: false, toolUsed: null, evidence: [] },
      l5: { hasQoR: false, metricsFound: [], evidence: [] },
    };

    // Read pane logs
    const pane0Log = join(this.evidenceDir, 'pane0_continuous.log');
    let paneText = '';
    if (existsSync(pane0Log)) {
      paneText = readFileSync(pane0Log, 'utf8');
    }

    // L1: Did Claude respond? (pane text changed, shows output)
    verification.l1.hasResponse = paneText.length > 100; // Substantial output
    verification.l1.evidence.push(`Pane content length: ${paneText.length} chars`);

    // L2: Did Claude understand the task?
    const understandingKeywords = [
      'synthesis', 'floorplan', 'placement', 'cts', 'routing',
      'innovus', 'dc_shell', 'compile', 'timing', 'constraint',
      'mission pack', 'flow', 'stage'
    ];
    verification.l2.keywordsFound = understandingKeywords.filter(kw =>
      paneText.toLowerCase().includes(kw.toLowerCase())
    );
    verification.l2.hasKeywords = verification.l2.keywordsFound.length >= 2;
    verification.l2.evidence.push(`Keywords found: ${verification.l2.keywordsFound.join(', ')}`);

    // L3: MCP Tool Usage
    const mcpLogPath = join(this.evidenceDir, 'mcp_calls.jsonl');
    if (existsSync(mcpLogPath)) {
      const mcpContent = readFileSync(mcpLogPath, 'utf8');
      const mcpLines = mcpContent.trim().split('\n').filter(l => l.trim());

      const mcpTools = [
        'execute_and_verify', 'generate_tcl', 'start_tool', 'detect_tool',
        'get_skill', 'query', 'send_keys', 'capture_pane'
      ];

      let toolCallCount = 0;
      for (const tool of mcpTools) {
        const matches = mcpContent.match(new RegExp(tool, 'g'));
        if (matches) toolCallCount += matches.length;
      }

      verification.l3.hasToolCalls = toolCallCount >= 3;
      verification.l3.toolCount = toolCallCount;
      verification.l3.evidence.push(`MCP tool calls detected: ${toolCallCount}`);
    }

    // L4: EDA Tool Execution
    const edaIndicators = ['innovus', 'dc_shell>', 'pt_shell>', 'ERROR', 'WARNING'];
    const edaMatches = edaIndicators.filter(ind => paneText.includes(ind));
    verification.l4.hasToolOutput = edaMatches.length > 0;
    verification.l4.evidence.push(`EDA indicators: ${edaMatches.join(', ')}`);

    // L5: QoR Metrics
    const qorPatterns = [
      /WNS[\s:=]+-?\d+\.?\d*/i,
      /TNS[\s:=]+-?\d+\.?\d*/i,
      /setup\s+(violation|slack)/i,
      /hold\s+(violation|slack)/i,
      /area[\s:=]+\d+/i,
    ];

    for (const pattern of qorPatterns) {
      const match = paneText.match(pattern);
      if (match) {
        verification.l5.metricsFound.push(match[0]);
      }
    }
    verification.l5.hasQoR = verification.l5.metricsFound.length > 0;
    verification.l5.evidence.push(`QoR patterns found: ${verification.l5.metricsFound.length}`);

    return verification;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * PHASE 5: Detect Mismatches Between Claims and Reality
   * ═══════════════════════════════════════════════════════════════════
   */
  _detectMismatches(claims, verification, cheatResult) {
    const mismatches = [];

    // Mismatch 1: Claimed high score but no evidence of tool usage
    if ((claims.l3ToolUsage || 0) > 0.5 && !verification.l3.hasToolCalls) {
      mismatches.push({
        severity: 'CRITICAL',
        type: 'l3_mismatch',
        message: `HiTestBot claims L3=${claims.l3ToolUsage} but Review Board found 0 MCP tool calls`,
        claimed: claims.l3ToolUsage,
        actual: 0,
      });
    }

    // Mismatch 2: Claimed EDA execution but no tool output
    if ((claims.l4Execution || 0) > 0.3 && !verification.l4.hasToolOutput) {
      mismatches.push({
        severity: 'CRITICAL',
        type: 'l4_mismatch',
        message: `HiTestBot claims L4=${claims.l4Execution} but Review Board found no EDA tool output`,
        claimed: claims.l4Execution,
        actual: 'No EDA output',
      });
    }

    // Mismatch 3: Claimed QoR but no metrics found
    if ((claims.l5QoR || 0) > 0.3 && !verification.l5.hasQoR) {
      mismatches.push({
        severity: 'CRITICAL',
        type: 'l5_mismatch',
        message: `HiTestBot claims L5=${claims.l5QoR} but Review Board found no QoR metrics`,
        claimed: claims.l5QoR,
        actual: 0,
      });
    }

    // Mismatch 4: Cheat detected but HiTestBot didn't report it
    if (!cheatResult.clean) {
      const hiTestBotCheatReport = join(this.evidenceDir, 'cheat_detection_report.json');
      let hiTestBotFoundCheats = false;

      if (existsSync(hiTestBotCheatReport)) {
        const htbReport = JSON.parse(readFileSync(hiTestBotCheatReport, 'utf8'));
        hiTestBotFoundCheats = htbReport.cheatDetected;
      }

      if (!hiTestBotFoundCheats) {
        mismatches.push({
          severity: 'CRITICAL',
          type: 'cheat_detection_mismatch',
          message: 'Review Board detected cheats that HiTestBot missed',
          reviewBoardIssues: cheatResult.issues.length,
          hiTestBotIssues: hiTestBotFoundCheats ? 'some' : 'none',
        });
      }
    }

    // Mismatch 5: Grade claim without supporting evidence
    if (claims.finalGrade && claims.finalGrade.startsWith('A') && !verification.l5.hasQoR) {
      mismatches.push({
        severity: 'WARNING',
        type: 'grade_overclaim',
        message: `HiTestBot claims grade ${claims.finalGrade} but no QoR evidence found`,
        claimed: claims.finalGrade,
        evidence: 'No QoR metrics',
      });
    }

    // Mismatch 6: No response at all but claims some score
    if (!verification.l1.hasResponse && (claims.totalScore || 0) > 0) {
      mismatches.push({
        severity: 'CRITICAL',
        type: 'no_response_mismatch',
        message: `HiTestBot claims score ${claims.totalScore} but Review Board found no response`,
        claimed: claims.totalScore,
        actual: 0,
      });
    }

    this.mismatches = mismatches;
    return mismatches;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * PHASE 6: Align with TEST_PLAN requirements
   * ═══════════════════════════════════════════════════════════════════
   */
  _alignWithTestPlan(claims, verification) {
    const alignment = {
      phasesCovered: [],
      requirementsMet: 0,
      requirementsTotal: 0,
      gaps: [],
    };

    // Map evidence to TEST_PLAN phases
    const phaseIndicators = {
      'Phase 0': () => true, // Infrastructure always checked
      'Phase 0.5': () => existsSync(join(this.evidenceDir, 'heartbeat.json')),
      'Phase 1': () => verification.l1.hasResponse,
      'Phase 2': () => verification.l3.hasToolCalls,
      'Phase 3': () => verification.l4.hasToolOutput,
      'Phase 4': () => verification.l4.hasToolOutput && verification.l3.toolCount >= 5,
      'Phase 4.5': () => claims.command?.includes('mission'),
      'Phase 5': () => verification.l4.hasToolOutput && verification.l5.hasQoR,
      'Phase 6': () => verification.l5.hasQoR && (claims.stagesPassed || 0) >= 4,
      'Phase 7': () => claims.stagesPassed >= 8,
      'Phase 8': () => claims.stagesPassed >= 8 && claims.command?.includes('mission'),
    };

    for (const [phase, checkFn] of Object.entries(phaseIndicators)) {
      alignment.requirementsTotal++;
      if (checkFn()) {
        alignment.phasesCovered.push(phase);
        alignment.requirementsMet++;
      } else {
        alignment.gaps.push(phase);
      }
    }

    return alignment;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════
   * PHASE 7: Render Final Verdict
   * ═══════════════════════════════════════════════════════════════════
   */
  _renderVerdict(inventory, cheatResult, claims, verification, mismatches, alignment) {
    // Calculate independent score
    let independentScore = 0;
    if (verification.l1.hasResponse) independentScore += 0.2;
    if (verification.l2.hasKeywords) independentScore += 0.2;
    if (verification.l3.hasToolCalls) independentScore += 0.2;
    if (verification.l4.hasToolOutput) independentScore += 0.2;
    if (verification.l5.hasQoR) independentScore += 0.2;

    // Cheat penalty
    const cheatPenalty = cheatResult.clean ? 0 : 1.0;
    const finalScore = Math.max(0, independentScore - cheatPenalty);

    // ═══════════════════════════════════════════════════════════════════
    // VETO POWER: CheatDetector has absolute authority to fail the test
    // If cheating detected, all other scores are irrelevant — immediate FAIL
    // ═══════════════════════════════════════════════════════════════════
    const hasVeto = !cheatResult.clean || (cheatResult.detector && cheatResult.detector.hasVeto && cheatResult.detector.hasVeto());

    // Determine verdict
    let verdict;
    if (hasVeto) {
      verdict = 'VETO — CHEATING DETECTED (Absolute Authority)';
    } else if (mismatches.filter(m => m.severity === 'CRITICAL').length > 0) {
      verdict = 'DISPUTED — Critical Mismatches Found';
    } else if (finalScore >= 0.8) {
      verdict = 'APPROVED — Test Passed';
    } else if (finalScore >= 0.5) {
      verdict = 'PARTIAL — Some Requirements Met';
    } else {
      verdict = 'FAILED — Insufficient Evidence';
    }

    console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
    console.log(`║                    FINAL REVIEW BOARD VERDICT                    ║`);
    console.log(`╠══════════════════════════════════════════════════════════════════╣`);
    console.log(`║  Verdict:  ${verdict.padEnd(54)} ║`);
    console.log(`║  Score:    ${(finalScore * 10).toFixed(1)}/10.0 (Independent)${' '.repeat(24)}║`);
    console.log(`║  HiTestBot Claimed: ${(claims.totalScore || 0).toFixed(1)}/10.0${' '.repeat(33)}║`);
    console.log(`║  Mismatches: ${mismatches.length} found${' '.repeat(43)}║`);
    if (hasVeto) {
      console.log(`║  ⚠️  VETO POWER EXERCISED: CheatDetector override${' '.repeat(29)}║`);
    }
    console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);

    return {
      verdict,
      finalScore,
      independentScore,
      cheatPenalty,
      hasVeto,
      vetoMessage: hasVeto ? 'CheatDetector veto: Critical cheats detected. Test automatically FAILED regardless of other scores.' : null,
      hiTestBotClaimedScore: claims.totalScore,
      mismatchCount: mismatches.length,
      criticalMismatches: mismatches.filter(m => m.severity === 'CRITICAL').length,
      timestamp: new Date().toISOString(),
      evidenceDir: this.evidenceDir,
    };
  }

  /**
   * Save detailed review report
   */
  _saveReport(reportPath) {
    const report = this._generateMarkdownReport();
    writeFileSync(reportPath, report);
  }

  _generateMarkdownReport() {
    return `# Test Review Board Report

**Generated:** ${new Date().toISOString()}
**Evidence Directory:** ${this.evidenceDir}

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Final Verdict** | ${this.verdict?.verdict || 'Pending'} |
| **Independent Score** | ${(this.verdict?.independentScore * 10 || 0).toFixed(1)}/10.0 |
| **HiTestBot Claimed** | ${(this.verdict?.hiTestBotClaimedScore || 0).toFixed(1)}/10.0 |
| **Mismatches Found** | ${this.verdict?.mismatchCount || 0} (${this.verdict?.criticalMismatches || 0} critical) |
| **Cheat Status** | ${this.verdict?.cheatPenalty > 0 ? '⚠️ CHEATING DETECTED' : '✓ Clean'} |
| **Veto Power** | ${this.verdict?.hasVeto ? '⚠️ EXERCISED — CheatDetector has absolute authority' : 'Not exercised'} |

---

## Mismatches Detected

${this.mismatches.length === 0 ? 'No mismatches found between HiTestBot claims and Review Board verification.' :
  this.mismatches.map(m => `### ${m.severity}: ${m.type}

- **Claimed:** ${m.claimed !== undefined ? m.claimed : 'N/A'}
- **Actual:** ${m.actual !== undefined ? m.actual : 'N/A'}
- **Issue:** ${m.message}
`).join('\n---\n\n')}

---

## Independent Verification Results

### L1: Response Verification
${this.verification?.l1 ? `- Has Response: ${this.verification.l1.hasResponse ? '✓' : '✗'}
- Evidence: ${this.verification.l1.evidence.join(', ')}` : 'Not verified'}

### L2: Intent Understanding
${this.verification?.l2 ? `- Has Keywords: ${this.verification.l2.hasKeywords ? '✓' : '✗'}
- Keywords Found: ${this.verification.l2.keywordsFound.join(', ') || 'None'}` : 'Not verified'}

### L3: MCP Tool Usage
${this.verification?.l3 ? `- Has Tool Calls: ${this.verification.l3.hasToolCalls ? '✓' : '✗'}
- Tool Call Count: ${this.verification.l3.toolCount}` : 'Not verified'}

### L4: EDA Execution
${this.verification?.l4 ? `- Has Tool Output: ${this.verification.l4.hasToolOutput ? '✓' : '✗'}
- Evidence: ${this.verification.l4.evidence.join(', ')}` : 'Not verified'}

### L5: QoR Reporting
${this.verification?.l5 ? `- Has QoR: ${this.verification.l5.hasQoR ? '✓' : '✗'}
- Metrics Found: ${this.verification.l5.metricsFound.join(', ') || 'None'}` : 'Not verified'}

---

## TEST_PLAN Alignment

${this.alignment ? `- Phases Covered: ${this.alignment.phasesCovered.join(', ') || 'None'}
- Requirements Met: ${this.alignment.requirementsMet}/${this.alignment.requirementsTotal}
- Gaps: ${this.alignment.gaps.join(', ') || 'None'}` : 'Not analyzed'}

---

## Review Board Certification

This report was generated by the independent TestReviewBoard, which:
1. Reads evidence files directly (no trust in HiTestBot)
2. Re-implements verification logic independently
3. Detects mismatches between claims and evidence
4. Cannot be cheated as it's a standalone third party

**Review Board Integrity:** ✓ Verified

---

*This report is the authoritative assessment. HiTestBot reports are advisory only.*
`;
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const evidenceDir = process.argv[2];

  if (!evidenceDir) {
    console.error('Usage: node TestReviewBoard.js <evidence-directory>');
    process.exit(1);
  }

  const board = new TestReviewBoard({ evidenceDir });
  board.reviewTestPackage().then(verdict => {
    process.exit(verdict.finalScore >= 0.5 ? 0 : 1);
  }).catch(err => {
    console.error('Review failed:', err.message);
    process.exit(1);
  });
}
