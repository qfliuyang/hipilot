#!/usr/bin/env node
/**
 * HiPilot Tmux MCP Server
 *
 * Provides tools for tmux pane management, send-to-EDA bridge,
 * and workspace layout for VLSI physical design workflows.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { VERSION } from '../../src/lib/version.js';
import { shellEscape, validateInt } from '../../src/lib/shell-escape.js';
import { createMcpLogger } from '../../src/lib/mcp-logger.js';
import { CONFIG } from '../../src/lib/config.js';
import { resolvePaneIndex } from '../../src/lib/pane-utils.js';

function tmuxExec(args) {
  try {
    const cmd = `tmux -L ${CONFIG.TMUX_SOCKET} ${args}`;
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    throw new Error('Tmux command failed: ' + error.message);
  }
}

/**
 * Resolve pane identifier to a tmux pane target.
 * Accepts: "chat"/"eda" (by name), "supervisor"/"knowledge"/"planner"/"executor"/"archivist" (5-agent team), "0"/"5" (by index), or raw pane ID.
 */
function resolvePane(pane) {
  // Validate pane input to prevent shell injection
  if (!/^[\w%.:-]+$/.test(pane)) {
    throw new Error(`Invalid pane identifier: ${pane}`);
  }

  // Numeric index - use directly
  if (/^\d+$/.test(pane)) return pane;

  // Try named pane resolution using pane-utils (supports 5-agent team names)
  try {
    const idx = resolvePaneIndex(pane);
    return String(idx);
  } catch {
    // Not a known named pane, continue to title search
  }

  // Try by title
  try {
    const panes = tmuxExec('list-panes -F "#{pane_id}:#{pane_title}"');
    for (const line of panes.split('\n')) {
      if (!line.trim()) continue;
      const colonIdx = line.indexOf(':');
      const id = line.substring(0, colonIdx);
      const title = line.substring(colonIdx + 1);
      if (title.includes(pane)) return id;
    }
  } catch {
    // Fall through
  }

  return pane;
}

const server = new Server(
  {
    name: 'hipilot-tmux-mcp-server',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'tmux.send_keys',
        description: 'Send text and/or a key to a tmux pane. Use "chat" for left pane, "eda" for right pane. Text is sent literally; set submit=true to press Enter (C-m) after the text.',
        inputSchema: {
          type: 'object',
          properties: {
            pane: { type: 'string', description: 'Pane name: chat (0), eda (5), or numeric index 0-5' },
            keys: { type: 'string', description: 'Text to send (sent literally). Trailing "Enter" or "C-m" is auto-detected and converted to a keypress.' },
            submit: { type: 'boolean', description: 'Press Enter (C-m) after the text. Default: auto-detect from trailing Enter/C-m in keys, or false.' },
          },
          required: ['pane', 'keys'],
        },
      },
      {
        name: 'tmux.capture_pane',
        description: 'Capture current content of a tmux pane',
        inputSchema: {
          type: 'object',
          properties: {
            pane: { type: 'string', description: 'Pane name: chat (0), eda (5), or numeric index 0-5' },
            lines: { type: 'number', description: 'Number of lines to capture (default: all visible)', default: 0 },
          },
          required: ['pane'],
        },
      },
      {
        name: 'tmux.get_pane_output',
        description: 'Get last N lines from a pane (scrollback buffer)',
        inputSchema: {
          type: 'object',
          properties: {
            pane: { type: 'string', description: 'Pane name: chat (0), eda (5), or numeric index 0-5' },
            lines: { type: 'number', description: 'Number of lines (default: 100)', default: 100 },
          },
          required: ['pane'],
        },
      },
      {
        name: 'tmux.setup_layout',
        description: 'Create or attach to the HiPilot tmux workspace (50/50 split)',
        inputSchema: {
          type: 'object',
          properties: {
            working_dir: { type: 'string', description: 'Working directory for panes' },
          },
        },
      },
      {
        name: 'tmux.update_status',
        description: 'Update the tmux status bar with current context (tool, skill, job, design, mode)',
        inputSchema: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: 'Active EDA tool name' },
            skill: { type: 'string', description: 'Active skill name' },
            job_status: { type: 'string', enum: ['Running', 'Completed', 'Failed', 'Idle'] },
            design: { type: 'string', description: 'Design name' },
            wns: { type: 'string', description: 'Current WNS value' },
            mode: { type: 'string', enum: ['manual', 'auto'], description: 'Execution mode' },
            pending: { type: 'boolean', description: 'Whether there is pending Tcl waiting for approval' },
          },
        },
      },
      {
        name: 'tmux.set_mode_status',
        description: 'Update status bar to show current execution mode (manual/auto)',
        inputSchema: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['manual', 'auto'], description: 'Execution mode' },
            pending: { type: 'boolean', description: 'Pending Tcl waiting for approval' },
          },
          required: ['mode'],
        },
      },
      {
        name: 'tmux.list_panes',
        description: 'List all panes in the HiPilot session',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'tmux.resize_pane',
        description: 'Resize a pane by percentage or absolute size',
        inputSchema: {
          type: 'object',
          properties: {
            pane: { type: 'string', description: 'Pane name: chat (0), eda (5), or numeric index 0-5' },
            width: { type: 'number', description: 'Width in percentage' },
            height: { type: 'number', description: 'Height in rows' },
          },
          required: ['pane'],
        },
      },
    ],
  };
});

