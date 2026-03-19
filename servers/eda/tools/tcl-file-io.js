/**
 * tools/tcl-file-io.js - Tcl file I/O tools
 *
 * Provides tools for saving and editing Tcl scripts.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getPending, queuePending } from '../../../src/lib/mode.js';
import { getHipilotPaths } from '../../../src/lib/paths.js';

const hipilotPaths = getHipilotPaths();

/**
 * Tool definitions for Tcl file I/O tools.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'eda.edit_tcl',
    description: 'Open pending or generated Tcl in $EDITOR for manual modification. Waits for user to save and exit, then returns the edited content. Use this when user wants to modify Tcl before execution.',
    inputSchema: {
      type: 'object',
      properties: {
        tcl: {
          type: 'string',
          description: 'Tcl content to edit (overrides pending)',
        },
        use_pending: {
          type: 'boolean',
          description: 'Use pending Tcl instead of provided tcl (default: false)',
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
];

/**
 * Handle eda.edit_tcl.
 */
export function handleEditTcl(args) {
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
        content: [{ type: 'text', text: `⏱️ Editor timeout after 5 minutes. Temp file preserved at: ${tmpFile}` }],
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

/**
 * Handle eda.save_tcl.
 */
export function handleSaveTcl(args) {
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

/**
 * Tool handler map for Tcl file I/O tools.
 */
export const TOOL_HANDLERS = {
  'eda.edit_tcl': handleEditTcl,
  'eda.save_tcl': handleSaveTcl,
};
