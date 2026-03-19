/**
 * tools/execution.js - EDA tool execution and control
 *
 * Provides eda.start_tool tool for launching EDA tools.
 * The execute_tcl and execute_and_verify functions remain in index.js
 * due to their dependencies on mode system and risk analysis.
 */

import { execSync } from 'child_process';
import { CONFIG } from '../../../src/lib/config.js';
import { buildPaneTarget } from '../../../src/lib/pane-utils.js';
import { shellEscape } from '../../../src/lib/shell-escape.js';
import { validatePane, validateToolName, validateTimeout } from '../../../src/lib/mcp-validation.js';
import { detectTool } from '../lib/tool-detection.js';

/**
 * Tool definitions for execution tools.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'eda.start_tool',
    description: 'Start an EDA tool in the right pane via tmux. Sends the launch command, waits for the prompt, and returns when ready. Use this before running workflows so the user does not need to start the tool manually. If a tool is already running, returns immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        tool: {
          type: 'string',
          description: 'EDA tool to start: innovus (default), icc2_shell, dc_shell, pt_shell',
          enum: ['innovus', 'icc2_shell', 'dc_shell', 'pt_shell'],
          default: 'innovus',
        },
        design_dir: {
          type: 'string',
          description: 'Optional: change to this directory before starting (e.g. /home/EDA/hipilot_test/ibex_work_upload for Ibex)',
        },
        pane: {
          type: 'string',
          description: 'Target pane (default: eda)',
          enum: ['eda', 'chat', '0', '1'],
          default: 'eda',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in seconds waiting for tool prompt (default: 90 for innovus, 60 for others)',
          default: 90,
        },
      },
    },
  },
];

/**
 * Wait for a command to complete by polling for prompt.
 * @param {string} target - Tmux pane target
 * @param {number} timeout - Timeout in seconds
 * @returns {Promise<{success: boolean, output: string, elapsed: number}>}
 */
async function waitForPrompt(target, timeout = 60) {
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
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
        `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${target} -p -S -50 2>/dev/null || echo ""`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      const lastLine = output.split('\n').filter(l => l.trim()).slice(-1)[0] || '';
      for (const pattern of promptPatterns) {
        if (pattern.test(lastLine)) {
          return {
            success: true,
            output: lastLine.trim(),
            elapsed: Date.now() - startTime,
          };
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  return {
    success: false,
    output: '',
    elapsed: Date.now() - startTime,
  };
}

/**
 * Handle eda.start_tool tool call.
 */
export async function handleStartTool(args) {
  const { tool = 'innovus', design_dir, pane = 'eda', timeout } = args;
  const validatedPane = validatePane(pane);
  const validatedTool = validateToolName(tool);
  const validatedTimeout = timeout !== undefined ? validateTimeout(timeout, 180) : undefined;
  const target = buildPaneTarget(CONFIG.TMUX_SESSION, validatedPane);

  // Check current tool state
  const detected = detectTool();
  const toolMap = { innovus: 'Innovus', icc2_shell: 'ICC2', pt_shell: 'PrimeTime', dc_shell: 'DesignCompiler' };
  const requestedToolName = toolMap[tool];

  // If requested tool already running, return success
  if (detected && detected.tool === requestedToolName) {
    return {
      content: [{
        type: 'text',
        text: `✓ ${detected.tool} is already running. Ready for commands.`,
      }],
    };
  }

  // If WRONG tool is running, exit it first
  if (detected && detected.tool !== requestedToolName) {
    try {
      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} -l 'exit'`, { encoding: 'utf-8' });
      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} C-m`, { encoding: 'utf-8' });
      await new Promise(r => setTimeout(r, 2000)); // Wait for exit
    } catch (e) {
      // Continue anyway, might already be at bash prompt
    }
  }

  const launchCmd = validatedTool === 'innovus'
    ? 'innovus -no_gui'
    : validatedTool === 'icc2_shell'
      ? 'icc2_shell'
      : validatedTool === 'dc_shell'
        ? 'dc_shell -no_gui'
        : 'pt_shell';
  const waitSeconds = validatedTimeout ?? (validatedTool === 'innovus' ? 90 : 60);

  // Check if target pane exists, recreate if needed
  try {
    execSync(`tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${target} -p -S -1 2>/dev/null`, { encoding: 'utf-8' });
  } catch {
    // Pane doesn't exist - need to recreate it
    try {
      // Split window to create new pane
      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} split-window -h -t ${buildPaneTarget(CONFIG.TMUX_SESSION, CONFIG.PANE_LAYOUT.SUPERVISOR)} -c ${design_dir ? shellEscape(design_dir).slice(1, -1) : process.env.HOME || '/home/EDA'} 2>/dev/null || tmux -L ${CONFIG.TMUX_SOCKET} split-window -h -t ${buildPaneTarget(CONFIG.TMUX_SESSION, CONFIG.PANE_LAYOUT.SUPERVISOR)}`, { encoding: 'utf-8' });
      // Enable remain-on-exit for the new pane
      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} set-option -t ${target} remain-on-exit on 2>/dev/null || true`, { encoding: 'utf-8' });
    } catch (recreateError) {
      return {
        content: [{ type: 'text', text: `❌ Failed to recreate EDA pane: ${recreateError.message}` }],
        isError: true,
      };
    }
  }

  try {
    if (design_dir) {
      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} -l 'cd ${shellEscape(design_dir)}'`, { encoding: 'utf-8' });
      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} C-m`, { encoding: 'utf-8' });
      await new Promise(r => setTimeout(r, 800));
    }
    execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} -l '${launchCmd}'`, { encoding: 'utf-8' });
    execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} C-m`, { encoding: 'utf-8' });
  } catch (e) {
    return {
      content: [{ type: 'text', text: `❌ Failed to send start command: ${e.message}` }],
      isError: true,
    };
  }

  // Wait for EDA prompt
  const result = await waitForPrompt(target, waitSeconds);
  const elapsedS = (result.elapsed / 1000).toFixed(1);

  if (result.success) {
    return {
      content: [{
        type: 'text',
        text: `✓ ${toolMap[tool] || tool} started and ready after ${elapsedS}s\n\nPrompt: ${result.output}`,
      }],
    };
  }

  return {
    content: [{ type: 'text', text: `⏱ Timeout waiting for ${tool} prompt after ${waitSeconds}s. The tool may still be starting.` }],
    isError: true,
  };
}

/**
 * Tool handler map for execution tools.
 */
export const TOOL_HANDLERS = {
  'eda.start_tool': handleStartTool,
};

// Export waitForPrompt for use by execute_and_verify
export { waitForPrompt };
