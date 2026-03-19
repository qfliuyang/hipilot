/**
 * tools/flow-validation.js - Flow validation and tool switching tools
 *
 * Provides tools for validating stage prerequisites, detecting flow state,
 * switching between EDA tools, and checking prerequisites.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { detectTool, validateToolMatch, getToolAlias, STAGE_DEFINITIONS } from '../lib/tool-detection.js';
import { CONFIG } from '../../../src/lib/config.js';
import { buildPaneTarget } from '../../../src/lib/pane-utils.js';
import { shellEscape } from '../../../src/lib/shell-escape.js';

/**
 * Tool definitions for flow validation tools.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'eda.validate_stage',
    description: 'Validate that the current stage can proceed with the detected tool. Checks stage-tool compatibility and returns validation result with guidance.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          description: 'Flow stage name (synthesis, init_design, floorplan, placement, cts, routing, sta, etc.)',
        },
      },
      required: ['stage'],
    },
  },
  {
    name: 'eda.get_flow_state',
    description: 'Get complete flow state including current tool, detected stage, completed stages, and readiness to proceed. Essential for process-aware flow control.',
    inputSchema: {
      type: 'object',
      properties: {
        design_dir: {
          type: 'string',
          description: 'Optional design directory to check for checkpoints',
        },
      },
    },
  },
  {
    name: 'eda.switch_tool',
    description: 'Safely switch between EDA tools with proper checkpointing. Exits current tool, saves state if needed, and starts new tool. Prevents data loss.',
    inputSchema: {
      type: 'object',
      properties: {
        from_tool: {
          type: 'string',
          description: 'Current tool to exit (innovus, dc_shell, pt_shell)',
        },
        to_tool: {
          type: 'string',
          description: 'Tool to start (innovus, dc_shell, pt_shell)',
        },
        design_dir: {
          type: 'string',
          description: 'Design working directory',
        },
        save_checkpoint: {
          type: 'boolean',
          description: 'Whether to save checkpoint before switching',
          default: true,
        },
      },
      required: ['to_tool'],
    },
  },
  {
    name: 'eda.check_prerequisites',
    description: 'Check all prerequisites before running a stage: correct tool running, required checkpoints exist, previous stages completed, license available.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          description: 'Stage to check prerequisites for',
        },
        design_dir: {
          type: 'string',
          description: 'Design directory to check for checkpoints',
        },
      },
      required: ['stage'],
    },
  },
];

/**
 * Handle eda.validate_stage.
 */
export function handleValidateStage(args) {
  const { stage } = args;

  const detected = detectTool();
  const stageInfo = STAGE_DEFINITIONS[stage.toLowerCase()];

  if (!stageInfo) {
    return {
      content: [{
        type: 'text',
        text: `❓ Unknown stage: "${stage}"\n\nKnown stages: ${Object.keys(STAGE_DEFINITIONS).join(', ')}`,
      }],
      isError: true,
    };
  }

  const validation = validateToolMatch(stageInfo.tool, detected);

  let text = `## Stage Validation: ${stage}\n\n`;
  text += `**Expected Tool:** ${stageInfo.tool}\n`;
  text += `**Category:** ${stageInfo.category}\n`;
  text += `**Detected Tool:** ${detected ? detected.tool : 'none'}\n`;
  text += `**Confidence:** ${detected ? (detected.confidence * 100).toFixed(0) : 0}%\n\n`;

  if (validation.valid) {
    text += `✅ **VALID:** Correct tool is running for this stage.\n\n`;
    if (stageInfo.next) {
      text += `Next stage: ${stageInfo.next}\n`;
    }
  } else {
    text += `❌ **INVALID:** Tool mismatch detected!\n\n`;
    text += `**Issue:** ${validation.message || validation.reason}\n\n`;
    text += `**Action Required:**\n`;
    text += `1. Exit current tool: type 'exit' in EDA pane\n`;
    text += `2. Start correct tool: eda.start_tool({tool: "${stageInfo.tool}"})\n`;
    text += `3. Retry the stage\n`;
  }

  return {
    content: [{ type: 'text', text }],
    _metadata: {
      stage,
      expected_tool: stageInfo.tool,
      detected_tool: detected?.tool || null,
      valid: validation.valid,
      validation,
    },
  };
}

