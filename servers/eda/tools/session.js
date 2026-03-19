/**
 * tools/session.js - Session state and note-taking tools
 *
 * Provides tools for managing session checkpoints, notes, and todos.
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { CONFIG } from '../../../src/lib/config.js';
import { buildPaneTarget } from '../../../src/lib/pane-utils.js';
import { getHipilotPaths } from '../../../src/lib/paths.js';
import { getModeStatus } from '../../../src/lib/mode.js';
import { extractQoR } from '../lib/qor-parser.js';
import { detectTool } from '../lib/tool-detection.js';

const hipilotPaths = getHipilotPaths();

/**
 * Tool definitions for session tools.
 */
export const TOOL_DEFINITIONS = [
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
  {
    name: 'session.add_note',
    description: 'Add a note to the session journal. Use to record errors, decisions, observations, and fixes for later reference. Categories: error, decision, observation, qor, fix.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Type of note: error, decision, observation, qor, fix, warning',
          enum: ['error', 'decision', 'observation', 'qor', 'fix', 'warning'],
        },
        stage: {
          type: 'string',
          description: 'Flow stage this note relates to (e.g., placement, cts)',
        },
        content: {
          type: 'string',
          description: 'The note content. Be specific about what happened and why.',
        },
        tcl_fixed: {
          type: 'string',
          description: 'Optional: Tcl command that fixed the issue (for error/fix notes)',
        },
      },
      required: ['category', 'content'],
    },
  },
  {
    name: 'session.get_notes',
    description: 'Retrieve session notes. Filter by category or stage to review previous errors, decisions, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category (error, decision, observation, qor, fix, warning)',
          enum: ['error', 'decision', 'observation', 'qor', 'fix', 'warning'],
        },
        stage: {
          type: 'string',
          description: 'Filter by flow stage',
        },
      },
    },
  },
  {
    name: 'session.add_todo',
    description: 'Add a task to remember for later. Use for deferred checks or follow-up actions.',
    inputSchema: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Description of what needs to be done',
        },
        priority: {
          type: 'string',
          description: 'Priority level',
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium',
        },
        stage: {
          type: 'string',
          description: 'Stage where this todo should be checked (e.g., post_cts)',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'session.get_todos',
    description: 'Get list of pending todos. Review before proceeding to next stage.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          description: 'Filter todos for specific stage',
        },
      },
    },
  },
  {
    name: 'session.complete_todo',
    description: 'Mark a todo as completed.',
    inputSchema: {
      type: 'object',
      properties: {
        todo_id: {
          type: 'string',
          description: 'ID of todo to complete',
        },
      },
      required: ['todo_id'],
    },
  },
];

/**
 * Handle session.save_checkpoint.
 */
