/**
 * tools/capture.js - Pane capture and monitoring tools
 *
 * Provides tools for capturing EDA pane output, waiting for patterns,
 * and monitoring execution state.
 */

import { execSync } from 'child_process';
import { CONFIG } from '../../../src/lib/config.js';
import { buildPaneTarget } from '../../../src/lib/pane-utils.js';
import { validatePane, validateTimeout } from '../../../src/lib/mcp-validation.js';
import { analyzeReport, REPORT_TYPES } from '../../../src/lib/report-analyzer.js';
import { getCachedAnalysis, setCachedAnalysis, generateActionButtons, formatActionButtons } from '../../../src/lib/report-cache.js';

/**
 * Tool definitions for capture tools.
 */
export const TOOL_DEFINITIONS = [
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
    name: 'eda.peek',
    description: 'Instantly capture what is currently visible in the EDA tool pane (right pane). Returns the last N lines plus a state assessment: is the tool running, is the prompt back, are there errors? Call this repeatedly to watch progress of long-running commands.',
    inputSchema: {
      type: 'object',
      properties: {
        lines: {
          type: 'number',
          description: 'Number of lines to capture (default: 30)',
          default: 30,
        },
      },
    },
  },
  {
    name: 'eda.await_idle',
    description: 'DEFINITIVE: Wait for EDA pane to become idle (like a human watching). Detects when output stops changing AND prompt appears. This is the primary tool for knowing when a command has completed. Polls internally every 500ms and returns immediately when idle is detected.',
    inputSchema: {
      type: 'object',
      properties: {
        timeout: {
          type: 'number',
          description: 'Maximum wait time in seconds (default: 300)',
          default: 300,
        },
        stability_ms: {
          type: 'number',
          description: 'How long output must be unchanged to consider idle (default: 1500ms)',
          default: 1500,
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
];

/**
 * Capture pane output.
 */
function capturePane(pane, lines = 200) {
  const target = buildPaneTarget(CONFIG.TMUX_SESSION, pane);
  return execSync(
    `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${target} -p -S -${lines}`,
    { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
  );
}

/**
 * Wait for a pattern to appear in pane output.
 */
async function waitForPattern(patternStr, pane, timeout) {
  const target = buildPaneTarget(CONFIG.TMUX_SESSION, pane);
  const pattern = new RegExp(patternStr);
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const output = execSync(
        `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${target} -p -S -100 2>/dev/null || echo ""`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      const match = output.match(pattern);
      if (match) {
        return {
          success: true,
          matched: match[0],
          elapsed: Date.now() - startTime,
        };
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  return {
    success: false,
    matched: null,
    elapsed: Date.now() - startTime,
  };
}

/**
 * Wait for tool prompt.
 */
async function waitForPrompt(pane, timeout) {
  const target = buildPaneTarget(CONFIG.TMUX_SESSION, pane);
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  const promptPatterns = [
    /innovus\s*\d+>/i,
    /icc2_shell>/i,
    /icc2>/i,
    /pt_shell>/i,
    /tempus\s*\d*>/i,
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
            prompt: lastLine.trim(),
            elapsed: Date.now() - startTime,
          };
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  return {
    success: false,
    prompt: null,
    elapsed: Date.now() - startTime,
  };
}

/**
 * Wait for pane to become idle.
 */
async function awaitIdle(pane, timeout, stabilityMs) {
  const target = buildPaneTarget(CONFIG.TMUX_SESSION, pane);
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  const stabilityWindow = stabilityMs;

  let lastContent = '';
  let stableSince = null;
  const promptPatterns = [
    /innovus\s*\d+>/i,
    /icc2_shell>/i,
    /icc2>/i,
    /pt_shell>/i,
    /tempus\s*\d*>/i,
  ];

  while (Date.now() - startTime < timeoutMs) {
    try {
      const content = execSync(
        `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${target} -p 2>/dev/null || echo ""`,
        { encoding: 'utf-8', timeout: 5000 }
      );

      // Check for prompt
      const lastLine = content.split('\n').filter(l => l.trim()).slice(-1)[0] || '';
      const hasPrompt = promptPatterns.some(p => p.test(lastLine));

      // Check for stability
      if (content === lastContent && hasPrompt) {
        if (stableSince === null) {
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= stabilityWindow) {
          return {
            success: true,
            idle: true,
            elapsed: Date.now() - startTime,
            prompt: lastLine.trim(),
          };
        }
      } else {
        stableSince = null;
        lastContent = content;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  return {
    success: false,
    idle: false,
    elapsed: Date.now() - startTime,
    prompt: null,
  };
}

/**
 * Handle eda.capture_and_analyze.
 */
export async function handleCaptureAndAnalyze(args) {
  const { pane = 'eda', lines = 200, report_type = 'auto', use_cache = true } = args;

  // Capture EDA pane output
  let capturedOutput;
  try {
    capturedOutput = capturePane(pane, lines);
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
    analysis = analyzeReport(capturedOutput, report_type);
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

/**
 * Handle eda.peek.
 */
export function handlePeek(args) {
  const { lines = 30 } = args;
  const target = buildPaneTarget(CONFIG.TMUX_SESSION, 'eda');

  let output;
  try {
    output = execSync(
      `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${target} -p -S -${lines} 2>/dev/null || echo ""`,
      { encoding: 'utf-8', timeout: 5000 }
    );
  } catch (e) {
    return {
      content: [{ type: 'text', text: `❌ Failed to capture pane: ${e.message}` }],
      isError: true,
    };
  }

  const linesList = output.split('\n');
  const lastLine = linesList.filter(l => l.trim()).slice(-1)[0] || '';

  // Detect state
  const hasPrompt = /innovus\s*\d+>|icc2_shell>|pt_shell>|tempus\s*\d*>|\]$/i.test(lastLine);
  const hasErrors = /error|failed|cannot|fatal/i.test(output);
  const isBusy = !hasPrompt && output.length > 100;

  let state = 'unknown';
  if (hasPrompt) state = 'idle';
  else if (isBusy) state = 'busy';

  let text = `👁️ **EDA Pane Peek**\n\n`;
  text += `**State:** ${state === 'idle' ? '🟢 Idle (prompt ready)' : state === 'busy' ? '🟡 Busy' : '⚪ Unknown'}\n`;
  text += `**Lines captured:** ${linesList.length}\n`;
  text += `**Last line:** ${lastLine.trim().slice(0, 80)}\n`;
  if (hasErrors) {
    text += `⚠️ **Errors detected** in output\n`;
  }

  text += `\n\`\`\`\n${output}\n\`\`\`\n`;

  return {
    content: [{ type: 'text', text }],
    _metadata: { state, has_prompt: hasPrompt, has_errors: hasErrors },
  };
}

/**
 * Handle eda.await_idle.
 */
export async function handleAwaitIdle(args) {
  const { timeout = 300, stability_ms = 1500, pane = 'eda' } = args;
  const validatedPane = validatePane(pane);

  const result = await awaitIdle(validatedPane, timeout, stability_ms);

  if (result.success && result.idle) {
    return {
      content: [{
        type: 'text',
        text: `✅ **EDA Pane Idle**\n\nWaited ${result.elapsed}ms for output to stabilize.\n**Prompt:** ${result.prompt}`,
      }],
      _metadata: { idle: true, elapsed_ms: result.elapsed, prompt: result.prompt },
    };
  }

  return {
    content: [{ type: 'text', text: `⏱ Timed out after ${timeout}s waiting for idle state.` }],
    isError: true,
    _metadata: { idle: false, elapsed_ms: result.elapsed },
  };
}

/**
 * Handle eda.get_last_result.
 */
export function handleGetLastResult(args) {
  const { lines = 50, pane = 'eda' } = args;
  const target = buildPaneTarget(CONFIG.TMUX_SESSION, pane);

  let output;
  try {
    output = execSync(
      `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${target} -p -S -${lines} 2>/dev/null || echo ""`,
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
      const outputLines = output.split('\n');
      for (const line of outputLines) {
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

/**
 * Handle eda.wait_for_pattern.
 */
export async function handleWaitForPattern(args) {
  const { pattern, timeout = 60, pane = 'eda' } = args;
  const validatedPane = validatePane(pane);

  const result = await waitForPattern(pattern, validatedPane, timeout);

  if (result.success) {
    return {
      content: [{
        type: 'text',
        text: `✅ Pattern matched after ${(result.elapsed / 1000).toFixed(1)}s\n\nMatched:\n${result.matched}`,
      }],
      _metadata: { matched: result.matched, elapsed_ms: result.elapsed },
    };
  }

  return {
    content: [{ type: 'text', text: `⏱ Timed out after ${timeout}s waiting for pattern: ${pattern}` }],
    isError: true,
    _metadata: { elapsed_ms: result.elapsed },
  };
}

/**
 * Handle eda.wait_for_prompt.
 */
export async function handleWaitForPrompt(args) {
  const { timeout = 30, pane = 'eda' } = args;
  const validatedPane = validatePane(pane);

  const result = await waitForPrompt(validatedPane, timeout);

  if (result.success) {
    return {
      content: [{
        type: 'text',
        text: `✅ Prompt detected after ${(result.elapsed / 1000).toFixed(1)}s\n\n${result.prompt}`,
      }],
      _metadata: { prompt: result.prompt, elapsed_ms: result.elapsed },
    };
  }

  return {
    content: [{ type: 'text', text: `⏱ Timed out after ${timeout}s waiting for prompt` }],
    isError: true,
    _metadata: { elapsed_ms: result.elapsed },
  };
}

/**
 * Tool handler map for capture tools.
 */
export const TOOL_HANDLERS = {
  'eda.capture_and_analyze': handleCaptureAndAnalyze,
  'eda.peek': handlePeek,
  'eda.await_idle': handleAwaitIdle,
  'eda.get_last_result': handleGetLastResult,
  'eda.wait_for_pattern': handleWaitForPattern,
  'eda.wait_for_prompt': handleWaitForPrompt,
};
