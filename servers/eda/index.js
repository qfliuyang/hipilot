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
} from '../../src/lib/risk-analyzer.js';

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

  // Analyze risk regardless of mode (for logging and display)
  const riskAnalysis = analyzeRisk(tcl);

  // Store risk analysis with pending Tcl
  const enrichedMetadata = {
    ...metadata,
    risk_analysis: riskAnalysis,
    queued_at: new Date().toISOString()
  };

  if (mode === MODES.AUTO) {
    // Even in auto mode, warn about dangerous operations
    if (riskAnalysis.category >= 2) {
      // For dangerous/critical ops in auto mode, still require confirmation
      queuePending(tcl, enrichedMetadata);
      return {
        success: true,
        queued: true,
        mode: 'auto_blocked',
        blocked_reason: 'dangerous_operation',
        risk_analysis: riskAnalysis,
        message: `⚠️ Auto mode blocked for ${riskAnalysis.label.toLowerCase()} operation. Manual confirmation required.`,
        approval_prompt: generateApprovalPrompt(riskAnalysis, tcl),
        pendingFile: PENDING_FILE,
      };
    }

    const result = executeTcl(tcl, pane);
    return {
      ...result,
      mode: 'auto',
      risk_analysis: riskAnalysis,
      message: result.success
        ? `⚡ Claude has conn - executed immediately: ${result.message}`
        : result.message,
    };
  } else {
    queuePending(tcl, enrichedMetadata);
    const status = getModeStatus();
    return {
      success: true,
      queued: true,
      mode: 'manual',
      risk_analysis: riskAnalysis,
      approval_prompt: generateApprovalPrompt(riskAnalysis, tcl),
      message: `🔒 Manual mode - Tcl queued for approval`,
      pendingFile: PENDING_FILE,
      status: status,
    };
  }
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
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'eda.generate_tcl': {
        const { intent, tool, operation, targets, variables } = args;
        const result = generateTcl(intent, { tool, operation, targets, variables });

        // Write generated Tcl to temp file
        const timestamp = Date.now();
        const tempFile = `${hipilotPaths.generatedDir}/hipilot_generated_${timestamp}.tcl`;
        writeFileSync(tempFile, result.tcl);

        let text = `${result.badge} Generated Tcl script:\n\n${result.tcl}\n`;
        text += `\nSaved to: ${tempFile}`;
        if (result.template_path) {
          text += `\nTemplate: ${result.template_path}`;
        }
        if (result.reasoning) {
          text += `\nReasoning: ${result.reasoning}`;
        }
        text += `\n\nTo execute: use eda.send_to_terminal or run 'source ${tempFile}' in the EDA tool`;

        return {
          content: [{ type: 'text', text }],
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
        // ONE-CALL solution for common operations
        const { operation, params = {} } = args;

        // Map quick operation to full operation name
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

        // Detect tool
        const detectedTool = detectTool();
        const tool = detectedTool?.vendor || 'cadence';

        // Generate Tcl
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

        // Analyze risk
        const riskAnalysis = analyzeRisk(genResult.tcl);

        // Send to terminal
        const sendResult = sendToTerminal(genResult.tcl, 'eda');

        if (sendResult.queued) {
          updateTmuxModeStatus('manual', true);
        }

        // Build compact response
        let text = `🔧 **${operation.toUpperCase()}** ${riskAnalysis.color}\n\n`;
        text += `**Tcl:**\n\`\`\`tcl\n${genResult.tcl}\n\`\`\`\n\n`;

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
            queued: sendResult.queued
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
        // AI Report Comprehension Pipeline - THE MAJOR BREAKTHROUGH
        const { pane = 'eda', lines = 200, report_type = 'auto' } = args;

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

        // Extract basic QoR metrics for structured data
        const metrics = extractQoR(capturedOutput);

        // Build analysis prompt based on report type
        const analysisPrompt = `Analyze this EDA tool output and provide a structured summary:

**Detected Metrics:**
- WNS: ${metrics.wns !== null ? metrics.wns + ' ns' : 'N/A'}
- TNS: ${metrics.tns !== null ? metrics.tns + ' ns' : 'N/A'}
- Setup Violations: ${metrics.setup_violations}
- Hold Violations: ${metrics.hold_violations}
- DRC Violations: ${metrics.drc_violations}

**Raw Output (last ${lines} lines):**
\`\`\`
${capturedOutput.slice(-5000)}
\`\`\`

Please provide:
1. **Summary**: What is the current state of the design?
2. **Key Issues**: What are the most critical problems found?
3. **Recommendations**: What actions should be taken next?
4. **Confidence**: How confident are you in this analysis (high/medium/low)?`;

        return {
          content: [{
            type: 'text',
            text: `📊 **EDA Output Analysis**\n\n**Captured:** ${capturedOutput.split('\n').length} lines\n**Pane:** ${pane}\n\n**Quick Metrics:**\n- WNS: ${metrics.wns !== null ? metrics.wns + ' ns' : 'N/A'}\n- TNS: ${metrics.tns !== null ? metrics.tns + ' ns' : 'N/A'}\n- Setup Violations: ${metrics.setup_violations}\n- Hold Violations: ${metrics.hold_violations}\n- DRC Violations: ${metrics.drc_violations}\n\n---\n\n**AI Analysis Prompt:**\nThe following prompt can be sent to Claude for detailed analysis:\n\n\`\`\`\n${analysisPrompt}\n\`\`\`\n\nTo get AI analysis, ask: "Analyze this EDA report" and provide the output above.`
          }],
          _metadata: {
            captured_lines: capturedOutput.split('\n').length,
            metrics,
            analysis_prompt: analysisPrompt,
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

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
