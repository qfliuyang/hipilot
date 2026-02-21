/**
 * Innovus Mock Helpers
 *
 * Mock responses for testing without real EDA tool
 */

/**
 * Mock Innovus timing report output
 */
export function mockTimingReport() {
  return `
**INFO:  Timing Report


Corner: func_worst
Mode: func

WNS: -0.234 ns
TNS: -45.678 ns

Setup Violations: 12
Hold Violations: 0

Path Group: reg2reg
----------------------------------------
Startpoint: reg1/CLK
Endpoint: reg2/D
Slack: -0.234

Path Type: max
----------------------------------------
`;
}

/**
 * Mock Innovus power report output
 */
export function mockPowerReport() {
  return `
**INFO:  Power Report

Total Power: 1.234 mW
Leakage Power: 0.045 mW
Dynamic Power: 1.189 mW

Cell Count: 12345
`;
}

/**
 * Mock Innovus area report output
 */
export function mockAreaReport() {
  return `
**INFO:  Area Report

Total Area: 12345.67 um^2
Utilization: 78.5%
Cell Count: 12345
`;
}

/**
 * Mock Innovus DRC report output
 */
export function mockDrcReport() {
  return `
**INFO:  DRC Report

Total Violations: 23

Breakdown:
- Short: 5
- Spacing: 12
- Width: 6
`;
}

/**
 * Mock Innovus shell prompt
 */
export function mockInnovusPrompt() {
  return 'innovus@hipilot>';
}

/**
 * Generate mock response for a command
 */
export function generateMockResponse(command) {
  if (command.includes('report_timing') || command.includes('timing')) {
    return mockTimingReport();
  }
  if (command.includes('report_power') || command.includes('power')) {
    return mockPowerReport();
  }
  if (command.includes('report_area') || command.includes('area')) {
    return mockAreaReport();
  }
  if (command.includes('check_drc') || command.includes('drc')) {
    return mockDrcReport();
  }
  return `Command executed: ${command}`;
}

/**
 * Simulate EDA tool execution
 */
export function simulateEdaExecution(tclScript) {
  const commands = tclScript
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  const responses = commands.map(cmd => ({
    command: cmd,
    output: generateMockResponse(cmd),
  }));

  return {
    commands,
    responses,
    summary: {
      commandCount: commands.length,
      hasTiming: commands.some(c => c.includes('timing')),
      hasPower: commands.some(c => c.includes('power')),
      hasDrc: commands.some(c => c.includes('drc')),
    },
  };
}

export default {
  mockTimingReport,
  mockPowerReport,
  mockAreaReport,
  mockDrcReport,
  mockInnovusPrompt,
  generateMockResponse,
  simulateEdaExecution,
};
