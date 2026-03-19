/**
 * tools/tcl-generation.js - Tcl generation tools
 *
 * Provides eda.generate_tcl and eda.list_templates tools.
 */

import { writeFileSync } from 'fs';
import { getHipilotPaths } from '../../../src/lib/paths.js';
import { getModeStatus } from '../../../src/lib/mode.js';
import { analyzeSideEffects, generateSideEffectWarnings } from '../../../src/lib/risk-analyzer.js';
import { listTemplates, generateTcl, initializeRenderer } from '../lib/tcl-renderer.js';

// Initialize renderer (will be called from main index.js)
let PROJECT_ROOT = null;

export function initTclGeneration(projectRoot) {
  PROJECT_ROOT = projectRoot;
  initializeRenderer(projectRoot);
}

/**
 * Tool definitions for tcl-generation tools.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'eda.generate_tcl',
    description: 'Generate Tcl script from natural language intent. Uses Nunjucks templates when available (trust badge: [✓ Template]), falls back to inline generation ([⚠ Unverified]). Returns Tcl with trust badge and source attribution.',
    inputSchema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description: 'Natural language description of what to do',
        },
        tool: {
          type: 'string',
          description: 'EDA tool / vendor (icc2/synopsys, innovus/cadence, dc_shell, pt_shell, or auto to detect for P&R tools)',
          enum: ['icc2', 'innovus', 'synopsys', 'cadence', 'dc_shell', 'pt_shell', 'auto'],
        },
        operation: {
          type: 'string',
          description: 'Operation type',
          enum: [
            'fix_setup_timing', 'fix_hold_timing', 'route_design',
            'report_timing', 'report_power', 'report_area',
            'check_drc', 'run_cts', 'optimize_design',
            'read_design', 'save_design', 'compare_qor',
            'synthesis', 'signoff_timing',
          ],
        },
        targets: {
          type: 'string',
          description: 'Target path groups, instances, or parameters',
        },
        variables: {
          type: 'object',
          description: 'Template variables to override defaults (e.g., max_paths, corner, report_path)',
        },
      },
      required: ['intent', 'operation'],
    },
  },
  {
    name: 'eda.list_templates',
    description: 'List available Tcl templates organized by vendor',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Handle eda.generate_tcl tool call.
 */
export function handleGenerateTcl(args) {
  const { intent, tool, operation, targets, variables } = args;
  const result = generateTcl(intent, { tool, operation, targets, variables });

  const sideEffectAnalysis = analyzeSideEffects(result.tcl);
  const sideEffectWarnings = generateSideEffectWarnings(sideEffectAnalysis);

  const hipilotPaths = getHipilotPaths();
  const timestamp = Date.now();
  const tempFile = `${hipilotPaths.generatedDir}/hipilot_generated_${timestamp}.tcl`;
  writeFileSync(tempFile, result.tcl);

  let text = '';

  text += `## Analysis\n`;
  text += `**Intent:** ${intent || operation}\n`;
  text += `**Operation:** ${operation}\n`;
  if (tool) {
    text += `**Target Tool:** ${tool}\n`;
  }

  text += `\n## Source\n`;
  if (result.template_path) {
    text += `**Type:** Template-based (trusted)\n`;
    text += `**Template:** \`${result.template_path}\`\n`;
  } else {
    text += `**Type:** Generated (review recommended)\n`;
    text += `**Reasoning:** Built from operation mapping for ${operation}\n`;
  }

  if (sideEffectWarnings.length > 0) {
    text += `\n## Side Effects\n`;
    text += `⚠️ This operation may cause unintended side effects:\n\n`;
    for (const w of sideEffectWarnings) {
      text += `${w.icon} **${w.title}**: ${w.message}\n`;
      text += `   _${w.recommendation}_\n\n`;
    }
  }

  text += `\n## Generated Tcl\n`;
  text += `\`\`\`tcl\n${result.tcl}\n\`\`\`\n`;

  text += `\n## Actions\n`;
  text += `**Saved to:** ${tempFile}\n`;
  text += `**To execute:** Use \`eda.send_to_terminal\` or run \`source ${tempFile}\` in the EDA tool\n`;
  text += `**Mode:** ${getModeStatus().mode === 'auto' ? 'Auto (immediate)' : 'Manual (approval required)'}`;

  return {
    content: [{ type: 'text', text }],
    _metadata: {
      source: result.source,
      template_path: result.template_path,
      badge: result.badge,
      file: tempFile,
      side_effects: sideEffectAnalysis,
    }
  };
}

/**
 * Handle eda.list_templates tool call.
 */
export function handleListTemplates() {
  const templates = listTemplates();
  const synopsys = templates.filter(t => t.startsWith('synopsys/'));
  const cadence = templates.filter(t => t.startsWith('cadence/'));

  let text = 'Available Tcl Templates:\n\n';
  text += `Synopsys (ICC2): ${synopsys.length}\n`;
  synopsys.forEach(t => { text += `  ${t}\n`; });
  text += `\nCadence (Innovus): ${cadence.length}\n`;
  cadence.forEach(t => { text += `  ${t}\n`; });
  text += `\nTotal: ${templates.length} templates`;

  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Tool handler map for tcl-generation tools.
 */
export const TOOL_HANDLERS = {
  'eda.generate_tcl': handleGenerateTcl,
  'eda.list_templates': handleListTemplates,
};
