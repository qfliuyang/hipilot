/**
 * ASIC-Brain Self-Improvement System
 *
 * Captures patterns from HiTestBot runs, user corrections, and EDA tool
 * interactions to improve HiPilot's performance over time.
 *
 * Part of the ASIC-Brain (Customer Owned Technology Brain) general knowledge system.
 * Formerly part of LittleBrain - renamed to reflect the dual-brain architecture.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Built-in error patterns for common EDA issues
 */
const BUILTIN_ERROR_PATTERNS = [
  {
    id: 'builtin_implf53_lef_order',
    pattern: {
      regex: 'IMPLF-53.*layer.*referenced in pin.*macro',
      tool: 'innovus',
      stage: 'design_init',
      context_before: 5,
      context_after: 3
    },
    root_cause: {
      category: 'LEF_LOADING_ORDER',
      description: 'Tech LEF (.tlef) must be loaded BEFORE cell LEFs (.lef) to define layers',
      confidence: 1.0
    },
    fix: {
      type: 'REORDER_LEF',
      action: 'Reorder init_lef_file to put tech LEF (.tlef) before cell LEFs (.lef)',
      tcl_template: 'set init_lef_file "<TECH_LEF> <CELL_LEFS>"',
      verify: 'Check that .tlef file appears before .lef files in init_lef_file',
      success_pattern: 'Design initialized successfully',
      added_at: '2026-03-10T00:00:00Z'
    },
    meta: {
      first_seen: '2026-03-09T08:57:25Z',
      last_seen: '2026-03-09T08:57:25Z',
      occurrence_count: 1,
      fix_success_count: 0,
      fix_success_rate: 0,
      source: 'manual',
      validated: true
    }
  },
  {
    id: 'builtin_lef_loading_failed',
    pattern: {
      regex: 'Loading LEF file\\(s\\) failed',
      tool: 'innovus',
      stage: 'design_init',
      context_before: 3,
      context_after: 5
    },
    root_cause: {
      category: 'LEF_LOADING_FAILED',
      description: 'LEF files failed to load, often due to wrong order or missing tech LEF',
      confidence: 0.9
    },
    fix: {
      type: 'CHECK_LEF_ORDER',
      action: 'Ensure tech LEF (.tlef) is first, then cell LEFs (.lef)',
      tcl_template: 'set init_lef_file "<TECH_LEF> <CELL_LEFS>"',
      verify: 'Verify LEF file paths and order',
      success_pattern: 'LEF files loaded successfully',
      added_at: '2026-03-10T00:00:00Z'
    },
    meta: {
      first_seen: '2026-03-09T08:57:25Z',
      last_seen: '2026-03-09T08:57:25Z',
      occurrence_count: 1,
      fix_success_count: 0,
      fix_success_rate: 0,
      source: 'manual',
      validated: true
    }
  }
];

/**
 * Error Pattern Database - Stores known errors and their fixes
 */
export class ErrorPatternDB {
  constructor(dbPath = '.hipilot/asic-brain/patterns/errors/index.json') {
    this.dbPath = dbPath;
    this.patterns = new Map();
    this._load();
  }

  _load() {
    // Load builtin patterns first
    for (const pattern of BUILTIN_ERROR_PATTERNS) {
      this.patterns.set(pattern.id, pattern);
    }

    if (existsSync(this.dbPath)) {
      const data = JSON.parse(readFileSync(this.dbPath, 'utf-8'));
      for (const pattern of data.patterns || []) {
        // Don't override builtin patterns
        if (!pattern.id?.startsWith('builtin_')) {
          this.patterns.set(pattern.id, pattern);
        }
      }
    }
  }

