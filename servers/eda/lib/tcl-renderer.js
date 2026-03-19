/**
 * tcl-renderer.js - Tcl template rendering and generation
 *
 * Handles Nunjucks template rendering and inline Tcl generation.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import nunjucks from 'nunjucks';
import { getHipilotPaths } from '../../../src/lib/paths.js';
import { detectTool } from './tool-detection.js';

// Configure nunjucks (will be initialized with templates dir)
let nunjucksEnv = null;
let TEMPLATES_DIR = null;
let PROJECT_ROOT = null;

/**
 * Initialize the renderer with paths.
 * @param {string} projectRoot - Project root directory
 */
export function initializeRenderer(projectRoot) {
  PROJECT_ROOT = projectRoot;
  TEMPLATES_DIR = join(projectRoot, 'templates');
  nunjucksEnv = nunjucks.configure(TEMPLATES_DIR, {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
    noCache: true,
  });
}

/**
 * List available Tcl templates.
 * @returns {string[]} Array of template paths
 */
export function listTemplates() {
  if (!existsSync(TEMPLATES_DIR)) return [];

  const { readdirSync } = require('fs');
  const templates = [];
  const walk = (dir) => {
    const files = readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = join(dir, file.name);
      if (file.isDirectory()) {
        walk(fullPath);
      } else if (file.name.endsWith('.tcl') || file.name.endsWith('.tcl.j2')) {
        if (file.name === '.gitkeep') continue;
        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (content.trim().length === 0) continue;
        } catch { continue; }
        templates.push(fullPath.replace(TEMPLATES_DIR + '/', ''));
      }
    }
  };
  walk(TEMPLATES_DIR);
  return templates;
}

/**
 * Resolve vendor/tool to template directory and prefix.
 * @param {string} tool - Tool name (icc2, innovus, dc_shell, pt_shell, auto)
 * @returns {object} { dir: vendorDir, prefix: templatePrefix }
 */
export function resolveVendor(tool) {
  if (!tool || tool === 'auto') {
    const detected = detectTool();
    if (detected) {
      if (detected.tool === 'ICC2') return { dir: detected.vendor, prefix: 'icc2' };
      if (detected.tool === 'Innovus') return { dir: detected.vendor, prefix: 'innovus' };
      if (detected.tool === 'PrimeTime') return { dir: 'synopsys', prefix: 'pt' };
    }
    return { dir: 'synopsys', prefix: 'icc2' }; // default
  }

  if (tool === 'dc_shell' || tool === 'dc') return { dir: 'synopsys', prefix: 'dc' };
  if (tool === 'pt_shell' || tool === 'pt') return { dir: 'synopsys', prefix: 'pt' };
  if (tool === 'icc2' || tool === 'synopsys') return { dir: 'synopsys', prefix: 'icc2' };
  if (tool === 'innovus' || tool === 'cadence') return { dir: 'cadence', prefix: 'innovus' };
  return { dir: 'synopsys', prefix: 'icc2' };
}

/**
 * Generate Tcl from intent - uses Nunjucks template rendering when available.
 * @param {string} intent - Natural language intent
 * @param {object} params - Parameters { tool, operation, targets, variables }
 * @returns {object} { tcl, source, badge, template_path?, reasoning? }
 */
