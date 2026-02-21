/**
 * HiPilot Activity Feed
 *
 * Tracks and displays operation history with timestamps.
 * Provides visual feedback on recent operations.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getHipilotPaths } from './paths.js';
import { info, debug } from './logger.js';

const paths = getHipilotPaths();
const ACTIVITY_FILE = join(paths.baseDir, 'activity.json');
const MAX_ENTRIES = 50;

// Activity status icons
export const STATUS_ICONS = {
  success: '✓',
  pending: '⏳',
  failed: '✗',
  running: '🔄',
  warning: '⚠',
};

// Activity status colors for terminal
export const STATUS_COLORS = {
  success: '\x1b[32m',  // Green
  pending: '\x1b[33m',  // Yellow
  failed: '\x1b[31m',   // Red
  running: '\x1b[36m',  // Cyan
  warning: '\x1b[33m',  // Yellow
  reset: '\x1b[0m',
};

/**
 * Get current activity log
 */
function getActivityLog() {
  try {
    if (existsSync(ACTIVITY_FILE)) {
      const data = readFileSync(ACTIVITY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    debug('Failed to read activity log', { error: err.message });
  }
  return { entries: [], lastUpdated: new Date().toISOString() };
}

/**
 * Save activity log
 */
function saveActivityLog(log) {
  try {
    writeFileSync(ACTIVITY_FILE, JSON.stringify(log, null, 2));
  } catch (err) {
    debug('Failed to save activity log', { error: err.message });
  }
}

/**
 * Add an activity entry
 */
export function addActivity(type, description, status = 'running', metadata = {}) {
  const log = getActivityLog();

  const entry = {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    type,
    description,
    status,
    metadata,
  };

  log.entries.unshift(entry);

  // Trim to max entries
  if (log.entries.length > MAX_ENTRIES) {
    log.entries = log.entries.slice(0, MAX_ENTRIES);
  }

  log.lastUpdated = new Date().toISOString();
  saveActivityLog(log);

  info('Activity recorded', { type, description, status });
  return entry;
}

/**
 * Update activity status
 */
export function updateActivityStatus(entryId, newStatus, metadataUpdate = {}) {
  const log = getActivityLog();
  const entry = log.entries.find(e => e.id === entryId);

  if (entry) {
    entry.status = newStatus;
    entry.updatedAt = new Date().toISOString();
    entry.metadata = { ...entry.metadata, ...metadataUpdate };
    saveActivityLog(log);
    info('Activity status updated', { entryId, newStatus });
    return true;
  }

  return false;
}

/**
 * Get recent activities
 */
export function getRecentActivities(count = 10, filter = null) {
  const log = getActivityLog();
  let entries = log.entries;

  if (filter) {
    entries = entries.filter(e => e.type === filter || e.status === filter);
  }

  return entries.slice(0, count);
}

/**
 * Format timestamp for display
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // Less than a minute
  if (diff < 60000) {
    return 'just now';
  }

  // Less than an hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  return date.toLocaleDateString();
}

/**
 * Format activity entry for display
 */
function formatEntry(entry) {
  const icon = STATUS_ICONS[entry.status] || '•';
  const color = STATUS_COLORS[entry.status] || STATUS_COLORS.reset;
  const reset = STATUS_COLORS.reset;
  const time = formatTime(entry.timestamp);

  return `  ${color}${icon}${reset} ${entry.description} ${color}(${time})${reset}`;
}

/**
 * Display activity feed
 */
export function showActivityFeed(count = 10) {
  const entries = getRecentActivities(count);

  if (entries.length === 0) {
    console.log('  No recent activity');
    return;
  }

  console.log('');
  console.log('  Recent Activity:');
  console.log('');

  entries.forEach(entry => {
    console.log(formatEntry(entry));
  });

  console.log('');
}

/**
 * Get activity summary statistics
 */
export function getActivityStats() {
  const log = getActivityLog();
  const entries = log.entries;

  const stats = {
    total: entries.length,
    byStatus: {},
    byType: {},
    recentSuccess: 0,
    recentFailed: 0,
  };

  const oneHourAgo = Date.now() - 3600000;

  entries.forEach(entry => {
    // Count by status
    stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;

    // Count by type
    stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;

    // Recent counts (last hour)
    const entryTime = new Date(entry.timestamp).getTime();
    if (entryTime > oneHourAgo) {
      if (entry.status === 'success') stats.recentSuccess++;
      if (entry.status === 'failed') stats.recentFailed++;
    }
  });

  return stats;
}

/**
 * Clear activity log
 */
export function clearActivityLog() {
  saveActivityLog({ entries: [], lastUpdated: new Date().toISOString() });
  info('Activity log cleared');
}

export default {
  addActivity,
  updateActivityStatus,
  getRecentActivities,
  showActivityFeed,
  getActivityStats,
  clearActivityLog,
  STATUS_ICONS,
  STATUS_COLORS,
};
