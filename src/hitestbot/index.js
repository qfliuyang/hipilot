#!/usr/bin/env node
/**
 * HiTestBot - HiPilot Testing Framework
 *
 * General-purpose test framework with handy tools for:
 * - E2E testing (HiPilot on EDA server)
 * - Skills testing
 * - UI element testing
 * - Custom test scenarios
 *
 * Usage:
 *   npm run hitestbot              # Run default E2E test
 *   node src/hitestbot/index.js    # Same as above
 *
 * Programmatic usage:
 *   import { E2ETestRunner, TestRunner, TestUtils } from './hitestbot/index.js';
 *
 *   // Extend TestRunner for custom tests
 *   class MyTest extends TestRunner {
 *     async execute() {
 *       await this.step('Setup', () => setup());
 *       await this.step('Test', () => test());
 *     }
 *   }
 */

import { TestRunner } from './TestRunner.js';
import { E2ETestRunner } from './E2ETestRunner.js';
import { TestReporter } from './TestReporter.js';
import { VideoRecorder } from './VideoRecorder.js';
import { TmuxController } from './TmuxController.js';
import * as TestUtils from './TestUtils.js';

export {
  TestRunner,
  E2ETestRunner,
  TestReporter,
  VideoRecorder,
  TmuxController,
  TestUtils
};

// CLI entry point - runs default E2E test
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new E2ETestRunner();
  runner.run().catch(err => {
    console.error('HiTestBot failed:', err);
    process.exit(1);
  });
}
