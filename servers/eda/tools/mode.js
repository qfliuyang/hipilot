/**
 * tools/mode.js - Execution mode and approval tools
 *
 * Provides tools for managing execution mode (manual/auto), viewing/approving
 * pending Tcl commands, and risk analysis.
 */

import { getModeStatus, getPending, approvePending, rejectPending } from '../../../src/lib/mode.js';
import { analyzeRisk, validateConfirmation } from '../../../src/lib/risk-analyzer.js';
import { updateModeStatus } from '../lib/tmux-bridge.js';

/**
 * Approve and execute pending Tcl.
 * This function is defined in index.js and re-exported.
 */
let approveAndExecuteFn = null;
let rejectPendingTclFn = null;

export function setApprovalHandlers(approveFn, rejectFn) {
  approveAndExecuteFn = approveFn;
  rejectPendingTclFn = rejectFn;
}

/**
 * Tool definitions for mode tools.
 */
export const TOOL_DEFINITIONS = [
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
];

/**
 * Handle eda.get_mode.
 */
export function handleGetMode() {
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

/**
 * Handle eda.set_mode (deprecated - always auto).
 */
export function handleSetMode() {
  return {
    content: [{
      type: 'text',
      text: `⚡ AUTO MODE is permanent - Claude has the conn\n\nAll Tcl commands execute immediately. Manual mode has been removed.`,
    }],
  };
}

/**
 * Handle eda.toggle_mode (deprecated - always auto).
 */
export function handleToggleMode() {
  return {
    content: [{
      type: 'text',
      text: `⚡ AUTO MODE is permanent - Claude has the conn\n\nAll Tcl commands execute immediately. Manual mode has been removed.`,
    }],
  };
}

/**
 * Handle eda.get_pending.
 */
export function handleGetPending() {
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

/**
 * Handle eda.approve_pending.
 */
export function handleApprovePending() {
  if (!approveAndExecuteFn) {
    return {
      content: [{ type: 'text', text: '❌ Approval handler not initialized.' }],
      isError: true,
    };
  }

  const result = approveAndExecuteFn();
  updateModeStatus('manual', false);

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

/**
 * Handle eda.reject_pending.
 */
export function handleRejectPending() {
  if (!rejectPendingTclFn) {
    rejectPending();
  } else {
    rejectPendingTclFn();
  }
  updateModeStatus('manual', false);

  return {
    content: [{
      type: 'text',
      text: `✗ Pending Tcl rejected and cleared.`,
    }],
  };
}

/**
 * Handle eda.confirm_dangerous.
 */
export function handleConfirmDangerous(args) {
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
    if (!approveAndExecuteFn) {
      approvePending();
      updateModeStatus('manual', false);
      return {
        content: [{ type: 'text', text: `✓ ${validation.message}\n\nExecuted.` }],
      };
    }

    const result = approveAndExecuteFn();
    updateModeStatus('manual', false);

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
    updateModeStatus('manual', false);
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

/**
 * Handle eda.get_risk_analysis.
 */
export function handleGetRiskAnalysis(args) {
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

/**
 * Tool handler map for mode tools.
 */
export const TOOL_HANDLERS = {
  'eda.get_mode': handleGetMode,
  'eda.set_mode': handleSetMode,
  'eda.toggle_mode': handleToggleMode,
  'eda.get_pending': handleGetPending,
  'eda.approve_pending': handleApprovePending,
  'eda.reject_pending': handleRejectPending,
  'eda.confirm_dangerous': handleConfirmDangerous,
  'eda.get_risk_analysis': handleGetRiskAnalysis,
};
