/**
 * MCP Call Logger
 *
 * Logs all MCP tool calls to a JSONL file when HIPILOT_TEST_LOG is set.
 * Verbose mode (HIPILOT_VERBOSE_LOG=1 or when HIPILOT_TEST_LOG is set): includes
 * result_preview and full error text. EDA server has no source code; all debug
 * info comes from the evidence package pulled to dev machine — logs must be verbose.
 *
 * Usage in MCP servers:
 *   import { createMcpLogger } from '../../src/lib/mcp-logger.js';
 *   const mcpLog = createMcpLogger('eda');
 *   server.setRequestHandler(CallToolRequestSchema, mcpLog.wrapHandler(async (request) => {
 *     // ... existing handler code ...
 *   }));
 */

import { appendFileSync } from 'fs';

const LOG_PATH = process.env.HIPILOT_TEST_LOG || null;
const VERBOSE = process.env.HIPILOT_VERBOSE_LOG === '1' || !!LOG_PATH;

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
            errorMsg = textContent?.text || 'Unknown error';
          }
        } catch (err) {
          status = 'error';
          errorMsg = err.message + (err.stack ? '\n' + err.stack : '');
          throw err;
        } finally {
          const durationMs = Date.now() - startTime;
          const meta = result?._metadata || {};
          const entry = {
            ts: new Date(startTime).toISOString(),
            server: serverName,
            tool: name,
            args: sanitizeArgs(args, VERBOSE),
            status,
            duration_ms: durationMs,
            ...(errorMsg && { error: VERBOSE ? errorMsg : errorMsg.slice(0, 500) }),
            ...(Object.keys(meta).length > 0 && { meta }),
          };
          if (VERBOSE && result?.content) {
            const textContent = result.content.find(c => c.type === 'text');
            if (textContent?.text) {
              entry.result_preview = textContent.text.slice(0, 1000) + (textContent.text.length > 1000 ? '...' : '');
            }
          }
          writeLogEntry(entry);
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
 * Sanitize arguments for logging. Verbose mode keeps more (2000 chars).
 */
function sanitizeArgs(args, verbose = false) {
  if (!args || typeof args !== 'object') return args;
  const limit = verbose ? 2000 : 500;
  const sanitized = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.length > limit) {
      sanitized[key] = value.slice(0, limit) + `... (${value.length} chars)`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
