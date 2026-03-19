/**
 * tools/jobs.js - EDA job status monitoring tools
 *
 * Provides tools for checking the status of running EDA jobs.
 */

import { exec } from 'child_process';

/**
 * Tool definitions for job monitoring tools.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'eda.get_job_status',
    description: 'Check status of running EDA jobs (LSF or local processes)',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'string',
          description: 'Job ID to check (optional, checks all if not provided)',
        },
      },
    },
  },
];

/**
 * Handle eda.get_job_status.
 */
export function handleGetJobStatus() {
  try {
    const bjobs = exec('bjobs 2>/dev/null', { stdio: 'pipe' });
    return {
      content: [{ type: 'text', text: `LSF Jobs:\n${bjobs}` }],
    };
  } catch {
    try {
      const ps = exec('ps aux | grep -E "(icc2|innovus|pt_shell|tempus|calibre)" | grep -v grep', { stdio: 'pipe' });
      return {
        content: [{ type: 'text', text: `Local EDA Processes:\n${ps || 'No EDA processes found'}` }],
      };
    } catch {
      return {
        content: [{ type: 'text', text: 'No active EDA jobs or processes found' }],
      };
    }
  }
}

/**
 * Tool handler map for job monitoring tools.
 */
export const TOOL_HANDLERS = {
  'eda.get_job_status': handleGetJobStatus,
};