/**
 * Handle eda.get_flow_state.
 */
export function handleGetFlowState(args) {
  const { design_dir } = args;

  const detected = detectTool();

  // Check for existing checkpoints
  const checkpoints = [];
  const checkpointPaths = [
    { stage: 'synthesis', path: 'result/syn/data/*.v', tool: 'dc_shell' },
    { stage: 'init_design', path: 'result/pr/data/init_design.enc', tool: 'innovus' },
    { stage: 'floorplan', path: 'result/pr/data/floor_plan.enc', tool: 'innovus' },
    { stage: 'power_plan', path: 'result/pr/data/powerplan.enc', tool: 'innovus' },
    { stage: 'placement', path: 'result/pr/data/placement.enc', tool: 'innovus' },
    { stage: 'cts', path: 'result/pr/data/cts.enc', tool: 'innovus' },
    { stage: 'post_cts_opt', path: 'result/pr/data/post_cts_opt.enc', tool: 'innovus' },
    { stage: 'routing', path: 'result/pr/data/routing.enc', tool: 'innovus' },
    { stage: 'chip_finish', path: 'result/pr/data/chip_done.enc', tool: 'innovus' },
  ];

  if (design_dir && existsSync(design_dir)) {
    for (const cp of checkpointPaths) {
      const fullPath = join(design_dir, cp.path);
      try {
        const result = execSync(`ls ${fullPath} 2>/dev/null | head -1`, { encoding: 'utf-8', stdio: 'pipe' });
        if (result.trim()) {
          checkpoints.push({ stage: cp.stage, path: result.trim(), tool: cp.tool });
        }
      } catch {}
    }
  }

  // Determine current stage from checkpoints
  let currentStage = 'unknown';
  let nextStage = null;
  const stageOrder = ['synthesis', 'init_design', 'floorplan', 'power_plan', 'placement', 'cts', 'post_cts_opt', 'routing', 'chip_finish'];

  if (checkpoints.length > 0) {
    const completedStages = checkpoints.map(cp => cp.stage);
    for (const stage of stageOrder) {
      if (!completedStages.includes(stage)) {
        currentStage = stage;
        const idx = stageOrder.indexOf(stage);
        nextStage = idx < stageOrder.length - 1 ? stageOrder[idx + 1] : null;
        break;
      }
    }
    if (currentStage === 'unknown') {
      currentStage = 'complete';
    }
  } else {
    currentStage = 'synthesis';
    nextStage = 'init_design';
  }

  // Check EDA pane state
  let paneState = 'unknown';
  try {
    const paneOutput = execSync(
      `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${buildPaneTarget(CONFIG.TMUX_SESSION, CONFIG.PANE_LAYOUT.EDA)} -p -S -10 2>/dev/null || echo ""`,
      { encoding: 'utf-8', timeout: 2000 }
    );
    const lastLine = paneOutput.split('\n').filter(l => l.trim()).slice(-1)[0] || '';

    if (/innovus\s*\d+\s*>/i.test(lastLine)) paneState = 'innovus_ready';
    else if (/dc_shell\s*>/i.test(lastLine)) paneState = 'dc_shell_ready';
    else if (/pt_shell\s*>/i.test(lastLine)) paneState = 'pt_shell_ready';
    else if (/icc2_shell\s*>/i.test(lastLine)) paneState = 'icc2_ready';
    else if (/\$\s*$/.test(lastLine) || /bash/i.test(lastLine)) paneState = 'shell_idle';
    else if (paneOutput.includes('Start your EDA tool')) paneState = 'welcome';
    else paneState = 'busy_or_unknown';
  } catch {}

  // Check license availability
  let licenseStatus = 'unknown';
  try {
    const lmstat = execSync('which lmstat 2>/dev/null', { encoding: 'utf-8', stdio: 'pipe' });
    if (lmstat.trim()) licenseStatus = 'lmstat_available';
  } catch {
    licenseStatus = 'lmstat_not_found';
  }

  let text = `## Flow State\n\n`;
  text += `### Current Tool\n`;
  text += `- **Tool:** ${detected ? detected.tool : 'None detected'}\n`;
  text += `- **Confidence:** ${detected ? (detected.confidence * 100).toFixed(0) : 0}%\n`;
  text += `- **Pane State:** ${paneState}\n\n`;

  text += `### Flow Progress\n`;
  text += `- **Current Stage:** ${currentStage}\n`;
  text += `- **Next Stage:** ${nextStage || 'N/A (flow complete)'}\n`;
  text += `- **Checkpoints Found:** ${checkpoints.length}\n`;
  if (checkpoints.length > 0) {
    text += `- **Last Checkpoint:** ${checkpoints[checkpoints.length - 1].stage}\n`;
  }
  text += `\n`;

  text += `### System Status\n`;
  text += `- **License Check:** ${licenseStatus}\n\n`;

  text += `### Recommendations\n`;
  if (!detected) {
    text += `- Start EDA tool: \`eda.start_tool({tool: "${currentStage === 'synthesis' ? 'dc_shell' : 'innovus'}"})\`\n`;
  } else if (currentStage !== 'complete') {
    const expectedTool = currentStage === 'synthesis' ? 'dc_shell' : (currentStage === 'sta' ? 'pt_shell' : 'innovus');
    if (getToolAlias(detected.tool) !== getToolAlias(expectedTool)) {
      text += `- ⚠️ Tool mismatch! Expected ${expectedTool} for ${currentStage}\n`;
      text += `- Switch tool: \`eda.switch_tool({to_tool: "${expectedTool}"})\`\n`;
    } else {
      text += `- ✅ Ready to proceed with ${currentStage}\n`;
    }
  } else {
    text += `- ✅ All stages complete!\n`;
  }

  return {
    content: [{ type: 'text', text }],
    _metadata: {
      current_tool: detected,
      pane_state: paneState,
      current_stage: currentStage,
      next_stage: nextStage,
      checkpoints: checkpoints,
    },
  };
}