export function generateTcl(intent, params) {
  const { tool, operation, targets, variables } = params;
  const { dir: vendorDir, prefix } = resolveVendor(tool);
  const templateName = `${prefix}_${operation}.tcl`;
  const templatePath = join(TEMPLATES_DIR, vendorDir, templateName);

  const hipilotPaths = getHipilotPaths();

  // Build template context with defaults and user overrides
  const context = {
    intent: intent,
    tool: prefix,
    vendor: vendorDir,
    targets: targets || '*',
    max_paths: 10,
    corner: 'func_worst',
    report_path: `${hipilotPaths.baseDir}/hipilot_${operation}_${Date.now()}.rpt`,
    ...(variables || {}),
  };

  // Try template-based rendering
  if (existsSync(templatePath)) {
    const rawTemplate = readFileSync(templatePath, 'utf-8');
    if (rawTemplate.trim().length > 0) {
      let rendered;
      try {
        // Render with Nunjucks if template has {{ }} markers
        if (rawTemplate.includes('{{') || rawTemplate.includes('{%')) {
          rendered = nunjucksEnv.renderString(rawTemplate, context);
        } else {
          // Plain Tcl template - use as-is
          rendered = rawTemplate;
        }
      } catch (err) {
        // Nunjucks rendering failed - return raw template
        rendered = rawTemplate;
        console.error(`Template render warning: ${err.message}`);
      }

      return {
        tcl: rendered,
        source: 'template',
        badge: '[✓ Template]',
        template_path: `${vendorDir}/${templateName}`,
        template_name: templateName,
      };
    }
  }

  // Fallback: generate inline Tcl with reasoning
  let tcl = '';
  tcl += `# HiPilot Auto-Generated Tcl\n`;
  tcl += `# Intent: ${intent}\n`;
  tcl += `# Tool: ${prefix} (${vendorDir})\n`;
  tcl += `# [⚠ Unverified] No matching template found\n`;
  tcl += `# Please review carefully before executing\n\n`;

  switch (operation) {
    case 'fix_setup_timing':
      if (prefix === 'innovus') {
        tcl += `setOptMode -effort high\n`;
        tcl += `optDesign -postRoute -setup\n`;
      } else {
        tcl += `fix_eco_timing -type setup\n`;
      }
      tcl += `report_timing -max_paths ${context.max_paths} -delay_type max\n`;
      break;

    case 'fix_hold_timing':
      if (prefix === 'innovus') {
        tcl += `setOptMode -holdFixing all\n`;
        tcl += `optDesign -postRoute -hold\n`;
      } else {
        tcl += `fix_eco_timing -type hold\n`;
      }
      break;

    case 'report_timing':
      if (prefix === 'innovus') {
        tcl += `report_timing -max_paths ${context.max_paths} -late\n`;
        tcl += `report_analysis_summary\n`;
      } else {
        tcl += `report_timing -max_paths ${context.max_paths} -delay_type max -input_pins -nets -transition_time -capacitance -significant_digits 4\n`;
        tcl += `report_qor\n`;
      }
      break;

    case 'report_power':
      if (prefix === 'innovus') {
        tcl += `report_power -outfile ${context.report_path}\n`;
      } else {
        tcl += `report_power -analysis_effort high\n`;
      }
      break;

    case 'report_area':
      if (prefix === 'innovus') {
        tcl += `report_area\n`;
        tcl += `summaryReport\n`;
      } else {
        tcl += `report_design -physical\n`;
      }
      break;

    case 'check_drc':
      if (prefix === 'innovus') {
        tcl += `verify_drc\n`;
        tcl += `verify_connectivity\n`;
      } else {
        tcl += `check_routes\n`;
        tcl += `report_design -drc_violations\n`;
      }
      break;

    case 'read_design':
      if (prefix === 'innovus') {
        tcl += `# restoreDesign <design_dir> <top_cell>\n`;
        tcl += `restoreDesign ${context.targets}\n`;
      } else {
        tcl += `# open_lib <library> ; open_block <block>\n`;
        tcl += `open_lib ${context.targets}\n`;
      }
      break;

    case 'save_design':
      if (prefix === 'innovus') {
        tcl += `saveDesign ${context.targets || 'checkpoint'}\n`;
      } else {
        tcl += `save_block -as ${context.targets || 'checkpoint'}\n`;
      }
      break;

    case 'route_design':
      if (prefix === 'innovus') {
        tcl += `setNanoRouteMode -drouteEndIteration 10\n`;
        tcl += `routeDesign -globalDetail\n`;
        tcl += `verify_drc\n`;
      } else {
        tcl += `route_auto\n`;
        tcl += `check_routes\n`;
      }
      break;

    case 'run_cts':
      if (prefix === 'innovus') {
        tcl += `setCTSMode -engine ckSynthesis\n`;
        tcl += `clockDesign -specFile Clock.ctstch\n`;
      } else {
        tcl += `synthesize_clock_trees\n`;
        tcl += `report_clock_timing -type summary\n`;
      }
      break;

    case 'optimize_design':
      if (prefix === 'innovus') {
        tcl += `setOptMode -effort high\n`;
        tcl += `optDesign -postRoute\n`;
      } else {
        tcl += `route_opt\n`;
      }
      break;

    case 'compare_qor':
      tcl += `# Compare QoR between runs\n`;
      tcl += `# Baseline: ${context.targets || 'previous'}\n`;
      if (prefix === 'innovus') {
        tcl += `report_timing -late > ${hipilotPaths.baseDir}/hipilot_current_timing.rpt\n`;
        tcl += `report_power > ${hipilotPaths.baseDir}/hipilot_current_power.rpt\n`;
      } else {
        tcl += `report_timing -max_paths 100 > ${hipilotPaths.baseDir}/hipilot_current_timing.rpt\n`;
        tcl += `report_power > ${hipilotPaths.baseDir}/hipilot_current_power.rpt\n`;
        tcl += `report_qor > ${hipilotPaths.baseDir}/hipilot_current_qor.rpt\n`;
      }
      break;

    default:
      tcl += `# Operation: ${operation}\n`;
      if (targets) tcl += `set targets "${targets}"\n`;
      tcl += `# TODO: No template for '${operation}' - please specify manually\n`;
  }

  return {
    tcl,
    source: 'generated',
    badge: '[⚠ Unverified]',
    reasoning: `No template found for ${operation} (${vendorDir}/${templateName}). Generated inline Tcl - please review before executing.`,
  };
}
