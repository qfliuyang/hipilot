/**
 * MCP Call Logger
 * 
 * Logs all MCP tool calls to a JSONL file when HIPILOT_TEST_LOG is set.
 * Zero overhead when disabled (no file I/O, no string formatting).
 * 
 * Usage in MCP servers:
 *   import { createMcpLogger } from '../../src/lib/mcp-logger.js';
 *   const mcpLog = createMcpLogger('eda');
 * 
 *   // Wrap the tool handler:
 *   server.setRequestHandler(CallToolRequestSchema, mcpLog.wrapHandler(async (request) => {
 *     // ... existing handler code ...
 *   }));
 */

import { appendFileSync } from 'fs';

const LOG_PATH = process.env.HIPILOT_TEST_LOG || null;

function writeLogEntry(entry) {
  if (!LOG_PATH) return;
  try {
    appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
  } catch {
    // Silently ignore write failures to avoid disrupting MCP operations
  }
}

/**
 * Create a logger for a specific MCP server.
 * @param {string} serverName - Server identifier: 'eda', 'tmux', or 'knowledge'
 */
export function createMcpLogger(serverName) {
  const enabled = !!LOG_PATH;

  return {
    enabled,

    /**
     * Wrap a CallToolRequest handler with automatic logging.
     * Logs: tool name, args, status, duration, metadata, errors.
     */
    wrapHandler(handler) {
      if (!enabled) return handler;

      return async (request) => {
        const { name, arguments: args } = request.params;
        const startTime = Date.now();
        let result;
        let status = 'ok';
        let errorMsg = null;

        try {
          result = await handler(request);

          if (result && result.isError) {
            status = 'error';
            const textContent = result.content?.find(c => c.type === 'text');
            errorMsg = textContent?.text?.slice(0, 200) || 'Unknown error';
          }
        } catch (err) {
          status = 'error';
          errorMsg = err.message;
          throw err;
        } finally {
          const durationMs = Date.now() - startTime;
          const meta = result?._metadata || {};

          writeLogEntry({
            ts: new Date(startTime).toISOString(),
            server: serverName,
            tool: name,
            args: sanitizeArgs(args),
            status,
            duration_ms: durationMs,
            ...(errorMsg && { error: errorMsg }),
            ...(Object.keys(meta).length > 0 && { meta }),
          });
        }

        return result;
      };
    },

    /**
     * Log a custom event (not a tool call).
     */
    logEvent(event, data = {}) {
      if (!enabled) return;
      writeLogEntry({
        ts: new Date().toISOString(),
        server: serverName,
        event,
        ...data,
      });
    },
  };
}

/**
 * Sanitize arguments for logging — truncate large values to keep logs readable.
 */
function sanitizeArgs(args) {
  if (!args || typeof args !== 'object') return args;

  const sanitized = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = value.slice(0, 500) + `... (${value.length} chars)`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
