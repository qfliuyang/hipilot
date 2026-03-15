#!/usr/bin/env node
/**
 * Planner Agent - Strategy and Execution Planning
 *
 * Responsibilities:
 * - Query Knowledge Agent for flow/recipe information
 * - Create execution strategy for each stage
 * - Select appropriate recipes based on design characteristics
 * - Estimate execution time and resource requirements
 */

export class PlannerAgent {
  constructor(knowledgeAgent) {
    this.name = 'planner';
    this.knowledge = knowledgeAgent;
    this.currentPlan = null;
    this.planHistory = [];
  }

  /**
   * Create execution plan for a phase
   */
  async createPlan(phase, context = {}) {
    console.log(`[Planner] Creating plan for ${phase}`);

    // Step 1: Get flow definition from Knowledge
    const flowDef = await this.knowledge.queryMissionPack({
      type: 'flow_definition',
    });

    // Step 2: Get stage recipe from Knowledge
    const recipe = await this.knowledge.queryMissionPack({
      type: 'stage_recipe',
      stage: phase,
    });

    // Step 3: Get targets from Knowledge
    const targets = await this.knowledge.queryMissionPack({
      type: 'targets',
    });

    // Step 4: Get tool configuration from Knowledge
    const toolConfig = await this.knowledge.queryMissionPack({
      type: 'tool_config',
      tool: this.getToolForPhase(phase),
      stage: phase,
    });

    // Step 5: Get best practices from Knowledge (EDA-Brain)
    const bestPractices = await this.knowledge.queryEDA({
      type: 'best_practices',
      tool: this.getToolForPhase(phase),
      stage: phase,
    });

    // Step 6: Get historical context from Knowledge (Project-Brain)
    const history = await this.knowledge.queryProject({
      type: 'context',
      needs: [`${phase}_memory`, 'timing_memory'],
    });

    // Synthesize plan
    const plan = {
      phase,
      recipe: recipe || 'default',
      strategy: this.selectStrategy(phase, flowDef, context),
      targets: targets || {},
      toolConfig: toolConfig || {},
      bestPractices: bestPractices || [],
      historicalContext: history.success ? history.context : null,
      estimatedTime: this.estimateTime(phase, context),
      prerequisites: this.getPrerequisites(phase),
      steps: this.generateSteps(phase, recipe, toolConfig),
      checkpointTarget: `${phase}.enc`,
      createdAt: Date.now(),
    };

    this.currentPlan = plan;
    this.planHistory.push(plan);

    return plan;
  }

  /**
   * Select execution strategy based on design characteristics
   */
  selectStrategy(phase, flowDef, context) {
    // Default strategy
    let strategy = 'standard';

    // Check for optimization opportunities
    if (context.optimization === 'aggressive') {
      strategy = 'aggressive';
    } else if (context.optimization === 'quick') {
      strategy = 'quick';
    }

    // Check historical performance
    if (context.previousIssues?.includes(phase)) {
      strategy = 'conservative';
    }

    return {
      type: strategy,
      rationale: `Selected ${strategy} strategy for ${phase}`,
      params: this.getStrategyParams(strategy),
    };
  }

  /**
   * Get strategy-specific parameters
   */
  getStrategyParams(strategy) {
    const params = {
      standard: {
        effort: 'medium',
        runtime: 'normal',
        optimization: 'balanced',
      },
      aggressive: {
        effort: 'high',
        runtime: 'long',
        optimization: 'area_timing',
      },
      quick: {
        effort: 'low',
        runtime: 'short',
        optimization: 'minimal',
      },
      conservative: {
        effort: 'medium',
        runtime: 'normal',
        optimization: 'safe',
      },
    };

    return params[strategy] || params.standard;
  }

