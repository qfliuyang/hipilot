#!/usr/bin/env node
/**
 * HiTestBot - HiPilot E2E Testing Framework
 *
 * Standardized E2E testing from requirement to evidence.
 * No manual mistakes. No cheating. Proper video evidence.
 */

const { E2ETestRunner } = require('./E2ETestRunner');
const { TestReporter } = require('./TestReporter');
const { VideoRecorder } = require('./VideoRecorder');

module.exports = {
  E2ETestRunner,
  TestReporter,
  VideoRecorder
};

// CLI entry point
if (require.main === module) {
  const runner = new E2ETestRunner();
  runner.run().catch(err => {
    console.error('HiTestBot failed:', err);
    process.exit(1);
  });
}
