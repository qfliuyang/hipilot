/**
 * tool-detection.js - EDA tool detection utilities
 *
 * Detects which EDA tool is currently running using multiple methods:
 * - Process checking (pgrep)
 * - Pane content analysis
 * - Log file checking
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { CONFIG } from '../../../src/lib/config.js';
import { buildPaneTarget } from '../../../src/lib/pane-utils.js';
import { shellEscape } from '../../../src/lib/shell-escape.js';

/**
 * Enhanced tool detection with multiple verification methods.
 * Returns tool info with confidence score (0.0-1.0).
 * @returns {object|null} Tool info or null if no tool detected
 */
export function detectTool() {
  const checks = [
    { cmd: 'pgrep -f "icc2_shell"', tool: 'ICC2', vendor: 'synopsys', version: 'T-2022.03', patterns: [/icc2_shell\s*>/i, /ICC2/i] },
    { cmd: 'pgrep -f "innovus"', tool: 'Innovus', vendor: 'cadence', version: 'v20.10', patterns: [/innovus\s*\d+\s*>/i, /Innovus/i] },
    { cmd: 'pgrep -f "pt_shell"', tool: 'PrimeTime', vendor: 'synopsys', version: 'T-2022.03', patterns: [/pt_shell\s*>/i, /PrimeTime/i] },
    { cmd: 'pgrep -f "tempus"', tool: 'Tempus', vendor: 'cadence', version: 'v20.10', patterns: [/tempus\s*\d*\s*>/i, /Tempus/i] },
    { cmd: 'pgrep -f "dc_shell"', tool: 'DesignCompiler', vendor: 'synopsys', version: 'T-2022.03', patterns: [/dc_shell\s*>/i, /Design Compiler/i] },
  ];

  let bestMatch = null;
  let highestConfidence = 0;

  for (const check of checks) {
    let confidence = 0;

    // Method 1: Process check (0.5 confidence)
    try {
      const result = execSync(check.cmd, { encoding: 'utf-8', stdio: 'pipe' });
      if (result.trim()) confidence += 0.5;
    } catch (e) {
      if (process.env.HIPILOT_DEBUG) {
        console.error(`[detectTool] Check failed: ${e.message}`);
      }
      // Process not found
      continue;
    }

    // Method 2: Pane content check (0.3 confidence)
    try {
      const paneOutput = execSync(
        `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${buildPaneTarget(CONFIG.TMUX_SESSION, 'eda')} -p -S -50 2>/dev/null || echo ""`,
        { encoding: 'utf-8', timeout: 2000 }
      );
      for (const pattern of check.patterns) {
        if (pattern.test(paneOutput)) {
          confidence += 0.3;
          break;
        }
      }
    } catch (e) {
      if (process.env.HIPILOT_DEBUG) {
        console.error(`[detectTool] Check failed: ${e.message}`);
      }
    }

    // Method 3: Log file check (0.2 confidence)
    try {
      const logPatterns = {
        'Innovus': `${process.env.HOME || '/home/EDA'}/innovus.log*`,
        'ICC2': `${process.env.HOME || '/home/EDA'}/icc2_shell.log*`,
        'PrimeTime': `${process.env.HOME || '/home/EDA'}/pt_shell.log*`,
        'DesignCompiler': `${process.env.HOME || '/home/EDA'}/dc_shell.log*`,
      };
      if (logPatterns[check.tool]) {
        // Use fs to safely find log files (avoiding shell injection)
        const logPattern = logPatterns[check.tool];
        const baseDir = (process.env.HOME || '/home/EDA');
        const baseName = logPattern.replace(baseDir + '/', '').replace('*', '');
        try {
          const files = readdirSync(baseDir);
          const matchingFiles = files.filter(f => f.startsWith(baseName));
          if (matchingFiles.length > 0) confidence += 0.2;
        } catch (e) {
          // Directory doesn't exist, skip
        }
      }
    } catch (e) {
      if (process.env.HIPILOT_DEBUG) {
        console.error(`[detectTool] Check failed: ${e.message}`);
      }
    }

    if (confidence > highestConfidence) {
      highestConfidence = confidence;
      bestMatch = {
        tool: check.tool,
        vendor: check.vendor,
        version: check.version,
        confidence: Math.min(confidence, 1.0)
      };
    }
  }

  return bestMatch;
}

/**
 * Get normalized tool name for comparison.
 * @param {string} tool - Tool name to normalize
 * @returns {string} Canonical tool name
 */
export function getToolAlias(tool) {
  const aliases = {
    'innovus': ['innovus', 'cadence', 'Innovus'],
    'dc_shell': ['dc_shell', 'dc', 'design_compiler', 'DesignCompiler'],
    'pt_shell': ['pt_shell', 'pt', 'primetime', 'PrimeTime'],
    'icc2': ['icc2', 'icc2_shell', 'ICC2'],
    'tempus': ['tempus', 'Tempus'],
  };

  const normalized = tool.toLowerCase().replace(/[-_]/g, '');
  for (const [canonical, variants] of Object.entries(aliases)) {
    for (const variant of variants) {
      if (normalized === variant.toLowerCase().replace(/[-_]/g, '')) {
        return canonical;
      }
    }
  }
  return tool;
}

