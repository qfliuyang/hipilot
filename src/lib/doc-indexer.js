/**
 * HiPilot Document Indexer
 *
 * SQLite + FTS5 full-text search for documentation
 * Indexes EDA manuals, team docs, and skills
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { info, debug } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import sqlite3 dynamically (optional dependency)
let sqlite3 = null;
try {
  const sqlite = await import('better-sqlite3');
  sqlite3 = sqlite.default;
} catch {
  debug('better-sqlite3 not available, using fallback search');
}

const PROJECT_ROOT = join(__dirname, '..', '..');
const INDEX_DB_PATH = join(PROJECT_ROOT, '.hipilot', 'doc-index.db');

/**
 * Initialize the search index database
 */
export function initIndex() {
  if (!sqlite3) {
    return { success: false, error: 'SQLite not available', fallback: true };
  }

  try {
    const db = new sqlite3(INDEX_DB_PATH);

    // Create FTS5 virtual table for full-text search
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS doc_index USING fts5(
        title,
        content,
        source,
        doc_type,
        tokenize='porter'
      );

      CREATE TABLE IF NOT EXISTS doc_metadata (
        id INTEGER PRIMARY KEY,
        source TEXT UNIQUE,
        doc_type TEXT,
        last_indexed TEXT,
        file_size INTEGER
      );

      CREATE TABLE IF NOT EXISTS search_stats (
        query TEXT PRIMARY KEY,
        count INTEGER DEFAULT 1,
        last_searched TEXT
      );
    `);

    db.close();
    return { success: true };
  } catch (err) {
    debug('Failed to initialize index', { error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Index a single document
 */
function indexDocument(db, filePath, docType = 'doc') {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const stats = { size: content.length, lines: content.split('\n').length };

    // Extract title from first heading or filename
    const titleMatch = content.match(/^#+\s+(.+)$/m) ||
                       content.match(/^title:\s*(.+)$/mi);
    const title = titleMatch ? titleMatch[1] : filePath.split('/').pop();

    // Delete existing entry
    db.prepare('DELETE FROM doc_index WHERE source = ?').run(filePath);

    // Insert new entry
    db.prepare(`
      INSERT INTO doc_index (title, content, source, doc_type)
      VALUES (?, ?, ?, ?)
    `).run(title, content, filePath, docType);

    // Update metadata
    db.prepare(`
      INSERT OR REPLACE INTO doc_metadata (source, doc_type, last_indexed, file_size)
      VALUES (?, ?, datetime('now'), ?)
    `).run(filePath, docType, stats.size);

    return { success: true, stats };
  } catch (err) {
    debug('Failed to index document', { file: filePath, error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Recursively index a directory
 */
function indexDirectory(db, dirPath, docType = 'doc', extensions = ['.md', '.txt']) {
  const results = { indexed: 0, failed: 0, totalSize: 0 };

  try {
    const files = readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = join(dirPath, file.name);

      if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
        const subResults = indexDirectory(db, fullPath, docType, extensions);
        results.indexed += subResults.indexed;
        results.failed += subResults.failed;
        results.totalSize += subResults.totalSize;
      } else if (extensions.some(ext => file.name.endsWith(ext))) {
        const result = indexDocument(db, fullPath, docType);
        if (result.success) {
          results.indexed++;
          results.totalSize += result.stats.size;
        } else {
          results.failed++;
        }
      }
    }
  } catch (err) {
    debug('Failed to read directory', { dir: dirPath, error: err.message });
  }

  return results;
}

/**
 * Build the full document index
 */
export function buildIndex(docPaths = []) {
  const init = initIndex();
  if (!init.success) {
    return init;
  }

  const db = new sqlite3(INDEX_DB_PATH);

  // Default paths
  const pathsToIndex = docPaths.length > 0 ? docPaths : [
    { path: join(PROJECT_ROOT, 'skills'), type: 'skill' },
    { path: join(PROJECT_ROOT, 'docs'), type: 'doc' },
    { path: join(PROJECT_ROOT, 'templates'), type: 'template' },
  ];

  const results = {
    totalIndexed: 0,
    totalFailed: 0,
    totalSize: 0,
    paths: [],
  };

  for (const { path, type } of pathsToIndex) {
    if (existsSync(path)) {
      const pathResults = indexDirectory(db, path, type);
      results.totalIndexed += pathResults.indexed;
      results.totalFailed += pathResults.failed;
      results.totalSize += pathResults.totalSize;
      results.paths.push({ path, type, ...pathResults });
    }
  }

  db.close();

  info('Index built', results);
  return { success: true, ...results };
}

/**
 * Search the document index using FTS5
 */
export function searchIndex(query, maxResults = 10) {
  if (!sqlite3) {
    return { fallback: true, results: [] };
  }

  if (!existsSync(INDEX_DB_PATH)) {
    return { error: 'Index not built. Run buildIndex() first.', results: [] };
  }

  try {
    const db = new sqlite3(INDEX_DB_PATH);

    // Record search stat
    db.prepare(`
      INSERT INTO search_stats (query, count, last_searched)
      VALUES (?, 1, datetime('now'))
      ON CONFLICT(query) DO UPDATE SET
        count = count + 1,
        last_searched = datetime('now')
    `).run(query);

    // FTS5 search with highlighting
    const rows = db.prepare(`
      SELECT
        title,
        snippet(doc_index, 0, '[', ']', '...', 32) as snippet,
        source,
        doc_type,
        rank
      FROM doc_index
      WHERE doc_index MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, maxResults);

    db.close();

    const results = rows.map(row => ({
      title: row.title,
      context: row.snippet,
      source: row.source,
      docType: row.doc_type,
      score: row.rank ? Math.round(1000 / (1 + Math.abs(row.rank))) : 50,
    }));

    return { success: true, results, query };
  } catch (err) {
    debug('Search failed', { query, error: err.message });
    return { error: err.message, results: [] };
  }
}

/**
 * Get index statistics
 */
export function getIndexStats() {
  if (!sqlite3 || !existsSync(INDEX_DB_PATH)) {
    return { available: false };
  }

  try {
    const db = new sqlite3(INDEX_DB_PATH);

    const docCount = db.prepare('SELECT COUNT(*) as count FROM doc_index').get();
    const typeCounts = db.prepare('SELECT doc_type, COUNT(*) as count FROM doc_metadata GROUP BY doc_type').all();
    const searchCounts = db.prepare('SELECT COUNT(*) as count FROM search_stats').get();
    const topQueries = db.prepare('SELECT query, count FROM search_stats ORDER BY count DESC LIMIT 5').all();

    db.close();

    return {
      available: true,
      documents: docCount.count,
      byType: typeCounts,
      uniqueSearches: searchCounts.count,
      topQueries,
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Clear and rebuild the index
 */
export function rebuildIndex(docPaths) {
  if (existsSync(INDEX_DB_PATH)) {
    try {
      const { unlinkSync } = await import('fs');
      unlinkSync(INDEX_DB_PATH);
    } catch (err) {
      debug('Failed to clear index', { error: err.message });
    }
  }
  return buildIndex(docPaths);
}

export default {
  initIndex,
  buildIndex,
  searchIndex,
  getIndexStats,
  rebuildIndex,
};
