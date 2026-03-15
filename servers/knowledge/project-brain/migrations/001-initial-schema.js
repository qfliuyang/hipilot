/**
 * Migration 001: Initial Schema
 * Creates the core tables for Project-Brain hybrid architecture
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function migrate(db) {
  const schemaPath = join(__dirname, '..', 'database', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Split by semicolon and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    db.exec(stmt + ';');
  }

  return {
    success: true,
    migration: '001-initial-schema',
    tablesCreated: ['qor_snapshots', 'error_log', 'checkpoints', 'stage_transitions']
  };
}

export function rollback(db) {
  const tables = ['stage_transitions', 'checkpoints', 'error_log', 'qor_snapshots'];

  for (const table of tables) {
    try {
      db.exec(`DROP TABLE IF EXISTS ${table};`);
    } catch (e) {
      // Table may not exist, continue
    }
  }

  return {
    success: true,
    migration: '001-initial-schema',
    tablesDropped: tables
  };
}

export const metadata = {
  version: '001',
  name: 'initial-schema',
  description: 'Creates core tables for Project-Brain hybrid architecture',
  created: '2026-03-15'
};