/**
 * Handle eda.switch_tool.
 */
export async function handleSwitchTool(args) {
  const { from_tool, to_tool, design_dir, save_checkpoint = true } = args;
  const target = `${buildPaneTarget(CONFIG.TMUX_SESSION, CONFIG.PANE_LAYOUT.EDA)}`;

  const detected = detectTool();
  const actualFromTool = from_tool || (detected ? getToolAlias(detected.tool) : null);

  if (!actualFromTool) {
    return {
      content: [{
        type: 'text',
        text: `❌ No tool currently running. Cannot determine what to exit.\n\nStart a tool first with: eda.start_tool({tool: "${to_tool}"})`,
      }],
      isError: true,
    };
  }

  let text = `## Tool Switch: ${actualFromTool} → ${to_tool}\n\n`;

  // Step 1: Save checkpoint if requested
  if (save_checkpoint) {
    text += `### Step 1: Saving checkpoint...\n`;
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 14);
      const saveCmd = actualFromTool === 'dc_shell'
        ? `write_file -format verilog -hierarchy -output pre_switch_${timestamp}.v`
        : `saveDesign pre_switch_${timestamp}.enc`;

      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} -l '${saveCmd}'`, { encoding: 'utf-8' });
      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} C-m`, { encoding: 'utf-8' });
      await new Promise(r => setTimeout(r, 2000));

      text += `✅ Checkpoint saved: pre_switch_${timestamp}.${actualFromTool === 'dc_shell' ? 'v' : 'enc'}\n\n`;
    } catch (e) {
      text += `⚠️ Checkpoint save may have failed: ${e.message}\n\n`;
    }
  }

  // Step 2: Exit current tool
  text += `### Step 2: Exiting ${actualFromTool}...\n`;
  try {
    execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} -l 'exit'`, { encoding: 'utf-8' });
    execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} C-m`, { encoding: 'utf-8' });
    await new Promise(r => setTimeout(r, 2000));
    text += `✅ Exit command sent\n\n`;
  } catch (e) {
    text += `⚠️ Exit command failed: ${e.message}\n\n`;
  }

  // Step 3: Start new tool
  text += `### Step 3: Starting ${to_tool}...\n`;

  // Validate to_tool against whitelist
  const ALLOWED_TOOLS = {
    'innovus': 'innovus -no_gui',
    'dc_shell': 'dc_shell',
    'pt_shell': 'pt_shell',
    'icc2': 'icc2_shell'
  };

  if (!ALLOWED_TOOLS[to_tool]) {
    return {
      content: [{ type: 'text', text: `❌ Invalid tool: ${to_tool}. Allowed tools: ${Object.keys(ALLOWED_TOOLS).join(', ')}` }],
      isError: true,
    };
  }

  const launchCmd = ALLOWED_TOOLS[to_tool];

  try {
    if (design_dir) {
      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} -l 'cd ${shellEscape(design_dir)}'`, { encoding: 'utf-8' });
      execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} C-m`, { encoding: 'utf-8' });
      await new Promise(r => setTimeout(r, 1000));
    }

    execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} -l '${launchCmd}'`, { encoding: 'utf-8' });
    execSync(`tmux -L ${CONFIG.TMUX_SOCKET} send-keys -t ${target} C-m`, { encoding: 'utf-8' });

    // Wait for prompt
    const startTime = Date.now();
    const timeoutMs = 120000;
    const promptPatterns = {
      'innovus': /innovus\s*\d+\s*>/i,
      'dc_shell': /dc_shell\s*>/i,
      'pt_shell': /pt_shell\s*>/i,
      'icc2': /icc2_shell\s*>/i,
    };
    const pattern = promptPatterns[to_tool] || /\$/;
    let promptFound = false;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const output = execSync(
          `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${target} -p -S -50 2>/dev/null || echo ""`,
          { encoding: 'utf-8', timeout: 5000 }
        );
        const lastLine = output.split('\n').filter(l => l.trim()).slice(-1)[0] || '';
        if (pattern.test(lastLine)) {
          text += `✅ ${to_tool} started and ready!\n`;
          text += `Prompt: ${lastLine.trim()}\n\n`;
          promptFound = true;
          break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }

    if (!promptFound) {
      text += `❌ Timeout: ${to_tool} did not start within ${timeoutMs / 1000}s\n\n`;
    }
  } catch (e) {
    text += `❌ Failed to start ${to_tool}: ${e.message}\n\n`;
  }

  text += `### Summary\n`;
  text += `- Switched from: ${actualFromTool}\n`;
  text += `- Switched to: ${to_tool}\n`;
  text += `- Checkpoint saved: ${save_checkpoint ? 'Yes' : 'No'}\n`;

  return {
    content: [{ type: 'text', text }],
    _metadata: { from_tool: actualFromTool, to_tool, save_checkpoint },
  };
}

