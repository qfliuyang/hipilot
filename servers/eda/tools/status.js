/**
 * tools/status.js - System status and quick operations tools
 *
 * Provides tools for getting system status and quick EDA operations.
 */

import { execSync } from 'child_process';
import { CONFIG } from '../../../src/lib/config.js';
import { buildPaneTarget } from '../../../src/lib/pane-utils.js';
import { getModeStatus, getPending } from '../../../src/lib/mode.js';
import { detectTool } from '../lib/tool-detection.js';
import { listTemplates } from '../lib/tcl-renderer.js';

/**
 * Tool definitions for status tools.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'eda.get_status',
    description: 'Get comprehensive HiPilot system status. USE THIS FIRST before any EDA operation to understand the current state. Returns: mode, pending Tcl, detected EDA tool, and available actions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Handle eda.get_status.
 */
export function handleGetStatus() {
  // Get comprehensive system status INCLUDING what's on screen in both panes.
  // This gives Claude Code "eyes" — it can see the right pane through MCP.
  const modeStatus = getModeStatus();
  const pending = getPending();
  const detectedTool = detectTool();
  const templates = listTemplates();

  // Capture both panes so Claude can SEE what's happening
  let edaPaneText = '';
  let claudePaneText = '';
  try {
    edaPaneText = execSync(
      `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${buildPaneTarget(CONFIG.TMUX_SESSION, CONFIG.PANE_LAYOUT.EDA)} -p -S -50 2>/dev/null || echo ""`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
  } catch { edaPaneText = '(could not capture)'; }
  try {
    claudePaneText = execSync(
      `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${buildPaneTarget(CONFIG.TMUX_SESSION, CONFIG.PANE_LAYOUT.SUPERVISOR)} -p -S -20 2>/dev/null || echo ""`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
  } catch { claudePaneText = '(could not capture)'; }

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
    text += `None detected — call eda.start_tool to launch one`;
  }
  text += `\n`;

  // Pending Tcl
  if (pending.exists) {
    text += `**Pending Tcl:** Yes (${pending.tcl.split('\n').length} lines)\n`;
  }

  // Templates
  text += `**Templates Available:** ${templates.length}\n`;
  text += `\n`;

  // RIGHT PANE SNAPSHOT — this is Claude's "eyes" on the EDA tool
  text += `### Right Pane (EDA Tool) — last 20 lines\n\n`;
  const edaLines = edaPaneText.split('\n').filter(l => l.trim()).slice(-20);
  if (edaLines.length > 0) {
    text += '```\n' + edaLines.join('\n') + '\n```\n\n';
    // Tell Claude what the pane state means
    const lastEdaLine = edaLines[edaLines.length - 1] || '';
    if (/innovus\s*\d+>/.test(lastEdaLine)) {
      text += `**→ Innovus is running and ready for commands**\n\n`;
    } else if (/icc2_shell>/.test(lastEdaLine)) {
      text += `**→ ICC2 is running and ready for commands**\n\n`;
    } else if (/\$\s*$/.test(lastEdaLine)) {
      text += `**→ Shell prompt — no EDA tool running. Call eda.start_tool first.**\n\n`;
    } else {
      text += `**→ EDA tool may be running a command (no prompt visible)**\n\n`;
    }
  } else {
    text += `(empty)\n\n`;
  }

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

/**
 * Tool handler map for status tools.
 */
export const TOOL_HANDLERS = {
  'eda.get_status': handleGetStatus,
};
