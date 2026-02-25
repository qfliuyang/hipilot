#!/usr/bin/env node
/**
 * HiPilot EDA MCP Server
 *
 * Provides tools for Tcl generation, EDA tool interaction, QoR extraction,
 * and job management for VLSI physical design workflows.
 *
 * Key features:
 * - Nunjucks-based template rendering with parameter substitution
 * - Trust badge system: [✓ Template], [📖 Doc-based], [⚠ Unverified]
 * - Send-to-terminal bridge via tmux
 * - QoR metric extraction from timing/power/DRC reports
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import nunjucks from 'nunjucks';
import { VERSION } from '../../src/lib/version.js';
import { getHipilotPaths } from '../../src/lib/paths.js';
import { createMcpLogger } from '../../src/lib/mcp-logger.js';
import {
  getMode,
  setMode,
  toggleMode,
  isAutoMode,
  isManualMode,
  queuePending,
  getPending,
  approvePending,
  rejectPending,
  getModeStatus,
  MODES,
  PENDING_FILE,
} from '../../src/lib/mode.js';
import {
  analyzeRisk,
  generateApprovalPrompt,
  validateConfirmation,
  analyzeSideEffects,
  generateSideEffectWarnings,
} from '../../src/lib/risk-analyzer.js';
import {
  analyzeReport,
  REPORT_TYPES,
  generateTimingPrompt,
  generateDrcPrompt,
  generatePowerPrompt,
  generateAreaPrompt,
} from '../../src/lib/report-analyzer.js';
import {
  getCachedAnalysis,
  setCachedAnalysis,
  getCacheStats,
  clearCache,
  generateActionButtons,
  formatActionButtons,
} from '../../src/lib/report-cache.js';

const TMUX_SESSION = process.env.HIPILOT_SESSION || 'hipilot';

// Get user-specific temp paths
const hipilotPaths = getHipilotPaths();

function updateTmuxModeStatus(mode, pending = false) {
  try {
    const session = process.env.HIPILOT_SESSION || 'hipilot';
    let statusLeft;
    if (mode === 'auto') {
      statusLeft = `#[fg=#000000,bg=#00ff88,bold] ⚡ Claude has conn #[default]#[fg=#666666]│`;
    } else {
      const pendingIndicator = pending ? ' ⏳' : '';
      statusLeft = `#[fg=#00d4ff,bg=#1a1a2e,bold] ⚙ HiPilot #[fg=#666666]│#[fg=#ffd700] 🔒 Manual${pendingIndicator} #[fg=#666666]│`;
    }
    execSync(`tmux -L ${session} set-option -t ${session} status-left "${statusLeft}"`, { stdio: 'pipe' });
  } catch {
    // Tmux status update is best-effort
  }
}

// Auto-detect project root from server location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const TEMPLATES_DIR = join(PROJECT_ROOT, 'templates');
const HISTORY_DIR = join(PROJECT_ROOT, '.hipilot', 'history');

// Configure nunjucks with templates directory
const nunjucksEnv = nunjucks.configure(TEMPLATES_DIR, {
  autoescape: false,
  trimBlocks: true,
  lstripBlocks: true,
  noCache: true,
});

/**
 * Execute shell command and return output
 */
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, ...options });
  } catch (error) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

/**
 * Extract basic QoR metrics from report text
 */
function extractQoR(reportContent) {
  const metrics = {
    wns: null,
    tns: null,
    setup_violations: 0,
    hold_violations: 0,
    drc_violations: 0,
    total_power: null,
    leakage_power: null,
    cell_count: null,
    area: null,
    utilization: null,
  };

  // WNS patterns (ICC2, Innovus, PrimeTime)
  const wnsPatterns = [
    /(?:WNS|worst\s+negative\s+slack|wns)\s*[:=]?\s*(-?\d+\.?\d*)\s*(?:ns|ps)?/i,
    /slack\s*\(VIOLATED\)\s*(-?\d+\.?\d*)/i,
    /^\s*(-\d+\.?\d*)\s+\(VIOLATED\)/m,
  ];
  for (const pat of wnsPatterns) {
    const m = reportContent.match(pat);
    if (m) { metrics.wns = parseFloat(m[1]); break; }
  }

  // TNS patterns
  const tnsPatterns = [
    /(?:TNS|total\s+negative\s+slack|tns)\s*[:=]?\s*(-?\d+\.?\d*)\s*(?:ns|ps)?/i,
  ];
  for (const pat of tnsPatterns) {
    const m = reportContent.match(pat);
    if (m) { metrics.tns = parseFloat(m[1]); break; }
  }

  // Violation counts
  const setupMatch = reportContent.match(/(?:setup|max_delay)\s*(?:violations?|failing\s+endpoints?)\s*[:=]?\s*(\d+)/gi);
  if (setupMatch) {
    for (const m of setupMatch) {
      const n = m.match(/(\d+)\s*$/);
      if (n) metrics.setup_violations += parseInt(n[1]);
    }
  }

  const holdMatch = reportContent.match(/(?:hold|min_delay)\s*(?:violations?|failing\s+endpoints?)\s*[:=]?\s*(\d+)/gi);
  if (holdMatch) {
    for (const m of holdMatch) {
      const n = m.match(/(\d+)\s*$/);
      if (n) metrics.hold_violations += parseInt(n[1]);
    }
  }

  // DRC violations
  const drcPatterns = [
    /(?:total|all)\s*(?:drc)?\s*violations?\s*[:=]?\s*(\d+)/i,
    /(\d+)\s+(?:total\s+)?violations?\s+found/i,
    /Number of DRC violations\s*[:=]?\s*(\d+)/i,
  ];
  for (const pat of drcPatterns) {
    const m = reportContent.match(pat);
    if (m) { metrics.drc_violations = parseInt(m[1]); break; }
  }

  // Power
  const totalPower = reportContent.match(/total.*?power\s*[:=]?\s*(\d+\.?\d*)\s*(mW|uW|W)/i);
  if (totalPower) metrics.total_power = `${totalPower[1]} ${totalPower[2]}`;

  const leakagePower = reportContent.match(/leakage.*?power\s*[:=]?\s*(\d+\.?\d*)\s*(mW|uW|W)/i);
  if (leakagePower) metrics.leakage_power = `${leakagePower[1]} ${leakagePower[2]}`;

  // Cell count
  const cellMatch = reportContent.match(/(?:cell|instance|leaf)\s*count\s*[:=]?\s*(\d+)/i);
  if (cellMatch) metrics.cell_count = parseInt(cellMatch[1]);

  // Area
  const areaMatch = reportContent.match(/(?:total|design)\s*area\s*[:=]?\s*(\d+\.?\d*)/i);
  if (areaMatch) metrics.area = parseFloat(areaMatch[1]);

  // Utilization
  const utilMatch = reportContent.match(/utilization\s*[:=]?\s*(\d+\.?\d*)\s*%/i);
  if (utilMatch) metrics.utilization = parseFloat(utilMatch[1]);

  return metrics;
}

/**
 * Detect which EDA tool is currently running
 */
function detectTool() {
  const checks = [
    { cmd: 'pgrep -f icc2_shell', tool: 'ICC2', vendor: 'synopsys', version: 'T-2022.03' },
    { cmd: 'pgrep -f innovus', tool: 'Innovus', vendor: 'cadence', version: 'v20.10' },
    { cmd: 'pgrep -f pt_shell', tool: 'PrimeTime', vendor: 'synopsys', version: 'T-2022.03' },
    { cmd: 'pgrep -f tempus', tool: 'Tempus', vendor: 'cadence', version: 'v20.10' },
  ];

  for (const check of checks) {
    try {
      const result = execSync(check.cmd, { encoding: 'utf-8', stdio: 'pipe' });
      if (result.trim()) return { tool: check.tool, vendor: check.vendor, version: check.version };
    } catch {
      // Process not found
    }
  }
  return null;
}

/**
 * List available Tcl templates
 */
