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

const HIPILOT_SESSION = process.env.HIPILOT_SESSION || 'hipilot';
// Use -L <socket> only if HIPILOT_TMUX_SOCKET is explicitly set.
// Default: use the standard tmux server socket so the MCP server
// talks to the same tmux server that the workspace was created on.
const TMUX_SOCKET = process.env.HIPILOT_TMUX_SOCKET || '';

function tmuxExec(args) {
  try {
    const socketFlag = TMUX_SOCKET ? `-L ${TMUX_SOCKET} ` : '';
    const cmd = `tmux ${socketFlag}${args}`;
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  } catch (error) {
    throw new Error('Tmux command failed: ' + error.message);
  }
}

/**
 * Resolve pane identifier to a tmux pane target.
 * Accepts: "chat"/"eda" (by title), "0"/"1" (by index), or raw pane ID.
 */
function resolvePane(pane) {
  // Numeric index - use directly
  if (/^\d+$/.test(pane)) return pane;

  // Named pane - try to find by title, fall back to index convention
  if (pane === 'chat') return '0';
  if (pane === 'eda') return '1';

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
    version: '0.2.1',
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
        description: 'Send keystrokes to a tmux pane. Use "chat" for left pane, "eda" for right pane.',
        inputSchema: {
          type: 'object',
          properties: {
            pane: { type: 'string', description: 'Pane name: chat, eda, 0, 1' },
            keys: { type: 'string', description: 'Keys to send. Use Enter to submit commands.' },
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
            pane: { type: 'string', description: 'Pane name: chat, eda, 0, 1' },
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
            pane: { type: 'string', description: 'Pane name: chat, eda, 0, 1' },
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
            pane: { type: 'string', description: 'Pane name: chat, eda, 0, 1' },
            width: { type: 'number', description: 'Width in percentage' },
            height: { type: 'number', description: 'Height in rows' },
          },
          required: ['pane'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'tmux.send_keys': {
        const paneId = resolvePane(args.pane);
        const target = `${HIPILOT_SESSION}:0.${paneId}`;
        // Send keys as-is. Caller should include "Enter" in keys if they want to submit.
        // Quote the keys to handle spaces and special characters.
        const socketFlag = TMUX_SOCKET ? `-L ${TMUX_SOCKET} ` : '';
        execSync(`tmux ${socketFlag}send-keys -t ${target} ${JSON.stringify(args.keys)}`, { encoding: 'utf-8' });
        return {
          content: [{ type: 'text', text: `Sent to pane ${args.pane}: ${args.keys}` }],
        };
      }

      case 'tmux.capture_pane': {
        const paneId = resolvePane(args.pane);
        const target = `${HIPILOT_SESSION}:0.${paneId}`;
        const lines = args.lines || 0;
        const lineArg = lines > 0 ? ` -S -${lines}` : '';
        const capture = tmuxExec(`capture-pane -t ${target} -p${lineArg}`);
        return {
          content: [{ type: 'text', text: capture }],
        };
      }

      case 'tmux.get_pane_output': {
        const paneId = resolvePane(args.pane);
        const target = `${HIPILOT_SESSION}:0.${paneId}`;
        const lines = args.lines || 100;
        const output = tmuxExec(`capture-pane -t ${target} -p -S -${lines} -E -1`);
        return {
          content: [{ type: 'text', text: output }],
        };
      }

      case 'tmux.setup_layout': {
        const workDir = args.working_dir || process.cwd();
        const socketFlag = TMUX_SOCKET ? `-L ${TMUX_SOCKET} ` : '';

        // Check if session exists
        try {
          tmuxExec(`has-session -t ${HIPILOT_SESSION}`);
          return {
            content: [{ type: 'text', text: `HiPilot session "${HIPILOT_SESSION}" already exists. Use tmux.list_panes to see layout.` }],
          };
        } catch {
          // Session doesn't exist, create it
        }

        // Create new session with 50/50 split
        execSync(`tmux ${socketFlag}new-session -d -s ${HIPILOT_SESSION} -n HiPilot -c "${workDir}"`, { encoding: 'utf-8' });
        tmuxExec(`split-window -h -t ${HIPILOT_SESSION} -l 50% -c "${workDir}"`);
        tmuxExec(`select-pane -t ${HIPILOT_SESSION}:0.0`);

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
        const panes = tmuxExec(`list-panes -t ${HIPILOT_SESSION} -F "#{pane_index} #{pane_id} #{pane_width}x#{pane_height} #{pane_current_command}"`);
        return {
          content: [{ type: 'text', text: 'Panes:\n' + panes }],
        };
      }

      case 'tmux.resize_pane': {
        const paneId = resolvePane(args.pane);
        const target = `${HIPILOT_SESSION}:0.${paneId}`;
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
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HiPilot Tmux MCP Server running');
  console.error(`  Session: ${HIPILOT_SESSION}`);
}

main().catch(console.error);
