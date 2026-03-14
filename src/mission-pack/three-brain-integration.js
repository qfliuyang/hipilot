/**
 * Three-Brain Integration for Mission Pack
 *
 * Connects the Project Mission Pack with the Three-Brain architecture:
 * - ASIC-Brain: Uses mission pack for flow planning, recipes, targets
 * - EDA-Brain: Uses mission pack for tool configs, library paths
 * - Project-Brain: Stores design-specific learnings during execution
 */

import { loadMissionPack, hasMissionPack } from './index.js';
import { autoDetectMissionPack, canAutoDetect } from './auto-detect.js';
import * as projectBrain from '../../servers/knowledge/project-brain/index.js';

/**
 * MissionPackContext - Unified interface for accessing mission pack data
 * across all three brains.
 */
export class MissionPackContext {
  constructor(designDir = null) {
    this.designDir = designDir || process.env.HIPILOT_DESIGN_DIR || process.cwd();
    this.missionPack = null;
    this.projectBrain = null;
    this._loadMissionPack();
  }

  /**
   * Load mission pack for the design
   */
  _loadMissionPack() {
    if (hasMissionPack(this.designDir)) {
      this.missionPack = loadMissionPack(this.designDir);
    } else if (canAutoDetect(this.designDir).canDetect) {
      const autoData = autoDetectMissionPack(this.designDir);
      // MissionPack will be set from autoData via loadMissionPack
      this.missionPack = loadMissionPack(this.designDir);
    } else {
      // Create default mission pack
      this.missionPack = loadMissionPack(this.designDir);
    }

    // Initialize Project-Brain
    this.projectBrain = projectBrain.getProjectBrain(
      this.designDir,
      this.missionPack.projectName
    );
  }

  // ============================================================================
  // ASIC-Brain Interface (Methodology & Flow)
  // ============================================================================

  /**
   * Get flow definition for ASIC-Brain
   * Returns: stages, recipes, targets
   */
  getFlowDefinition() {
    return {
      stages: this.missionPack.stages,
      recipes: this.missionPack.flow.recipes || {},
      targets: this.missionPack.getTargets(),
    };
  }

  /**
   * Get stage recipe for a specific stage
   */
  getStageRecipe(stage) {
    return this.missionPack.getRecipe(stage);
  }

  /**
   * Get target metrics for QoR validation
   */
  getTargetMetrics() {
    return this.missionPack.getTargets();
  }

  /**
   * Get timing targets
   */
  getTimingTargets() {
    return this.missionPack.getTimingTargets();
  }

  /**
   * Check if a QoR metric meets target
   */
  checkQoRTarget(metric, value) {
    const targets = this.missionPack.getTargets();

    switch (metric) {
      case 'wns':
        return value >= (targets.timing?.wns ?? 0);
      case 'tns':
        return value >= (targets.timing?.tns ?? 0);
      case 'utilization':
        return value <= (targets.area?.max_utilization ?? 1.0);
      default:
        return true;
    }
  }

  // ============================================================================
  // EDA-Brain Interface (Tool Configuration)
  // ============================================================================

  /**
   * Get tool configuration for EDA-Brain
   */
  getToolConfig(toolName, stage = null) {
    return this.missionPack.getToolConfig(toolName, stage);
  }

  /**
   * Get all library paths for a specific corner
   */
  getLibrariesForCorner(corner = 'typical') {
    return this.missionPack.getLibraries(corner);
  }

  /**
   * Get LEF files (Tech LEF first)
   */
  getLefFiles() {
    return this.missionPack.getLefFiles();
  }

  /**
   * Get GDS files
   */
  getGdsFiles() {
    return this.missionPack.getGdsFiles();
  }

  /**
   * Get RTL files with resolved paths
   */
  getRtlFiles() {
    return this.missionPack.getRtlFiles();
  }

  /**
   * Get constraint files
   */
  getConstraintFiles() {
    return this.missionPack.getConstraintFiles();
  }

  /**
   * Get technology information
   */
  getTechnologyInfo() {
    return this.missionPack.getTechnologyInfo();
  }

  /**
   * Get power domain configuration
   */
  getPowerDomains() {
    return this.missionPack.getPowerDomains();
  }

  /**
   * Get MMMC corner definitions
   */
  getCorners() {
    return this.missionPack.getCorners();
  }

  /**
   * Get pre-stage hook Tcl
   */
  getPreHook(stage) {
    return this.missionPack.getPreHook(stage);
  }

  /**
   * Get post-stage hook Tcl
   */
  getPostHook(stage) {
    return this.missionPack.getPostHook(stage);
  }

  /**
   * Get environment variables
   */
  getEnvironment() {
    return this.missionPack.getEnvironment();
  }

  // ============================================================================
  // Project-Brain Interface (Design Memory)
  // ============================================================================

  /**
   * Remember something in Project-Brain
   */
  remember(category, key, value, context = {}) {
    return this.projectBrain.remember(category, key, value, context);
  }

  /**
   * Recall from Project-Brain
   */
  recall(category, key = null) {
    return this.projectBrain.recall(category, key);
  }