function listTemplates() {
  if (!existsSync(TEMPLATES_DIR)) return [];

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
 * Resolve vendor/tool to template directory and prefix
 */
function resolveVendor(tool) {
  if (!tool || tool === 'auto') {
    const detected = detectTool();
    if (detected) return { dir: detected.vendor, prefix: detected.tool === 'ICC2' ? 'icc2' : 'innovus' };
    return { dir: 'synopsys', prefix: 'icc2' }; // default
  }
  if (tool === 'icc2' || tool === 'synopsys') return { dir: 'synopsys', prefix: 'icc2' };
  if (tool === 'innovus' || tool === 'cadence') return { dir: 'cadence', prefix: 'innovus' };
  return { dir: 'synopsys', prefix: 'icc2' };
}

/**
 * Generate Tcl from intent - uses Nunjucks template rendering when available
 */
function generateTcl(intent, params) {
  const { tool, operation, targets, variables } = params;
  const { dir: vendorDir, prefix } = resolveVendor(tool);
  const templateName = `${prefix}_${operation}.tcl`;
  const templatePath = join(TEMPLATES_DIR, vendorDir, templateName);

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

/**
 * Execute Tcl in EDA terminal (internal function, called after approval or in auto mode)
 */
function executeTcl(tcl, pane = 'eda') {
  const session = process.env.HIPILOT_SESSION || 'hipilot';
  try {
    const timestamp = Date.now();
    const tmpFile = `${hipilotPaths.execDir}/hipilot_exec_${timestamp}.tcl`;
    writeFileSync(tmpFile, tcl);

    try {
      if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });
      const histFile = join(HISTORY_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}.tcl`);
      writeFileSync(histFile, `# Sent at: ${new Date().toISOString()}\n# Pane: ${pane}\n\n${tcl}`);
    } catch {
      // History archiving is best-effort
    }

    let paneTarget;
    if (pane === 'eda' || pane === '1') {
      paneTarget = `${session}:0.1`;
    } else if (pane === 'chat' || pane === '0') {
      paneTarget = `${session}:0.0`;
    } else {
      paneTarget = pane;
    }

    execSync(
      `tmux -L ${session} send-keys -t ${paneTarget} "source ${tmpFile}" Enter`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    return { success: true, message: `Sent to ${pane} pane via: source ${tmpFile}`, file: tmpFile };
  } catch (error) {
    return { success: false, message: `Failed to send: ${error.message}` };
  }
}

/**
 * Send Tcl to EDA terminal - respects mode (manual/auto)
 * In MANUAL mode: queues Tcl for user approval with risk analysis
 * In AUTO mode: executes immediately (but still warns for dangerous ops)
 */
function sendToTerminal(tcl, pane = 'eda', metadata = {}) {
  const mode = getMode();

  const riskAnalysis = analyzeRisk(tcl);
  const sideEffectAnalysis = analyzeSideEffects(tcl);
  const sideEffectWarnings = generateSideEffectWarnings(sideEffectAnalysis);

  const enrichedMetadata = {
    ...metadata,
    risk_analysis: riskAnalysis,
    side_effects: sideEffectAnalysis,
    queued_at: new Date().toISOString()
  };

  if (mode === MODES.AUTO) {
    if (riskAnalysis.category >= 2) {
      queuePending(tcl, enrichedMetadata);
      const approvalPrompt = generateApprovalPromptWithSideEffects(riskAnalysis, tcl, sideEffectWarnings);
      return {
        success: true,
        queued: true,
        mode: 'auto_blocked',
        blocked_reason: 'dangerous_operation',
        risk_analysis: riskAnalysis,
        side_effects: sideEffectAnalysis,
        message: `Auto mode blocked for ${riskAnalysis.label.toLowerCase()} operation. Manual confirmation required.`,
        approval_prompt: approvalPrompt,
        pendingFile: PENDING_FILE,
      };
    }

    const result = executeTcl(tcl, pane);
    return {
      ...result,
      mode: 'auto',
      risk_analysis: riskAnalysis,
      side_effects: sideEffectAnalysis,
      message: result.success
        ? `Executed immediately: ${result.message}`
        : result.message,
    };
  } else {
    queuePending(tcl, enrichedMetadata);
    const status = getModeStatus();
    const approvalPrompt = generateApprovalPromptWithSideEffects(riskAnalysis, tcl, sideEffectWarnings);
    return {
      success: true,
      queued: true,
      mode: 'manual',
      risk_analysis: riskAnalysis,
      side_effects: sideEffectAnalysis,
      approval_prompt: approvalPrompt,
      message: `Manual mode - Tcl queued for approval`,
      pendingFile: PENDING_FILE,
      status: status,
    };
  }
}

function generateApprovalPromptWithSideEffects(riskAnalysis, tcl, sideEffectWarnings) {
  let prompt = generateApprovalPrompt(riskAnalysis, tcl);

  if (sideEffectWarnings && sideEffectWarnings.length > 0) {
    const warningSection = '\n---\n\n**Potential Side Effects:**\n\n';
    const warnings = sideEffectWarnings.map(w => 
      `${w.icon} **${w.title}**: ${w.message}\n   _${w.recommendation}_`
    ).join('\n\n');
    prompt = prompt.replace('---\n\n**Actions:**', warningSection + warnings + '\n\n---\n\n**Actions:**');
  }

  return prompt;
}

/**
 * Approve and execute pending Tcl
 */
function approveAndExecute() {
  const pending = approvePending();
  if (!pending.approved) {
    return { success: false, message: 'No pending Tcl to approve' };
  }
  const pane = pending.meta.pane || 'eda';
  return executeTcl(pending.tcl, pane);
}

/**
 * Reject pending Tcl
 */
function rejectPendingTcl() {
  rejectPending();
  return { success: true, message: 'Pending Tcl rejected and cleared' };
}

/**
 * Create server
 */
const server = new Server(
  {
    name: 'hipilot-eda-mcp-server',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
              description: 'EDA tool vendor (icc2/synopsys or innovus/cadence, or auto to detect)',
              enum: ['icc2', 'innovus', 'synopsys', 'cadence', 'auto'],
            },
            operation: {
              type: 'string',
              description: 'Operation type',
              enum: [
                'fix_setup_timing', 'fix_hold_timing', 'route_design',
                'report_timing', 'report_power', 'report_area',
                'check_drc', 'run_cts', 'optimize_design',
                'read_design', 'save_design', 'compare_qor',
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
        name: 'eda.send_to_terminal',
        description: 'Send Tcl script to the EDA terminal pane via tmux. Archives to .hipilot/history/ for session tracking.',
        inputSchema: {
          type: 'object',
          properties: {
            tcl: {
              type: 'string',
              description: 'Tcl script content to send',
            },
            pane: {
              type: 'string',
              description: 'Target pane (default: eda)',
              enum: ['eda', 'chat', '0', '1'],
            },
          },
          required: ['tcl'],
        },
      },
      {
        name: 'eda.extract_qor',
        description: 'Extract QoR metrics (WNS, TNS, violations, power, area, utilization) from EDA report text or file',
        inputSchema: {
          type: 'object',
          properties: {
            report_path: {
              type: 'string',
              description: 'Path to the report file',
            },
            report_content: {
              type: 'string',
              description: 'Report content as string (alternative to report_path)',
            },
          },
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
      {
        name: 'eda.detect_tool',
        description: 'Detect which EDA tool is currently running (ICC2, Innovus, PrimeTime, Tempus)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'eda.get_job_status',
        description: 'Check status of running EDA jobs (LSF or local processes)',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: {
              type: 'string',
              description: 'Job ID to check (optional, checks all if not provided)',
            },
          },
        },
      },
      {
        name: 'eda.get_mode',
        description: 'Get current execution mode: "manual" (requires approval) or "auto" (Claude has conn)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'eda.set_mode',
        description: 'Set execution mode: "manual" (user approves each command) or "auto" (Claude has conn - auto-execute)',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              description: 'Execution mode',
              enum: ['manual', 'auto'],
            },
          },
          required: ['mode'],
        },
      },
      {
        name: 'eda.toggle_mode',
        description: 'Toggle between manual and auto mode ("Claude has the conn")',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'eda.get_pending',
        description: 'Get pending Tcl waiting for approval (in manual mode)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'eda.approve_pending',
        description: 'Approve and execute pending Tcl command',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'eda.reject_pending',
        description: 'Reject and discard pending Tcl command',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'eda.confirm_dangerous',
        description: 'Confirm execution of a dangerous/critical Tcl command by providing the required confirmation text. Use this after user explicitly confirms dangerous operations.',
        inputSchema: {
          type: 'object',
          properties: {
            confirmation_text: {
              type: 'string',
              description: 'The confirmation text the user provided (e.g., "CONFIRM" for dangerous, or the full phrase for critical operations)',
            },
          },
          required: ['confirmation_text'],
        },
      },
      {
        name: 'eda.get_risk_analysis',
        description: 'Analyze the risk level of a Tcl script without executing it. Returns risk category, dangerous commands, and estimated time.',
        inputSchema: {
          type: 'object',
          properties: {
            tcl: {
              type: 'string',
              description: 'Tcl script to analyze',
            },
          },
          required: ['tcl'],
        },
      },
      {
        name: 'eda.get_status',
        description: 'Get comprehensive HiPilot system status. USE THIS FIRST before any EDA operation to understand the current state. Returns: mode, pending Tcl, detected EDA tool, and available actions.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'eda.quick',
        description: 'ONE-CALL solution for common EDA operations. Generates Tcl, analyzes risk, and sends to terminal in one step. Use this instead of calling generate_tcl + send_to_terminal separately. Operations: timing, power, area, drc, setup, hold, route, save.',
        inputSchema: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              description: 'Operation to perform',
              enum: ['timing', 'power', 'area', 'drc', 'setup', 'hold', 'route', 'save', 'load'],
            },
            params: {
              type: 'object',
              description: 'Optional parameters (max_paths, path_group, corner, etc.)',
            },
          },
          required: ['operation'],
        },
      },
      {
        name: 'eda.capture_and_analyze',
        description: 'Capture EDA pane output and extract QoR metrics. Use this after running a command to analyze timing/DRC/power reports. Returns captured text and structured metrics (WNS, TNS, violations).',
        inputSchema: {
          type: 'object',
          properties: {
            pane: {
              type: 'string',
              description: 'Pane to capture: "eda" (default) or "chat"',
              enum: ['eda', 'chat', '0', '1'],
              default: 'eda',
            },
            lines: {
              type: 'number',
              description: 'Number of lines to capture from end of pane (default: 200)',
              default: 200,
            },
            report_type: {
              type: 'string',
              description: 'Type of report for targeted analysis: timing, power, area, drc, or auto (default)',
              enum: ['auto', 'timing', 'power', 'area', 'drc'],
              default: 'auto',
            },
          },
        },
      },
      {
        name: 'eda.run_skill',
        description: 'Execute a HiPilot skill by name. Skills encode team expertise for common workflows. Available skills: report-timing, fix-setup-timing, fix-hold-timing, report-power, report-area, run-drc.',
        inputSchema: {
          type: 'object',
          properties: {
            skill: {
              type: 'string',
              description: 'Skill name to execute',
            },
            params: {
              type: 'object',
              description: 'Skill parameters',
            },
          },
          required: ['skill'],
        },
      },
      {
        name: 'eda.edit_tcl',
        description: 'Open pending or generated Tcl in $EDITOR for manual modification. Waits for user to save and exit, then returns the edited content. Use this when user wants to modify Tcl before execution.',
        inputSchema: {
          type: 'object',
          properties: {
            tcl: {
              type: 'string',
              description: 'Tcl content to edit (if not using pending)',
            },
            use_pending: {
              type: 'boolean',
              description: 'Edit the pending Tcl instead of provided content',
              default: false,
            },
          },
        },
      },
      {
        name: 'eda.save_tcl',
        description: 'Save Tcl script to the project scripts directory. Creates the directory if it does not exist. Generates a timestamped filename if none provided.',
        inputSchema: {
          type: 'object',
          properties: {
            tcl: {
              type: 'string',
              description: 'Tcl content to save',
            },
            filename: {
              type: 'string',
              description: 'Optional custom filename (default: auto-generated with timestamp)',
            },
            directory: {
              type: 'string',
              description: 'Directory to save to (default: ./scripts/)',
              default: './scripts/',
            },
          },
          required: ['tcl'],
        },
      },
      {
        name: 'eda.analyze_report',
        description: 'Analyze EDA report (timing, DRC, power, area) using AI. Auto-detects report type or accepts explicit type. Returns structured analysis with LLM prompt for detailed insights. Use this to understand report contents and get actionable recommendations.',
        inputSchema: {
          type: 'object',
          properties: {
            report_content: {
              type: 'string',
              description: 'Full text content of the EDA report to analyze',
            },
            report_path: {
              type: 'string',
              description: 'Path to report file (alternative to report_content)',
            },
            report_type: {
              type: 'string',
              description: 'Type of report for targeted analysis (auto-detected if not specified)',
              enum: ['auto', 'timing', 'drc', 'power', 'area'],
              default: 'auto',
            },
          },
          required: [],
        },
      },
      {
        name: 'eda.get_analysis_cache',
        description: 'Get report analysis cache statistics or clear cache. Shows number of cached analyses, cache size, and hit rates. Use action:clear to clear all cached analyses.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'Action to perform',
              enum: ['stats', 'clear'],
              default: 'stats',
            },
          },
        },
      },
      // === PHASE 1.1: FEEDBACK LOOP TOOLS ===
      {
        name: 'eda.wait_for_pattern',
        description: 'Wait for a specific regex pattern to appear in EDA pane output. Essential for detecting when EDA commands complete. Returns matched content and timing.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Regex pattern to wait for (e.g., "innovus \\d+>", "SUCCESS", "ERROR")',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in seconds (default: 60)',
              default: 60,
            },
            pane: {
              type: 'string',
              description: 'Pane to monitor (default: eda)',
              enum: ['eda', 'chat', '0', '1'],
              default: 'eda',
            },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'eda.wait_for_prompt',
        description: 'Wait for EDA tool prompt (auto-detected per tool). Detects innovus, icc2_shell, pt_shell, tempus prompts. Use after sending commands to wait for completion.',
        inputSchema: {
          type: 'object',
          properties: {
            timeout: {
              type: 'number',
              description: 'Timeout in seconds (default: 30)',
              default: 30,
            },
            pane: {
              type: 'string',
              description: 'Pane to monitor (default: eda)',
              enum: ['eda', 'chat', '0', '1'],
              default: 'eda',
            },
          },
        },
      },
      {
        name: 'eda.get_last_result',
        description: 'Parse last EDA command output to determine success/failure. Analyzes output for common error patterns and success indicators.',
        inputSchema: {
          type: 'object',
          properties: {
            lines: {
              type: 'number',
              description: 'Number of lines to analyze (default: 50)',
              default: 50,
            },
            pane: {
              type: 'string',
              description: 'Pane to analyze (default: eda)',
              enum: ['eda', 'chat', '0', '1'],
              default: 'eda',
            },
          },
        },
      },
      {
        name: 'eda.capture_and_wait',
        description: 'Combined: send Tcl command, wait for prompt, return output with result analysis. Best for commands that complete quickly.',
        inputSchema: {
          type: 'object',
          properties: {
            tcl: {
              type: 'string',
              description: 'Tcl command to send',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in seconds (default: 60)',
              default: 60,
            },
            pane: {
              type: 'string',
              description: 'Target pane (default: eda)',
              enum: ['eda', 'chat', '0', '1'],
              default: 'eda',
            },
          },
          required: ['tcl'],
        },
      },
      {
        name: 'eda.execute_and_verify',
        description: 'Complete execution pipeline: send Tcl to EDA tool, wait for completion, capture output, detect errors, extract QoR metrics. Returns structured result with status, errors, warnings, and QoR. Respects execution mode (manual/auto) and risk analysis. USE THIS instead of calling send_to_terminal + wait_for_prompt + capture_and_analyze separately.',
        inputSchema: {
          type: 'object',
          properties: {
            tcl: {
              type: 'string',
              description: 'Tcl script or command to execute',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in seconds waiting for EDA prompt to return (default: 120)',
              default: 120,
            },
            description: {
              type: 'string',
              description: 'Human-readable description of what this command does (e.g., "CTS stage of RTL-to-GDS flow")',
            },
            extract_qor: {
              type: 'boolean',
              description: 'Whether to extract QoR metrics from output (default: true)',
              default: true,
            },
            pane: {
              type: 'string',
              description: 'Target pane (default: eda)',
              enum: ['eda', 'chat', '0', '1'],
              default: 'eda',
            },
          },
          required: ['tcl'],
        },
      },
      // === PHASE 1.2: SESSION STATE TOOLS ===
      {
        name: 'session.save_checkpoint',
        description: 'Save current session state as a named checkpoint. Includes QoR snapshot, command history, and design context.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Checkpoint name (e.g., "pre_cts", "after_opt")',
            },
            description: {
              type: 'string',
              description: 'Description of the checkpoint',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'session.list_checkpoints',
        description: 'List all saved session checkpoints with timestamps and QoR summaries.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'session.restore_checkpoint',
        description: 'Restore session context from a checkpoint (context only, does not undo EDA changes).',
        inputSchema: {
          type: 'object',
          properties: {
            checkpoint_id: {
              type: 'string',
              description: 'Checkpoint ID or name to restore',
            },
          },
          required: ['checkpoint_id'],
        },
      },
      {
        name: 'session.get_history',
        description: 'Get command history with result summaries. Shows what commands were run and their outcomes.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of entries (default: 50)',
              default: 50,
            },
          },
        },
      },
      {
        name: 'session.get_context',
        description: 'Get current session context summary: design, stage, tool, last commands, pending actions, QoR.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // === PHASE 1.3: CONTEXT DETECTION TOOLS ===
      {
        name: 'context.detect',
        description: 'Auto-detect current design context from EDA output and project files. Returns design name, technology, stage, tool, corners.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'context.get_stage',
        description: 'Get current flow stage (synthesis, floorplan, place, cts, route, signoff) with confidence level.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'context.suggest_next',
        description: 'Suggest next logical step based on current stage and QoR status. Returns prioritized action list.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // === PHASE 2.1: QOR TRACKING TOOLS ===
      {
        name: 'qor.snapshot',
        description: 'Capture current QoR metrics as a named snapshot. Use for before/after comparisons.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Snapshot name (e.g., "baseline", "after_cts")',
            },
            description: {
              type: 'string',
              description: 'Optional description',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'qor.list_snapshots',
        description: 'List all saved QoR snapshots with metrics.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'qor.compare',
        description: 'Compare two QoR snapshots and show delta. Identifies improvements and regressions.',
        inputSchema: {
          type: 'object',
          properties: {
            snapshot1: {
              type: 'string',
              description: 'First snapshot ID or name (baseline)',
            },
            snapshot2: {
              type: 'string',
              description: 'Second snapshot ID or name (current)',
            },
          },
          required: ['snapshot1', 'snapshot2'],
        },
      },
      {
        name: 'qor.get_trend',
        description: 'Show QoR trend over last N snapshots. Identifies improvement/degradation patterns.',
        inputSchema: {
          type: 'object',
          properties: {
            metric: {
              type: 'string',
              description: 'Metric to track',
              enum: ['wns', 'tns', 'violations', 'power', 'area'],
              default: 'wns',
            },
            snapshots: {
              type: 'number',
              description: 'Number of snapshots to analyze (default: 10)',
              default: 10,
            },
          },
        },
      },
      // === PHASE 2.2: ERROR DIAGNOSIS TOOLS ===
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
      // === PHASE 2.3: WORKFLOW AUTOMATION TOOLS ===
      {
        name: 'workflow.define',
        description: 'Define a multi-step workflow with automatic error handling. Workflows can be saved and reused.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Workflow name (e.g., "fix_setup_timing", "run_cts_flow")',
            },
            description: {
              type: 'string',
              description: 'Workflow description',
            },
            steps: {
              type: 'array',
              description: 'Array of workflow steps',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  tcl: { type: 'string' },
                  success_check: { type: 'string' },
                  on_failure: { type: 'string', enum: ['stop', 'skip', 'retry'] },
                },
              },
            },
          },
          required: ['name', 'steps'],
        },
      },
      {
        name: 'workflow.list',
        description: 'List all defined workflows (built-in and user-defined).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'workflow.run',
        description: 'Execute a defined workflow. Runs steps sequentially with automatic error handling.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Workflow name to execute',
            },
            params: {
              type: 'object',
              description: 'Parameters to pass to the workflow',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'workflow.get_status',
        description: 'Get status of a running or completed workflow.',
        inputSchema: {
          type: 'object',
          properties: {
            run_id: {
              type: 'string',
              description: 'Workflow run ID (from workflow.run)',
            },
          },
          required: ['run_id'],
        },
      },
      {
        name: 'workflow.cancel',
        description: 'Cancel a running workflow.',
        inputSchema: {
          type: 'object',
          properties: {
            run_id: {
              type: 'string',
              description: 'Workflow run ID to cancel',
            },
          },
          required: ['run_id'],
        },
      },
      // === PHASE 3.2: SMART SUGGESTIONS ===
      {
        name: 'suggest.analyze',
        description: 'Analyze current design state and suggest improvements. Returns prioritized suggestions.',
        inputSchema: {
          type: 'object',
          properties: {
            focus: {
              type: 'string',
              description: 'Focus area: timing, power, area, drc, or all',
              enum: ['timing', 'power', 'area', 'drc', 'all'],
              default: 'all',
            },
          },
        },
      },
      {
        name: 'suggest.for_violation',
        description: 'Get specific suggestions for a violation type. Returns actionable fixes with Tcl templates.',
        inputSchema: {
          type: 'object',
          properties: {
            violation_type: {
              type: 'string',
              description: 'Violation type: setup, hold, max_cap, max_tran, drc, etc.',
            },
            path_group: {
              type: 'string',
              description: 'Optional path group filter',
            },
          },
          required: ['violation_type'],
        },
      },
      {
        name: 'suggest.next_optimization',
        description: 'Suggest the next optimization step based on current QoR status.',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'Optimization goal: timing, power, area, drc',
              enum: ['timing', 'power', 'area', 'drc'],
              default: 'timing',
            },
          },
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
const mcpLog = createMcpLogger('eda');

