/**
 * ASIC-Brain - Customer Owned Technology Knowledge-Based Orchestration Layer
 *
 * The "ASIC brain" that acts like a dedicated LLM for EDA tasks:
 * - Tcl generation and validation
 * - EDA output parsing and understanding
 * - Workflow orchestration
 * - Self-improvement through pattern learning
 *
 * Formerly known as LittleBrain - renamed to reflect its role in the
 * dual-brain architecture alongside Project-Brain.
 */

import { generateTcl, sanitizeScript, validateSyntax, autoFix } from './tcl-generator.js';
import { parseOutput, extractErrors, extractQoR, detectToolState, recommendRecovery } from './output-parser.js';
import {
  FlowContext,
  validateCommand,
  getStageDefinition,
  getFlowStages,
  validateIntent,
  recommendFix,
  planStageExecution,
  checkPrerequisites,
  getCommandSyntax
} from '../orchestrator.js';
import { ASICBrainLogger, getLogger, readLogs, resetLogger } from './logger.js';
import { PageIndexDB, quickQuery, quickSearch, quickGetStage } from './database/pageindex-db.js';

/**
 * Main ASIC-Brain class - unified interface for general EDA knowledge
 *
 * ASIC-Brain (Customer Owned Technology Brain) provides general EDA reasoning capabilities
 * that are design-agnostic. It works alongside Project-Brain which stores
 * design-specific memories.
 */
class ASICBrain {
  constructor(flowId = null) {
    this.flowContext = new FlowContext(flowId);
    this.sessionId = flowId || `session_${Date.now()}`;
    this.logger = getLogger(this.sessionId);
    this.pageIndexDB = new PageIndexDB();
    this.logger.logReasoning({
      component: 'ASICBrain',
      step: 'constructor',
      input: { flowId },
      reasoning: 'Initializing ASIC-Brain session for EDA orchestration',
      output: { sessionId: this.sessionId },
      confidence: 1.0
    });
  }

  /**
   * Generate and validate Tcl for a given intent
   */
  generateTcl(intent, tool, stage, context = {}) {
    this.logger.logReasoning({
      component: 'ASICBrain',
      step: 'generateTcl_start',
      input: { intent, tool, stage, context },
      reasoning: `Starting Tcl generation for ${intent} using ${tool}`,
      output: { status: 'generating' },
      confidence: 0.9
    });

    // First, try to generate from intent
    let result = generateTcl(intent, tool, stage, context);

    // Handle error case
    if (result.error) {
      this.logger.logTclGeneration({
        intent,
        tool,
        stage,
        context,
        generated_tcl: null,
        validation: { valid: false, errors: [result.error], warnings: [] },
        fixes_applied: [],
        can_execute: false
      });
      return {
        tcl: null,
        error: result.error,
        suggestions: result.suggestions,
        canExecute: false
      };
    }

    let tcl = result.tcl;

    // Sanitize to fix common errors
    const sanitizeResult = sanitizeScript(tcl, tool);
    tcl = sanitizeResult.tcl;

    // Validate
    const validation = validateSyntax(tcl, tool);

    // Auto-fix if needed
    let fixes = [...sanitizeResult.fixes];
    if (!validation.valid) {
      const originalTcl = tcl;
      tcl = autoFix(tcl, validation.errors);
      fixes.push(`Auto-fixed ${validation.errors.length} syntax errors`);
    }

    const finalResult = {
      tcl,
      validation,
      fixes,
      warnings: [...sanitizeResult.warnings, ...validation.warnings],
      canExecute: validation.valid || validation.warnings.length === 0
    };

    this.logger.logTclGeneration({
      intent,
      tool,
      stage,
      context,
      generated_tcl: tcl,
      validation,
      fixes_applied: fixes,
      can_execute: finalResult.canExecute
    });

    return finalResult;
  }

  /**
   * Parse EDA tool output and return structured understanding
   */
  parseOutput(output, tool) {
    const startTime = Date.now();
    const result = parseOutput(output, tool);

    this.logger.logOutputParsing({
      tool,
      output_snippet: output?.substring(0, 500),
      parsed_state: result.state,
      errors_found: result.errors,
      qor_extracted: result.qor,
      tool_state: result.toolState
    });

    return result;
  }

