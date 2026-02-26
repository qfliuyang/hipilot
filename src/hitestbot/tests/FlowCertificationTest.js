#!/usr/bin/env node
/**
 * FlowCertificationTest — Uses HiPilot like a human, then scores the result.
 *
 * This test launches HiPilot, types a command, watches Claude work,
 * approves when asked, and judges the result by reading the screen —
 * exactly like a human engineer would.
 *
 * Usage:
 *   node src/hitestbot/tests/FlowCertificationTest.js [command]
 *
 * Examples:
 *   node src/hitestbot/tests/FlowCertificationTest.js /rtl2gds
 *   node src/hitestbot/tests/FlowCertificationTest.js "fix setup timing"
 */

import { FlowCertifier } from '../core/FlowCertifier.js';
import { ProgressTracker } from '../core/ProgressTracker.js';

const EVIDENCE_DIR = process.env.HITESTBOT_EVIDENCE_DIR || '/tmp/hipilot-test-evidence';
const COMMAND = process.argv[2] || '/rtl2gds';
const MAX_WAIT = parseInt(process.env.HITESTBOT_MAX_WAIT || '300000', 10);

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  HiTestBot v2 — Flow Certification Test          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Command:      ${COMMAND}`);
  console.log(`Evidence Dir: ${EVIDENCE_DIR}`);
  console.log(`Max Wait:     ${MAX_WAIT / 1000}s`);
  console.log('');
  console.log('HiTestBot will use HiPilot like a human:');
  console.log('  1. Launch HiPilot (bin/hipilot)');
  console.log('  2. Wait for Claude Code to be ready');
  console.log(`  3. Type "${COMMAND}"`);
  console.log('  4. Watch Claude work, approve when asked');
  console.log('  5. Read Claude\'s final report and score');
  console.log('');

  const certifier = new FlowCertifier({
    evidenceDir: EVIDENCE_DIR,
    session: process.env.HIPILOT_SESSION || 'hipilot',
  });

  console.log('Starting test...');
  console.log('');

  const result = await certifier.runTest(COMMAND, { maxWaitMs: MAX_WAIT });

  // Print summary
  const progress = result.progress;
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Command: ${COMMAND}`);
  console.log(`  Duration: ${progress.duration_s}s`);
  console.log(`  Score: ${progress.total_score?.toFixed(1)}/${progress.max_score}`);
  if (progress.blocking_stage) {
    console.log(`  Blocked: ${progress.blocking_stage} (${progress.blocking_category})`);
  }
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Print per-layer scores
  for (const sr of result.stageResults) {
    const icon = sr.status === 'pass' ? '✅' : sr.status === 'partial' ? '⚠️' : '❌';
    console.log(`  ${icon} Overall: ${sr.total_score.toFixed(1)}/5.0 (${sr.status.toUpperCase()})`);
    console.log('');
    for (const [layer, val] of Object.entries(sr.scores)) {
      const li = val.score >= 1.0 ? '✅' : val.score >= 0.5 ? '⚠️' : '❌';
      console.log(`    ${li} ${layer}: ${val.score.toFixed(1)} — ${val.detail}`);
    }
    if (sr.failure_classification) {
      console.log('');
      console.log(`    Category: ${sr.failure_classification.category}`);
      console.log(`    Summary:  ${sr.failure_classification.summary}`);
      console.log(`    Action:   ${sr.failure_classification.action}`);
    }
  }

  console.log('');
  console.log(`Report:   ${result.reportPath}`);
  console.log(`Evidence: ${result.evidenceDir}`);
  console.log('');

  // Check improvement trend
  const tracker = new ProgressTracker();
  tracker.scanDirectory(EVIDENCE_DIR);
  if (tracker.runs.length > 1) {
    console.log('Improvement Trend:');
    console.log(tracker.formatTrend());

    const graduation = tracker.checkGraduation();
    if (graduation.graduated) {
      console.log('🎉 GRADUATION CRITERIA MET — Flow certified!');
    } else {
      console.log(`Graduation: ${graduation.reason}`);
    }
  }

  const exitCode = progress.blocking_stage ? 1 : 0;
  process.exit(exitCode);
}

main().catch(err => {
  console.error('FlowCertificationTest failed:', err.message);
  process.exit(2);
});
