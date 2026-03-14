/**
 * Orchestrator - Flow Stage Management and Execution Planning
 *
 * Defines flow stages, prerequisites, and execution planning for RTL2GDS.
 * Used by ASIC-Brain for workflow orchestration.
 */

// ============================================================================
// Flow Stage Definitions
// ============================================================================

const FLOW_STAGES = {
  synthesis: {
    name: 'synthesis',
    stage: 0,
    tool: 'dc_shell',
    description: 'RTL synthesis and optimization',
    inputs: ['rtl', 'constraints'],
    outputs: ['netlist', 'sdc'],
    exit_criteria: [' synthesized netlist', ' timing constraints applied'],
    next_stage: 'design_init',
  },
  design_init: {
    name: 'design_init',
    stage: 1,
    tool: 'innovus',
    description: 'Design initialization and MMMC setup',
    inputs: ['netlist', 'lef', 'constraints'],
    outputs: ['initialized design'],
    exit_criteria: ['design initialized', 'MMMC configured'],
    next_stage: 'floorplan',
  },
  floorplan: {
    name: 'floorplan',
    stage: 2,
    tool: 'innovus',
    description: 'Floorplanning and IO placement',
    inputs: ['initialized design'],
    outputs: ['floorplanned design', 'IO placement'],
    exit_criteria: ['floorplan created', 'IOs placed'],
    next_stage: 'power_planning',
  },
  power_planning: {
    name: 'power_planning',
    stage: 3,
    tool: 'innovus',
    description: 'Power planning and PG network',
    inputs: ['floorplanned design'],
    outputs: ['power planned design', 'PG network'],
    exit_criteria: ['power rings created', 'stripes added', 'PG connected'],
    next_stage: 'placement',
  },
  placement: {
    name: 'placement',
    stage: 4,
    tool: 'innovus',
    description: 'Standard cell placement',
    inputs: ['power planned design'],
    outputs: ['placed design', 'placement metrics'],
    exit_criteria: ['cells placed', 'placement legalized'],
    next_stage: 'cts',
  },
  cts: {
    name: 'cts',
    stage: 5,
    tool: 'innovus',
    description: 'Clock tree synthesis',
    inputs: ['placed design'],
    outputs: ['CTS completed design', 'clock tree'],
    exit_criteria: ['clock tree synthesized', 'skew targets met'],
    next_stage: 'post_cts_opt',
  },
  post_cts_opt: {
    name: 'post_cts_opt',
    stage: 6,
    tool: 'innovus',
    description: 'Post-CTS optimization',
    inputs: ['CTS design'],
    outputs: ['optimized design', 'timing metrics'],
    exit_criteria: ['setup optimized', 'hold fixed'],
    next_stage: 'routing',
  },
  routing: {
    name: 'routing',
    stage: 7,
    tool: 'innovus',
    description: 'Global and detailed routing',
    inputs: ['post-CTS design'],
    outputs: ['routed design', 'DRC report'],
    exit_criteria: ['routing complete', 'DRC clean'],
    next_stage: 'route_opt',
  },
  route_opt: {
    name: 'route_opt',
    stage: 8,
    tool: 'innovus',
    description: 'Post-route optimization',
    inputs: ['routed design'],
    outputs: ['final optimized design'],
    exit_criteria: ['timing closed', 'DRC clean'],
    next_stage: 'chip_finish',
  },
  chip_finish: {
    name: 'chip_finish',
    stage: 9,
    tool: 'innovus',
    description: 'Chip finish and GDS export',
    inputs: ['final design'],
    outputs: ['GDS', 'netlist', 'reports'],
    exit_criteria: ['GDS generated', 'LVS clean', 'signoff complete'],
    next_stage: null,
  },
};

const STAGE_ORDER = [
  'synthesis',
  'design_init',
  'floorplan',
  'power_planning',
  'placement',
  'cts',
  'post_cts_opt',
  'routing',
  'route_opt',
  'chip_finish',
];

// ============================================================================
// FlowContext Class
// ============================================================================

export class FlowContext {
  constructor(flowId = null) {
    this.flowId = flowId || `flow_${Date.now()}`;
    this.currentStage = null;
    this.completedStages = [];
    this.stageHistory = [];
    this.checkpoints = {};
    this.metrics = {};
    this.startTime = new Date().toISOString();
  }

  recordToolCall(tool, command, result = null) {
    this.stageHistory.push({
      timestamp: new Date().toISOString(),
      stage: this.currentStage,
      tool,
      command: command?.substring(0, 100),
      result: result ? 'success' : 'pending',
    });
  }

  recordCheckpoint(stage, path) {
    this.checkpoints[stage] = {
      path,
      timestamp: new Date().toISOString(),
    };
  }

  recordMetrics(stage, metrics) {
    this.metrics[stage] = {
      ...metrics,
      timestamp: new Date().toISOString(),
    };
  }

  setStage(stage) {
    if (this.currentStage && !this.completedStages.includes(this.currentStage)) {
      this.completedStages.push(this.currentStage);
    }
    this.currentStage = stage;
  }

  getState() {
    return {
      flowId: this.flowId,
      currentStage: this.currentStage,
      completedStages: this.completedStages,
      checkpoints: this.checkpoints,
      metrics: this.metrics,
      startTime: this.startTime,
    };
  }
}

// ============================================================================
// Stage Functions
// ============================================================================

export function getStageDefinition(stageName) {
  return FLOW_STAGES[stageName] || null;
}

export function getFlowStages() {
  return STAGE_ORDER.map(name => FLOW_STAGES[name]);
}