  /**
   * Plan a stage execution with validation
   */
  planStage(stageName, context = {}) {
    this.logger.logReasoning({
      component: 'ASICBrain',
      step: 'planStage',
      input: { stageName, context, completedStages: this.flowContext.state.completedStages },
      reasoning: `Planning execution for stage: ${stageName}`,
      output: { status: 'planning' },
      confidence: 0.85
    });

    const plan = planStageExecution(stageName, context);
    const prerequisites = checkPrerequisites(stageName, this.flowContext);

    const result = {
      ...plan,
      prerequisitesMet: prerequisites.met,
      missingPrerequisites: prerequisites.missing,
      canStart: prerequisites.met && !plan.error
    };

    this.logger.logStagePlanning({
      stage_name: stageName,
      prerequisites: plan.prerequisites,
      plan,
      prerequisites_met: prerequisites.met,
      missing_prerequisites: prerequisites.missing,
      can_start: result.canStart
    });

    return result;
  }

  /**
   * Get current flow status
   */
  getFlowStatus() {
    const stages = getFlowStages();
    const status = stages.map(s => ({
      id: s.id,
      name: s.name,
      tool: s.tool,
      completed: this.flowContext.state.completedStages.includes(s.id),
      canRun: this.flowContext.canRunStage(s.id).allowed
    }));

    return {
      currentStage: this.flowContext.state.currentStage,
      completedStages: this.flowContext.state.completedStages,
      nextStage: this.flowContext.getNextStage(),
      stages: status
    };
  }

  /**
   * Mark a stage as complete
   */
  completeStage(stageName, result = {}) {
    this.flowContext.completeStage(stageName, result);
    return this.getFlowStatus();
  }

  /**
   * Get recommended fix for an error
   */
  getFixRecommendation(error, context = {}) {
    return recommendFix(error, context);
  }

  /**
   * Analyze a command before execution
   */
  analyzeCommand(command, tool, stage) {
    const cmdValidation = validateCommand(command, tool);
    const intentValidation = validateIntent(command, stage);
    const syntax = getCommandSyntax(command.split(/\s+/)[0], tool);

    const result = {
      command,
      tool,
      stage,
      valid: cmdValidation.valid && intentValidation.valid,
      errors: [...cmdValidation.errors, ...intentValidation.errors],
      warnings: [...cmdValidation.warnings, ...intentValidation.warnings],
      syntax,
      canExecute: cmdValidation.valid && intentValidation.valid
    };

    this.logger.logCommandAnalysis({
      command,
      tool,
      stage,
      validation_result: { valid: result.valid, errors: result.errors, warnings: result.warnings },
      syntax_info: syntax,
      can_execute: result.canExecute
    });

    return result;
  }

  /**
   * Log session end with summary
   */
  endSession(summary = '') {
    return this.logger.logSessionEnd({
      summary,
      total_decisions: this.logger.decisions.length,
      final_state: this.getFlowStatus()
    });
  }

  /**
   * Export logs to evidence directory
   */
  exportLogs(evidenceDir) {
    return this.logger.exportToEvidence(evidenceDir);
  }

  /**
   * Query the PageIndex database by path
   * Navigate tree path like "synthesis/tcl-patterns/compile_ultra"
   * @param {string} path - Tree path
   * @returns {object} Query result with content and metadata
   */
  query(path) {
    this.logger.logReasoning({
      component: 'ASICBrain',
      step: 'pageIndex_query',
      input: { path },
      reasoning: `Querying PageIndex database for path: ${path}`,
      output: { status: 'querying' },
      confidence: 0.95
    });

    const result = this.pageIndexDB.query(path);

    this.logger.logReasoning({
      component: 'ASICBrain',
      step: 'pageIndex_query_complete',
      input: { path },
      reasoning: `PageIndex query completed for path: ${path}`,
      output: { type: result.type, hasContent: !!result.content },
      confidence: 0.95
    });

    return result;
  }

