/**
 * tools/qor.js - QoR extraction and tool detection utilities
 *
 * Provides tools for extracting Quality of Results metrics and detecting EDA tools.
 */

import { existsSync, readFileSync } from 'fs';
import { detectTool } from '../lib/tool-detection.js';
import { extractQoR } from '../lib/qor-parser.js';

/**
 * Tool definitions for QoR tools.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'eda.extract_qor',
    description: 'Extract QoR metrics (WNS, TNS, violations, power, area, utilization) from EDA report text or file',
    inputSchema: {
      type: 'object',
      properties: {
        report_content: {
          type: 'string',
          description: 'Report text content',
        },
        report_path: {
          type: 'string',
          description: 'Path to report file (alternative to report_content)',
        },
      },
    },
  },
  {
    name: 'eda.detect_tool',
    description: 'Detect which EDA tool is currently running (ICC2, Innovus, PrimeTime, Tempus)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Handle eda.extract_qor.
 */
export function handleExtractQoR(args) {
  let reportContent = args.report_content;
  if (args.report_path) {
    if (!existsSync(args.report_path)) {
      throw new Error(`Report file not found: ${args.report_path}`);
    }
    reportContent = readFileSync(args.report_path, 'utf-8');
  }
  if (!reportContent) {
    throw new Error('Either report_path or report_content must be provided');
  }

  const metrics = extractQoR(reportContent);
  const nonNull = Object.entries(metrics).filter(([, v]) => v !== null && v !== 0);
  let summary = 'QoR Metrics:\n';
  for (const [key, val] of nonNull) {
    summary += `  ${key}: ${val}\n`;
  }
  if (nonNull.length === 0) {
    summary += '  (no metrics extracted - check report format)\n';
  }

  return {
    content: [{
      type: 'text',
      text: summary + '\nFull data:\n' + JSON.stringify(metrics, null, 2),
    }],
  };
}

/**
 * Handle eda.detect_tool.
 */
export function handleDetectTool() {
  const detected = detectTool();

  return {
    content: [{
      type: 'text',
      text: detected
        ? `Detected EDA Tool: ${detected.tool} ${detected.version} (${detected.vendor})`
        : 'No EDA tool detected running. Start icc2_shell, innovus, or pt_shell in the EDA pane.',
    }],
  };
}

/**
 * Tool handler map for QoR tools.
 */
export const TOOL_HANDLERS = {
  'eda.extract_qor': handleExtractQoR,
  'eda.detect_tool': handleDetectTool,
};