export function checkPrerequisites(stageName, flowContext) {
  const stage = FLOW_STAGES[stageName];
  if (!stage) {
    return { canStart: false, missing: ['unknown stage'] };
  }

  const missing = [];

  // Check if previous stage is completed
  const currentIdx = STAGE_ORDER.indexOf(stageName);
  if (currentIdx > 0) {
    const prevStage = STAGE_ORDER[currentIdx - 1];
    if (!flowContext?.completedStages?.includes(prevStage)) {
      missing.push(`${prevStage} not completed`);
    }
  }

  return {
    canStart: missing.length === 0,
    missing,
    requiredInputs: stage.inputs,
  };
}

export function planStageExecution(stageName, context = {}) {
  const stage = FLOW_STAGES[stageName];
  if (!stage) {
    return { error: `Unknown stage: ${stageName}` };
  }

  return {
    stage: stageName,
    tool: stage.tool,
    purpose: stage.description,
    inputs: stage.inputs,
    outputs: stage.outputs,
    exit_criteria: stage.exit_criteria,
    steps: [
      { order: 1, action: 'setup', description: `Setup ${stage.tool} environment` },
      { order: 2, action: 'load', description: `Load design and constraints` },
      { order: 3, action: 'execute', description: `Run ${stage.description}` },
      { order: 4, action: 'verify', description: 'Check exit criteria' },
      { order: 5, action: 'save', description: 'Save checkpoint' },
    ],
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

export function validateCommand(command, tool) {
  const errors = [];
  const warnings = [];

  // Basic validation
  if (!command || typeof command !== 'string') {
    errors.push('Command must be a non-empty string');
    return { valid: false, errors, warnings, canExecute: false };
  }

  // Check for common issues
  if (command.includes(';;')) {
    warnings.push('Double semicolon found');
  }

  if (command.trim().startsWith('#')) {
    warnings.push('Command is a comment');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    canExecute: errors.length === 0,
    command,
    tool,
  };
}

export function validateIntent(intent, stage) {
  const errors = [];
  const warnings = [];

  if (!intent || typeof intent !== 'string') {
    errors.push('Intent must be a non-empty string');
  }

  // Check if intent is appropriate for stage
  const stageDef = stage ? FLOW_STAGES[stage] : null;
  if (stageDef) {
    const inappropriate = checkInappropriateIntent(intent, stageDef);
    if (inappropriate) {
      warnings.push(`Intent may not be appropriate for ${stage}: ${inappropriate}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    intent,
    stage,
  };
}

function checkInappropriateIntent(intent, stageDef) {
  const intentLower = intent.toLowerCase();

  // Check for stage-inappropriate actions
  const stageInappropriate = {
    floorplan: ['route', 'place cells', 'cts'],
    placement: ['route', 'floorplan', 'cts'],
    cts: ['route', 'floorplan'],
    routing: ['floorplan', 'place'],
  };

  const inappropriate = stageInappropriate[stageDef.name];
  if (inappropriate) {
    for (const action of inappropriate) {
      if (intentLower.includes(action)) {
        return `contains "${action}" which is typically done in a different stage`;
      }
    }
  }

  return null;
}

export function getCommandSyntax(commandName, tool) {
  // Return basic syntax info for common commands
  const syntaxDb = {
    innovus: {
      init_design: 'init_design',
      floorPlan: 'floorPlan -site <site> -su <ar> <density> <l> <b> <r> <t>',
      place_opt_design: 'place_opt_design [-incremental]',
      ccopt_design: 'ccopt_design',
      routeDesign: 'routeDesign',
      saveDesign: 'saveDesign <checkpoint_name>',
    },
    dc_shell: {
      analyze: 'analyze -format <format> <files>',
      elaborate: 'elaborate <design>',
      compile_ultra: 'compile_ultra [-scan] [-retime]',
      write_file: 'write_file -format <fmt> <file>',
    },
  };

  const toolSyntax = syntaxDb[tool];
  if (!toolSyntax) return null;

  return {
    command: commandName,
    syntax: toolSyntax[commandName] || `${commandName} [options]`,
    tool,
  };
}

// ============================================================================
// Recommendation Functions
// ============================================================================

export function recommendFix(error, context = {}) {
  const errorLower = error.toLowerCase();
  const recommendations = [];

  // Pattern-based recommendations
  if (errorLower.includes('lef') || errorLower.includes('tech')) {
    recommendations.push('Check LEF file order: Tech LEF must be loaded before cell LEFs');
    recommendations.push('Verify LEF file paths are correct');
  }

  if (errorLower.includes('constraint') || errorLower.includes('sdc')) {
    recommendations.push('Check SDC constraints are loaded');
    recommendations.push('Verify clock definitions exist');
  }

  if (errorLower.includes('license')) {
    recommendations.push('Check license server availability');
    recommendations.push('Verify license environment variables');
  }

  if (errorLower.includes('memory') || errorLower.includes('oom')) {
    recommendations.push('Increase process memory limit');
    recommendations.push('Consider reducing design hierarchy depth');
  }

  if (recommendations.length === 0) {
    recommendations.push('Check tool log for detailed error message');
    recommendations.push('Verify input files exist and are readable');
    recommendations.push('Check tool version compatibility');
  }

  return {
    error,
    recommendations,
    context,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  FlowContext,
  getStageDefinition,
  getFlowStages,
  checkPrerequisites,
  planStageExecution,
  validateCommand,
  validateIntent,
  getCommandSyntax,
  recommendFix,
  FLOW_STAGES,
  STAGE_ORDER,
};
