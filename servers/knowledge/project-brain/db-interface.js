/**
 * Database Interface for Project-Brain
 * SQLite wrapper for metrics storage
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

// Dynamic import for better-sqlite3 (optional dependency)
let Database = null;
try {
  const betterSqlite3 = await import('better-sqlite3');
  Database = betterSqlite3.default;
} catch (e) {
  // SQLite not available, will use JSON fallback
}

export class ProjectBrainDB {
  constructor(projectName, dbPath = null) {
    this.projectName = projectName;
    this.dbPath = dbPath;
    this.db = null;
    this.isSQLite = false;
  }

  /**
   * Initialize database connection
   */
  initialize(customDbPath = null) {
    if (customDbPath) {
      this.dbPath = customDbPath;
    }

    // If no path specified, use default location
    if (!this.dbPath) {
      const designDir = process.env.HIPILOT_DESIGN_DIR || process.cwd();
      const brainDir = join(designDir, '.project-brain');
      this.dbPath = join(brainDir, 'metrics.db');
    }

    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Try to use SQLite if available
    if (Database) {
      try {
        this.db = new Database(this.dbPath);
        this.isSQLite = true;
        this._applyMigrations();
        return { success: true, mode: 'sqlite', path: this.dbPath };
      } catch (e) {
        console.warn(`SQLite failed, using JSON fallback: ${e.message}`);
      }
    }

    // Fallback to JSON-based storage
    this.isSQLite = false;
    this._initJsonFallback();
    return { success: true, mode: 'json', path: this.dbPath.replace('.db', '.json') };
  }

  /**
   * Apply database migrations
   */
  _applyMigrations() {
    if (!this.isSQLite) return;

    // Check if migrations table exists
    const tableCheck = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
    ).get();

    if (!tableCheck) {
      // Create migrations table
      this.db.exec(`
        CREATE TABLE migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Apply initial schema
      const schemaPath = join(dirname(this.dbPath), '..', 'database', 'schema.sql');
      if (existsSync(schemaPath)) {
        const schema = readFileSync(schemaPath, 'utf-8');
        this.db.exec(schema);
        this.db.prepare('INSERT INTO migrations (version) VALUES (?)').run('001');
      }
    }
  }

  /**
   * Initialize JSON fallback storage
   */
  _initJsonFallback() {
    this.jsonData = {
      qor_snapshots: [],
      error_log: [],
      checkpoints: [],
      stage_transitions: []
    };

    // Try to load existing data
    const jsonPath = this.dbPath.replace('.db', '.json');
    if (existsSync(jsonPath)) {
      try {
        this.jsonData = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      } catch (e) {
        // Use empty data
      }
    }
  }

  /**
   * Save JSON fallback data
   */
  _saveJsonFallback() {
    if (this.isSQLite) return;
    const jsonPath = this.dbPath.replace('.db', '.json');
    writeFileSync(jsonPath, JSON.stringify(this.jsonData, null, 2));
  }

  /**
   * Record QoR snapshot
   */
  recordQoR(stage, metrics, checkpointName = null) {
    const record = {
      project_name: this.projectName,
      stage,
      checkpoint_name: checkpointName,
      timestamp: new Date().toISOString(),
      wns: metrics.wns ?? null,
      tns: metrics.tns ?? null,
      area: metrics.area ?? null,
      power: metrics.power ?? null,
      cell_count: metrics.cell_count ?? null,
      utilization: metrics.utilization ?? null,
      drc_count: metrics.drc_count ?? null
    };

    if (this.isSQLite) {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO qor_snapshots
        (project_name, stage, checkpoint_name, wns, tns, area, power, cell_count, utilization, drc_count)
        VALUES (@project_name, @stage, @checkpoint_name, @wns, @tns, @area, @power, @cell_count, @utilization, @drc_count)
      `);
      stmt.run(record);
    } else {
      // JSON fallback - remove existing entry for same stage/checkpoint
      this.jsonData.qor_snapshots = this.jsonData.qor_snapshots.filter(
        s => !(s.project_name === record.project_name &&
               s.stage === record.stage &&
               s.checkpoint_name === record.checkpoint_name)
      );
      this.jsonData.qor_snapshots.push(record);
      this._saveJsonFallback();
    }

    return { success: true, record };
  }

  /**
   * Get QoR trend for a stage
   */
  getQoRTrend(stage, limit = 10) {
    if (this.isSQLite) {
      const stmt = this.db.prepare(`
        SELECT * FROM qor_snapshots
        WHERE project_name = ? AND stage = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      const rows = stmt.all(this.projectName, stage, limit);
      return { success: true, stage, count: rows.length, data: rows };
    } else {
      const rows = this.jsonData.qor_snapshots
        .filter(s => s.project_name === this.projectName && s.stage === stage)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
      return { success: true, stage, count: rows.length, data: rows };
    }
  }

  /**
   * Get QoR progression across all stages
   */
  getQoRProgression(metric = 'wns') {
    if (this.isSQLite) {
      const stmt = this.db.prepare(`
        SELECT stage, ${metric}, timestamp
        FROM qor_snapshots
        WHERE project_name = ? AND ${metric} IS NOT NULL
        ORDER BY timestamp ASC
      `);
      const rows = stmt.all(this.projectName);
      return { success: true, metric, count: rows.length, progression: rows };
    } else {
      const rows = this.jsonData.qor_snapshots
        .filter(s => s.project_name === this.projectName && s[metric] !== null)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map(s => ({ stage: s.stage, [metric]: s[metric], timestamp: s.timestamp }));
      return { success: true, metric, count: rows.length, progression: rows };
    }
  }

  /**
   * Log an error with resolution
   */
  logError(stage, errorMessage, errorType = null, resolution = null) {
    const record = {
      project_name: this.projectName,
      stage,
      error_message: errorMessage,
      error_type: errorType,
      resolution,
      timestamp: new Date().toISOString()
    };

    if (this.isSQLite) {
      const stmt = this.db.prepare(`
        INSERT INTO error_log (project_name, stage, error_message, error_type, resolution)
        VALUES (@project_name, @stage, @error_message, @error_type, @resolution)
      `);
      const result = stmt.run(record);
      return { success: true, id: result.lastInsertRowid, record };
    } else {
      record.id = this.jsonData.error_log.length + 1;
      this.jsonData.error_log.push(record);
      this._saveJsonFallback();
      return { success: true, id: record.id, record };
    }
  }

  /**
   * Find similar past errors
   */
  getSimilarErrors(errorMessage, limit = 5) {
    const searchTerm = errorMessage.toLowerCase().substring(0, 100);

    if (this.isSQLite) {
      // Use LIKE for simple text matching
      const stmt = this.db.prepare(`
        SELECT * FROM error_log
        WHERE project_name = ? AND LOWER(error_message) LIKE ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      const rows = stmt.all(this.projectName, `%${searchTerm}%`, limit);
      return { success: true, count: rows.length, errors: rows };
    } else {
      const rows = this.jsonData.error_log
        .filter(e => e.project_name === this.projectName &&
                     e.error_message.toLowerCase().includes(searchTerm))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
      return { success: true, count: rows.length, errors: rows };
    }
  }

  /**
   * Register a checkpoint
   */
  registerCheckpoint(stage, checkpointPath, parentCheckpoint = null, metadata = {}) {
    const record = {
      project_name: this.projectName,
      stage,
      checkpoint_path: checkpointPath,
      parent_checkpoint: parentCheckpoint,
      metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString()
    };

    if (this.isSQLite) {
      const stmt = this.db.prepare(`
        INSERT INTO checkpoints (project_name, stage, checkpoint_path, parent_checkpoint, metadata)
        VALUES (@project_name, @stage, @checkpoint_path, @parent_checkpoint, @metadata)
      `);
      const result = stmt.run(record);
      return { success: true, id: result.lastInsertRowid, record };
    } else {
      record.id = this.jsonData.checkpoints.length + 1;
      this.jsonData.checkpoints.push(record);
      this._saveJsonFallback();
      return { success: true, id: record.id, record };
    }
  }

  /**
   * Get checkpoint history
   */
  getCheckpointHistory(stage = null) {
    if (this.isSQLite) {
      let query = 'SELECT * FROM checkpoints WHERE project_name = ?';
      const params = [this.projectName];

      if (stage) {
        query += ' AND stage = ?';
        params.push(stage);
      }

      query += ' ORDER BY created_at DESC';

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);

      // Parse metadata JSON
      rows.forEach(row => {
        try {
          row.metadata = JSON.parse(row.metadata);
        } catch (e) {
          row.metadata = {};
        }
      });

      return { success: true, count: rows.length, checkpoints: rows };
    } else {
      let rows = this.jsonData.checkpoints.filter(c => c.project_name === this.projectName);
      if (stage) {
        rows = rows.filter(c => c.stage === stage);
      }
      rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { success: true, count: rows.length, checkpoints: rows };
    }
  }

  /**
   * Record stage transition
   */
  recordStageTransition(fromStage, toStage, success = true, metadata = {}) {
    const record = {
      project_name: this.projectName,
      from_stage: fromStage,
      to_stage: toStage,
      success,
      metadata: JSON.stringify(metadata)
    };

    if (this.isSQLite) {
      const stmt = this.db.prepare(`
        INSERT INTO stage_transitions (project_name, from_stage, to_stage, success, metadata)
        VALUES (@project_name, @from_stage, @to_stage, @success, @metadata)
      `);
      const result = stmt.run(record);
      return { success: true, id: result.lastInsertRowid };
    } else {
      record.id = this.jsonData.stage_transitions.length + 1;
      record.transition_time = new Date().toISOString();
      this.jsonData.stage_transitions.push(record);
      this._saveJsonFallback();
      return { success: true, id: record.id };
    }
  }

  /**
   * Get project summary from database
   */
  getSummary() {
    if (this.isSQLite) {
      const qorCount = this.db.prepare(
        'SELECT COUNT(*) as count FROM qor_snapshots WHERE project_name = ?'
      ).get(this.projectName);

      const errorCount = this.db.prepare(
        'SELECT COUNT(*) as count FROM error_log WHERE project_name = ?'
      ).get(this.projectName);

      const checkpointCount = this.db.prepare(
        'SELECT COUNT(*) as count FROM checkpoints WHERE project_name = ?'
      ).get(this.projectName);

      const latestQoR = this.db.prepare(`
        SELECT stage, wns, tns, timestamp
        FROM qor_snapshots
        WHERE project_name = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(this.projectName);

      return {
        success: true,
        project_name: this.projectName,
        qor_snapshots: qorCount.count,
        error_log: errorCount.count,
        checkpoints: checkpointCount.count,
        latest_qor: latestQoR || null
      };
    } else {
      return {
        success: true,
        project_name: this.projectName,
        qor_snapshots: this.jsonData.qor_snapshots.filter(s => s.project_name === this.projectName).length,
        error_log: this.jsonData.error_log.filter(e => e.project_name === this.projectName).length,
        checkpoints: this.jsonData.checkpoints.filter(c => c.project_name === this.projectName).length,
        latest_qor: this.jsonData.qor_snapshots
          .filter(s => s.project_name === this.projectName)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0] || null
      };
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.isSQLite && this.db) {
      this.db.close();
    } else {
      this._saveJsonFallback();
    }
  }
}

// Factory function
export function createDB(projectName, dbPath) {
  return new ProjectBrainDB(projectName, dbPath);
}

export default ProjectBrainDB;