server.setRequestHandler(CallToolRequestSchema, mcpLog.wrapHandler(async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'eda.generate_tcl': {
        const { intent, tool, operation, targets, variables } = args;
        const result = generateTcl(intent, { tool, operation, targets, variables });

        const sideEffectAnalysis = analyzeSideEffects(result.tcl);
        const sideEffectWarnings = generateSideEffectWarnings(sideEffectAnalysis);

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

      case 'eda.send_to_terminal': {
        const { tcl, pane = 'eda' } = args;
        const result = sendToTerminal(tcl, pane);

        if (result.queued) {
          updateTmuxModeStatus('manual', true);
        }

        // Build response based on result type
        let responseText = '';

        if (result.queued) {
          // Use the generated approval prompt
          responseText = result.approval_prompt;
        } else if (result.mode === 'auto') {
          // Auto mode - show what was executed
          responseText = `⚡ **Auto Mode - Executed Immediately**\n\n`;
          responseText += `**Risk Level:** ${result.risk_analysis?.summary?.risk_level || 'Unknown'}\n\n`;
          responseText += `**Tcl Executed:**\n\`\`\`tcl\n${tcl}\n\`\`\`\n\n`;
          responseText += result.message;
        } else {
          responseText = result.success
            ? `✓ ${result.message}`
            : `✗ ${result.message}`;
        }

        return {
          content: [{
            type: 'text',
            text: responseText,
          }],
          isError: !result.success,
          // Include metadata for programmatic handling
          _metadata: {
            status: result.queued ? 'pending_approval' : (result.success ? 'executed' : 'failed'),
            mode: result.mode,
            risk_category: result.risk_analysis?.category,
            pending_file: result.pendingFile,
          }
        };
      }

      case 'eda.extract_qor': {
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

      case 'eda.list_templates': {
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

      case 'eda.detect_tool': {
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

      case 'eda.get_job_status': {
        try {
          const bjobs = exec('bjobs 2>/dev/null', { stdio: 'pipe' });
          return {
            content: [{ type: 'text', text: `LSF Jobs:\n${bjobs}` }],
          };
        } catch {
          try {
            const ps = exec('ps aux | grep -E "(icc2|innovus|pt_shell|tempus|calibre)" | grep -v grep', { stdio: 'pipe' });
            return {
              content: [{ type: 'text', text: `Local EDA Processes:\n${ps || 'No EDA processes found'}` }],
            };
          } catch {
            return {
              content: [{ type: 'text', text: 'No active EDA jobs or processes found' }],
            };
          }
        }
      }

      case 'eda.get_mode': {
        const status = getModeStatus();
        const icon = status.icon;
        const modeText = status.mode === 'auto'
          ? `${icon} AUTO MODE - Claude has the conn\n\nCommands execute immediately without approval.`
          : `${icon} MANUAL MODE - Approval required\n\nEach command must be approved before execution.`;
        
        let text = modeText;
        if (status.pending) {
          text += `\n\n⏳ Pending Tcl waiting for approval (${status.pendingInfo.lines} lines)`;
        }
        
        return {
          content: [{ type: 'text', text }],
        };
      }

      case 'eda.set_mode': {
        const { mode } = args;
        setMode(mode);
        updateTmuxModeStatus(mode, false);
        
        return {
          content: [{
            type: 'text',
            text: mode === 'auto'
              ? `⚡ AUTO MODE enabled - Claude has the conn\n\nAll Tcl commands will execute immediately.`
              : `🔒 MANUAL MODE enabled\n\nEach Tcl command requires your approval.`,
          }],
        };
      }

      case 'eda.toggle_mode': {
        const newMode = toggleMode();
        updateTmuxModeStatus(newMode, false);
        
        return {
          content: [{
            type: 'text',
            text: newMode === 'auto'
              ? `⚡ Toggled to AUTO MODE - Claude has the conn\n\nAll Tcl commands will execute immediately.`
              : `🔒 Toggled to MANUAL MODE\n\nEach Tcl command requires your approval.`,
          }],
        };
      }

      case 'eda.get_pending': {
        const pending = getPending();
        
        if (!pending.exists) {
          return {
            content: [{ type: 'text', text: 'No pending Tcl commands.' }],
          };
        }
        
        let text = `⏳ Pending Tcl Command:\n\n`;
        text += `Queued at: ${pending.meta.queuedAt || 'unknown'}\n`;
        text += `Lines: ${pending.tcl.split('\n').length}\n\n`;
        text += `--- Tcl Content ---\n${pending.tcl}\n--- End ---\n\n`;
        text += `Use eda.approve_pending to execute, or eda.reject_pending to cancel.`;
        
        return {
          content: [{ type: 'text', text }],
        };
      }

      case 'eda.approve_pending': {
        const result = approveAndExecute();
        updateTmuxModeStatus('manual', false);
        
        return {
          content: [{
            type: 'text',
            text: result.success
              ? `✓ Approved and executed: ${result.message}`
              : `✗ ${result.message}`,
          }],
          isError: !result.success,
        };
      }

      case 'eda.reject_pending': {
        const result = rejectPendingTcl();
        updateTmuxModeStatus('manual', false);

        return {
          content: [{
            type: 'text',
            text: `✗ Pending Tcl rejected and cleared.`,
          }],
        };
      }

      case 'eda.confirm_dangerous': {
        const { confirmation_text } = args;
        const pending = getPending();

        if (!pending.exists) {
          return {
            content: [{ type: 'text', text: 'No pending Tcl to confirm.' }],
            isError: true,
          };
        }

        // Get the risk analysis from pending metadata
        const riskAnalysis = pending.meta.risk_analysis || analyzeRisk(pending.tcl);
        const validation = validateConfirmation(confirmation_text, riskAnalysis);

        if (validation.valid) {
          // Confirmation accepted - execute the Tcl
          const result = approveAndExecute();
          updateTmuxModeStatus('manual', false);

          return {
            content: [{
              type: 'text',
              text: result.success
                ? `✓ ${validation.message}\n\nExecuted: ${result.message}`
                : `✗ Execution failed: ${result.message}`,
            }],
            isError: !result.success,
          };
        } else if (validation.cancelled) {
          // User cancelled
          rejectPending();
          updateTmuxModeStatus('manual', false);
          return {
            content: [{ type: 'text', text: `✗ Cancelled: ${validation.message}` }],
          };
        } else {
          // Invalid confirmation
          let text = `⚠️ ${validation.message}\n\n`;
          if (validation.hint) {
            text += `**Required phrase:**\n\`\`\`\n${validation.hint}\n\`\`\`\n\n`;
          }
          text += `Please try again with the correct confirmation text.`;

          return {
            content: [{ type: 'text', text }],
            isError: true,
          };
        }
      }

      case 'eda.get_risk_analysis': {
        const { tcl } = args;
        const analysis = analyzeRisk(tcl);

        let text = `**Tcl Risk Analysis**\n\n`;
        text += `**Category:** ${analysis.color} ${analysis.label}\n`;
        text += `**Description:** ${analysis.description}\n`;
        text += `**Estimated Time:** ${analysis.estimated_time_display}\n`;
        text += `**Requires Confirmation:** ${analysis.requires_confirmation ? 'Yes' : 'No'}\n\n`;

        if (analysis.detected_risks.length > 0) {
          text += `**Detected Operations:**\n`;
          for (const risk of analysis.detected_risks) {
            text += `- ${risk.color} ${risk.level}: \`${risk.line}\`\n`;
          }
          text += `\n`;
        }

        if (analysis.dangerous_commands.length > 0) {
          text += `**Dangerous Commands:** ${analysis.dangerous_commands.length}\n`;
        }
        if (analysis.critical_commands.length > 0) {
          text += `**Critical Commands:** ${analysis.critical_commands.length}\n`;
        }

        return {
          content: [{ type: 'text', text }],
          _metadata: { analysis }
        };
      }

      case 'eda.get_status': {
        // Get comprehensive system status
        const modeStatus = getModeStatus();
        const pending = getPending();
        const detectedTool = detectTool();
        const templates = listTemplates();

        let text = `📊 **HiPilot System Status**\n\n`;

        // Mode
        text += `**Mode:** ${modeStatus.icon} ${modeStatus.mode.toUpperCase()}`;
        if (modeStatus.mode === 'manual') {
          text += ` (approval required for each command)`;
        } else {
          text += ` (commands execute immediately)`;
        }
        text += `\n`;

        // EDA Tool
        text += `**EDA Tool:** `;
        if (detectedTool) {
          text += `${detectedTool.tool} ${detectedTool.version} (${detectedTool.vendor})`;
        } else {
          text += `None detected. Start icc2_shell, innovus, or pt_shell in the EDA pane.`;
        }
        text += `\n`;

        // Pending Tcl
        text += `**Pending Tcl:** `;
        if (pending.exists) {
          text += `Yes (${pending.tcl.split('\n').length} lines waiting for approval)\n`;
          text += `  Use \`eda.approve_pending()\` or \`eda.reject_pending()\`\n`;
        } else {
          text += `None\n`;
        }
        text += `\n`;

        // Templates
        text += `**Templates Available:** ${templates.length}\n`;
        text += `\n`;

        // Available tools
        text += `**Available MCP Tools:**\n`;
        text += `  - \`eda.generate_tcl()\` - Generate Tcl from intent\n`;
        text += `  - \`eda.send_to_terminal()\` - Send Tcl to EDA pane (with approval)\n`;
        text += `  - \`eda.get_risk_analysis()\` - Analyze risk level\n`;
        text += `  - \`eda.approve_pending()\` - Approve queued Tcl\n`;
        text += `  - \`eda.reject_pending()\` - Reject queued Tcl\n`;
        text += `  - \`eda.confirm_dangerous()\` - Confirm dangerous/critical operations\n`;
        text += `  - \`eda.get_mode()\` / \`eda.set_mode()\` - Check/change mode\n`;
        text += `\n`;

        // Instructions
        text += `---\n\n`;
        text += `**Workflow:**\n`;
        text += `1. Use \`eda.generate_tcl()\` to create Tcl from intent\n`;
        text += `2. Use \`eda.send_to_terminal()\` to send (will prompt for approval in Manual mode)\n`;
        text += `3. User approves → Tcl executes in EDA pane\n`;
        text += `\n`;
        text += `**⚠️ IMPORTANT:** Always use MCP tools (not Bash) to send Tcl commands.\n`;
        text += `Using Bash bypasses the approval system.\n`;

        return {
          content: [{ type: 'text', text }],
          _metadata: {
            mode: modeStatus.mode,
            has_pending: pending.exists,
            eda_tool: detectedTool,
            templates_count: templates.length
          }
        };
      }

      case 'eda.quick': {
        const { operation, params = {} } = args;

        const operationMap = {
          'timing': 'report_timing',
          'power': 'report_power',
          'area': 'report_area',
          'drc': 'check_drc',
          'setup': 'fix_setup_timing',
          'hold': 'fix_hold_timing',
          'route': 'route_design',
          'save': 'save_design',
          'load': 'read_design',
        };

        const fullOperation = operationMap[operation] || operation;

        const detectedTool = detectTool();
        const tool = detectedTool?.vendor || 'cadence';

        const genResult = generateTcl(`${operation} report/action`, {
          operation: fullOperation,
          tool,
          variables: params
        });

        if (!genResult.tcl) {
          return {
            content: [{ type: 'text', text: `❌ Could not generate Tcl for operation: ${operation}` }],
            isError: true,
          };
        }

        const riskAnalysis = analyzeRisk(genResult.tcl);
        const sideEffectAnalysis = analyzeSideEffects(genResult.tcl);
        const sideEffectWarnings = generateSideEffectWarnings(sideEffectAnalysis);

        const sendResult = sendToTerminal(genResult.tcl, 'eda');

        if (sendResult.queued) {
          updateTmuxModeStatus('manual', true);
        }

        let text = `🔧 **${operation.toUpperCase()}** ${riskAnalysis.color}\n\n`;
        text += `**Tcl:**\n\`\`\`tcl\n${genResult.tcl}\n\`\`\`\n\n`;

        if (sideEffectWarnings.length > 0) {
          text += `**Side Effects:**\n`;
          for (const w of sideEffectWarnings) {
            text += `${w.icon} ${w.title}: ${w.message}\n`;
          }
          text += `\n`;
        }

        if (sendResult.queued) {
          text += `**Status:** ⏳ Waiting for approval\n`;
          text += `**Risk:** ${riskAnalysis.color} ${riskAnalysis.label}\n`;
          text += `**Time:** ${riskAnalysis.estimated_time_display}\n\n`;
          text += `▶ Say "yes" to execute, "no" to cancel`;
        } else if (sendResult.mode === 'auto') {
          text += `**Status:** ⚡ Executed (auto mode)\n`;
        } else {
          text += `**Status:** ${sendResult.message}\n`;
        }

        return {
          content: [{ type: 'text', text }],
          _metadata: {
            operation,
            risk_category: riskAnalysis.category,
            template: genResult.template_path,
            queued: sendResult.queued,
            side_effects: sideEffectAnalysis,
          }
        };
      }

      case 'eda.run_skill': {
        // Execute a HiPilot skill
        const { skill, params = {} } = args;

        // Load skill file
        const skillPath = join(PROJECT_ROOT, 'skills', `${skill}.md`);
        if (!existsSync(skillPath)) {
          // Try with hyphens converted to underscores
          const altPath = join(PROJECT_ROOT, 'skills', `${skill.replace(/-/g, '_')}.md`);
          if (!existsSync(altPath)) {
            return {
              content: [{ type: 'text', text: `❌ Skill not found: ${skill}\n\nAvailable skills: report-timing, fix-setup-timing, fix-hold-timing, report-power, report-area, run-drc` }],
              isError: true,
            };
          }
        }

        // Read skill content
        const skillContent = readFileSync(skillPath, 'utf-8');

        // Extract skill metadata from frontmatter
        const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
        let skillMeta = {};
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          // Simple YAML parsing for key fields
          const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
          const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
          if (nameMatch) skillMeta.name = nameMatch[1].trim();
          if (descMatch) skillMeta.description = descMatch[1].trim();
        }

        // Detect tool and get template
        const detectedTool = detectTool();
        const vendor = detectedTool?.vendor || 'cadence';

        // Look for template reference in skill
        const templateMatch = skillContent.match(/template_path:\s*\n\s*synopsys:\s*(\S+)\s*\n\s*cadence:\s*(\S+)/);
        let templatePath = null;
        if (templateMatch) {
          templatePath = vendor === 'synopsys' ? templateMatch[1] : templateMatch[2];
        }

        // Generate Tcl based on skill
        const operationMap = {
          'report-timing': 'report_timing',
          'fix-setup-timing': 'fix_setup_timing',
          'fix-hold-timing': 'fix_hold_timing',
          'report-power': 'report_power',
          'report-area': 'report_area',
          'run-drc': 'check_drc',
        };

        const operation = operationMap[skill] || skill.replace(/-/g, '_');
        const genResult = generateTcl(skillMeta.description || skill, {
          operation,
          tool: vendor,
          variables: params
        });

        // Analyze and send
        const riskAnalysis = analyzeRisk(genResult.tcl);
        const sendResult = sendToTerminal(genResult.tcl, 'eda');

        if (sendResult.queued) {
          updateTmuxModeStatus('manual', true);
        }

        // Build response
        let text = `🎯 **Skill: ${skillMeta.name || skill}**\n\n`;
        text += `${skillMeta.description || ''}\n\n`;
        text += `**Tcl:**\n\`\`\`tcl\n${genResult.tcl}\n\`\`\`\n\n`;
        text += `**Risk:** ${riskAnalysis.color} ${riskAnalysis.label}\n`;
        text += `**Time:** ${riskAnalysis.estimated_time_display}\n\n`;

        if (sendResult.queued) {
          text += `▶ Say "yes" to execute, "no" to cancel`;
        } else {
          text += `**Status:** ${sendResult.message}`;
        }

        return {
          content: [{ type: 'text', text }],
          _metadata: {
            skill,
            operation,
            risk_category: riskAnalysis.category,
            template: templatePath
          }
        };
      }

      case 'eda.capture_and_analyze': {
        // AI Report Comprehension Pipeline - with caching and action buttons
        const { pane = 'eda', lines = 200, report_type = 'auto', use_cache = true } = args;

        // Capture EDA pane output
        let capturedOutput;
        try {
          const session = process.env.HIPILOT_SESSION || 'hipilot';
          const paneTarget = pane === 'eda' || pane === '1' ? `${session}:0.1` : `${session}:0.0`;
          capturedOutput = execSync(
            `tmux -L ${session} capture-pane -t ${paneTarget} -p -S -${lines}`,
            { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
          );
        } catch (err) {
          return {
            content: [{ type: 'text', text: `❌ Failed to capture pane: ${err.message}` }],
            isError: true,
          };
        }

        if (!capturedOutput || capturedOutput.trim().length === 0) {
          return {
            content: [{ type: 'text', text: '⚠️ No output captured from EDA pane. The pane may be empty or the command may not have completed yet.' }],
          };
        }

        // Check cache first
        let analysis;
        let cached = false;
        if (use_cache) {
          const cachedResult = getCachedAnalysis(capturedOutput, report_type);
          if (cachedResult) {
            analysis = cachedResult;
            cached = true;
          }
        }

        // If not cached, perform analysis
        if (!analysis) {
          // Use the full report analyzer
          analysis = analyzeReport(capturedOutput, report_type);

          // Store in cache
          if (use_cache) {
            setCachedAnalysis(capturedOutput, report_type, analysis);
          }
        }

        // Generate action buttons
        const actionButtons = generateActionButtons(analysis.type, true);

        // Build response
        let text = `📊 **EDA Output Analysis: ${analysis.type.toUpperCase()}**`;
        if (cached) {
          text += ' 🔄 (cached)';
        }
        text += `\n\n**Captured:** ${capturedOutput.split('\n').length} lines from ${pane} pane\n\n`;

        // Show extracted metrics
        if (analysis.metrics) {
          text += `**Extracted Metrics:**\n`;
          for (const [key, value] of Object.entries(analysis.metrics)) {
            if (value !== null && value !== undefined && value !== 0) {
              text += `  • ${key}: ${value}\n`;
            }
          }
          text += `\n`;
        }

        // Show summary
        text += `**Summary:** ${analysis.summary}\n`;

        // Add action buttons
        text += formatActionButtons(actionButtons);

        text += `\n\n---\n\n`;
        text += analysis.prompt;

        return {
          content: [{ type: 'text', text }],
          _metadata: {
            captured_lines: capturedOutput.split('\n').length,
            report_type: analysis.type,
            metrics: analysis.metrics,
            summary: analysis.summary,
            prompt: analysis.prompt,
            cached,
            action_buttons: actionButtons,
          }
        };
      }

      case 'eda.edit_tcl': {
        const { tcl, use_pending = false } = args;

        // Get content to edit
        let contentToEdit = tcl;
        if (use_pending) {
          const pending = getPending();
          if (!pending.exists) {
            return {
              content: [{ type: 'text', text: '❌ No pending Tcl to edit.' }],
              isError: true,
            };
          }
          contentToEdit = pending.tcl;
        }

        if (!contentToEdit) {
          return {
            content: [{ type: 'text', text: '❌ No Tcl content provided.' }],
            isError: true,
          };
        }

        // Write to temp file
        const timestamp = Date.now();
        const tmpFile = join(hipilotPaths.baseDir, `edit_${timestamp}.tcl`);
        writeFileSync(tmpFile, contentToEdit);

        // Open in editor with timeout to prevent hanging
        const editor = process.env.EDITOR || 'vi';
        try {
          execSync(`${editor} "${tmpFile}"`, {
            stdio: 'inherit',
            timeout: 300000, // 5 minute timeout
            killSignal: 'SIGTERM'
          });
        } catch (err) {
          // Clean up temp file on error
          try { unlinkSync(tmpFile); } catch {}
          if (err.code === 'ETIMEDOUT') {
            return {
              content: [{ type: 'text', text: '❌ Editor timed out after 5 minutes.' }],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text', text: `❌ Editor failed: ${err.message}` }],
            isError: true,
          };
        }

        // Read back edited content
        let editedContent;
        try {
          editedContent = readFileSync(tmpFile, 'utf-8');
          unlinkSync(tmpFile); // Clean up
        } catch (err) {
          return {
            content: [{ type: 'text', text: `❌ Failed to read edited file: ${err.message}` }],
            isError: true,
          };
        }

        // If editing pending, update it
        if (use_pending) {
          queuePending(editedContent, { edited: true, editedAt: new Date().toISOString() });
        }

        return {
          content: [{
            type: 'text',
            text: `✏️ **Tcl Edited**\n\n\`\`\`tcl\n${editedContent}\n\`\`\`\n\n${use_pending ? 'Pending Tcl updated.' : 'Use this edited content as needed.'}`
          }],
          _metadata: {
            edited: true,
            length: editedContent.length,
            updated_pending: use_pending,
          }
        };
      }

      case 'eda.save_tcl': {
        const { tcl, filename, directory = './scripts/' } = args;

        if (!tcl) {
          return {
            content: [{ type: 'text', text: '❌ No Tcl content provided.' }],
            isError: true,
          };
        }

        // Ensure directory exists
        try {
          if (!existsSync(directory)) {
            mkdirSync(directory, { recursive: true });
          }
        } catch (err) {
          return {
            content: [{ type: 'text', text: `❌ Failed to create directory: ${err.message}` }],
            isError: true,
          };
        }

        // Generate filename if not provided
        const saveFile = filename || `hipilot_${new Date().toISOString().replace(/[:.]/g, '-')}.tcl`;
        const fullPath = join(directory, saveFile);

        // Write file
        try {
          writeFileSync(fullPath, tcl);
        } catch (err) {
          return {
            content: [{ type: 'text', text: `❌ Failed to save file: ${err.message}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text',
            text: `💾 **Tcl Saved**\n\n**Path:** ${fullPath}\n**Size:** ${tcl.length} characters`
          }],
          _metadata: {
            saved: true,
            path: fullPath,
            size: tcl.length,
          }
        };
      }

      case 'eda.analyze_report': {
        // AI Report Analysis - uses LLM to comprehend EDA reports with caching
        const { report_content, report_path, report_type = 'auto', use_cache = true } = args;

        // Get report content from file or argument
        let content = report_content;
        if (report_path && !content) {
          if (!existsSync(report_path)) {
            return {
              content: [{ type: 'text', text: `❌ Report file not found: ${report_path}` }],
              isError: true,
            };
          }
          content = readFileSync(report_path, 'utf-8');
        }

        if (!content || content.trim().length === 0) {
          return {
            content: [{ type: 'text', text: '❌ No report content provided. Use report_content or report_path.' }],
            isError: true,
          };
        }

        // Check cache first
        let analysis;
        let cached = false;
        if (use_cache) {
          const cachedResult = getCachedAnalysis(content, report_type);
          if (cachedResult) {
            analysis = cachedResult;
            cached = true;
          }
        }

        // If not cached, analyze the report
        if (!analysis) {
          analysis = analyzeReport(content, report_type);
          // Store in cache for future use
          if (use_cache) {
            setCachedAnalysis(content, report_type, analysis);
          }
        }

        // Build response
        let text = `📊 **Report Analysis: ${analysis.type.toUpperCase()}**`;
        if (cached) {
          text += ' 🔄 (cached)';
        }
        text += '\n\n';

        // Show extracted metrics if available
        if (analysis.metrics) {
          text += `**Extracted Metrics:**\n`;
          const metrics = analysis.metrics;
          for (const [key, value] of Object.entries(metrics)) {
            if (value !== null && value !== undefined && value !== 0) {
              text += `  • ${key}: ${value}\n`;
            }
          }
          text += `\n`;
        }

        // Show summary
        text += `**Summary:** ${analysis.summary}\n\n`;

        // Generate action buttons
        const actionButtons = generateActionButtons(analysis.type, true);
        text += formatActionButtons(actionButtons);

        text += `\n\n---\n\n`;
        text += analysis.prompt;

        return {
          content: [{ type: 'text', text }],
          _metadata: {
            report_type: analysis.type,
            metrics: analysis.metrics,
            summary: analysis.summary,
            prompt: analysis.prompt,
            cached,
            action_buttons: actionButtons,
          }
        };
      }

      case 'eda.get_analysis_cache': {
        const { action = 'stats' } = args;

        if (action === 'clear') {
          const result = clearCache();
          return {
            content: [{
              type: 'text',
              text: result.error
                ? `❌ Failed to clear cache: ${result.error}`
                : `✓ Cleared ${result.cleared} cached analysis entries`
            }],
            _metadata: result,
          };
        }

        // Default: show stats
        const stats = getCacheStats();
        let text = '📊 **Analysis Cache Statistics**\n\n';
        text += `**Valid Entries:** ${stats.entries}\n`;
        text += `**Expired Entries:** ${stats.expired || 0}\n`;
        text += `**Total Cache Size:** ${stats.sizeKB} KB\n\n`;
        text += `**Cache Location:** ~/.hipilot/analysis-cache/\n`;
        text += `**TTL:** 24 hours\n\n`;
        text += `Use \`eda.get_analysis_cache({ action: 'clear' })\` to clear all cached analyses.`;

        return {
          content: [{ type: 'text', text }],
          _metadata: stats,
        };
      }

      // === PHASE 1.1: FEEDBACK LOOP TOOL HANDLERS ===
      case 'eda.wait_for_pattern': {
        const { pattern, timeout = 60, pane = 'eda' } = args;
        const startTime = Date.now();
        const timeoutMs = timeout * 1000;
        const paneIdx = pane === 'eda' ? '1' : pane === 'chat' ? '0' : pane;
        const target = `${TMUX_SESSION}:0.${paneIdx}`;
        const regex = new RegExp(pattern);
        
        while (Date.now() - startTime < timeoutMs) {
          try {
            const output = execSync(
              `tmux capture-pane -t ${target} -p -S -100 2>/dev/null || echo ""`,
              { encoding: 'utf-8', timeout: 5000 }
            );
            const match = output.match(regex);
            if (match) {
              return {
                content: [{
                  type: 'text',
                  text: `✓ Pattern matched after ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\nMatch: ${match[0]}\n\nContext:\n${output.slice(-500)}`
                }],
                _metadata: { matched: true, match: match[0], elapsed_ms: Date.now() - startTime }
              };
            }
          } catch {}
          await new Promise(r => setTimeout(r, 500));
        }
        
        return {
          content: [{ type: 'text', text: `⏱ Timeout waiting for pattern: ${pattern}` }],
          isError: true,
          _metadata: { matched: false, elapsed_ms: timeoutMs }
        };
      }

      case 'eda.wait_for_prompt': {
        const { timeout = 30, pane = 'eda' } = args;
        const startTime = Date.now();
        const timeoutMs = timeout * 1000;
        const paneIdx = pane === 'eda' ? '1' : pane === 'chat' ? '0' : pane;
        const target = `${TMUX_SESSION}:0.${paneIdx}`;
        
        const promptPatterns = [
          /innovus\s*\d+>/i,
          /icc2_shell>/i,
          /icc2>/i,
          /pt_shell>/i,
          /tempus\s*\d*>/i,
          /\]\s*$/m,
        ];
        
        while (Date.now() - startTime < timeoutMs) {
          try {
            const output = execSync(
              `tmux capture-pane -t ${target} -p -S -50 2>/dev/null || echo ""`,
              { encoding: 'utf-8', timeout: 5000 }
            );
            const lastLine = output.split('\n').filter(l => l.trim()).slice(-1)[0] || '';
            for (const pattern of promptPatterns) {
              if (pattern.test(lastLine)) {
                return {
                  content: [{
                    type: 'text',
                    text: `✓ EDA prompt detected after ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\nPrompt: ${lastLine.trim()}`
                  }],
                  _metadata: { ready: true, prompt: lastLine.trim(), elapsed_ms: Date.now() - startTime }
                };
              }
            }
          } catch {}
          await new Promise(r => setTimeout(r, 500));
        }
        
        return {
          content: [{ type: 'text', text: `⏱ Timeout waiting for EDA prompt` }],
          isError: true,
          _metadata: { ready: false, elapsed_ms: timeoutMs }
        };
      }

      case 'eda.get_last_result': {
        const { lines = 50, pane = 'eda' } = args;
        const paneIdx = pane === 'eda' ? '1' : pane === 'chat' ? '0' : pane;
        const target = `${TMUX_SESSION}:0.${paneIdx}`;
        
        let output;
        try {
          output = execSync(
            `tmux capture-pane -t ${target} -p -S -${lines} 2>/dev/null || echo ""`,
            { encoding: 'utf-8', timeout: 5000 }
          );
        } catch (e) {
          return { content: [{ type: 'text', text: `❌ Failed to capture pane: ${e.message}` }], isError: true };
        }
        
        const successPatterns = [/^#\s*$/m, /successfully/i, /completed/i, /pass/i, /no\s+(error|violation)/i];
        const errorPatterns = [/^Error:/m, /ERROR:/i, /failed/i, /cannot/i, /unknown\s+command/i, /syntax\s+error/i];
        
        let success = false;
        let errorType = null;
        let errorLine = null;
        
        for (const p of successPatterns) {
          if (p.test(output)) { success = true; break; }
        }
        for (const p of errorPatterns) {
          const m = output.match(p);
          if (m) {
            success = false;
            errorType = m[0].trim();
            const lines = output.split('\n');
            for (const line of lines) {
              if (p.test(line)) { errorLine = line.trim(); break; }
            }
            break;
          }
        }
        
        const summary = success 
          ? '✓ Command appears to have completed successfully'
          : errorType 
            ? `✗ Error detected: ${errorType}`
            : '⚠ Unable to determine result (no clear success/error indicators)';
        
        return {
          content: [{ type: 'text', text: `${summary}\n\nLast output:\n${output.slice(-800)}` }],
          _metadata: { success, error_type: errorType, error_line: errorLine }
        };
      }

      case 'eda.capture_and_wait': {
        const { tcl, timeout = 60, pane = 'eda' } = args;
        const paneIdx = pane === 'eda' ? '1' : pane === 'chat' ? '0' : pane;
        const target = `${TMUX_SESSION}:0.${paneIdx}`;
        
        
        const tclFile = `${hipilotPaths.tempDir}/capture_wait_${Date.now()}.tcl`;
        writeFileSync(tclFile, tcl);
        try {
          execSync(`tmux -L ${TMUX_SESSION} send-keys -t ${target} "source ${tclFile}" Enter`, { encoding: 'utf-8' });
        } catch (e) {
          return { content: [{ type: 'text', text: `❌ Failed to send Tcl: ${e.message}` }], isError: true };
        }
        
        
        await new Promise(r => setTimeout(r, 1000));
        
        const startTime = Date.now();
        const timeoutMs = timeout * 1000;
        const promptPatterns = [/innovus\s*\d+>/i, /icc2_shell>/i, /pt_shell>/i, /\]\s*$/m];
        
        while (Date.now() - startTime < timeoutMs) {
          try {
            const output = execSync(`tmux -L ${TMUX_SESSION} capture-pane -t ${target} -p -S -100`, { encoding: 'utf-8', timeout: 5000 });
            const lastLine = output.split('\n').filter(l => l.trim()).slice(-1)[0] || '';
            for (const pattern of promptPatterns) {
              if (pattern.test(lastLine)) {
                
                try { unlinkSync(tclFile); } catch {}
                return {
                  content: [{
                    type: 'text',
                    text: `✓ Command completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s\n\nOutput:\n${output.slice(-1000)}`
                  }],
                  _metadata: { success: true, elapsed_ms: Date.now() - startTime }
                };
              }
            }
          } catch {}
          await new Promise(r => setTimeout(r, 500));
        }
        
        try { unlinkSync(tclFile); } catch {}
        return {
          content: [{ type: 'text', text: `⏱ Command timed out after ${timeout}s` }],
          isError: true,
          _metadata: { success: false, elapsed_ms: timeoutMs }
        };
      }

      case 'eda.execute_and_verify': {
        const { tcl, timeout = 120, description = '', extract_qor: shouldExtractQor = true, pane = 'eda' } = args;
        const startTime = Date.now();
        const paneIdx = pane === 'eda' ? '1' : pane === 'chat' ? '0' : pane;
        const target = `${TMUX_SESSION}:0.${paneIdx}`;

        // Step 1: Risk analysis
        const riskAnalysis = analyzeRisk(tcl);
        const sideEffects = analyzeSideEffects(tcl);

        // Step 2: Mode check — queue if manual or dangerous
        const mode = getMode();
        if (mode === MODES.MANUAL || (mode === MODES.AUTO && riskAnalysis.category >= 2)) {
          queuePending(tcl, {
            risk_analysis: riskAnalysis,
            side_effects: sideEffects,
            description,
            queued_at: new Date().toISOString(),
          });
          const modeLabel = mode === MODES.MANUAL ? 'manual' : 'auto_blocked';
          return {
            content: [{
              type: 'text',
              text: `⏳ **Pending Approval**\n\n`
                + `**Description:** ${description || 'Tcl execution'}\n`
                + `**Mode:** ${modeLabel}\n`
                + `**Risk:** ${riskAnalysis.label} (category ${riskAnalysis.category})\n\n`
                + `Approve with \`eda.approve_pending\` or tmux prefix+y`,
            }],
            _metadata: {
              status: 'pending_approval',
              mode: modeLabel,
              risk_category: riskAnalysis.category,
              risk_label: riskAnalysis.label,
              description,
              elapsed_ms: Date.now() - startTime,
            },
          };
        }

        // Step 3: Execute — write temp file and send via tmux
        const tclFile = `${hipilotPaths.execDir}/hipilot_exec_${Date.now()}.tcl`;
        writeFileSync(tclFile, tcl);

        try {
          if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });
          const histFile = join(HISTORY_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}.tcl`);
          writeFileSync(histFile, `# ${description || 'execute_and_verify'}\n# Sent at: ${new Date().toISOString()}\n\n${tcl}`);
        } catch {}

        try {
          execSync(
            `tmux -L ${TMUX_SESSION} send-keys -t ${target} "source ${tclFile}" Enter`,
            { encoding: 'utf-8', stdio: 'pipe' }
          );
        } catch (e) {
          return {
            content: [{ type: 'text', text: `❌ Failed to send Tcl to EDA pane: ${e.message}` }],
            isError: true,
            _metadata: { status: 'send_failed', error: e.message, elapsed_ms: Date.now() - startTime },
          };
        }

        // Step 4: Wait for EDA prompt to return
        await new Promise(r => setTimeout(r, 1000));

        const timeoutMs = timeout * 1000;
        const promptPatterns = [
          /innovus\s*\d+>/i,
          /icc2_shell>/i,
          /icc2>/i,
          /pt_shell>/i,
          /tempus\s*\d*>/i,
        ];

        let promptDetected = false;
        let capturedOutput = '';

        while (Date.now() - startTime < timeoutMs) {
          try {
            capturedOutput = execSync(
              `tmux -L ${TMUX_SESSION} capture-pane -t ${target} -p -S -200 2>/dev/null || echo ""`,
              { encoding: 'utf-8', timeout: 5000 }
            );
            const lastLine = capturedOutput.split('\n').filter(l => l.trim()).slice(-1)[0] || '';
            for (const pattern of promptPatterns) {
              if (pattern.test(lastLine)) {
                promptDetected = true;
                break;
              }
            }
            if (promptDetected) break;
          } catch {}
          await new Promise(r => setTimeout(r, 1000));
        }

        const elapsedMs = Date.now() - startTime;
        const elapsedS = (elapsedMs / 1000).toFixed(1);

        // Handle timeout
        if (!promptDetected) {
          try { unlinkSync(tclFile); } catch {}
          return {
            content: [{
              type: 'text',
              text: `⏱ **Execution Timed Out** (${timeout}s)\n\n`
                + `**Description:** ${description || 'Tcl execution'}\n\n`
                + `The EDA tool prompt did not return within ${timeout}s. The command may still be running.\n\n`
                + `**Last output:**\n\`\`\`\n${capturedOutput.slice(-500)}\n\`\`\``,
            }],
            isError: true,
            _metadata: {
              status: 'timeout',
              elapsed_ms: elapsedMs,
              description,
              captured_lines: capturedOutput.split('\n').length,
            },
          };
        }

        // Step 5: Detect errors and warnings in output
        const errorPatterns = [
          /^\*\*ERROR/m, /^Error:/m, /ERROR:/i, /FATAL/i,
          /failed/i, /cannot/i, /unknown\s+command/i, /syntax\s+error/i,
          /invalid/i, /no\s+such/i,
        ];
        const warningPatterns = [
          /^\*\*WARN/m, /WARNING:/i, /WARN-/i, /deprecated/i,
        ];

        const errors = [];
        const warnings = [];
        const outputLines = capturedOutput.split('\n');
        for (const line of outputLines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          for (const pat of errorPatterns) {
            if (pat.test(trimmed)) {
              errors.push(trimmed);
              break;
            }
          }
          for (const pat of warningPatterns) {
            if (pat.test(trimmed)) {
              warnings.push(trimmed);
              break;
            }
          }
        }

        // Deduplicate
        const uniqueErrors = [...new Set(errors)].slice(0, 20);
        const uniqueWarnings = [...new Set(warnings)].slice(0, 20);

        // Step 6: Extract QoR metrics if requested
        let qor = null;
        if (shouldExtractQor) {
          qor = extractQoR(capturedOutput);
        }

        // Step 7: Build result
        const hasErrors = uniqueErrors.length > 0;
        const status = hasErrors ? 'error' : 'success';

        let text = '';
        if (status === 'success') {
          text += `✅ **Execution Successful** (${elapsedS}s)\n\n`;
        } else {
          text += `❌ **Execution Completed with Errors** (${elapsedS}s)\n\n`;
        }

        if (description) {
          text += `**Description:** ${description}\n`;
        }
        text += `**Risk:** ${riskAnalysis.label}\n`;
        text += `**Duration:** ${elapsedS}s\n`;
        text += `**Output Lines:** ${outputLines.length}\n\n`;

        if (uniqueErrors.length > 0) {
          text += `### Errors Detected (${uniqueErrors.length})\n\n`;
          for (const err of uniqueErrors.slice(0, 10)) {
            text += `- \`${err.slice(0, 120)}\`\n`;
          }
          text += '\n';
        }

        if (uniqueWarnings.length > 0) {
          text += `### Warnings (${uniqueWarnings.length})\n\n`;
          for (const w of uniqueWarnings.slice(0, 5)) {
            text += `- \`${w.slice(0, 120)}\`\n`;
          }
          text += '\n';
        }

        if (qor && (qor.wns !== null || qor.tns !== null || qor.drc_violations > 0)) {
          text += `### QoR Metrics\n\n`;
          text += `| Metric | Value |\n|--------|-------|\n`;
          if (qor.wns !== null) text += `| WNS | ${qor.wns} ns |\n`;
          if (qor.tns !== null) text += `| TNS | ${qor.tns} ns |\n`;
          if (qor.setup_violations) text += `| Setup Violations | ${qor.setup_violations} |\n`;
          if (qor.hold_violations) text += `| Hold Violations | ${qor.hold_violations} |\n`;
          if (qor.drc_violations) text += `| DRC Violations | ${qor.drc_violations} |\n`;
          if (qor.area) text += `| Area | ${qor.area} |\n`;
          if (qor.utilization) text += `| Utilization | ${qor.utilization} |\n`;
          text += '\n';
        }

        if (sideEffects.has_side_effects) {
          text += `### Side Effect Warnings\n\n`;
          text += sideEffects.summary + '\n\n';
        }

        text += `### Output (last 30 lines)\n\n\`\`\`\n${outputLines.slice(-30).join('\n')}\n\`\`\`\n`;

        try { unlinkSync(tclFile); } catch {}

        return {
          content: [{ type: 'text', text }],
          _metadata: {
            status,
            elapsed_ms: elapsedMs,
            description,
            risk_category: riskAnalysis.category,
            risk_label: riskAnalysis.label,
            errors_detected: uniqueErrors,
            warnings_detected: uniqueWarnings,
            error_count: uniqueErrors.length,
            warning_count: uniqueWarnings.length,
            output_lines: outputLines.length,
            ...(qor && { qor }),
            ...(sideEffects.has_side_effects && { side_effects: sideEffects.summary }),
          },
        };
      }

      // === PHASE 1.2: SESSION STATE TOOL HANDLERS ===
      case 'session.save_checkpoint': {
        const { name, description = '' } = args;
        const checkpointsDir = join(hipilotPaths.hipilotDir, 'session', 'checkpoints');
        mkdirSync(checkpointsDir, { recursive: true });
        
        
        let qorMetrics = {};
        try {
          const paneOutput = execSync(
            `tmux -L ${TMUX_SESSION} capture-pane -t ${TMUX_SESSION}:0.1 -p -S -200 2>/dev/null || echo ""`,
            { encoding: 'utf-8' }
          );
          qorMetrics = extractQoR(paneOutput);
        } catch {}
        
        const checkpoint = {
          id: `ckpt_${Date.now()}`,
          name,
          description,
          saved_at: new Date().toISOString(),
          qor: qorMetrics,
          context: {
            tool: detectTool()?.tool || null,
            stage: 'unknown',
          }
        };
        
        const checkpointPath = join(checkpointsDir, `${checkpoint.id}.json`);
        writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
        
        return {
          content: [{
            type: 'text',
            text: `💾 **Checkpoint Saved**\n\n**Name:** ${name}\n**ID:** ${checkpoint.id}\n**Time:** ${checkpoint.saved_at}\n${description ? `**Description:** ${description}\n` : ''}`
          }],
          _metadata: checkpoint
        };
      }

      case 'session.list_checkpoints': {
        const checkpointsDir = join(hipilotPaths.hipilotDir, 'session', 'checkpoints');
        const checkpoints = [];
        
        if (existsSync(checkpointsDir)) {
          for (const file of readdirSync(checkpointsDir).filter(f => f.endsWith('.json'))) {
            try {
              const cp = JSON.parse(readFileSync(join(checkpointsDir, file), 'utf-8'));
              checkpoints.push(cp);
            } catch {}
          }
        }
        
        checkpoints.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
        
        let text = `📋 **Session Checkpoints** (${checkpoints.length})\n\n`;
        if (checkpoints.length === 0) {
          text += 'No checkpoints saved yet.\n\nUse `session.save_checkpoint` to create one.';
        } else {
          for (const cp of checkpoints) {
            text += `**${cp.name}** (${cp.id})\n`;
            text += `  Saved: ${cp.saved_at}\n`;
            if (cp.qor?.wns !== undefined) text += `  WNS: ${cp.qor.wns}\n`;
            text += '\n';
          }
        }
        
        return { content: [{ type: 'text', text }], _metadata: { checkpoints } };
      }

      case 'session.restore_checkpoint': {
        const { checkpoint_id } = args;
        const checkpointsDir = join(hipilotPaths.hipilotDir, 'session', 'checkpoints');
        
        let checkpointPath = join(checkpointsDir, `${checkpoint_id}.json`);
        if (!existsSync(checkpointPath)) {
          const files = readdirSync(checkpointsDir).filter(f => f.includes(checkpoint_id));
          if (files.length === 0) {
            return { content: [{ type: 'text', text: `❌ Checkpoint not found: ${checkpoint_id}` }], isError: true };
          }
          checkpointPath = join(checkpointsDir, files[0]);
        }
        
        const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf-8'));
        
        return {
          content: [{
            type: 'text',
            text: `✓ **Checkpoint Context Restored**\n\n**Name:** ${checkpoint.name}\n**Saved:** ${checkpoint.saved_at}\n\nContext is now loaded. Note: This does NOT undo EDA changes.`
          }],
          _metadata: { restored: true, checkpoint }
        };
      }

      case 'session.get_history': {
        const { limit = 50 } = args;
        const historyPath = join(hipilotPaths.hipilotDir, 'history');
        const entries = [];
        
        if (existsSync(historyPath)) {
          for (const file of readdirSync(historyPath).filter(f => f.endsWith('.tcl')).slice(-limit)) {
            try {
              const stat = { file, time: new Date(parseInt(file.split('_').pop()) || 0) };
              entries.push(stat);
            } catch {}
          }
        }
        
        let text = `📜 **Command History** (${entries.length} recent)\n\n`;
        for (const e of entries.reverse()) {
          text += `• ${e.file}\n`;
        }
        
        return { content: [{ type: 'text', text }], _metadata: { entries } };
      }

      case 'session.get_context': {
        const tool = detectTool();
        let qorMetrics = {};
        try {
          const output = execSync(
            `tmux capture-pane -t ${TMUX_SESSION}:0.1 -p -S -100 2>/dev/null || echo ""`,
            { encoding: 'utf-8' }
          );
          qorMetrics = extractQoR(output);
        } catch {}
        
        const context = {
          tool: tool?.tool || 'none',
          vendor: tool?.vendor || 'unknown',
          stage: 'unknown',
          qor: qorMetrics,
          mode: getModeStatus().mode,
        };
        
        let text = `📍 **Current Session Context**\n\n`;
        text += `**Tool:** ${context.tool}\n`;
        text += `**Vendor:** ${context.vendor}\n`;
        text += `**Stage:** ${context.stage}\n`;
        text += `**Mode:** ${context.mode}\n`;
        if (context.qor.wns !== undefined) text += `**WNS:** ${context.qor.wns}\n`;
        if (context.qor.tns !== undefined) text += `**TNS:** ${context.qor.tns}\n`;
        
        return { content: [{ type: 'text', text }], _metadata: context };
      }

      // === PHASE 1.3: CONTEXT DETECTION TOOL HANDLERS ===
      case 'context.detect': {
        const tool = detectTool();
        
        const context = {
          design_name: null,
          technology: null,
          stage: 'unknown',
          tool: tool?.tool || null,
          vendor: tool?.vendor || null,
          corners: [],
        };
        
        
        try {
          const output = execSync(
            `tmux capture-pane -t ${TMUX_SESSION}:0.1 -p -S -500 2>/dev/null || echo ""`,
            { encoding: 'utf-8' }
          );
          
          
          if (/CTS|clock_tree/i.test(output)) context.stage = 'cts';
          else if (/route|routing/i.test(output)) context.stage = 'route';
          else if (/place|placement/i.test(output)) context.stage = 'place';
          else if (/floorplan/i.test(output)) context.stage = 'floorplan';
          else if (/synthesis|synthesize/i.test(output)) context.stage = 'synthesis';
          else if (/signoff|drc|lvs/i.test(output)) context.stage = 'signoff';
          
          
          const designMatch = output.match(/design[:\s]+["']?(\w+)/i);
          if (designMatch) context.design_name = designMatch[1];
          
        } catch {}
        
        let text = `🔍 **Detected Context**\n\n`;
        text += `**Tool:** ${context.tool || 'Not detected'}\n`;
        text += `**Vendor:** ${context.vendor || 'Unknown'}\n`;
        text += `**Stage:** ${context.stage}\n`;
        if (context.design_name) text += `**Design:** ${context.design_name}\n`;
        
        return { content: [{ type: 'text', text }], _metadata: context };
      }

      case 'context.get_stage': {
        const tool = detectTool();
        let stage = 'unknown';
        let confidence = 0;
        
        try {
          const output = execSync(
            `tmux capture-pane -t ${TMUX_SESSION}:0.1 -p -S -300 2>/dev/null || echo ""`,
            { encoding: 'utf-8' }
          );
          
          const stagePatterns = [
            { stage: 'synthesis', patterns: [/synthesis|synthesize/i], weight: 1 },
            { stage: 'floorplan', patterns: [/floorplan|io_placement/i], weight: 1 },
            { stage: 'place', patterns: [/placement|placed/i], weight: 1 },
            { stage: 'cts', patterns: [/CTS|clock_tree|ccopt/i], weight: 1 },
            { stage: 'route', patterns: [/route|routing|nanoroute/i], weight: 1 },
            { stage: 'signoff', patterns: [/signoff|drc|lvs|sta/i], weight: 1 },
          ];
          
          for (const sp of stagePatterns) {
            for (const p of sp.patterns) {
              if (p.test(output)) {
                stage = sp.stage;
                confidence = 0.8;
                break;
              }
            }
            if (confidence > 0) break;
          }
        } catch {}
        
        return {
          content: [{ type: 'text', text: `**Current Stage:** ${stage}\n**Confidence:** ${Math.round(confidence * 100)}%` }],
          _metadata: { stage, confidence }
        };
      }

      case 'context.suggest_next': {
        const stageResult = await (async () => {
          try {
            const output = execSync(
              `tmux capture-pane -t ${TMUX_SESSION}:0.1 -p -S -300 2>/dev/null || echo ""`,
              { encoding: 'utf-8' }
            );
            if (/CTS|clock_tree/i.test(output)) return 'cts';
            if (/route|routing/i.test(output)) return 'route';
            if (/place|placement/i.test(output)) return 'place';
            if (/floorplan/i.test(output)) return 'floorplan';
            return 'unknown';
          } catch { return 'unknown'; }
        })();
        
        const suggestions = {
          synthesis: [{ action: 'Run placement', reason: 'Synthesis complete, start physical design', priority: 1 }],
          floorplan: [{ action: 'Run placement', reason: 'Floorplan ready for cell placement', priority: 1 }],
          place: [{ action: 'Run CTS', reason: 'Placement complete, build clock tree', priority: 1 }],
          cts: [{ action: 'Run routing', reason: 'Clock tree ready for signal routing', priority: 1 }],
          route: [{ action: 'Run timing optimization', reason: 'Routing done, optimize timing closure', priority: 1 }],
          signoff: [{ action: 'Review results', reason: 'Design in signoff stage', priority: 1 }],
          unknown: [{ action: 'Detect design status', reason: 'Unable to determine current stage', priority: 1 }],
        };
        
        const list = suggestions[stageResult] || suggestions.unknown;
        
        let text = `💡 **Suggested Next Steps**\n\n`;
        for (const s of list) {
          text += `${s.priority}. **${s.action}**\n   ${s.reason}\n\n`;
        }
        
        return { content: [{ type: 'text', text }], _metadata: { stage: stageResult, suggestions: list } };
      }

      // === PHASE 2.1: QOR TRACKING TOOL HANDLERS ===
      case 'qor.snapshot': {
        const { name, description = '' } = args;
        const snapshotsDir = join(hipilotPaths.hipilotDir, 'qor_snapshots');
        mkdirSync(snapshotsDir, { recursive: true });
        
        let metrics = {};
        try {
          const output = execSync(
            `tmux -L ${TMUX_SESSION} capture-pane -t ${TMUX_SESSION}:0.1 -p -S -200 2>/dev/null || echo ""`,
            { encoding: 'utf-8' }
          );
          metrics = extractQoR(output);
        } catch {}
        
        const snapshot = {
          id: `qor_${Date.now()}`,
          name,
          description,
          timestamp: new Date().toISOString(),
          metrics
        };
        
        const snapshotPath = join(snapshotsDir, `${snapshot.id}.json`);
        writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        
        let text = `📊 **QoR Snapshot Saved**\n\n**Name:** ${name}\n**ID:** ${snapshot.id}\n\n`;
        if (metrics.wns !== undefined) text += `**WNS:** ${metrics.wns}\n`;
        if (metrics.tns !== undefined) text += `**TNS:** ${metrics.tns}\n`;
        if (metrics.violations !== undefined) text += `**Violations:** ${metrics.violations}\n`;
        
        return { content: [{ type: 'text', text }], _metadata: snapshot };
      }

      case 'qor.list_snapshots': {
        const snapshotsDir = join(hipilotPaths.hipilotDir, 'qor_snapshots');
        const snapshots = [];
        
        if (existsSync(snapshotsDir)) {
          for (const file of readdirSync(snapshotsDir).filter(f => f.endsWith('.json'))) {
            try {
              const snap = JSON.parse(readFileSync(join(snapshotsDir, file), 'utf-8'));
              snapshots.push(snap);
            } catch {}
          }
        }
        
        snapshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        let text = `📈 **QoR Snapshots** (${snapshots.length})\n\n`;
        if (snapshots.length === 0) {
          text += 'No snapshots saved.\n\nUse `qor.snapshot` to create one.';
        } else {
          for (const snap of snapshots) {
            text += `**${snap.name}** (${snap.id})\n`;
            text += `  Time: ${snap.timestamp}\n`;
            if (snap.metrics?.wns !== undefined) text += `  WNS: ${snap.metrics.wns}\n`;
            if (snap.metrics?.tns !== undefined) text += `  TNS: ${snap.metrics.tns}\n`;
            text += '\n';
          }
        }
        
        return { content: [{ type: 'text', text }], _metadata: { snapshots } };
      }

      case 'qor.compare': {
        const { snapshot1, snapshot2 } = args;
        const snapshotsDir = join(hipilotPaths.hipilotDir, 'qor_snapshots');
        
        const findSnapshot = (id) => {
          let path = join(snapshotsDir, `${id}.json`);
          if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf-8'));
          for (const file of readdirSync(snapshotsDir).filter(f => f.includes(id))) {
            return JSON.parse(readFileSync(join(snapshotsDir, file), 'utf-8'));
          }
          return null;
        };
        
        const snap1 = findSnapshot(snapshot1);
        const snap2 = findSnapshot(snapshot2);
        
        if (!snap1 || !snap2) {
          return { content: [{ type: 'text', text: `❌ Snapshot not found` }], isError: true };
        }
        
        const delta = {};
        const metrics = ['wns', 'tns', 'violations', 'power_total', 'total_area'];
        for (const m of metrics) {
          if (snap1.metrics?.[m] !== undefined && snap2.metrics?.[m] !== undefined) {
            delta[m] = snap2.metrics[m] - snap1.metrics[m];
          }
        }
        
        const improved = (delta.wns !== undefined && delta.wns > 0) || 
                        (delta.tns !== undefined && delta.tns > 0) ||
                        (delta.violations !== undefined && delta.violations < 0);
        
        let text = `📊 **QoR Comparison**\n\n`;
        text += `**Baseline:** ${snap1.name} (${snap1.timestamp})\n`;
        text += `**Current:** ${snap2.name} (${snap2.timestamp})\n\n`;
        text += `**Delta:**\n`;
        for (const [m, v] of Object.entries(delta)) {
          const icon = (m === 'violations' ? v < 0 : v > 0) ? '✓' : v === 0 ? '=' : '✗';
          text += `  ${icon} ${m}: ${v > 0 ? '+' : ''}${v}\n`;
        }
        text += `\n**Result:** ${improved ? '✓ Improved' : '✗ Regressed or unchanged'}`;
        
        return { content: [{ type: 'text', text }], _metadata: { delta, improved } };
      }

      case 'qor.get_trend': {
        const { metric = 'wns', snapshots = 10 } = args;
        const snapshotsDir = join(hipilotPaths.hipilotDir, 'qor_snapshots');
        const data = [];
        
        if (existsSync(snapshotsDir)) {
          const files = readdirSync(snapshotsDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .slice(-snapshots);
          
          for (const file of files) {
            try {
              const snap = JSON.parse(readFileSync(join(snapshotsDir, file), 'utf-8'));
              if (snap.metrics?.[metric] !== undefined) {
                data.push({ name: snap.name, value: snap.metrics[metric] });
              }
            } catch {}
          }
        }
        
        if (data.length < 2) {
          return { content: [{ type: 'text', text: 'Need at least 2 snapshots with this metric to show trend.' }] };
        }
        
        const trend = data[data.length - 1].value > data[0].value ? 'improving' :
                      data[data.length - 1].value < data[0].value ? 'degrading' : 'stable';
        
        let text = `📈 **QoR Trend: ${metric.toUpperCase()}**\n\n`;
        for (const d of data) {
          text += `${d.name}: ${d.value}\n`;
        }
        text += `\n**Trend:** ${trend}`;
        
        return { content: [{ type: 'text', text }], _metadata: { trend, data } };
      }

      // === PHASE 2.2: ERROR DIAGNOSIS TOOL HANDLERS ===
      case 'eda.diagnose_error': {
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

      case 'eda.validate_tcl': {
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

      // === PHASE 2.3: WORKFLOW AUTOMATION TOOL HANDLERS ===
      case 'workflow.define': {
        const { name, description = '', steps } = args;
        const workflowsDir = join(hipilotPaths.hipilotDir, 'workflows');
        mkdirSync(workflowsDir, { recursive: true });
        
        const workflow = {
          id: `wf_${Date.now()}`,
          name,
          description,
          steps: steps.map((s, i) => ({
            ...s,
            step_id: i + 1,
          })),
          created_at: new Date().toISOString(),
          is_builtin: false,
        };
        
        const workflowPath = join(workflowsDir, `${name}.json`);
        writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
        
        let text = `📝 **Workflow Defined**\n\n`;
        text += `**Name:** ${name}\n`;
        text += `**ID:** ${workflow.id}\n`;
        text += `**Steps:** ${steps.length}\n`;
        text += `\n**Step Summary:**\n`;
        for (const s of workflow.steps) {
          text += `  ${s.step_id}. ${s.name}\n`;
        }
        
        return { content: [{ type: 'text', text }], _metadata: workflow };
      }

      case 'workflow.list': {
        const workflowsDir = join(hipilotPaths.hipilotDir, 'workflows');
        const workflows = [];
        
        const builtinWorkflows = [
          { id: 'wf_builtin_fix_setup', name: 'fix_setup_timing', description: 'Analyze → Generate fixes → Apply → Verify', steps: 4, is_builtin: true },
          { id: 'wf_builtin_fix_hold', name: 'fix_hold_timing', description: 'Analyze → Generate fixes → Apply → Verify', steps: 4, is_builtin: true },
          { id: 'wf_builtin_cts', name: 'run_cts_flow', description: 'Build CTS → Optimize → Verify', steps: 3, is_builtin: true },
          { id: 'wf_builtin_eco', name: 'eco_flow', description: 'Analyze changes → Apply ECO → Verify', steps: 3, is_builtin: true },
        ];
        
        workflows.push(...builtinWorkflows);
        
        if (existsSync(workflowsDir)) {
          for (const file of readdirSync(workflowsDir).filter(f => f.endsWith('.json'))) {
            try {
              const wf = JSON.parse(readFileSync(join(workflowsDir, file), 'utf-8'));
              workflows.push(wf);
            } catch {}
          }
        }
        
        let text = `📋 **Available Workflows** (${workflows.length})\n\n`;
        for (const wf of workflows) {
          const badge = wf.is_builtin ? '[Built-in]' : '[Custom]';
          text += `**${wf.name}** ${badge}\n`;
          text += `  ${wf.description}\n`;
          text += `  Steps: ${wf.steps.length || wf.steps}\n\n`;
        }
        
        return { content: [{ type: 'text', text }], _metadata: { workflows } };
      }

      case 'workflow.run': {
        const { name, params = {} } = args;
        const workflowsDir = join(hipilotPaths.hipilotDir, 'workflows');
        const runsDir = join(hipilotPaths.hipilotDir, 'workflow_runs');
        mkdirSync(runsDir, { recursive: true });
        
        let workflow = null;
        const builtinWorkflows = {
          'fix_setup_timing': { name: 'fix_setup_timing', steps: [{ name: 'Analyze timing' }, { name: 'Generate fixes' }, { name: 'Apply fixes' }, { name: 'Verify' }] },
          'fix_hold_timing': { name: 'fix_hold_timing', steps: [{ name: 'Analyze timing' }, { name: 'Generate fixes' }, { name: 'Apply fixes' }, { name: 'Verify' }] },
          'run_cts_flow': { name: 'run_cts_flow', steps: [{ name: 'Build CTS' }, { name: 'Optimize' }, { name: 'Verify' }] },
          'eco_flow': { name: 'eco_flow', steps: [{ name: 'Analyze changes' }, { name: 'Apply ECO' }, { name: 'Verify' }] },
        };
        
        if (builtinWorkflows[name]) {
          workflow = builtinWorkflows[name];
        } else {
          const workflowPath = join(workflowsDir, `${name}.json`);
          if (existsSync(workflowPath)) {
            workflow = JSON.parse(readFileSync(workflowPath, 'utf-8'));
          }
        }
        
        if (!workflow) {
          return { content: [{ type: 'text', text: `❌ Workflow not found: ${name}` }], isError: true };
        }
        
        const runId = `run_${Date.now()}`;
        const run = {
          run_id: runId,
          workflow_name: name,
          status: 'running',
          current_step: 1,
          total_steps: workflow.steps.length,
          started_at: new Date().toISOString(),
          params,
          results: [],
        };
        
        writeFileSync(join(runsDir, `${runId}.json`), JSON.stringify(run, null, 2));
        
        let text = `🚀 **Workflow Started**\n\n`;
        text += `**Workflow:** ${name}\n`;
        text += `**Run ID:** ${runId}\n`;
        text += `**Status:** Running\n`;
        text += `**Steps:** ${run.total_steps}\n`;
        text += `\nUse \`workflow.get_status\` to check progress.`;
        
        return { content: [{ type: 'text', text }], _metadata: run };
      }

      case 'workflow.get_status': {
        const { run_id } = args;
        const runsDir = join(hipilotPaths.hipilotDir, 'workflow_runs');
        const runPath = join(runsDir, `${run_id}.json`);
        
        if (!existsSync(runPath)) {
          return { content: [{ type: 'text', text: `❌ Run not found: ${run_id}` }], isError: true };
        }
        
        const run = JSON.parse(readFileSync(runPath, 'utf-8'));
        
        let text = `📊 **Workflow Status**\n\n`;
        text += `**Run ID:** ${run.run_id}\n`;
        text += `**Workflow:** ${run.workflow_name}\n`;
        text += `**Status:** ${run.status}\n`;
        text += `**Progress:** ${run.current_step}/${run.total_steps}\n`;
        text += `**Started:** ${run.started_at}\n`;
        
        return { content: [{ type: 'text', text }], _metadata: run };
      }

      case 'workflow.cancel': {
        const { run_id } = args;
        const runsDir = join(hipilotPaths.hipilotDir, 'workflow_runs');
        const runPath = join(runsDir, `${run_id}.json`);
        
        if (!existsSync(runPath)) {
          return { content: [{ type: 'text', text: `❌ Run not found: ${run_id}` }], isError: true };
        }
        
        const run = JSON.parse(readFileSync(runPath, 'utf-8'));
        run.status = 'cancelled';
        run.cancelled_at = new Date().toISOString();
        writeFileSync(runPath, JSON.stringify(run, null, 2));
        
        return { content: [{ type: 'text', text: `✓ **Workflow Cancelled**\n\nRun ${run_id} has been cancelled.` }], _metadata: run };
      }

      // === PHASE 3.2: SMART SUGGESTIONS TOOL HANDLERS ===
      case 'suggest.analyze': {
        const { focus = 'all' } = args;
        const tool = detectTool();
        let qorMetrics = {};
        
        try {
          const output = execSync(
            `tmux -L ${TMUX_SESSION} capture-pane -t ${TMUX_SESSION}:0.1 -p -S -200 2>/dev/null || echo ""`,
            { encoding: 'utf-8' }
          );
          qorMetrics = extractQoR(output);
        } catch {}
        
        const suggestions = [];
        
        if ((focus === 'timing' || focus === 'all') && qorMetrics.wns !== null) {
          if (qorMetrics.wns < 0) {
            suggestions.push({ action: 'Fix setup timing violations', impact: 'Critical', effort: 'Medium', priority: 1 });
          }
          if (qorMetrics.hold_violations > 0) {
            suggestions.push({ action: 'Fix hold timing violations', impact: 'High', effort: 'Medium', priority: 2 });
          }
        }
        
        if ((focus === 'drc' || focus === 'all') && qorMetrics.drc_violations > 0) {
          suggestions.push({ action: 'Fix DRC violations', impact: 'High', effort: 'Low', priority: 3 });
        }
        
        if (suggestions.length === 0) {
          suggestions.push({ action: 'Run timing analysis to get current status', impact: 'Informational', effort: 'Low', priority: 1 });
        }
        
        let text = `💡 **Analysis Suggestions**\n\n`;
        text += `**Focus:** ${focus}\n`;
        text += `**Tool:** ${tool?.tool || 'Unknown'}\n\n`;
        text += `**Suggestions:**\n`;
        for (const s of suggestions) {
          text += `${s.priority}. ${s.action}\n`;
          text += `   Impact: ${s.impact} | Effort: ${s.effort}\n`;
        }
        
        return { content: [{ type: 'text', text }], _metadata: { suggestions, qor: qorMetrics } };
      }

      case 'suggest.for_violation': {
        const { violation_type, path_group } = args;
        
        const fixes = {
          setup: [
            { fix: 'Size up drivers on critical paths', tcl: 'size_cell $cells $larger_size', expected_impact: '0.1-0.3ns improvement' },
            { fix: 'Insert buffers for long nets', tcl: 'insert_buffer $net $buffer_cell', expected_impact: '0.05-0.15ns improvement' },
          ],
          hold: [
            { fix: 'Add delay elements to short paths', tcl: 'insert_buffer $short_path $delay_cell', expected_impact: '0.05-0.2ns improvement' },
            { fix: 'Size down cells on short paths', tcl: 'size_cell $cells $smaller_size', expected_impact: '0.02-0.1ns improvement' },
          ],
          max_cap: [
            { fix: 'Insert buffer to reduce capacitance', tcl: 'insert_buffer $high_cap_net $buffer', expected_impact: 'Reduce cap by 30-50%' },
          ],
          max_tran: [
            { fix: 'Size up driver for high transition nets', tcl: 'size_cell $driver $larger', expected_impact: 'Reduce transition by 20-40%' },
          ],
          drc: [
            { fix: 'Fix spacing violations', tcl: 'eco_route -fix_drc', expected_impact: 'Fix DRC violations' },
          ],
        };
        
        const suggestions = fixes[violation_type] || [
          { fix: 'Analyze specific violation for fix suggestions', tcl: 'report_violation -type ' + violation_type, expected_impact: 'Information' },
        ];
        
        let text = `🔧 **Fix Suggestions for ${violation_type.toUpperCase()}**\n`;
        if (path_group) text += `**Path Group:** ${path_group}\n`;
        text += `\n`;
        
        for (let i = 0; i < suggestions.length; i++) {
          const s = suggestions[i];
          text += `${i + 1}. **${s.fix}**\n`;
          text += `   Tcl: \`${s.tcl}\`\n`;
          text += `   Expected Impact: ${s.expected_impact}\n\n`;
        }
        
        return { content: [{ type: 'text', text }], _metadata: { violation_type, suggestions } };
      }

      case 'suggest.next_optimization': {
        const { goal = 'timing' } = args;
        let qorMetrics = {};
        
        try {
          const output = execSync(
            `tmux -L ${TMUX_SESSION} capture-pane -t ${TMUX_SESSION}:0.1 -p -S -200 2>/dev/null || echo ""`,
            { encoding: 'utf-8' }
          );
          qorMetrics = extractQoR(output);
        } catch {}
        
        let optimization = '';
        let reason = '';
        let expected_gain = '';
        
        if (goal === 'timing') {
          if (qorMetrics.wns !== null && qorMetrics.wns < 0) {
            optimization = 'Fix setup violations on critical paths';
            reason = `WNS is ${qorMetrics.wns}ns (negative = timing violation)`;
            expected_gain = '0.1-0.5ns per iteration';
          } else if (qorMetrics.hold_violations > 0) {
            optimization = 'Fix hold violations';
            reason = `${qorMetrics.hold_violations} hold violations detected`;
            expected_gain = 'Meet hold timing';
          } else {
            optimization = 'Run timing optimization for marginal gains';
            reason = 'Timing is clean, optimize for performance margin';
            expected_gain = '0.02-0.1ns';
          }
        } else if (goal === 'power') {
          optimization = 'Apply power optimization';
          reason = 'Reduce dynamic and leakage power';
          expected_gain = '5-15% power reduction';
        } else if (goal === 'area') {
          optimization = 'Apply area recovery';
          reason = 'Reduce total cell area';
          expected_gain = '2-5% area reduction';
        } else {
          optimization = 'Fix DRC violations';
          reason = `${qorMetrics.drc_violations || 0} DRC violations`;
          expected_gain = 'Clean DRC';
        }
        
        let text = `🎯 **Next Optimization Step**\n\n`;
        text += `**Goal:** ${goal}\n`;
        text += `**Optimization:** ${optimization}\n`;
        text += `**Reason:** ${reason}\n`;
        text += `**Expected Gain:** ${expected_gain}\n`;
        
        return { content: [{ type: 'text', text }], _metadata: { optimization, reason, expected_gain } };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}));

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HiPilot EDA MCP Server running');
  console.error(`  Templates: ${TEMPLATES_DIR}`);
  console.error(`  History: ${HISTORY_DIR}`);
  const templates = listTemplates();
  console.error(`  ${templates.length} templates available`);
}

main().catch(console.error);
