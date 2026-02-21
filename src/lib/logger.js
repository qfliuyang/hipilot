/**
 * HiPilot Logger
 *
 * Structured logging with levels and context.
 * Logs to ~/.hipilot/logs/hipilot-YYYY-MM-DD.log
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const LOG_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

// Current log level - can be controlled via environment
const CURRENT_LEVEL = LOG_LEVELS[process.env.HIPILOT_LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Get the log directory path
 */
function getLogDir() {
  return join(homedir(), '.hipilot', 'logs');
}

/**
 * Get the current log file path
 */
function getLogFile() {
  const date = new Date().toISOString().split('T')[0];
  return join(getLogDir(), `hipilot-${date}.log`);
}

/**
 * Ensure log directory exists
 */
function ensureLogDir() {
  const logDir = getLogDir();
  if (!existsSync(logDir)) {
    try {
      mkdirSync(logDir, { recursive: true });
    } catch (err) {
      // Silent fail - can't log if we can't create the directory
    }
  }
}

/**
 * Format a log entry
 */
function formatEntry(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const levelName = LOG_NAMES[level] ?? 'UNKNOWN';
  const contextStr = Object.keys(context).length > 0
    ? ' | ' + JSON.stringify(context)
    : '';
  return `[${timestamp}] [${levelName}] ${message}${contextStr}\n`;
}

/**
 * Write to log file
 */
function writeLog(entry) {
  ensureLogDir();
  try {
    appendFileSync(getLogFile(), entry);
  } catch {
    // Silent fail - can't log if file writing fails
  }
}

/**
 * Log an error
 */
export function error(message, context = {}) {
  if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
    const entry = formatEntry(LOG_LEVELS.ERROR, message, context);
    writeLog(entry);
    // Note: Avoid console.error here as it can break MCP stdio transport
    // Errors are logged to file for later inspection
  }
}

/**
 * Log a warning
 */
export function warn(message, context = {}) {
  if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
    const entry = formatEntry(LOG_LEVELS.WARN, message, context);
    writeLog(entry);
  }
}

/**
 * Log info
 */
export function info(message, context = {}) {
  if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
    const entry = formatEntry(LOG_LEVELS.INFO, message, context);
    writeLog(entry);
  }
}

/**
 * Log debug
 */
export function debug(message, context = {}) {
  if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
    const entry = formatEntry(LOG_LEVELS.DEBUG, message, context);
    writeLog(entry);
  }
}

/**
 * Log an error with exception details
 */
export function errorWithException(message, err, context = {}) {
  const errorContext = {
    ...context,
    errorName: err?.name,
    errorMessage: err?.message,
    stack: err?.stack?.split('\n').slice(0, 3).join('; '),
  };
  error(message, errorContext);
}

/**
 * Safe wrapper for async operations with logging
 */
export async function tryWithLog(operationName, fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    errorWithException(`Operation failed: ${operationName}`, err);
    return fallback;
  }
}

/**
 * Safe wrapper for sync operations with logging
 */
export function trySyncWithLog(operationName, fn, fallback = null) {
  try {
    return fn();
  } catch (err) {
    errorWithException(`Operation failed: ${operationName}`, err);
    return fallback;
  }
}

export default {
  error,
  warn,
  info,
  debug,
  errorWithException,
  tryWithLog,
  trySyncWithLog,
  LOG_LEVELS,
};