/**
 * Validate that expected tool matches detected tool.
 * @param {string} expectedTool - Expected tool name
 * @param {string|object} detectedTool - Detected tool info
 * @returns {object} Validation result with valid flag and reason
 */
export function validateToolMatch(expectedTool, detectedTool) {
  if (!expectedTool || !detectedTool) return { valid: false, reason: 'missing_tool' };

  const expected = getToolAlias(expectedTool);
  const detected = getToolAlias(detectedTool.tool || detectedTool);

  const toolMap = {
    'innovus': 'physical_design',
    'icc2': 'physical_design',
    'dc_shell': 'synthesis',
    'pt_shell': 'signoff',
    'tempus': 'signoff',
  };

  if (expected === detected) {
    return { valid: true, reason: 'exact_match', confidence: detectedTool.confidence || 1.0 };
  }

  // Check if tools are in same category (e.g., innovus and icc2 are both physical design)
  if (toolMap[expected] && toolMap[detected] && toolMap[expected] === toolMap[detected]) {
    return { valid: true, reason: 'same_category', category: toolMap[expected], confidence: (detectedTool.confidence || 0.5) * 0.7 };
  }

  return {
    valid: false,
    reason: 'mismatch',
    expected: expected,
    detected: detected,
    message: `Expected ${expected} but ${detected} is running. These tools serve different purposes.`
  };
}

/**
 * Stage definitions for EDA flow validation.
 * Maps stage names to required tools, categories, and checkpoint dependencies.
 */
export const STAGE_DEFINITIONS = {
  'synthesis': {
    tool: 'dc_shell',
    category: 'Synthesis',
    next: 'init_design',
    required_checkpoints: [],
    optional_checkpoints: [],
    description: 'RTL synthesis using Design Compiler',
  },
  'compile': { tool: 'dc_shell', category: 'Synthesis', next: 'init_design' },
  'elaborate': { tool: 'dc_shell', category: 'Synthesis', next: 'init_design' },
  'init_design': {
    tool: 'innovus',
    category: 'Physical Design',
    next: 'floorplan',
    required_checkpoints: ['result/syn/data/*.v'],
    optional_checkpoints: [],
    description: 'Design initialization in Innovus',
  },
  'init': { tool: 'innovus', category: 'Physical Design', next: 'floorplan' },
  'floorplan': {
    tool: 'innovus',
    category: 'Physical Design',
    next: 'power_plan',
    required_checkpoints: ['result/pr/data/init_design.enc'],
    optional_checkpoints: [],
    description: 'Floorplanning',
  },
  'floorplanning': { tool: 'innovus', category: 'Physical Design', next: 'power_plan' },
  'power_plan': { tool: 'innovus', category: 'Physical Design', next: 'placement' },
  'powerplan': { tool: 'innovus', category: 'Physical Design', next: 'placement' },
  'placement': {
    tool: 'innovus',
    category: 'Physical Design',
    next: 'cts',
    required_checkpoints: ['result/pr/data/floor_plan.enc'],
    optional_checkpoints: ['result/pr/data/powerplan.enc'],
    description: 'Cell placement',
  },
  'place': { tool: 'innovus', category: 'Physical Design', next: 'cts' },
  'cts': {
    tool: 'innovus',
    category: 'Physical Design',
    next: 'routing',
    required_checkpoints: ['result/pr/data/placement.enc'],
    optional_checkpoints: [],
    description: 'Clock tree synthesis',
  },
  'clock_tree': { tool: 'innovus', category: 'Physical Design', next: 'routing' },
  'post_cts_opt': { tool: 'innovus', category: 'Physical Design', next: 'routing' },
  'routing': {
    tool: 'innovus',
    category: 'Physical Design',
    next: 'chip_finish',
    required_checkpoints: ['result/pr/data/cts.enc'],
    optional_checkpoints: [],
    description: 'Detailed routing',
  },
  'route': { tool: 'innovus', category: 'Physical Design', next: 'chip_finish' },
  'chip_finish': {
    tool: 'innovus',
    category: 'Physical Design',
    next: 'sta',
    required_checkpoints: ['result/pr/data/routing.enc'],
    optional_checkpoints: [],
    description: 'Chip finishing',
  },
  'sta': {
    tool: 'pt_shell',
    category: 'Signoff',
    next: null,
    required_checkpoints: ['result/pr/data/chip_done.enc'],
    optional_checkpoints: [],
    description: 'Static timing analysis',
  },
  'timing': { tool: 'pt_shell', category: 'Signoff', next: null },
};
