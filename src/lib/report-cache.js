/**
 * HiPilot Report Analysis Cache
 *
 * Provides caching for report analysis results to improve performance
 * and avoid re-analyzing the same reports.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getHipilotPaths } from './paths.js';
import * as logger from './logger.js';

const CACHE_DIR = 'analysis-cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 100;

/**
 * Get the cache directory path
 */
function getCacheDir() {
  const paths = getHipilotPaths();
  return join(paths.baseDir, CACHE_DIR);
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  const cacheDir = getCacheDir();
  if (!existsSync(cacheDir)) {
    try {
      mkdirSync(cacheDir, { recursive: true });
      logger.info('Created analysis cache directory', { path: cacheDir });
    } catch (err) {
      logger.error('Failed to create cache directory', { error: err.message });
      return null;
    }
  }
  return cacheDir;
}

/**
 * Generate cache key from report content
 */
function generateCacheKeySync(reportContent, reportType) {
  // Use a simple string hash for sync operation
  let hash = 0;
  const str = reportContent.slice(0, 10000) + reportType;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Get cached analysis if available and not expired
 */
export function getCachedAnalysis(reportContent, reportType) {
  try {
    const cacheDir = ensureCacheDir();
    if (!cacheDir) return null;

    const cacheKey = generateCacheKeySync(reportContent, reportType);
    const cacheFile = join(cacheDir, `${cacheKey}.json`);

    if (!existsSync(cacheFile)) {
      return null;
    }

    const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));

    // Check TTL
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL_MS) {
      logger.debug('Cache entry expired', { cacheKey, age });
      try { unlinkSync(cacheFile); } catch {}
      return null;
    }

    logger.debug('Cache hit', { cacheKey, age });
    return cached.data;
  } catch (err) {
    logger.error('Error reading cache', { error: err.message });
    return null;
  }
}

/**
 * Store analysis result in cache
 */
export function setCachedAnalysis(reportContent, reportType, analysisData) {
  try {
    const cacheDir = ensureCacheDir();
    if (!cacheDir) return false;

    // Clean old entries if needed
    cleanOldCacheEntries();

    const cacheKey = generateCacheKeySync(reportContent, reportType);
    const cacheFile = join(cacheDir, `${cacheKey}.json`);

    const cacheEntry = {
      timestamp: Date.now(),
      reportType,
      contentPreview: reportContent.slice(0, 200),
      data: analysisData,
    };

    writeFileSync(cacheFile, JSON.stringify(cacheEntry, null, 2));
    logger.debug('Cache stored', { cacheKey });
    return true;
  } catch (err) {
    logger.error('Error writing cache', { error: err.message });
    return false;
  }
}

/**
 * Clean old cache entries to prevent unbounded growth
 */
function cleanOldCacheEntries() {
  try {
    const cacheDir = getCacheDir();
    if (!existsSync(cacheDir)) return;

    const files = readdirSync(cacheDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = readFileSync(join(cacheDir, f), 'utf-8');
        try {
          const data = JSON.parse(stat);
          return { file: f, timestamp: data.timestamp || 0 };
        } catch {
          return { file: f, timestamp: 0 };
        }
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    // Remove oldest entries if over limit
    if (files.length > MAX_CACHE_ENTRIES) {
      const toRemove = files.slice(MAX_CACHE_ENTRIES);
      for (const entry of toRemove) {
        try {
          unlinkSync(join(cacheDir, entry.file));
          logger.debug('Removed old cache entry', { file: entry.file });
        } catch {}
      }
    }
  } catch (err) {
    logger.error('Error cleaning cache', { error: err.message });
  }
}

/**
 * Clear all cached analyses
 */
export function clearCache() {
  try {
    const cacheDir = getCacheDir();
    if (!existsSync(cacheDir)) return { cleared: 0 };

    const files = readdirSync(cacheDir).filter(f => f.endsWith('.json'));
    let cleared = 0;
    for (const file of files) {
      try {
        unlinkSync(join(cacheDir, file));
        cleared++;
      } catch {}
    }

    logger.info('Cache cleared', { cleared });
    return { cleared };
  } catch (err) {
    logger.error('Error clearing cache', { error: err.message });
    return { cleared: 0, error: err.message };
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  try {
    const cacheDir = getCacheDir();
    if (!existsSync(cacheDir)) {
      return { entries: 0, size: 0 };
    }

    const files = readdirSync(cacheDir).filter(f => f.endsWith('.json'));
    let totalSize = 0;
    let validEntries = 0;
    let expiredEntries = 0;

    for (const file of files) {
      try {
        const content = readFileSync(join(cacheDir, file), 'utf-8');
        totalSize += content.length;
        const data = JSON.parse(content);
        const age = Date.now() - data.timestamp;
        if (age > CACHE_TTL_MS) {
          expiredEntries++;
        } else {
          validEntries++;
        }
      } catch {}
    }

    return {
      entries: validEntries,
      expired: expiredEntries,
      totalFiles: files.length,
      sizeKB: Math.round(totalSize / 1024),
    };
  } catch (err) {
    logger.error('Error getting cache stats', { error: err.message });
    return { entries: 0, error: err.message };
  }
}

/**
 * Generate action buttons for report analysis
 */
export function generateActionButtons(reportType, hasAnalysis = false) {
  const buttons = [];

  // Primary action: Analyze report
  buttons.push({
    type: 'action',
    label: hasAnalysis ? '🔄 Re-analyze Report' : '🔍 Analyze This Report',
    command: 'eda.analyze_report',
    description: `Run AI analysis on this ${reportType} report`,
  });

  // Secondary actions based on report type
  switch (reportType) {
    case 'timing':
      buttons.push(
        { type: 'action', label: '📊 View Timing Paths', command: 'eda.quick', params: { operation: 'timing' } },
        { type: 'action', label: '🔧 Fix Setup', command: 'eda.quick', params: { operation: 'setup' } },
        { type: 'action', label: '🔧 Fix Hold', command: 'eda.quick', params: { operation: 'hold' } }
      );
      break;
    case 'drc':
      buttons.push(
        { type: 'action', label: '🔍 View DRC Details', command: 'eda.quick', params: { operation: 'drc' } },
        { type: 'action', label: '📋 Export Report', command: 'eda.save_tcl', params: { tcl: '# DRC report export placeholder' } }
      );
      break;
    case 'power':
      buttons.push(
        { type: 'action', label: '📊 Power Breakdown', command: 'eda.quick', params: { operation: 'power' } }
      );
      break;
    case 'area':
      buttons.push(
        { type: 'action', label: '📐 Area Report', command: 'eda.quick', params: { operation: 'area' } }
      );
      break;
  }

  // Common actions
  buttons.push(
    { type: 'action', label: '💾 Save Report', command: 'eda.save_tcl', params: { tcl: '# Report save placeholder' } },
    { type: 'action', label: '📤 Share', command: 'tmux.send_keys', params: { keys: '# Share report placeholder' } }
  );

  return buttons;
}

/**
 * Format action buttons as markdown
 */
export function formatActionButtons(buttons) {
  if (!buttons || buttons.length === 0) return '';

  let markdown = '\n\n**Quick Actions:**\n\n';
  for (const btn of buttons) {
    markdown += `- **${btn.label}** - ${btn.description || 'Run command'}\n`;
  }
  return markdown;
}

export default {
  getCachedAnalysis,
  setCachedAnalysis,
  clearCache,
  getCacheStats,
  generateActionButtons,
  formatActionButtons,
};
