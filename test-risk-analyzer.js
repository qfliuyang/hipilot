#!/usr/bin/env node
/**
 * Test script for the risk analyzer module
 */

import { analyzeRisk, generateApprovalPrompt, validateConfirmation } from './src/lib/risk-analyzer.js';

console.log('='.repeat(60));
console.log('HiPilot Risk Analyzer Test');
console.log('='.repeat(60));
console.log('');

// Test cases
const testCases = [
  {
    name: 'Safe - Report Timing',
    tcl: `
# Report timing on pcie_rx
report_timing -max_paths 10 -delay_type max -path_group pcie_rx
report_qor
`,
    expectedCategory: 0
  },
  {
    name: 'Moderate - Optimize Design',
    tcl: `
setOptMode -effort high
optDesign -postRoute -setup
route_opt
`,
    expectedCategory: 1
  },
  {
    name: 'Dangerous - Remove Clock Tree',
    tcl: `
# Clean up clock tree for re-synthesis
remove_clock_tree -all
remove_clock_latency -all
`,
    expectedCategory: 2
  },
  {
    name: 'Critical - Remove Design',
    tcl: `
# Remove entire design
remove_design -all
`,
    expectedCategory: 3
  },
  {
    name: 'Mixed - Safe with Dangerous',
    tcl: `
report_timing -max_paths 10
remove_clock_tree -all
report_qor
`,
    expectedCategory: 2  // Should be the max category
  }
];

// Run tests
let passed = 0;
let failed = 0;

for (const test of testCases) {
  console.log(`\nTest: ${test.name}`);
  console.log('-'.repeat(40));

  const result = analyzeRisk(test.tcl);

  console.log(`Category: ${result.category} (${result.label})`);
  console.log(`Color: ${result.color}`);
  console.log(`Time: ${result.estimated_time_display}`);
  console.log(`Requires Confirmation: ${result.requires_confirmation}`);

  if (result.dangerous_commands.length > 0) {
    console.log(`Dangerous Commands: ${result.dangerous_commands.join(', ')}`);
  }
  if (result.critical_commands.length > 0) {
    console.log(`Critical Commands: ${result.critical_commands.join(', ')}`);
  }

  if (result.category === test.expectedCategory) {
    console.log('✓ PASSED');
    passed++;
  } else {
    console.log(`✗ FAILED - Expected category ${test.expectedCategory}, got ${result.category}`);
    failed++;
  }
}

console.log('\n' + '='.repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

// Test confirmation validation
console.log('\n\nTesting Confirmation Validation:');
console.log('-'.repeat(40));

// Safe operation
const safeResult = analyzeRisk('report_timing');
console.log('\nSafe operation - user says "yes":');
const safeConfirm = validateConfirmation('yes', safeResult);
console.log(`  Valid: ${safeConfirm.valid}, Message: ${safeConfirm.message}`);

// Dangerous operation
const dangerResult = analyzeRisk('remove_clock_tree -all');
console.log('\nDangerous operation - user says "yes":');
const dangerWrong = validateConfirmation('yes', dangerResult);
console.log(`  Valid: ${dangerWrong.valid}, Message: ${dangerWrong.message}`);

console.log('\nDangerous operation - user says "CONFIRM":');
const dangerRight = validateConfirmation('CONFIRM', dangerResult);
console.log(`  Valid: ${dangerRight.valid}, Message: ${dangerRight.message}`);

// Critical operation
const criticalResult = analyzeRisk('remove_design -all');
console.log('\nCritical operation - user says "CONFIRM":');
const criticalWrong = validateConfirmation('CONFIRM', criticalResult);
console.log(`  Valid: ${criticalWrong.valid}, Message: ${criticalWrong.message}`);
if (criticalWrong.hint) {
  console.log(`  Hint: ${criticalWrong.hint}`);
}

console.log('\nCritical operation - user says full phrase:');
const criticalRight = validateConfirmation('I UNDERSTAND THE RISKS AND WANT TO PROCEED', criticalResult);
console.log(`  Valid: ${criticalRight.valid}, Message: ${criticalRight.message}`);

// Show example approval prompt
console.log('\n\nExample Approval Prompt (Dangerous):');
console.log('='.repeat(60));
const prompt = generateApprovalPrompt(dangerResult, 'remove_clock_tree -all\nremove_clock_latency -all');
console.log(prompt);

console.log('\nAll tests completed!');
