/**
 * Unit tests for paths.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getHipilotTempDir, getHipilotPaths } from '../src/lib/paths.js';
import { tmpdir } from 'os';

describe('paths.js', () => {
  describe('getHipilotTempDir', () => {
    it('should return a user-specific temp directory', () => {
      const dir = getHipilotTempDir();
      const username = process.env.USER || process.env.USERNAME || 'unknown';

      expect(dir).toContain('hipilot');
      expect(dir).toContain(username);
      expect(dir.startsWith(tmpdir())).toBe(true);
    });

    it('should not use hardcoded /tmp/hipilot paths', () => {
      const dir = getHipilotTempDir();
      expect(dir).not.toBe('/tmp/hipilot');
      expect(dir).not.toMatch(/^\/tmp\/hipilot_/);
    });
  });

  describe('getHipilotPaths', () => {
    it('should return all required paths', () => {
      const paths = getHipilotPaths();

      expect(paths.baseDir).toBeDefined();
      expect(paths.modeFile).toBeDefined();
      expect(paths.pendingFile).toBeDefined();
      expect(paths.pendingMetaFile).toBeDefined();
      expect(paths.execDir).toBeDefined();
      expect(paths.generatedDir).toBeDefined();
      expect(paths.reportsDir).toBeDefined();
    });

    it('should have consistent base directory', () => {
      const paths = getHipilotPaths();

      expect(paths.modeFile.startsWith(paths.baseDir)).toBe(true);
      expect(paths.pendingFile.startsWith(paths.baseDir)).toBe(true);
      expect(paths.execDir.startsWith(paths.baseDir)).toBe(true);
    });

    it('should include username in all paths', () => {
      const paths = getHipilotPaths();
      const username = process.env.USER || process.env.USERNAME || 'unknown';

      expect(paths.baseDir).toContain(username);
    });
  });
});