export function handleSaveCheckpoint(args) {
  const { name, description = '' } = args;
  const checkpointsDir = join(hipilotPaths.hipilotDir, 'session', 'checkpoints');
  mkdirSync(checkpointsDir, { recursive: true });

  let qorMetrics = {};
  try {
    const paneOutput = execSync(
      `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${buildPaneTarget(CONFIG.TMUX_SESSION, CONFIG.PANE_LAYOUT.EDA)} -p -S -200 2>/dev/null || echo ""`,
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

/**
 * Handle session.list_checkpoints.
 */
export function handleListCheckpoints() {
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

/**
 * Handle session.restore_checkpoint.
 */
export function handleRestoreCheckpoint(args) {
  const { checkpoint_id } = args;
  const checkpointsDir = join(hipilotPaths.hipilotDir, 'session', 'checkpoints');

  // Validate checkpoint_id format to prevent path traversal
  const VALID_CHECKPOINT_ID = /^[a-zA-Z0-9_-]+$/;
  if (!VALID_CHECKPOINT_ID.test(checkpoint_id)) {
    return { content: [{ type: 'text', text: `❌ Invalid checkpoint_id format: ${checkpoint_id}. Only alphanumeric, underscore, and hyphen allowed.` }], isError: true };
  }

  let checkpointPath = join(checkpointsDir, `${checkpoint_id}.json`);

  // Verify resolved path is within checkpointsDir
  const resolvedPath = resolve(checkpointPath);
  const resolvedCheckpointsDir = resolve(checkpointsDir);
  if (!resolvedPath.startsWith(resolvedCheckpointsDir)) {
    return { content: [{ type: 'text', text: `❌ Path traversal detected: ${checkpoint_id}` }], isError: true };
  }

  if (!existsSync(checkpointPath)) {
    const files = readdirSync(checkpointsDir).filter(f => f.includes(checkpoint_id));
    if (files.length === 0) {
      return { content: [{ type: 'text', text: `❌ Checkpoint not found: ${checkpoint_id}` }], isError: true };
    }
    checkpointPath = join(checkpointsDir, files[0]);
    // Re-validate the matched file path
    const resolvedMatchPath = resolve(checkpointPath);
    if (!resolvedMatchPath.startsWith(resolvedCheckpointsDir)) {
      return { content: [{ type: 'text', text: `❌ Path traversal detected in matched file: ${files[0]}` }], isError: true };
    }
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

/**
 * Handle session.get_history.
 */
export function handleGetHistory(args) {
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

/**
 * Handle session.get_context.
 */
export function handleGetContext() {
  const tool = detectTool();
  let qorMetrics = {};
  try {
    const output = execSync(
      `tmux -L ${CONFIG.TMUX_SOCKET} capture-pane -t ${buildPaneTarget(CONFIG.TMUX_SESSION, CONFIG.PANE_LAYOUT.EDA)} -p -S -100 2>/dev/null || echo ""`,
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

/**
 * Handle session.add_note.
 */
export function handleAddNote(args) {
  const { category, stage, content, tcl_fixed } = args;
  const note = {
    id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    category,
    stage: stage || 'general',
    content,
    tcl_fixed: tcl_fixed || null,
  };

  // Append to session notes file
  const notesFile = join(hipilotPaths.baseDir, 'session_notes.jsonl');
  try {
    const existing = existsSync(notesFile) ? readFileSync(notesFile, 'utf-8') : '';
    writeFileSync(notesFile, existing + JSON.stringify(note) + '\n');
  } catch {
    // If file write fails, still return success (memory-only note)
  }

  const icon = {
    error: '❌',
    fix: '🔧',
    decision: '📌',
    observation: '👁️',
    qor: '📊',
    warning: '⚠️',
  }[category] || '📝';

  return {
    content: [{ type: 'text', text: `${icon} Note added [${category}]: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}` }],
    _metadata: { note_id: note.id },
  };
}

/**
 * Handle session.get_notes.
 */
export function handleGetNotes(args) {
  const { category, stage } = args;
  const notesFile = join(hipilotPaths.baseDir, 'session_notes.jsonl');
  const notes = [];

  try {
    if (existsSync(notesFile)) {
      const lines = readFileSync(notesFile, 'utf-8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const note = JSON.parse(line);
          if (category && note.category !== category) continue;
          if (stage && note.stage !== stage) continue;
          notes.push(note);
        } catch {}
      }
    }
  } catch {}

  // Sort by timestamp (newest first)
  notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  let text = `📝 **Session Notes** (${notes.length} total)`;
  if (category) text += ` [filter: ${category}]`;
  if (stage) text += ` [stage: ${stage}]`;
  text += '\n\n';

  for (const note of notes.slice(0, 20)) {
    const icon = { error: '❌', fix: '🔧', decision: '📌', observation: '👁️', qor: '📊', warning: '⚠️' }[note.category] || '📝';
    text += `${icon} [${note.category}] ${note.stage}\n`;
    text += `   ${note.content.substring(0, 80)}${note.content.length > 80 ? '...' : ''}\n`;
    if (note.tcl_fixed) text += `   🔧 Fix: ${note.tcl_fixed.substring(0, 60)}...\n`;
    text += '\n';
  }

  if (notes.length === 0) {
    text += 'No notes found. Use `session.add_note` to record errors, decisions, or observations.';
  }

  return { content: [{ type: 'text', text }], _metadata: { count: notes.length } };
}

/**
 * Handle session.add_todo.
 */
export function handleAddTodo(args) {
  const { task, priority, stage } = args;
  const todo = {
    id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    task,
    priority: priority || 'medium',
    stage: stage || 'general',
    completed: false,
  };

  const todosFile = join(hipilotPaths.baseDir, 'session_todos.jsonl');
  try {
    const existing = existsSync(todosFile) ? readFileSync(todosFile, 'utf-8') : '';
    writeFileSync(todosFile, existing + JSON.stringify(todo) + '\n');
  } catch {}

  const priorityIcon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[todo.priority] || '⚪';

  return {
    content: [{ type: 'text', text: `${priorityIcon} Todo added [${todo.priority}]: ${task}` }],
    _metadata: { todo_id: todo.id },
  };
}

/**
 * Handle session.get_todos.
 */
export function handleGetTodos(args) {
  const { stage } = args;
  const todosFile = join(hipilotPaths.baseDir, 'session_todos.jsonl');
  const todos = [];

  try {
    if (existsSync(todosFile)) {
      const lines = readFileSync(todosFile, 'utf-8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const todo = JSON.parse(line);
          if (todo.completed) continue;
          if (stage && todo.stage !== stage) continue;
          todos.push(todo);
        } catch {}
      }
    }
  } catch {}

  // Sort by priority (critical > high > medium > low)
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  todos.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  let text = `📋 **Pending Todos** (${todos.length})\n\n`;

  for (const todo of todos) {
    const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[todo.priority] || '⚪';
    text += `${icon} [${todo.priority}] ${todo.stage}\n`;
    text += `   ${todo.task}\n`;
    text += `   ID: ${todo.id}\n\n`;
  }

  if (todos.length === 0) {
    text += 'No pending todos. Use `session.add_todo` to create reminders.';
  }

  return { content: [{ type: 'text', text }], _metadata: { count: todos.length } };
}

/**
 * Handle session.complete_todo.
 */
export function handleCompleteTodo(args) {
  const { todo_id } = args;
  const todosFile = join(hipilotPaths.baseDir, 'session_todos.jsonl');
  let completed = false;

  try {
    if (existsSync(todosFile)) {
      const lines = readFileSync(todosFile, 'utf-8').trim().split('\n').filter(Boolean);
      const updated = [];
      for (const line of lines) {
        try {
          const todo = JSON.parse(line);
          if (todo.id === todo_id && !todo.completed) {
            todo.completed = true;
            todo.completed_at = new Date().toISOString();
            completed = true;
          }
          updated.push(JSON.stringify(todo));
        } catch {}
      }
      writeFileSync(todosFile, updated.join('\n') + '\n');
    }
  } catch {}

  return {
    content: [{ type: 'text', text: completed ? `✅ Todo completed: ${todo_id}` : `⚠️ Todo not found or already completed: ${todo_id}` }],
    _metadata: { completed },
  };
}

/**
 * Tool handler map for session tools.
 */
export const TOOL_HANDLERS = {
  'session.save_checkpoint': handleSaveCheckpoint,
  'session.list_checkpoints': handleListCheckpoints,
  'session.restore_checkpoint': handleRestoreCheckpoint,
  'session.get_history': handleGetHistory,
  'session.get_context': handleGetContext,
  'session.add_note': handleAddNote,
  'session.get_notes': handleGetNotes,
  'session.add_todo': handleAddTodo,
  'session.get_todos': handleGetTodos,
  'session.complete_todo': handleCompleteTodo,
};