const mcpLog = createMcpLogger('tmux');

server.setRequestHandler(CallToolRequestSchema, mcpLog.wrapHandler(async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'tmux.send_keys': {
        const paneId = resolvePane(args.pane);
        const target = `${CONFIG.TMUX_SESSION}:0.${paneId}`;

        let text = args.keys;
        let shouldSubmit = args.submit;

        // Auto-detect trailing Enter/C-m in the keys string and strip it.
        // "Enter" and "C-m" inside shellEscape quotes become literal text,
        // so we must send them as separate unquoted tmux key names.
        if (shouldSubmit === undefined) {
          if (/\s+Enter\s*$/.test(text)) {
            text = text.replace(/\s+Enter\s*$/, '');
            shouldSubmit = true;
          } else if (/\s+C-m\s*$/.test(text)) {
            text = text.replace(/\s+C-m\s*$/, '');
            shouldSubmit = true;
          } else {
            shouldSubmit = false;
          }
        }

        // Step 1: Send text literally (in quotes so tmux treats it as literal text)
        if (text) {
          execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} -l ${shellEscape(text)}`, { encoding: 'utf-8' });
        }

        // Step 2: Send Enter (C-m) as a real keypress, unquoted
        if (shouldSubmit) {
          execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} C-m`, { encoding: 'utf-8' });
        }

        return {
          content: [{ type: 'text', text: `Sent to pane ${args.pane}: ${text}${shouldSubmit ? ' [Enter]' : ''}` }],
        };
      }

      case 'tmux.capture_pane': {
        const paneId = resolvePane(args.pane);
        const target = `${CONFIG.TMUX_SESSION}:0.${paneId}`;
        const lines = args.lines || 0;
        const lineArg = lines > 0 ? ` -S -${lines}` : '';
        const capture = tmuxExec(`capture-pane -t ${target} -p${lineArg}`);
        return {
          content: [{ type: 'text', text: capture }],
        };
      }

      case 'tmux.get_pane_output': {
        const paneId = resolvePane(args.pane);
        const target = `${CONFIG.TMUX_SESSION}:0.${paneId}`;
        const lines = args.lines || 100;
        const output = tmuxExec(`capture-pane -t ${target} -p -S -${lines} -E -1`);
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'tmux.setup_layout': {
        const workDir = args.working_dir || process.cwd();

        // Check if session exists
        try {
          tmuxExec(`has-session -t ${CONFIG.TMUX_SESSION}`);
          return {
            content: [{ type: 'text', text: `HiPilot session "${CONFIG.TMUX_SESSION}" already exists. Use tmux.list_panes to see layout.` }],
          };
        } catch {
          // Session doesn't exist, create it
        }

        // Create new session with 50/50 split
        execSync(`tmux -L ${CONFIG.TMUX_SOCKET} new-session -d -s ${CONFIG.TMUX_SESSION} -n HiPilot -c ${shellEscape(workDir)}`, { encoding: 'utf-8' });
        tmuxExec(`split-window -h -t ${CONFIG.TMUX_SESSION} -l 50% -c ${shellEscape(workDir)}`);
        tmuxExec(`select-pane -t ${CONFIG.TMUX_SESSION}:0.0`);

        return {
          content: [{ type: 'text', text: `Created HiPilot workspace: 50/50 split in "${workDir}"\n  Pane 0 (left): Chat\n  Pane 1 (right): EDA` }],
        };
      }

      case 'tmux.update_status': {
        const { tool, skill, job_status, design, wns, mode, pending } = args;
        
        let statusLeft;
        if (mode === 'auto') {
          statusLeft = `#[fg=#000000,bg=#00ff88,bold] ⚡ Claude has conn #[default]#[fg=#666666]│`;
        } else {
          const pendingIndicator = pending ? ' ⏳' : '';
          statusLeft = `#[fg=#00d4ff,bg=#1a1a2e,bold] ⚙ HiPilot #[fg=#666666]│#[fg=#ffd700] 🔒 Manual${pendingIndicator} #[fg=#666666]│`;
        }
        
        try {
          tmuxExec(`set-option -g status-left "${statusLeft}"`);
        } catch {
          // Status bar update is best-effort
        }
        
        const parts = [];
        if (tool) parts.push('Tool: ' + tool);
        if (skill) parts.push('Skill: ' + skill);
        if (job_status) parts.push('Status: ' + job_status);
        if (design) parts.push('Design: ' + design);
        if (wns) parts.push('WNS: ' + wns);
        const statusText = parts.join(' | ');
        
        try {
          tmuxExec(`set-option -p pane-border-format " ${statusText} "`);
        } catch {
          // Status bar update is best-effort
        }
        
        return {
          content: [{ type: 'text', text: 'Status updated: ' + statusText + (mode ? ` (mode: ${mode})` : '') }],
        };
      }

      case 'tmux.set_mode_status': {
        const { mode, pending = false } = args;
        
        let statusLeft;
        let message;
        
        if (mode === 'auto') {
          statusLeft = `#[fg=#000000,bg=#00ff88,bold] ⚡ Claude has conn #[default]#[fg=#666666]│`;
          message = '⚡ AUTO MODE - Claude has the conn';
        } else {
          const pendingIndicator = pending ? ' ⏳ pending' : '';
          statusLeft = `#[fg=#00d4ff,bg=#1a1a2e,bold] ⚙ HiPilot #[fg=#666666]│#[fg=#ffd700] 🔒 Manual${pendingIndicator} #[fg=#666666]│`;
          message = '🔒 MANUAL MODE - Approval required' + (pending ? ' (Tcl pending)' : '');
        }
        
        try {
          tmuxExec(`set-option -g status-left "${statusLeft}"`);
        } catch {
          // Status bar update is best-effort
        }
        
        return {
          content: [{ type: 'text', text: message }],
        };
      }

      case 'tmux.list_panes': {
        const panes = tmuxExec(`list-panes -t ${CONFIG.TMUX_SESSION} -F "#{pane_index} #{pane_id} #{pane_width}x#{pane_height} #{pane_current_command}"`);
        return {
          content: [{ type: 'text', text: 'Panes:\n' + panes }],
        };
      }

      case 'tmux.resize_pane': {
        const paneId = resolvePane(args.pane);
        const target = `${CONFIG.TMUX_SESSION}:0.${paneId}`;
        if (args.width) tmuxExec(`resize-pane -t ${target} -x ${args.width}%`);
        if (args.height) tmuxExec(`resize-pane -t ${target} -y ${args.height}`);
        return {
          content: [{ type: 'text', text: 'Resized pane ' + args.pane }],
        };
      }

      default:
        throw new Error('Unknown tool: ' + name);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: 'Error: ' + error.message }],
      isError: true,
    };
  }
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HiPilot Tmux MCP Server running');
  console.error(`  Session: ${CONFIG.TMUX_SESSION}`);
}

main().catch(console.error);
