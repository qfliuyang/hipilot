/**
 * tools/error-analysis.js - Error diagnosis and Tcl validation tools
 *
 * Provides tools for analyzing EDA errors and validating Tcl syntax.
 */

import { analyzeError, classifyError, getFixSuggestions } from '../lib/error-analyzer.js';

/**
 * Tool definitions for error analysis tools.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'eda.diagnose_error',
    description: 'Analyze EDA error output and explain the problem with fix suggestions. Categorizes errors and provides actionable recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        output: {
          type: 'string',
          description: 'EDA error output to analyze',
        },
        tool: {
          type: 'string',
          description: 'EDA tool name (optional, auto-detected if not provided)',
          enum: ['icc2', 'innovus', 'pt_shell', 'tempus', 'auto'],
          default: 'auto',
        },
      },
      required: ['output'],
    },
  },
  {
    name: 'eda.validate_tcl',
    description: 'Validate Tcl syntax before sending to EDA. Catches common syntax errors and provides fix suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        tcl: {
          type: 'string',
          description: 'Tcl code to validate',
        },
      },
      required: ['tcl'],
    },
  },
];

/**
 * Handle eda.diagnose_error.
 */
export function handleDiagnoseError(args) {
  const { output, tool = 'auto' } = args;

  const errorPatterns = [
    { category: 'syntax', patterns: [/syntax error/i, /unknown command/i, /invalid command/i], fix: 'Check Tcl syntax and command names' },
    { category: 'constraint', patterns: [/cannot find.*clock/i, /no clock/i, /missing.*constraint/i], fix: 'Verify clocks and constraints are defined' },
    { category: 'timing', patterns: [/setup violation/i, /hold violation/i, /negative slack/i], fix: 'Review timing paths and apply fixes' },
    { category: 'drc', patterns: [/DRC violation/i, /design rule/i, /spacing/i], fix: 'Check design rules and fix violations' },
    { category: 'resource', patterns: [/out of memory/i, /license/i, /timeout/i], fix: 'Check resources, licenses, or increase timeout' },
    { category: 'data', patterns: [/file not found/i, /cannot open/i, /no such/i], fix: 'Verify file paths and data availability' },
  ];

  let diagnosis = { category: 'unknown', explanation: 'Unable to categorize error', suggested_fixes: [] };

  for (const ep of errorPatterns) {
    for (const pattern of ep.patterns) {
      const match = output.match(pattern);
      if (match) {
        diagnosis = {
          category: ep.category,
          explanation: `Detected ${ep.category} error: ${match[0]}`,
          suggested_fixes: [ep.fix]
        };
        break;
      }
    }
    if (diagnosis.category !== 'unknown') break;
  }

  let text = `🔍 **Error Diagnosis**\n\n`;
  text += `**Category:** ${diagnosis.category}\n`;
  text += `**Explanation:** ${diagnosis.explanation}\n`;
  text += `\n**Suggested Fixes:**\n`;
  for (const fix of diagnosis.suggested_fixes) {
    text += `  • ${fix}\n`;
  }
  text += `\n**Error Output:**\n${output.slice(0, 500)}`;

  return { content: [{ type: 'text', text }], _metadata: diagnosis };
}

/**
 * Handle eda.validate_tcl.
 */
export function handleValidateTcl(args) {
  const { tcl } = args;
  const errors = [];

  const lines = tcl.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    const openBrackets = (line.match(/\[/g) || []).length;
    const closeBrackets = (line.match(/\]/g) || []).length;

    if (/\bsets\b/.test(line) && !/\bset\s/.test(line)) {
      errors.push({ line: lineNum, message: 'Possible typo: "sets" instead of "set"' });
    }
  }

  const totalOpen = (tcl.match(/\{/g) || []).length;
  const totalClose = (tcl.match(/\}/g) || []).length;
  if (totalOpen !== totalClose) {
    errors.push({ line: 0, message: `Unmatched braces: ${totalOpen} open, ${totalClose} close` });
  }

  const valid = errors.length === 0;

  let text = valid
    ? `✓ **Tcl Validation Passed**\n\nNo syntax errors detected.`
    : `✗ **Tcl Validation Failed**\n\nFound ${errors.length} issue(s):\n`;

  for (const e of errors) {
    text += `  Line ${e.line}: ${e.message}\n`;
  }

  return { content: [{ type: 'text', text }], _metadata: { valid, errors } };
}

/**
 * Tool handler map for error analysis tools.
 */
export const TOOL_HANDLERS = {
  'eda.diagnose_error': handleDiagnoseError,
  'eda.validate_tcl': handleValidateTcl,
};
