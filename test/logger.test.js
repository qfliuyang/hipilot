/**
 * Unit tests for logger.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';

// Spy on appendFileSync before importing logger so it never writes real files
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    appendFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn(() => true),
  };
});

// Import logger AFTER the mock is set up
const { error, warn, info, debug, errorWithException, tryWithLog, trySyncWithLog, LOG_LEVELS } =
  await import('../src/lib/logger.js');

describe('logger.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LOG_LEVELS', () => {
    it('exports LOG_LEVELS with correct numeric values', () => {
      expect(LOG_LEVELS.ERROR).toBe(0);
      expect(LOG_LEVELS.WARN).toBe(1);
      expect(LOG_LEVELS.INFO).toBe(2);
      expect(LOG_LEVELS.DEBUG).toBe(3);
    });
  });

  describe('log entry format', () => {
    it('includes ISO timestamp in the log entry', () => {
      info('test message');
      const call = fs.appendFileSync.mock.calls[0];
      expect(call).toBeDefined();
      const entry = call[1];
      // ISO timestamp format: [2026-02-21T...]
      expect(entry).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('includes level name in the log entry', () => {
      error('err message');
      const entry = fs.appendFileSync.mock.calls[0]?.[1] ?? '';
      expect(entry).toContain('[ERROR]');
    });

    it('includes the message in the log entry', () => {
      info('hello world');
      const entry = fs.appendFileSync.mock.calls[0]?.[1] ?? '';
      expect(entry).toContain('hello world');
    });

    it('includes context as JSON when context is provided', () => {
      info('with context', { key: 'value' });
      const entry = fs.appendFileSync.mock.calls[0]?.[1] ?? '';
      expect(entry).toContain('"key"');
      expect(entry).toContain('"value"');
    });

    it('omits context section when context is empty', () => {
      info('no context');
      const entry = fs.appendFileSync.mock.calls[0]?.[1] ?? '';
      // Should not contain the pipe separator used for context
      expect(entry).not.toContain(' | {');
    });

    it('ends with a newline', () => {
      info('newline check');
      const entry = fs.appendFileSync.mock.calls[0]?.[1] ?? '';
      expect(entry.endsWith('\n')).toBe(true);
    });
  });

  describe('log level filtering', () => {
    it('error() writes a log entry at ERROR level', () => {
      error('something broke');
      expect(fs.appendFileSync).toHaveBeenCalledOnce();
      const entry = fs.appendFileSync.mock.calls[0][1];
      expect(entry).toContain('[ERROR]');
    });

    it('warn() writes a log entry at WARN level', () => {
      warn('careful now');
      expect(fs.appendFileSync).toHaveBeenCalledOnce();
      const entry = fs.appendFileSync.mock.calls[0][1];
      expect(entry).toContain('[WARN]');
    });

    it('info() writes a log entry at INFO level', () => {
      info('just info');
      expect(fs.appendFileSync).toHaveBeenCalledOnce();
      const entry = fs.appendFileSync.mock.calls[0][1];
      expect(entry).toContain('[INFO]');
    });

    // debug() is filtered out when HIPILOT_LOG_LEVEL is INFO (default).
    // We can only verify the module-level default filtering here.
    it('debug() does not write when default level is INFO', () => {
      // The module is loaded with whatever HIPILOT_LOG_LEVEL was set at import time.
      // In CI the default is INFO (level 2), so DEBUG (level 3) is suppressed.
      // If someone ran with HIPILOT_LOG_LEVEL=debug this assertion would flip;
      // we guard so the test is not flaky in either environment.
      const logLevel = process.env.HIPILOT_LOG_LEVEL?.toUpperCase();
      if (!logLevel || logLevel === 'INFO' || logLevel === 'WARN' || logLevel === 'ERROR') {
        debug('debug msg');
        expect(fs.appendFileSync).not.toHaveBeenCalled();
      } else {
        // DEBUG level or higher: a call IS expected
        debug('debug msg');
        expect(fs.appendFileSync).toHaveBeenCalledOnce();
      }
    });
  });

  describe('errorWithException', () => {
    it('includes error name in context', () => {
      const err = new TypeError('bad type');
      errorWithException('op failed', err);
      const entry = fs.appendFileSync.mock.calls[0]?.[1] ?? '';
      expect(entry).toContain('TypeError');
    });

    it('includes error message in context', () => {
      const err = new Error('disk full');
      errorWithException('write failed', err);
      const entry = fs.appendFileSync.mock.calls[0]?.[1] ?? '';
      expect(entry).toContain('disk full');
    });

    it('includes up to 3 stack lines in context', () => {
      const err = new Error('stack test');
      // Stack has at least 2 lines (message + at ...)
      errorWithException('stack check', err);
      const entry = fs.appendFileSync.mock.calls[0]?.[1] ?? '';
      // The stack is joined with '; ' so check for a recognisable stack pattern
      expect(entry).toContain('Error: stack test');
    });

    it('handles null error gracefully', () => {
      expect(() => errorWithException('msg', null)).not.toThrow();
    });

    it('merges caller-provided context with error fields', () => {
      const err = new Error('oops');
      errorWithException('fail', err, { requestId: '123' });
      const entry = fs.appendFileSync.mock.calls[0]?.[1] ?? '';
      expect(entry).toContain('"requestId"');
      expect(entry).toContain('"123"');
    });
  });

  describe('tryWithLog', () => {
    it('returns the result of the async function on success', async () => {
      const result = await tryWithLog('op', async () => 42);
      expect(result).toBe(42);
    });

    it('returns null fallback when the async function throws', async () => {
      const result = await tryWithLog('op', async () => { throw new Error('boom'); });
      expect(result).toBeNull();
    });

    it('returns a custom fallback value when the async function throws', async () => {
      const result = await tryWithLog('op', async () => { throw new Error('boom'); }, 'fallback');
      expect(result).toBe('fallback');
    });

    it('logs an error when the async function throws', async () => {
      await tryWithLog('failing-op', async () => { throw new Error('explode'); });
      expect(fs.appendFileSync).toHaveBeenCalled();
      const entry = fs.appendFileSync.mock.calls[0][1];
      expect(entry).toContain('[ERROR]');
    });
  });

  describe('trySyncWithLog', () => {
    it('returns the result of the sync function on success', () => {
      const result = trySyncWithLog('op', () => 'hello');
      expect(result).toBe('hello');
    });

    it('returns null fallback when the sync function throws', () => {
      const result = trySyncWithLog('op', () => { throw new Error('sync boom'); });
      expect(result).toBeNull();
    });

    it('returns a custom fallback value when the sync function throws', () => {
      const result = trySyncWithLog('op', () => { throw new Error('sync boom'); }, -1);
      expect(result).toBe(-1);
    });

    it('logs an error when the sync function throws', () => {
      trySyncWithLog('sync-fail', () => { throw new Error('sync explode'); });
      expect(fs.appendFileSync).toHaveBeenCalled();
      const entry = fs.appendFileSync.mock.calls[0][1];
      expect(entry).toContain('[ERROR]');
    });
  });
});
