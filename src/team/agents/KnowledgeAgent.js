#!/usr/bin/env node
/**
 * Knowledge Agent - Central Brain Interface
 *
 * Owns all 3 brains and serves as the single knowledge interface for all agents:
 * - ASIC-Brain: Tcl generation, flow orchestration, output parsing
 * - EDA-Brain: Tool commands, error patterns, best practices
 * - Project-Brain: Design memory, QoR tracking, error history
 */

import { createASICBrain } from '../../../servers/knowledge/asic-brain/index.js';
import { EDABrain } from '../../../servers/knowledge/eda-brain/index.js';
import { ProjectBrain } from '../../../servers/knowledge/project-brain/index.js';
import { getMissionPackContext } from '../../../src/mission-pack/three-brain-integration.js';

export class KnowledgeAgent {
  constructor(designDir = null) {
    this.name = 'knowledge';
    this.designDir = designDir || process.env.HIPILOT_DESIGN_DIR || process.cwd();

    // Initialize all 3 brains
    this.asicBrain = createASICBrain('team-session');
    this.edaBrain = new EDABrain();
    this.projectBrain = new ProjectBrain(this.designDir, 'team-design');

    // Mission pack context for unified access
    this.missionPack = getMissionPackContext(this.designDir);

    this.cache = new Map();
    this.queryCount = 0;
  }

  /**
   * Query ASIC-Brain for Tcl generation and flow orchestration
   */
  async queryASIC(intent, tool, stage, context = {}) {
    this.queryCount++;
    const cacheKey = `asic:${intent}:${tool}:${stage}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = this.asicBrain.generateTcl(intent, tool, stage, context);
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Query EDA-Brain for tool commands and error patterns
   */
  async queryEDA(query) {
    this.queryCount++;

    switch (query.type) {
      case 'command_info':
        return this.edaBrain.getCommand(query.tool, query.command);

      case 'error_pattern':
        return this.edaBrain.matchError(query.tool, query.output);

      case 'best_practices':
        return this.edaBrain.getBestPractices(query.tool, query.stage);

      case 'tool_info':
        return this.edaBrain.getTool(query.tool);

      case 'command_search':
        return this.edaBrain.searchCommands(query.tool, query.search);

      default:
        throw new Error(`Unknown EDA query type: ${query.type}`);
    }
  }

  /**
   * Query Project-Brain for design memory and history
   */
  async queryProject(query) {
    this.queryCount++;

    switch (query.type) {
      case 'recall':
        return this.projectBrain.recall(query.category, query.key);

      case 'search':
        return this.projectBrain.search(query.search, query.options);

      case 'context':
        return this.projectBrain.getContext(query.needs);

      case 'qor_progression':
        return this.projectBrain.getQoRProgression(query.metric);

      case 'summary':
        return this.projectBrain.getSummary();

      default:
        throw new Error(`Unknown Project query type: ${query.type}`);
    }
  }

  /**
   * Unified query interface - routes to appropriate brain
   */
  async query(request) {
    const { brain, ...params } = request;

    switch (brain) {
      case 'asic':
        return this.queryASIC(params.intent, params.tool, params.stage, params.context);

      case 'eda':
        return this.queryEDA(params);

      case 'project':
        return this.queryProject(params);

      case 'mission_pack':
        return this.queryMissionPack(params);

      default:
        throw new Error(`Unknown brain: ${brain}`);
    }
  }

  /**
   * Query Mission Pack via unified context
   */
  async queryMissionPack(params) {
    this.queryCount++;

    switch (params.type) {
      case 'flow_definition':
        return this.missionPack.getFlowDefinition();

      case 'stage_recipe':
        return this.missionPack.getStageRecipe(params.stage);

      case 'targets':
        return this.missionPack.getTargetMetrics();

      case 'tool_config':
        return this.missionPack.getToolConfig(params.tool, params.stage);

      case 'libraries':
        return this.missionPack.getLibrariesForCorner(params.corner);

      case 'agent_context':
        return this.missionPack.getAgentContext(params.role);

      default:
        throw new Error(`Unknown Mission Pack query type: ${params.type}`);
    }
  }

  /**
   * Store information to Project-Brain (for Archivist Agent)
   */
  async store(category, key, value, context = {}) {
    return this.projectBrain.remember(category, key, value, context);
  }

  /**
   * Record QoR metrics (for Archivist Agent)
   */
  async recordQoR(stage, metrics, context = {}) {
    return this.projectBrain.recordQoR(stage, metrics, context);
  }

  /**
   * Get execution context for a specific agent role
   */
  async getAgentContext(role) {
    return this.missionPack.getAgentContext(role);
  }

  /**
   * Parse EDA tool output using ASIC-Brain
   */
  async parseOutput(output, tool) {
    return this.asicBrain.parseOutput(output, tool);
  }

  /**
   * Get fix recommendation for an error
   */
  async getFixRecommendation(error, context = {}) {
    return this.asicBrain.getFixRecommendation(error, context);
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      queryCount: this.queryCount,
      cacheSize: this.cache.size,
      brains: {
        asic: 'active',
        eda: 'active',
        project: this.projectBrain.isAvailable() ? 'active' : 'unavailable',
      },
    };
  }

  /**
   * Clear query cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default KnowledgeAgent;
