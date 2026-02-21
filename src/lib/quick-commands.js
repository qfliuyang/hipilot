/**
 * HiPilot Quick Commands Parser
 *
 * Parses and executes quick commands like /timing, /drc, /compare, /history
 * These commands provide one-call solutions for common EDA operations.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { getHipilotPaths } from './paths.js';
import { VERSION } from './version.js';

const colors = {
  cyan: '#8be9fd',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  red: '#ff5555',
  magenta: '#ff79c6',
};

/**
 * Quick command definitions
 */
export const QUICK_COMMANDS = {
  timing: {
    name: 'timing',
    description: 'Generate and execute a timing report',
    usage: '/timing [path_group]',
    examples: ['/timing', '/timing reg2reg', '/timing in2out'],
    mcpOperation: 'timing',
    hasArgument: true,
    argumentName: 'path_group',
    argumentDescription: 'Optional path group to focus on (e.g., reg2reg, in2reg)',
  },
  drc: {
    name: 'drc',
    description: 'Run Design Rule Check on the current design',
    usage: '/drc',
    examples: ['/drc'],
    mcpOperation: 'drc',
    hasArgument: false,
  },
  compare: {
    name: 'compare',
    description: 'Compare QoR metrics with baseline',
    usage: '/compare [baseline|last]',
    examples: ['/compare', '/compare last', '/compare baseline'],
    mcpOperation: null, // Handled locally
    hasArgument: true,
    argumentName: 'baseline',
    argumentDescription: 'Baseline to compare against ("last" for most recent checkpoint)',
  },
  history: {
    name: 'history',
    description: 'Show Tcl commands sent this session',
    usage: '/history',
    examples: ['/history'],
    mcpOperation: null, // Handled locally
    hasArgument: false,
  },
  power: {
    name: 'power',
    description: 'Generate power report',
    usage: '/power',
    examples: ['/power'],
    mcpOperation: 'power',
    hasArgument: false,
  },
  area: {
    name: 'area',
    description: 'Generate area/utilization report',
    usage: '/area',
    examples: ['/area'],
    mcpOperation: 'area',
    hasArgument: false,
  },
};

/**
 * Parse a quick command from input string
 * @param {string} input - The command input (e.g., "/timing reg2reg")
 * @returns {object|null} - Parsed command or null if not a quick command
 */
export function parseQuickCommand(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Quick commands start with /
  if (!trimmed.startsWith('/')) {
    return null;
  }

  // Extract command name and argument
  const parts = trimmed.slice(1).split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const argument = parts.slice(1).join(' ').trim() || null;

  const commandDef = QUICK_COMMANDS[commandName];
  if (!commandDef) {
    return {
      isQuickCommand: true,
      isValid: false,
      command: commandName,
      argument,
      error: `Unknown command: /${commandName}. Available: ${Object.keys(QUICK_COMMANDS).join(', ')}`,
    };
  }

  // Validate argument presence
  if (commandDef.hasArgument && !argument) {
    return {
      isQuickCommand: true,
      isValid: true,
      command: commandName,
      argument: null,
      definition: commandDef,
      warning: `No ${commandDef.argumentName} provided. Using defaults.`,
    };
  }

  return {
    isQuickCommand: true,
    isValid: true,
    command: commandName,
    argument,
    definition: commandDef,
  };
}

/**
 * Check if input is a quick command
 * @param {string} input - The input to check
 * @returns {boolean}
 */
export function isQuickCommand(input) {
  const parsed = parseQuickCommand(input);
  return parsed !== null && parsed.isValid;
}

/**
 * Get list of available quick commands
 * @returns {array} - Array of command definitions
 */
export function listQuickCommands() {
  return Object.values(QUICK_COMMANDS);
}

/**
 * Get help text for a specific command
 * @param {string} commandName - The command name
 * @returns {string|null} - Help text or null if command not found
 */
export function getCommandHelp(commandName) {
  const cmd = QUICK_COMMANDS[commandName.toLowerCase()];
  if (!cmd) return null;

  let help = `/${cmd.name}\n`;
  help += `  ${cmd.description}\n\n`;
  help += `Usage: ${cmd.usage}\n`;
  if (cmd.hasArgument) {
    help += `Argument: ${cmd.argumentName} - ${cmd.argumentDescription}\n`;
  }
  help += `\nExamples:\n`;
  for (const ex of cmd.examples) {
    help += `  ${ex}\n`;
  }

  return help;
}

/**
 * Execute a quick command via MCP
 * @param {object} parsed - The parsed command from parseQuickCommand()
 * @returns {object} - Execution result
 */
export async function executeQuickCommand(parsed) {
  if (!parsed.isValid) {
    return {
      success: false,
      error: parsed.error,
    };
  }

  const { command, argument, definition } = parsed;

  // Handle locally-processed commands
  if (command === 'history') {
    return executeHistoryCommand();
  }

  if (command === 'compare') {
    return executeCompareCommand(argument);
  }

  // Commands that require MCP - return the MCP call specification
  // The caller is responsible for making the actual MCP call
  if (definition.mcpOperation) {
    return {
      success: true,
      requiresMcp: true,
      mcpTool: 'eda.quick',
      mcpParams: {
        operation: definition.mcpOperation,
        params: argument ? { path_group: argument } : {},
      },
      message: `Quick command /${command} ready for execution`,
      description: definition.description,
    };
  }

  return {
    success: false,
    error: `Command /${command} has no implementation`,
  };
}