  /**
   * Estimate execution time for a phase
   */
  estimateTime(phase, context) {
    const baseTimes = {
      synthesis: 900,
      design_init: 300,
      floorplan: 600,
      powerplan: 400,
      placement: 1200,
      cts: 900,
      post_cts_opt: 600,
      routing: 1500,
      route_opt: 900,
      chip_finish: 600,
    };

    let base = baseTimes[phase] || 600;

    // Adjust based on design size
    if (context.cellCount) {
      const scaleFactor = Math.log10(context.cellCount) / 4; // Normalize
      base = Math.round(base * scaleFactor);
    }

    // Adjust based on strategy
    if (context.optimization === 'aggressive') {
      base = Math.round(base * 1.5);
    } else if (context.optimization === 'quick') {
      base = Math.round(base * 0.7);
    }

    return {
      seconds: base,
      minutes: Math.ceil(base / 60),
      formatted: `${Math.ceil(base / 60)}m ${base % 60}s`,
    };
  }

  /**
   * Get prerequisites for a phase
   */
  getPrerequisites(phase) {
    const prereqs = {
      synthesis: ['rtl_files', 'constraints', 'libraries'],
      design_init: ['synthesis_checkpoint', 'netlist', 'constraints'],
      floorplan: ['design_init_checkpoint'],
      powerplan: ['floorplan_checkpoint'],
      placement: ['powerplan_checkpoint'],
      cts: ['placement_checkpoint'],
      post_cts_opt: ['cts_checkpoint'],
      routing: ['post_cts_opt_checkpoint'],
      route_opt: ['routing_checkpoint'],
      chip_finish: ['route_opt_checkpoint'],
    };

    return prereqs[phase] || [];
  }

  /**
   * Generate execution steps for a phase
   */
  generateSteps(phase, recipe, toolConfig) {
    // Basic steps - would be expanded based on recipe
    return [
      { name: 'load_checkpoint', description: 'Load previous stage checkpoint' },
      { name: 'configure_tool', description: 'Set up tool with recipe configuration' },
      { name: 'execute_main', description: `Run ${phase} main command` },
      { name: 'report_qor', description: 'Extract and report QoR metrics' },
      { name: 'save_checkpoint', description: 'Save checkpoint for next stage' },
    ];
  }

  /**
   * Get EDA tool for a phase
   */
  getToolForPhase(phase) {
    const toolMap = {
      synthesis: 'dc_shell',
      design_init: 'innovus',
      floorplan: 'innovus',
      powerplan: 'innovus',
      placement: 'innovus',
      cts: 'innovus',
      post_cts_opt: 'innovus',
      routing: 'innovus',
      route_opt: 'innovus',
      chip_finish: 'innovus',
    };

    return toolMap[phase] || 'innovus';
  }

  /**
   * Review and adjust plan based on execution results
   */
  async reviewPlan(plan, executionResults) {
    console.log(`[Planner] Reviewing plan for ${plan.phase}`);

    const adjustments = [];

    // Check if targets were met
    if (executionResults.qor) {
      const targets = plan.targets;

      if (targets.timing && executionResults.qor.wns < targets.timing.wns) {
        adjustments.push({
          type: 'timing',
          issue: 'WNS target not met',
          suggestion: 'Increase optimization effort or adjust constraints',
        });
      }

      if (targets.area && executionResults.qor.utilization > targets.area.max_utilization) {
        adjustments.push({
          type: 'area',
          issue: 'Utilization target exceeded',
          suggestion: 'Increase die size or reduce cell density',
        });
      }
    }

    // Store learnings via Knowledge
    if (adjustments.length > 0) {
      await this.knowledge.store(
        'planning_memory',
        `plan_adjustments_${plan.phase}`,
        adjustments,
        { phase: plan.phase, timestamp: Date.now() }
      );
    }

    return {
      originalPlan: plan,
      adjustments,
      recommendations: adjustments.map(a => a.suggestion),
    };
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      currentPlan: this.currentPlan?.phase || null,
      plansCreated: this.planHistory.length,
      phasesPlanned: [...new Set(this.planHistory.map(p => p.phase))],
    };
  }
}

export default PlannerAgent;
