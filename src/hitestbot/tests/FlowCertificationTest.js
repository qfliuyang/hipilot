#!/usr/bin/env node
/**
 * FlowCertificationTest - Main v2 test for RTL-to-GDS flow certification
 *
 * Tests the complete pipeline: Claude Code → MCP tools → Workflow Engine → EDA
 * Produces FLOW_REPORT.md with 5-layer scoring per stage.
 *
 * Usage:
 *   node src/hitestbot/tests/FlowCertificationTest.js [workflow_name]
 *
 * Examples:
 *   node src/hitestbot/tests/FlowCertificationTest.js rtl2gds
 *   node src/hitestbot/tests/FlowCertificationTest.js fix_setup_timing
 */

import { FlowCertifier } from '../core/FlowCertifier.js';
import { ProgressTracker } from '../core/ProgressTracker.js';

const EVIDENCE_DIR = process.env.HITESTBOT_EVIDENCE_DIR || '/tmp/hipilot-test-evidence';
const WORKFLOW = process.argv[2] || 'fix_setup_timing';

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  HiTestBot v2 — Flow Certification Test          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Workflow:     ${WORKFLOW}`);
  console.log(`Evidence Dir: ${EVIDENCE_DIR}`);
  console.log('');

  const certifier = new FlowCertifier({
    evidenceDir: EVIDENCE_DIR,
    session: process.env.HIPILOT_SESSION || 'hipilot',
  });

  console.log('Running flow certification...');
  console.log('');

  const result = await certifier.certifyWorkflow(WORKFLOW);

  // Print summary
  const progress = result.progress;
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Flow: ${progress.test_name}`);
  console.log(`  Progress: ${progress.completed_stages}/${progress.total_stages} (${progress.progress_pct}%)`);
  console.log(`  Score: ${progress.total_score?.toFixed(1)}/${progress.max_score}`);
  if (progress.blocking_stage) {
    console.log(`  Blocked: ${progress.blocking_stage} (${progress.blocking_category})`);
  }
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Print per-stage results
  for (const sr of result.stageResults) {
    const icon = sr.status === 'pass' ? '✅' : sr.status === 'partial' ? '⚠️' : '❌';
    const layers = Object.values(sr.scores).map(s => s.score.toFixed(1)).join(' ');
    console.log(`  ${icon} ${sr.stage.padEnd(25)} ${sr.total_score.toFixed(1)}/5.0  [${layers}]`);
    if (sr.failure_classification) {
      console.log(`     └─ ${sr.failure_classification.category}: ${sr.failure_classification.summary.slice(0, 70)}`);
    }
  }

  console.log('');
  console.log(`Report: ${result.reportPath}`);
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
      console.log('🎉 GRADUATION CRITERIA MET — RTL-to-GDS flow certified!');
    } else {
      console.log(`Graduation: ${graduation.reason}`);
    }
  }

  // Exit with appropriate code
  const exitCode = progress.blocking_stage ? 1 : 0;
  process.exit(exitCode);
}

main().catch(err => {
  console.error('FlowCertificationTest failed:', err.message);
  process.exit(2);
});