  /**
   * Search the PageIndex database for keywords
   * @param {string} keyword - Keyword to search for
   * @param {object} options - Search options (limit, stage)
   * @returns {array} Array of matching results
   */
  search(keyword, options = {}) {
    this.logger.logReasoning({
      component: 'ASICBrain',
      step: 'pageIndex_search',
      input: { keyword, options },
      reasoning: `Searching PageIndex database for keyword: ${keyword}`,
      output: { status: 'searching' },
      confidence: 0.9
    });

    const results = this.pageIndexDB.search(keyword, options);

    this.logger.logReasoning({
      component: 'ASICBrain',
      step: 'pageIndex_search_complete',
      input: { keyword, options },
      reasoning: `PageIndex search completed, found ${results.length} results`,
      output: { resultCount: results.length },
      confidence: 0.9
    });

    return results;
  }

  /**
   * Get all information for a stage
   * @param {string} stageName - Stage name (e.g., "synthesis", "cts")
   * @returns {object} Complete stage information
   */
  getStage(stageName) {
    this.logger.logReasoning({
      component: 'ASICBrain',
      step: 'pageIndex_getStage',
      input: { stageName },
      reasoning: `Getting PageIndex data for stage: ${stageName}`,
      output: { status: 'fetching' },
      confidence: 0.95
    });

    const result = this.pageIndexDB.getStage(stageName);

    this.logger.logReasoning({
      component: 'ASICBrain',
      step: 'pageIndex_getStage_complete',
      input: { stageName },
      reasoning: `Stage data retrieved for: ${stageName}`,
      output: { hasMetadata: !!result.metadata, subsectionsCount: Object.keys(result.subsections || {}).length },
      confidence: 0.95
    });

    return result;
  }
}

/**
 * Quick functions for direct use
 */

export function createASICBrain(flowId) {
  return new ASICBrain(flowId);
}

export function quickGenerate(intent, tool, stage) {
  const brain = new ASICBrain();
  return brain.generateTcl(intent, tool, stage);
}

export function quickParse(output, tool) {
  return parseOutput(output, tool);
}

export function quickPlan(stage) {
  const brain = new ASICBrain();
  return brain.planStage(stage);
}

/**
 * Integration helper for EDA MCP
 * Sanitizes and validates Tcl before sending to EDA tool
 */
export function sanitizeAndValidate(tcl, tool, stage) {
  const brain = new ASICBrain();

  // Sanitize
  const sanitizeResult = sanitizeScript(tcl, tool);

  // Analyze each command
  const lines = sanitizeResult.tcl.split('\n');
  const analysis = [];

  for (const line of lines) {
    const cmd = line.trim();
    if (cmd && !cmd.startsWith('#')) {
      const cmdAnalysis = brain.analyzeCommand(cmd, tool, stage);
      analysis.push(cmdAnalysis);
    }
  }

  const allValid = analysis.every(a => a.valid);
  const allErrors = analysis.flatMap(a => a.errors);
  const allWarnings = analysis.flatMap(a => a.warnings);

  return {
    original: tcl,
    corrected: sanitizeResult.corrected,
    fixes: sanitizeResult.fixes,
    analysis,
    valid: allValid,
    errors: allErrors,
    warnings: allWarnings,
    canExecute: allValid
  };
}

// From self-improvement
import {
  recordError,
  getSuggestedFix,
  recordSuccess,
  getBestPractice,
  processHiTestBotEvidence,
  ErrorPatternDB,
  SuccessTracker,
  HiTestBotAdapter
} from './self-improvement.js';

export {
  ASICBrain,
  // Backward compatibility alias
  ASICBrain as LittleBrain,
  // From tcl-generator
  generateTcl,
  sanitizeScript,
  validateSyntax,
  autoFix,
  // From output-parser
  parseOutput,
  extractErrors,
  extractQoR,
  detectToolState,
  recommendRecovery,
  // From orchestrator
  FlowContext,
  validateCommand,
  getStageDefinition,
  getFlowStages,
  validateIntent,
  recommendFix,
  planStageExecution,
  checkPrerequisites,
  getCommandSyntax,
  // From self-improvement
  recordError,
  getSuggestedFix,
  recordSuccess,
  getBestPractice,
  processHiTestBotEvidence,
  ErrorPatternDB,
  SuccessTracker,
  HiTestBotAdapter,
  // From logger
  ASICBrainLogger,
  ASICBrainLogger as LittleBrainLogger,
  getLogger,
  resetLogger,
  readLogs,
  // From pageindex-db
  PageIndexDB,
  quickQuery,
  quickSearch,
  quickGetStage
};