/**
 * Handle eda.check_prerequisites.
 */
export function handleCheckPrerequisites(args) {
  const { stage, design_dir } = args;

  const prerequisites = [];

  const req = STAGE_DEFINITIONS[stage.toLowerCase()];

  if (!req) {
    return {
      content: [{
        type: 'text',
        text: `❓ Unknown stage: "${stage}"\n\nKnown stages: ${Object.keys(STAGE_DEFINITIONS).join(', ')}`,
      }],
      isError: true,
    };
  }

  // Check 1: Tool running
  const detected = detectTool();
  const toolMatch = validateToolMatch(req.tool, detected);
  prerequisites.push({
    name: 'Required tool running',
    status: toolMatch.valid ? 'PASS' : 'FAIL',
    expected: req.tool,
    actual: detected?.tool || 'none',
    detail: toolMatch.valid ? `${req.tool} is running` : `Expected ${req.tool}, found ${detected?.tool || 'none'}`,
  });

  // Check 2: Required checkpoints
  if (design_dir && req.required_checkpoints.length > 0) {
    for (const cp of req.required_checkpoints) {
      const cpPath = join(design_dir, cp);
      try {
        const result = execSync(`ls ${cpPath} 2>/dev/null | head -1`, { encoding: 'utf-8', stdio: 'pipe' });
        if (result.trim()) {
          prerequisites.push({
            name: `Checkpoint: ${cp}`,
            status: 'PASS',
            path: result.trim(),
            detail: 'Found',
          });
        } else {
          prerequisites.push({
            name: `Checkpoint: ${cp}`,
            status: 'FAIL',
            path: cpPath,
            detail: 'Not found - previous stage may be incomplete',
          });
        }
      } catch {
        prerequisites.push({
          name: `Checkpoint: ${cp}`,
          status: 'FAIL',
          path: cpPath,
          detail: 'Not found - previous stage may be incomplete',
        });
      }
    }
  }

  // Check 3: License (basic check)
  let licenseOk = true;
  try {
    execSync('which lmstat 2>/dev/null', { encoding: 'utf-8', stdio: 'pipe' });
    prerequisites.push({
      name: 'License check',
      status: 'INFO',
      detail: 'lmstat available (run license check manually)',
    });
  } catch {
    prerequisites.push({
      name: 'License check',
      status: 'WARN',
      detail: 'lmstat not found - cannot verify license availability',
    });
  }

  const passed = prerequisites.filter(p => p.status === 'PASS').length;
  const failed = prerequisites.filter(p => p.status === 'FAIL').length;
  const warnings = prerequisites.filter(p => p.status === 'WARN').length;
  const canProceed = failed === 0;

  let text = `## Prerequisites Check: ${stage}\n\n`;
  text += `**Description:** ${req.description}\n`;
  text += `**Required Tool:** ${req.tool}\n\n`;

  text += `### Check Results\n\n`;
  text += `| Check | Status | Detail |\n`;
  text += `|-------|--------|--------|\n`;
  for (const p of prerequisites) {
    const icon = p.status === 'PASS' ? '✅' : p.status === 'FAIL' ? '❌' : p.status === 'WARN' ? '⚠️' : 'ℹ️';
    text += `| ${p.name} | ${icon} ${p.status} | ${p.detail} |\n`;
  }

  text += `\n**Summary:** ${passed} passed, ${failed} failed, ${warnings} warnings\n\n`;

  if (canProceed) {
    text += `✅ **Ready to proceed!** All prerequisites met.\n`;
  } else {
    text += `❌ **Cannot proceed.** Fix failed prerequisites first.\n`;
    if (!toolMatch.valid) {
      text += `\n**Action:** Switch to correct tool:\n`;
      text += `\`\`\`\neda.switch_tool({to_tool: "${req.tool}"})\n\`\`\`\n`;
    }
  }

  return {
    content: [{ type: 'text', text }],
    _metadata: {
      stage,
      prerequisites,
      can_proceed: canProceed,
      passed,
      failed,
      warnings,
    },
  };
}

/**
 * Tool handler map for flow validation tools.
 */
export const TOOL_HANDLERS = {
  'eda.validate_stage': handleValidateStage,
  'eda.get_flow_state': handleGetFlowState,
  'eda.switch_tool': handleSwitchTool,
  'eda.check_prerequisites': handleCheckPrerequisites,
};