  _save() {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    const data = {
      last_updated: new Date().toISOString(),
      pattern_count: this.patterns.size,
      patterns: Array.from(this.patterns.values())
    };
    writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

  /**
   * Learn from an error and its fix
   */
  learn(errorOutput, context, fix, success) {
    const pattern = this._findOrCreatePattern(errorOutput, context);

    // Update occurrence tracking
    pattern.meta.last_seen = new Date().toISOString();
    pattern.meta.occurrence_count++;

    if (success) {
      pattern.meta.fix_success_count++;
      pattern.meta.fix_success_rate =
        pattern.meta.fix_success_count / pattern.meta.occurrence_count;

      // Validate if success rate is high enough
      if (pattern.meta.fix_success_rate >= 0.8 && pattern.meta.occurrence_count >= 3) {
        pattern.meta.validated = true;
      }
    }

    // Update fix if this one is better documented
    if (fix && (!pattern.fix || success)) {
      pattern.fix = {
        type: fix.type || 'WORKAROUND',
        action: fix.action,
        tcl_template: fix.tcl_template,
        verify: fix.verify,
        success_pattern: fix.success_pattern,
        added_at: new Date().toISOString()
      };
    }

    this.patterns.set(pattern.id, pattern);
    this._save();

    return pattern;
  }

  /**
   * Find matching pattern for an error
   */
  match(errorOutput, context = {}) {
    const matches = [];

    for (const pattern of this.patterns.values()) {
      // Tool/stage filtering
      if (pattern.pattern.tool && pattern.pattern.tool !== context.tool) continue;
      if (pattern.pattern.stage && pattern.pattern.stage !== context.stage) continue;

      // Regex matching
      const regex = new RegExp(pattern.pattern.regex, 'i');
      if (regex.test(errorOutput)) {
        const confidence = this._calculateConfidence(pattern, context);
        matches.push({ pattern, confidence });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get suggested fix for an error
   */
  getSuggestedFix(errorOutput, context = {}) {
    const matches = this.match(errorOutput, context);
    if (matches.length === 0) return null;

    const best = matches[0];
    if (best.confidence < 0.5) return null;

    return {
      pattern_id: best.pattern.id,
      confidence: best.confidence,
      fix: best.pattern.fix,
      root_cause: best.pattern.root_cause
    };
  }

  _findOrCreatePattern(errorOutput, context) {
    // Try to find existing pattern
    for (const pattern of this.patterns.values()) {
      const regex = new RegExp(pattern.pattern.regex, 'i');
      if (regex.test(errorOutput)) {
        return pattern;
      }
    }

    // Create new pattern
    const id = `err_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return {
      id,
      pattern: {
        regex: this._generateRegex(errorOutput),
        tool: context.tool,
        stage: context.stage,
        context_before: 5,
        context_after: 3
      },
      root_cause: {
        category: 'UNKNOWN',
        description: 'Auto-detected error pattern',
        confidence: 0.5
      },
      fix: null,
      meta: {
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        occurrence_count: 0,
        fix_success_count: 0,
        fix_success_rate: 0,
        source: context.source || 'hitestbot',
        validated: false
      }
    };
  }

  _generateRegex(errorLine) {
    // Escape special characters but make variables wildcards
    let pattern = errorLine
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\b\d+\b/g, '\\d+')
      .replace(/'[^']*'/g, "'[^']*'")
      .replace(/"[^"]*"/g, '"[^"]*"');
    return pattern.substring(0, 200); // Limit length
  }

  _calculateConfidence(pattern, context) {
    let confidence = pattern.root_cause.confidence;

    if (pattern.pattern.tool === context.tool) confidence += 0.1;
    if (pattern.pattern.stage === context.stage) confidence += 0.1;
    confidence *= pattern.meta.fix_success_rate || 0.5;

    return Math.min(confidence, 1.0);
  }

  getValidatedPatterns() {
    return Array.from(this.patterns.values())
      .filter(p => p.meta.validated)
      .sort((a, b) => b.meta.fix_success_rate - a.meta.fix_success_rate);
  }
}

/**
 * Success Pattern Tracker - Records successful command sequences
 */
export class SuccessTracker {
  constructor(dbPath = '.hipilot/asic-brain/patterns/successes/index.json') {
    this.dbPath = dbPath;
    this.patterns = new Map();
    this._load();
  }

  _load() {
    if (existsSync(this.dbPath)) {
      const data = JSON.parse(readFileSync(this.dbPath, 'utf-8'));
      for (const pattern of data.patterns || []) {
        this.patterns.set(pattern.id, pattern);
      }
    }
  }

  _save() {
    mkdirSync(dirname(this.dbPath), { recursive: true });
    const data = {
      last_updated: new Date().toISOString(),
      pattern_count: this.patterns.size,
      patterns: Array.from(this.patterns.values())
    };
    writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

  /**
   * Record a successful command sequence
   */
  record(context, commands, outcomes) {
    const fingerprint = this._generateFingerprint(commands);
    const existing = this._findByFingerprint(fingerprint);

    if (existing) {
      // Update existing
      existing.meta.observation_count++;
      existing.meta.last_observed = new Date().toISOString();
      existing.outcomes = this._mergeOutcomes(existing.outcomes, outcomes);
      existing.outcomes.success_rate = this._calculateSuccessRate(existing);
    } else {
      // Create new
      const pattern = {
        id: `succ_${Date.now()}`,
        pattern: {
          stage: context.stage,
          tool: context.tool,
          command_sequence: commands.map((c, i) => ({
            order: i + 1,
            cmd: c.cmd || c,
            purpose: c.purpose || 'unknown'
          })),
          fingerprint
        },
        outcomes: {
          ...outcomes,
          success_rate: 1.0,
          observation_count: 1
        },
        meta: {
          first_observed: new Date().toISOString(),
          last_observed: new Date().toISOString(),
          observation_count: 1,
          validated: false
        }
      };

      // Auto-validate after 5 observations with good success rate
      if (pattern.outcomes.success_rate >= 0.9 && pattern.meta.observation_count >= 5) {
        pattern.meta.validated = true;
      }

      this.patterns.set(pattern.id, pattern);
    }

    this._save();
  }

  /**
   * Get recommended approach for a stage
   */
  getRecommendation(stage, limit = 3) {
    const candidates = Array.from(this.patterns.values())
      .filter(p => p.pattern.stage === stage)
      .sort((a, b) => b.outcomes.success_rate - a.outcomes.success_rate);

    return candidates.slice(0, limit);
  }

  _generateFingerprint(commands) {
    const cmdStrings = commands.map(c => (c.cmd || c).split(' ')[0]);
    return cmdStrings.join('->');
  }

  _findByFingerprint(fingerprint) {
    for (const pattern of this.patterns.values()) {
      if (pattern.pattern.fingerprint === fingerprint) {
        return pattern;
      }
    }
    return null;
  }

  _mergeOutcomes(existing, new_) {
    return {
      wns_improvement: this._avg(existing.wns_improvement, new_.wns_improvement),
      tns_improvement: this._avg(existing.tns_improvement, new_.tns_improvement),
      avg_runtime_seconds: this._avg(existing.avg_runtime_seconds, new_.runtime_seconds)
    };
  }

  _avg(a, b) {
    if (a === undefined) return b;
    if (b === undefined) return a;
    return (a + b) / 2;
  }

  _calculateSuccessRate(pattern) {
    // Simplified - in real implementation would track per-run success
    return pattern.outcomes.success_rate || 1.0;
  }
}

/**
 * HiTestBot Evidence Processor
 */
export class HiTestBotAdapter {
  constructor(errorDB, successTracker) {
    this.errorDB = errorDB || new ErrorPatternDB();
    this.successTracker = successTracker || new SuccessTracker();
  }

  /**
   * Process HiTestBot evidence package
   */
  async processEvidence(evidenceDir) {
    const results = {
      patterns_learned: [],
      metrics: null,
      errors: []
    };

    try {
      // Read flow progress
      const progressPath = join(evidenceDir, 'flow_progress.json');
      if (existsSync(progressPath)) {
        const progress = JSON.parse(readFileSync(progressPath, 'utf-8'));
        results.metrics = this._extractMetrics(progress);
      }

      // Read EDA logs for errors
      const logsDir = join(evidenceDir, 'logs');
      if (existsSync(logsDir)) {
        const errors = await this._extractErrorsFromLogs(logsDir);
        for (const error of errors) {
          const pattern = this.errorDB.learn(error.output, error.context, error.fix, error.fixed);
          results.patterns_learned.push(pattern.id);
        }
      }

      // Record success patterns from completed stages
      if (results.metrics) {
        for (const stage of results.metrics.stages || []) {
          if (stage.outcome?.status === 'success') {
            this.successTracker.record(
              { stage: stage.name, tool: stage.tool },
              stage.commands || [],
              { runtime_seconds: stage.timing?.duration_seconds }
            );
          }
        }
      }
    } catch (e) {
      results.errors.push(e.message);
    }

    return results;
  }

  _extractMetrics(progress) {
    return {
      score: progress.score,
      stage: progress.stage,
      stages: progress.stages || []
    };
  }

  async _extractErrorsFromLogs(logsDir) {
    // Simplified - look for error patterns in log files
    const errors = [];
    // Implementation would scan innovus.log, dc_shell.log etc.
    return errors;
  }
}

/**
 * Quick access functions for MCP integration
 */
let errorDB = null;
let successTracker = null;
let adapter = null;

function getErrorDB() {
  if (!errorDB) errorDB = new ErrorPatternDB();
  return errorDB;
}

function getSuccessTracker() {
  if (!successTracker) successTracker = new SuccessTracker();
  return successTracker;
}

function getAdapter() {
  if (!adapter) adapter = new HiTestBotAdapter(getErrorDB(), getSuccessTracker());
  return adapter;
}

/**
 * Record an error pattern
 */
export function recordError(errorOutput, context, fix, success) {
  return getErrorDB().learn(errorOutput, context, fix, success);
}

/**
 * Get suggested fix for an error
 */
export function getSuggestedFix(errorOutput, context) {
  return getErrorDB().getSuggestedFix(errorOutput, context);
}

/**
 * Record successful command sequence
 */
export function recordSuccess(context, commands, outcomes) {
  return getSuccessTracker().record(context, commands, outcomes);
}

/**
 * Get best practice for a stage
 */
export function getBestPractice(stage) {
  return getSuccessTracker().getRecommendation(stage);
}

/**
 * Process HiTestBot evidence
 */
export async function processHiTestBotEvidence(evidenceDir) {
  return getAdapter().processEvidence(evidenceDir);
}

