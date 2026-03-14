#!/usr/bin/env node
/**
 * Project-Brain - Per-Design Progressive Knowledge Base
 *
 * Stores design-specific memory that learns throughout the RTL-to-GDS flow.
 * Works alongside ASIC-Brain (methodology) and EDA-Brain (tool usage).
 *
 * Key Features:
 * - Per-design memory storage in ${HIPILOT_DESIGN_DIR}/.project-brain/
 * - Progressive disclosure: starts empty, learns during flow
 * - Stage-specific memories: RTL, Floorplan, Placement, CTS, Routing, Timing
 * - Error pattern tracking with resolutions
 * - QoR progression tracking (WNS/TNS trends)
 * - Checkpoint recovery context
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// ============================================================================
// Memory Types and Structure
// ============================================================================

const MEMORY_TYPES = {
  rtl_memory: {
    description: 'RTL analysis and hierarchy information',
    stage: 0,
    fields: ['design_name', 'hierarchy', 'clock_domains', 'critical_paths', 'synthesis_issues']
  },
  floorplan_memory: {
    description: 'Floorplan iterations and physical constraints',
    stage: 2,
    fields: ['iterations', 'final_config', 'io_placement', 'macro_placement']
  },
  powerplan_memory: {
    description: 'Power planning configuration',
    stage: 3,
    fields: ['ring_config', 'stripe_config', 'via_config', 'pg_network']
  },
  placement_memory: {
    description: 'Placement iterations and learnings',
    stage: 4,
    fields: ['wns_progression', 'density_trends', 'critical_paths', 'hotspots', 'strategies']
  },
  cts_memory: {
    description: 'Clock tree synthesis data',
    stage: 5,
    fields: ['spec', 'skew_targets', 'achieved_skew', 'ndr_rules', 'clock_gates']
  },
  post_cts_opt_memory: {
    description: 'Post-CTS optimization results',
    stage: 6,
    fields: ['setup_fixes', 'hold_fixes', 'buffer_insertions', 'optimization_strategies']
  },
  routing_memory: {
    description: 'Routing iterations and DRC data',
    stage: 7,
    fields: ['drc_violations', 'layer_usage', 'congestion_maps', 'via_strategies']
  },
  route_opt_memory: {
    description: 'Post-route optimization',
    stage: 8,
    fields: ['timing_ecos', 'drc_cleanup', 'final_qor']
  },
  chip_finish_memory: {
    description: 'Chip finish and GDS export',
    stage: 9,
    fields: ['filler_cells', 'seal_ring', 'gds_export', 'final_checks']
  },
  timing_memory: {
    description: 'Aggregated timing journey across all stages',
    stage: 'all',
    fields: ['wns_history', 'tns_history', 'critical_path_evolution', 'signoff_confidence']
  },
  error_patterns: {
    description: 'Design-specific errors and their resolutions',
    stage: 'all',
    fields: ['pattern_id', 'message_regex', 'context', 'resolution', 'times_encountered', 'auto_fixable']
  },
  drc_memory: {
    description: 'DRC issues and resolutions',
    stage: 'all',
    fields: ['violation_types', 'locations', 'fixes_applied', 'final_status']
  }
};

const STAGE_NAMES = {
  0: 'synthesis',
  1: 'design_init',
  2: 'floorplan',
  3: 'powerplan',
  4: 'placement',
  5: 'cts',
  6: 'post_cts_opt',
  7: 'routing',
  8: 'route_opt',
  9: 'chip_finish'
};

// ============================================================================
// Project-Brain Class
// ============================================================================

class ProjectBrain {
  constructor(designDir = null, designName = null) {
    this.designDir = designDir || process.env.HIPILOT_DESIGN_DIR;
    this.designName = designName || process.env.HIPILOT_DESIGN_NAME || 'unnamed';
    this.brainDir = this.designDir ? join(this.designDir, '.project-brain') : null;
    this.indexPath = this.brainDir ? join(this.brainDir, 'index.json') : null;

    // In-memory cache
    this.cache = new Map();
    this.index = null;

    // Ensure directory exists
    if (this.brainDir && !existsSync(this.brainDir)) {
      try {
        mkdirSync(this.brainDir, { recursive: true });
        this._initializeIndex();
      } catch (e) {
        console.error(`Failed to create Project-Brain directory: ${e.message}`);
      }
    }

    // Load existing index
    this._loadIndex();
  }

  /**
   * Check if Project-Brain is available (has design directory)
   */
  isAvailable() {
    return this.brainDir !== null && existsSync(this.brainDir);
  }

  /**
   * Initialize new index
   */
  _initializeIndex() {
    this.index = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      design_name: this.designName,
      design_dir: this.designDir,
      current_stage: 0,
      completed_stages: [],
      memory_files: {},
      metadata: {
        total_entries: 0,
        last_session: null
      }
    };
    this._saveIndex();
  }

  /**
   * Load index from disk
   */
  _loadIndex() {
    if (!this.indexPath || !existsSync(this.indexPath)) {
      this.index = null;
      return;
    }

    try {
      this.index = JSON.parse(readFileSync(this.indexPath, 'utf-8'));
    } catch (e) {
      console.error(`Failed to load Project-Brain index: ${e.message}`);
      this.index = null;
    }
  }

  /**
   * Save index to disk
   */
  _saveIndex() {
    if (!this.indexPath) return;

    try {
      this.index.updated_at = new Date().toISOString();
      writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
    } catch (e) {
      console.error(`Failed to save Project-Brain index: ${e.message}`);
    }
  }

  /**
   * Get memory file path for a category
   */
  _getMemoryPath(category) {
    if (!this.brainDir) return null;
    return join(this.brainDir, `${category}.json`);
  }

  /**
   * Load memory file for a category
   */
  _loadMemory(category) {
    // Check cache first
    if (this.cache.has(category)) {
      return this.cache.get(category);
    }

    const path = this._getMemoryPath(category);
    if (!path || !existsSync(path)) {
      return null;
    }

    try {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      this.cache.set(category, data);
      return data;
    } catch (e) {
      return null;
    }
  }

  /**
   * Save memory file for a category
   */
  _saveMemory(category, data) {
    const path = this._getMemoryPath(category);
    if (!path) return false;

    try {
      writeFileSync(path, JSON.stringify(data, null, 2));
      this.cache.set(category, data);

      // Update index
      if (this.index) {
        this.index.memory_files[category] = {
          updated_at: new Date().toISOString(),
          entry_count: Array.isArray(data) ? data.length : Object.keys(data).length
        };
        this.index.metadata.total_entries = Object.values(this.index.memory_files)
          .reduce((sum, f) => sum + (f.entry_count || 0), 0);
        this._saveIndex();
      }

      return true;
    } catch (e) {
      console.error(`Failed to save memory ${category}: ${e.message}`);
      return false;
    }
  }

  /**
   * Store information in project memory
   */
  remember(category, key, value, context = {}) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Project-Brain not available (no design directory)' };
    }

    if (!MEMORY_TYPES[category]) {
      return { success: false, error: `Unknown memory category: ${category}` };
    }

    let memory = this._loadMemory(category) || {
      category,
      design_name: this.designName,
      created_at: new Date().toISOString(),
      entries: []
    };

    // Ensure entries array exists
    if (!memory.entries) {
      memory.entries = [];
    }

    // Create entry
    const entry = {
      key,
      value,
      context,
      timestamp: new Date().toISOString(),
      stage: this.index?.current_stage || 0,
      stage_name: STAGE_NAMES[this.index?.current_stage || 0]
    };

    // Check if key already exists
    const existingIndex = memory.entries.findIndex(e => e.key === key);
    if (existingIndex >= 0) {
      // Update existing
      entry.previous_value = memory.entries[existingIndex].value;
      entry.update_count = (memory.entries[existingIndex].update_count || 0) + 1;
      memory.entries[existingIndex] = entry;
    } else {
      memory.entries.push(entry);
    }

    memory.updated_at = new Date().toISOString();

    const saved = this._saveMemory(category, memory);

    return {
      success: saved,
      category,
      key,
      is_update: existingIndex >= 0,
      entry_count: memory.entries.length
    };
  }

  /**
   * Retrieve information from project memory
   */
  recall(category, key = null, options = {}) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Project-Brain not available' };
    }

    const memory = this._loadMemory(category);
    if (!memory) {
      return { success: false, error: `No memory found for category: ${category}` };
    }

    if (!memory.entries) {
      return { success: false, error: 'Invalid memory structure' };
    }

    // Return all entries if no key specified
    if (key === null) {
      return {
        success: true,
        category,
        entries: memory.entries,
        count: memory.entries.length
      };
    }

    // Find specific key
    const entry = memory.entries.find(e => e.key === key);
    if (!entry) {
      return { success: false, error: `Key not found: ${key}` };
    }

    return {
      success: true,
      category,
      key,
      entry
    };
  }

  /**
   * Search across project memories
   */
  search(query, options = {}) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Project-Brain not available' };
    }

    const { categories = Object.keys(MEMORY_TYPES), limit = 20 } = options;
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const category of categories) {
      const memory = this._loadMemory(category);
      if (!memory || !memory.entries) continue;

      for (const entry of memory.entries) {
        // Search in key
        let score = 0;
        if (entry.key && entry.key.toLowerCase().includes(lowerQuery)) {
          score += 10;
        }

        // Search in value (if string)
        if (typeof entry.value === 'string' && entry.value.toLowerCase().includes(lowerQuery)) {
          score += 5;
        }

        // Search in context
        if (entry.context) {
          const contextStr = JSON.stringify(entry.context).toLowerCase();
          if (contextStr.includes(lowerQuery)) {
            score += 3;
          }
        }

        if (score > 0) {
          results.push({
            category,
            key: entry.key,
            value: entry.value,
            context: entry.context,
            timestamp: entry.timestamp,
            stage: entry.stage,
            score
          });
        }
      }
    }

    // Sort by score and limit
    results.sort((a, b) => b.score - a.score);

    return {
      success: true,
      query,
      results: results.slice(0, limit),
      total: results.length
    };
  }

  /**
   * Get current design context for decision making
   */
  getContext(need = []) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Project-Brain not available' };
    }

    const context = {
      design_name: this.designName,
      design_dir: this.designDir,
      current_stage: this.index?.current_stage || 0,
      current_stage_name: STAGE_NAMES[this.index?.current_stage || 0],
      completed_stages: this.index?.completed_stages || []
    };

    // Load requested memory categories
    for (const category of need) {
      const memory = this._loadMemory(category);
      if (memory) {
        context[category] = memory;
      }
    }

    return {
      success: true,
      context
    };
  }

  /**
   * Set current flow stage
   */
  setStage(stage) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Project-Brain not available' };
    }

    if (this.index) {
      // Mark previous stage as complete if advancing
      if (stage > this.index.current_stage && !this.index.completed_stages.includes(this.index.current_stage)) {
        this.index.completed_stages.push(this.index.current_stage);
      }

      this.index.current_stage = stage;
      this.index.metadata.last_session = new Date().toISOString();
      this._saveIndex();

      return {
        success: true,
        stage,
        stage_name: STAGE_NAMES[stage],
        completed_stages: this.index.completed_stages
      };
    }

    return { success: false, error: 'Index not loaded' };
  }

  /**
   * Record QoR snapshot
   */
  recordQoR(stage, metrics, context = {}) {
    return this.remember('timing_memory', `stage_${stage}_qor_${Date.now()}`, {
      stage,
      stage_name: STAGE_NAMES[stage],
      metrics,
      timestamp: new Date().toISOString()
    }, context);
  }

  /**
   * Get QoR progression
   */
  getQoRProgression(metric = 'wns') {
    const result = this.recall('timing_memory');
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const progression = result.entries
      .filter(e => e.value && e.value.metrics && e.value.metrics[metric] !== undefined)
      .map(e => ({
        stage: e.value.stage,
        stage_name: e.value.stage_name,
        value: e.value.metrics[metric],
        timestamp: e.timestamp,
        all_metrics: e.value.metrics
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return {
      success: true,
      metric,
      progression,
      count: progression.length
    };
  }

  /**
   * Record error pattern
   */
  recordErrorPattern(pattern, errorOutput, resolution, autoFixable = false) {
    return this.remember('error_patterns', pattern, {
      pattern,
      message_regex: errorOutput.substring(0, 200),
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      context: errorOutput.substring(0, 500),
      resolution,
      times_encountered: 1,
      auto_fixable: autoFixable
    });
  }

  /**
   * Get summary of all project knowledge
   */
  getSummary() {
    if (!this.isAvailable()) {
      return { success: false, error: 'Project-Brain not available' };
    }

    const summary = {
      design_name: this.designName,
      current_stage: this.index?.current_stage || 0,
      current_stage_name: STAGE_NAMES[this.index?.current_stage || 0],
      completed_stages: this.index?.completed_stages || [],
      memories: {},
      total_entries: 0
    };

    for (const category of Object.keys(MEMORY_TYPES)) {
      const memory = this._loadMemory(category);
      if (memory && memory.entries) {
        summary.memories[category] = {
          entry_count: memory.entries.length,
          last_updated: memory.updated_at
        };
        summary.total_entries += memory.entries.length;
      }
    }

    return {
      success: true,
      summary
    };
  }

  /**
   * Export all memories for sharing/backup
   */
  exportMemories() {
    if (!this.isAvailable()) {
      return { success: false, error: 'Project-Brain not available' };
    }

    const export_ = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      design_name: this.designName,
      index: this.index,
      memories: {}
    };

    for (const category of Object.keys(MEMORY_TYPES)) {
      const memory = this._loadMemory(category);
      if (memory) {
        export_.memories[category] = memory;
      }
    }

    return {
      success: true,
      export: export_
    };
  }
}

// ============================================================================
// Quick Access Functions
// ============================================================================

let globalInstance = null;

function getProjectBrain(designDir, designName) {
  if (!globalInstance || globalInstance.designDir !== designDir) {
    globalInstance = new ProjectBrain(designDir, designName);
  }
  return globalInstance;
}

export function remember(category, key, value, context, designDir, designName) {
  return getProjectBrain(designDir, designName).remember(category, key, value, context);
}

export function recall(category, key, designDir, designName) {
  return getProjectBrain(designDir, designName).recall(category, key);
}

export function searchProjectBrain(query, options, designDir, designName) {
  return getProjectBrain(designDir, designName).search(query, options);
}

export function getProjectContext(needs, designDir, designName) {
  return getProjectBrain(designDir, designName).getContext(needs);
}

export function setProjectStage(stage, designDir, designName) {
  return getProjectBrain(designDir, designName).setStage(stage);
}

export function recordProjectQoR(stage, metrics, context, designDir, designName) {
  return getProjectBrain(designDir, designName).recordQoR(stage, metrics, context);
}

export function getQoRProgression(metric, designDir, designName) {
  return getProjectBrain(designDir, designName).getQoRProgression(metric);
}

export function recordProjectErrorPattern(pattern, errorOutput, resolution, autoFixable, designDir, designName) {
  return getProjectBrain(designDir, designName).recordErrorPattern(pattern, errorOutput, resolution, autoFixable);
}

export function getProjectSummary(designDir, designName) {
  return getProjectBrain(designDir, designName).getSummary();
}

export function exportProjectMemories(designDir, designName) {
  return getProjectBrain(designDir, designName).exportMemories();
}

export function isProjectBrainAvailable(designDir) {
  const brain = designDir ? new ProjectBrain(designDir) : getProjectBrain();
  return brain.isAvailable();
}

// ============================================================================
// Exports
// ============================================================================

export {
  ProjectBrain,
  MEMORY_TYPES,
  STAGE_NAMES,
  getProjectBrain
};

export default {
  remember,
  recall,
  search: searchProjectBrain,
  getContext: getProjectContext,
  setStage: setProjectStage,
  recordQoR: recordProjectQoR,
  getQoRProgression,
  recordErrorPattern: recordProjectErrorPattern,
  getSummary: getProjectSummary,
  exportMemories: exportProjectMemories,
  isAvailable: isProjectBrainAvailable,
  MEMORY_TYPES,
  STAGE_NAMES
};
