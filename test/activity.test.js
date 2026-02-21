/**
 * Unit tests for activity.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

// Mock fs before importing activity
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    writeFileSync: vi.fn((path, data) => {
      // Store in memory for tests
      mockFiles[path] = data;
    }),
    readFileSync: vi.fn((path) => {
      if (mockFiles[path]) return mockFiles[path];
      throw new Error(`ENOENT: ${path}`);
    }),
    existsSync: vi.fn((path) => path in mockFiles),
    mkdirSync: vi.fn(),
  };
});

// Mock paths.js
vi.mock('../src/lib/paths.js', () => ({
  getHipilotPaths: () => ({
    baseDir: '/tmp/test-hipilot',
  }),
}));

// Mock logger.js
vi.mock('../src/lib/logger.js', () => ({
  info: vi.fn(),
  debug: vi.fn(),
}));

// In-memory file store
let mockFiles = {};

// Import activity after mocks
const {
  addActivity,
  updateActivityStatus,
  getRecentActivities,
  getActivityStats,
  clearActivityLog,
  STATUS_ICONS,
  STATUS_COLORS,
} = await import('../src/lib/activity.js');

describe('activity.js', () => {
  beforeEach(() => {
    mockFiles = {};
    vi.clearAllMocks();
  });

  describe('STATUS_ICONS', () => {
    it('exports status icons', () => {
      expect(STATUS_ICONS.success).toBe('✓');
      expect(STATUS_ICONS.pending).toBe('⏳');
      expect(STATUS_ICONS.failed).toBe('✗');
      expect(STATUS_ICONS.running).toBe('🔄');
      expect(STATUS_ICONS.warning).toBe('⚠');
    });
  });

  describe('STATUS_COLORS', () => {
    it('exports ANSI color codes', () => {
      expect(STATUS_COLORS.success).toContain('[32m');
      expect(STATUS_COLORS.failed).toContain('[31m');
      expect(STATUS_COLORS.reset).toBe('\x1b[0m');
    });
  });

  describe('addActivity', () => {
    it('adds an activity entry', () => {
      const entry = addActivity('timing', 'Generated timing report', 'success', { tool: 'innovus' });

      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('timestamp');
      expect(entry.type).toBe('timing');
      expect(entry.description).toBe('Generated timing report');
      expect(entry.status).toBe('success');
      expect(entry.metadata).toEqual({ tool: 'innovus' });
    });

    it('generates unique IDs for each entry', () => {
      const entry1 = addActivity('test', 'Test 1', 'success');
      const entry2 = addActivity('test', 'Test 2', 'success');

      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe('updateActivityStatus', () => {
    it('updates activity status', () => {
      const entry = addActivity('route', 'Route design', 'running');
      const updated = updateActivityStatus(entry.id, 'success', { wns: '-0.1' });

      expect(updated).toBe(true);

      const activities = getRecentActivities(1);
      expect(activities[0].status).toBe('success');
      expect(activities[0].metadata.wns).toBe('-0.1');
    });

    it('returns false for non-existent entry', () => {
      const result = updateActivityStatus('non-existent-id', 'success');
      expect(result).toBe(false);
    });
  });

  describe('getRecentActivities', () => {
    it('returns recent activities', () => {
      clearActivityLog();
      addActivity('test1', 'Test 1', 'success');
      addActivity('test2', 'Test 2', 'success');
      addActivity('test3', 'Test 3', 'failed');

      const activities = getRecentActivities(2);

      expect(activities).toHaveLength(2);
      expect(activities[0].type).toBe('test3');
    });

    it('filters by type', () => {
      clearActivityLog();
      addActivity('timing', 'Timing 1', 'success');
      addActivity('power', 'Power 1', 'success');
      addActivity('timing', 'Timing 2', 'success');

      const activities = getRecentActivities(10, 'timing');

      expect(activities).toHaveLength(2);
      activities.forEach(a => expect(a.type).toBe('timing'));
    });
  });

  describe('getActivityStats', () => {
    it('returns activity statistics', () => {
      clearActivityLog();
      addActivity('test1', 'Test 1', 'success');
      addActivity('test2', 'Test 2', 'failed');
      addActivity('test3', 'Test 3', 'success');

      const stats = getActivityStats();

      expect(stats.total).toBe(3);
      expect(stats.byStatus.success).toBe(2);
      expect(stats.byStatus.failed).toBe(1);
    });
  });

  describe('clearActivityLog', () => {
    it('clears all activities', () => {
      addActivity('test', 'Test', 'success');
      clearActivityLog();

      const activities = getRecentActivities(10);
      expect(activities).toHaveLength(0);
    });
  });
});