/**
 * Execute the /history command
 * Shows Tcl commands sent this session
 */
function executeHistoryCommand() {
  const paths = getHipilotPaths();
  const historyDir = join(paths.baseDir, '..', 'history');
  const execDir = paths.execDir;
  const generatedDir = paths.generatedDir;

  const commands = [];

  // Collect from exec directory (sent commands)
  if (existsSync(execDir)) {
    try {
      const files = readdirSync(execDir)
        .filter(f => f.startsWith('hipilot_exec_') && f.endsWith('.tcl'))
        .map(f => {
          const fullPath = join(execDir, f);
          const stats = statSync(fullPath);
          const content = readFileSync(fullPath, 'utf-8');
          return {
            type: 'executed',
            timestamp: stats.mtime,
            file: f,
            path: fullPath,
            content,
            lines: content.split('\n').length,
          };
        });
      commands.push(...files);
    } catch (err) {
      // Ignore errors reading exec dir
    }
  }

  // Collect from generated directory
  if (existsSync(generatedDir)) {
    try {
      const files = readdirSync(generatedDir)
        .filter(f => f.startsWith('hipilot_generated_') && f.endsWith('.tcl'))
        .map(f => {
          const fullPath = join(generatedDir, f);
          const stats = statSync(fullPath);
          const content = readFileSync(fullPath, 'utf-8');
          // Determine source from content
          const source = content.includes('[✓ Template]') ? 'template' :
                        content.includes('[⚠ Unverified]') ? 'generated' : 'unknown';
          return {
            type: 'generated',
            timestamp: stats.mtime,
            file: f,
            path: fullPath,
            content,
            lines: content.split('\n').length,
            source,
          };
        });
      commands.push(...files);
    } catch (err) {
      // Ignore errors reading generated dir
    }
  }

  // Sort by timestamp
  commands.sort((a, b) => a.timestamp - b.timestamp);

  if (commands.length === 0) {
    return {
      success: true,
      message: 'No commands found in session history.\n\nCommands are stored when you use eda.send_to_terminal() or eda.quick().',
    };
  }

  // Build output
  let output = `Session History (${commands.length} commands):\n\n`;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const time = cmd.timestamp.toLocaleTimeString();
    const indicator = cmd.type === 'executed' ? '▶' : '◆';
    const source = cmd.source ? ` [${cmd.source}]` : '';

    output += `${i + 1}. ${indicator} ${time}${source} (${cmd.lines} lines)\n`;

    // Show first few lines of content
    const previewLines = cmd.content.split('\n').slice(0, 3);
    for (const line of previewLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        output += `   ${trimmed.substring(0, 60)}${trimmed.length > 60 ? '...' : ''}\n`;
      }
    }
    output += '\n';
  }

  return {
    success: true,
    message: output,
    commands,
  };
}

/**
 * Execute the /compare command
 * Compares current QoR with baseline
 */
function executeCompareCommand(baseline) {
  // This is a placeholder - full implementation would:
  // 1. Load baseline metrics from checkpoint
  // 2. Run current reports
  // 3. Extract and compare metrics
  // 4. Show deltas

  const checkpointDir = join(process.cwd(), '.hipilot', 'checkpoints');

  if (!existsSync(checkpointDir)) {
    return {
      success: true,
      message: `No checkpoints directory found at ${checkpointDir}\n\nTo use /compare, first create checkpoints with the save command or eda.save_tcl().`,
    };
  }

  // List available checkpoints
  let checkpoints = [];
  try {
    checkpoints = readdirSync(checkpointDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stats = statSync(join(checkpointDir, f));
        return { name: f.replace('.json', ''), date: stats.mtime };
      })
      .sort((a, b) => b.date - a.date);
  } catch (err) {
    return {
      success: false,
      error: `Failed to read checkpoints: ${err.message}`,
    };
  }

  if (checkpoints.length === 0) {
    return {
      success: true,
      message: 'No checkpoints found.\n\nCreate a checkpoint first using eda.save_tcl() or the save command.',
    };
  }

  // Determine which baseline to use
  let targetBaseline = baseline;
  if (!targetBaseline || targetBaseline === 'last') {
    targetBaseline = checkpoints[0].name;
  }

  // This would normally load and compare actual metrics
  // For now, return a message indicating the comparison would happen
  return {
    success: true,
    message: `Compare command: Would compare current QoR with baseline "${targetBaseline}"\n\nAvailable checkpoints:\n${checkpoints.map(c => `  - ${c.name} (${c.date.toLocaleString()})`).join('\n')}\n\nFull implementation requires checkpoint system integration.`,
    baseline: targetBaseline,
    availableCheckpoints: checkpoints.map(c => c.name),
  };
}

/**
 * Format quick command help for display
 * @returns {string} - Formatted help text
 */
export function formatQuickCommandHelp() {
  let help = 'Quick Commands:\n\n';

  for (const cmd of Object.values(QUICK_COMMANDS)) {
    help += `  /${cmd.name}`;
    if (cmd.hasArgument) {
      help += ` [${cmd.argumentName}]`;
    }
    help += '\n';
    help += `    ${cmd.description}\n`;
    help += `    Usage: ${cmd.usage}\n\n`;
  }

  help += 'Use /help <command> for detailed help on a specific command.\n';

  return help;
}

export default {
  parseQuickCommand,
  isQuickCommand,
  listQuickCommands,
  getCommandHelp,
  executeQuickCommand,
  formatQuickCommandHelp,
  QUICK_COMMANDS,
};
