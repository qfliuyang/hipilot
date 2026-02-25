#!/usr/bin/env node
/**
 * HiTestBot v2 - Evidence-Based Testing Framework for HiPilot
 *
 * v2 Core (evidence-based):
 *   McpLogCollector    - Parse and query MCP call logs
 *   ObservationPoint   - Synchronized multi-view evidence capture
 *   StageVerifier      - 5-layer scoring per stage
 *   FlowCertifier      - Flow certification orchestrator
 *   FlowReporter       - FLOW_REPORT.md generation
 *   ProgressTracker    - Cross-run improvement tracking
 *
 * v1 Infrastructure (preserved):
 *   TestRunner, E2ETestRunner, TmuxController,
 *   VideoRecorder, TestReporter, TestUtils
 *
 * Usage:
 *   npm run hitestbot                                    # Run MCP infra test
 *   node src/hitestbot/tests/McpInfraTest.js             # MCP infrastructure
 *   node src/hitestbot/tests/FlowCertificationTest.js    # Flow certification
 */

// v2 Core
import { McpLogCollector } from './core/McpLogCollector.js';
import { ObservationPoint } from './core/ObservationPoint.js';
import { StageVerifier } from './core/StageVerifier.js';
import { FlowCertifier } from './core/FlowCertifier.js';
import { FlowReporter } from './core/FlowReporter.js';
import { ProgressTracker } from './core/ProgressTracker.js';

// v1 Infrastructure (backward compatibility)
import { TestRunner } from './infra/TestRunner.js';
import { E2ETestRunner } from './infra/E2ETestRunner.js';
import { TestReporter } from './infra/TestReporter.js';
import { VideoRecorder } from './infra/VideoRecorder.js';
import { TmuxController } from './infra/TmuxController.js';
import * as TestUtils from './infra/TestUtils.js';

export {
  // v2 Core
  McpLogCollector,
  ObservationPoint,
  StageVerifier,
  FlowCertifier,
  FlowReporter,
  ProgressTracker,
  // v1 Infrastructure
  TestRunner,
  E2ETestRunner,
  TestReporter,
  VideoRecorder,
  TmuxController,
  TestUtils,
};

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('HiTestBot v2 — Evidence-Based Testing Framework');
  console.log('');
  console.log('Tests:');
  console.log('  node src/hitestbot/tests/McpInfraTest.js             MCP infrastructure test');
  console.log('  node src/hitestbot/tests/FlowCertificationTest.js    Flow certification test');
  console.log('');
  console.log('Running MCP infrastructure test...');
  console.log('');
  import('./tests/McpInfraTest.js');
}