  /**
   * Search Project-Brain
   */
  search(query, options = {}) {
    return this.projectBrain.search(query, options);
  }

  /**
   * Get current design context
   */
  getDesignContext(needs = []) {
    // Merge mission pack context with learned context
    const baseContext = {
      project: this.missionPack.project,
      design: {
        top_module: this.missionPack.topModule,
        rtl_files: this.missionPack.getRtlFiles(),
      },
      flow: {
        stages: this.missionPack.stages,
        current_stage: this.projectBrain.index?.current_stage || 0,
        completed_stages: this.projectBrain.index?.completed_stages || [],
      },
    };

    // Add requested memory categories
    const learnedContext = this.projectBrain.getContext(needs);
    if (learnedContext.success) {
      Object.assign(baseContext, learnedContext.context);
    }

    return baseContext;
  }

  /**
   * Record QoR metrics
   */
  recordQoR(stage, metrics, context = {}) {
    // Store in Project-Brain
    const result = this.projectBrain.recordQoR(stage, metrics, context);

    // Check against targets
    const targetMet = this.checkQoRTargets(stage, metrics);

    return {
      ...result,
      targetsMet: targetMet,
    };
  }

  /**
   * Check if QoR metrics meet targets
   */
  checkQoRTargets(stage, metrics) {
    const targets = this.missionPack.getTargets();
    const results = {};

    if (targets.timing) {
      if (metrics.wns !== undefined) {
        results.wns = {
          value: metrics.wns,
          target: targets.timing.wns ?? 0,
          met: metrics.wns >= (targets.timing.wns ?? 0),
        };
      }
      if (metrics.tns !== undefined) {
        results.tns = {
          value: metrics.tns,
          target: targets.timing.tns ?? 0,
          met: metrics.tns >= (targets.timing.tns ?? 0),
        };
      }
    }

    if (targets.area && metrics.utilization !== undefined) {
      results.utilization = {
        value: metrics.utilization,
        target: targets.area.max_utilization ?? 1.0,
        met: metrics.utilization <= (targets.area.max_utilization ?? 1.0),
      };
    }

    return results;
  }

  /**
   * Record error pattern
   */
  recordErrorPattern(pattern, errorOutput, resolution, autoFixable = false) {
    return this.projectBrain.recordErrorPattern(pattern, errorOutput, resolution, autoFixable);
  }

  /**
   * Set current flow stage
   */
  setStage(stage) {
    return this.projectBrain.setStage(stage);
  }

  /**
   * Get full project summary
   */
  getSummary() {
    const missionSummary = this.missionPack.getSummary();
    const brainSummary = this.projectBrain.getSummary();

    return {
      ...missionSummary,
      learned: brainSummary.success ? brainSummary.summary : null,
      missionPackPath: this.missionPack.sourcePath,
    };
  }

  // ============================================================================
  // Team Mode Agent Interface
  // ============================================================================

  /**
   * Get context for a specific agent
   */
  getAgentContext(agentRole) {
    const baseContext = this.getDesignContext();

    switch (agentRole) {
      case 'supervisor':
        return {
          ...baseContext,
          missionPack: this.missionPack.toJSON(),
          validation: this.missionPack.validate(),
        };

      case 'knowledge':
        return {
          ...baseContext,
          libraries: {
            target: this.missionPack.getLibraries(),
            lef: this.missionPack.getLefFiles(),
            gds: this.missionPack.getGdsFiles(),
          },
          technology: this.missionPack.getTechnologyInfo(),
          corners: this.missionPack.getCorners(),
        };

      case 'planner':
        return {
          ...baseContext,
          flow: this.getFlowDefinition(),
          recipes: this.missionPack.flow.recipes,
          targets: this.missionPack.getTargets(),
        };

      case 'executor':
        return {
          ...baseContext,
          rtlFiles: this.missionPack.getRtlFiles(),
          constraints: this.missionPack.getConstraintFiles(),
          tools: this.missionPack.tools,
          environment: this.missionPack.getEnvironment(),
          hooks: {
            pre: this.missionPack.custom?.pre_hooks,
            post: this.missionPack.custom?.post_hooks,
          },
        };

      case 'memory':
        return {
          ...baseContext,
          brainDir: this.projectBrain.brainDir,
          memories: this.projectBrain.getSummary(),
        };

      case 'learning':
        return {
          ...baseContext,
          errorPatterns: this.projectBrain.recall('error_patterns'),
          qorProgression: this.projectBrain.getQoRProgression(),
          timingHistory: this.projectBrain.getQoRProgression('wns'),
        };

      default:
        return baseContext;
    }
  }
}

/**
 * Get global mission pack context (singleton)
 */
let globalContext = null;

export function getMissionPackContext(designDir = null) {
  if (!globalContext || globalContext.designDir !== designDir) {
    globalContext = new MissionPackContext(designDir);
  }
  return globalContext;
}

/**
 * Reset global context (for testing)
 */
export function resetMissionPackContext() {
  globalContext = null;
}

export default {
  MissionPackContext,
  getMissionPackContext,
  resetMissionPackContext,
};
