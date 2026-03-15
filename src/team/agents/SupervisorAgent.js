#!/usr/bin/env node
/**
 * Supervisor Agent - Flow Coordination and Validation
 *
 * Responsibilities:
 * - Validate prerequisites before each phase
 * - Coordinate agent execution sequence
 * - Handle errors and escalation
 * - Communicate with user
 */

export class SupervisorAgent {
  constructor(knowledgeAgent) {
    this.name = 'supervisor';
    this.knowledge = knowledgeAgent;
    this.currentPhase = null;
    this.phaseHistory = [];
  }

  /**
   * Validate prerequisites for a phase
   */
  async validatePrerequisites(phase, context = {}) {
    console.log(`[Supervisor] Validating prerequisites for ${phase}`);

    const checks = [];

    // Check 1: Design directory exists
    checks.push({
      name: 'design_directory',
      passed: !!this.knowledge.designDir,
      message: this.knowledge.designDir ? 'Design directory set' : 'No design directory',
    });

    // Check 2: Previous stage checkpoint exists (if applicable)
    if (phase !== 'synthesis') {
      const prevStage = this.getPreviousStage(phase);
      if (prevStage) {
        const checkpointCheck = await this.checkCheckpoint(prevStage);
        checks.push(checkpointCheck);
      }
    }

    // Check 3: Required tools available
    const toolCheck = await this.checkToolAvailability(phase);
    checks.push(toolCheck);

    // Check 4: Mission pack valid (via Knowledge)
    const missionCheck = await this.validateMissionPack();
    checks.push(missionCheck);

    const allPassed = checks.every(c => c.passed);

    return {
      phase,
      valid: allPassed,
      checks,
      canProceed: allPassed,
      blockers: checks.filter(c => !c.passed).map(c => c.message),
    };
  }

  /**
   * Get previous stage for checkpoint dependency
   */
  getPreviousStage(phase) {
    const stageOrder = [
      'synthesis',
      'design_init',
      'floorplan',
      'powerplan',
      'placement',
      'cts',
      'post_cts_opt',
      'routing',
      'route_opt',
      'chip_finish',
    ];

    const idx = stageOrder.indexOf(phase);
    if (idx > 0) {
      return stageOrder[idx - 1];
    }
    return null;
  }

  /**
   * Check if checkpoint exists for a stage
   */
  async checkCheckpoint(stage) {
    // Query Project-Brain via Knowledge Agent
    const result = await this.knowledge.queryProject({
      type: 'recall',
      category: 'timing_memory',
      key: `checkpoint_${stage}`,
    });

    const passed = result.success && result.entry;

    return {
      name: `${stage}_checkpoint`,
      passed,
      message: passed
        ? `Checkpoint for ${stage} exists`
        : `Missing checkpoint for ${stage}`,
    };
  }

  /**
   * Check tool availability for a phase
   */
  async checkToolAvailability(phase) {
    // Query EDA-Brain via Knowledge Agent for tool info
    const tool = this.getToolForPhase(phase);

    try {
      const result = await this.knowledge.queryEDA({
        type: 'tool_info',
        tool,
      });

      return {
        name: 'tool_availability',
        passed: !!result,
        message: result
          ? `${result.name} available`
          : `Tool ${tool} not found in registry`,
      };
    } catch (e) {
      return {
        name: 'tool_availability',
        passed: false,
        message: `Error checking tool: ${e.message}`,
      };
    }
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
   * Validate mission pack configuration
   */
  async validateMissionPack() {
    try {
      const flowDef = await this.knowledge.queryMissionPack({
        type: 'flow_definition',
      });

      const hasStages = flowDef && flowDef.stages && flowDef.stages.length > 0;

      return {
        name: 'mission_pack',
        passed: hasStages,
        message: hasStages
          ? `Mission pack valid with ${flowDef.stages.length} stages`
          : 'Mission pack missing or invalid',
      };
    } catch (e) {
      return {
        name: 'mission_pack',
        passed: false,
        message: `Mission pack error: ${e.message}`,
      };
    }
  }

  /**
   * Coordinate phase execution
   */
  async coordinatePhase(phase, agents, context = {}) {
    this.currentPhase = phase;
    console.log(`[Supervisor] Coordinating phase: ${phase}`);

    const startTime = Date.now();

    // Record phase start
    this.phaseHistory.push({
      phase,
      startTime,
      status: 'running',
    });

    try {
      // Step 1: Validate
      const validation = await this.validatePrerequisites(phase, context);
      if (!validation.canProceed) {
        throw new Error(`Prerequisites failed: ${validation.blockers.join(', ')}`);
      }

      // Step 2: Get strategy from Planner (via Knowledge)
      const strategy = await this.requestStrategy(phase, agents.planner);

      // Step 3: Execute (Executor + Archivist in parallel)
      const execution = await this.executeWithMonitoring(
        phase,
        strategy,
        agents.executor,
        agents.archivist,
        context
      );

      // Step 4: Validate completion
      const completion = await this.validateCompletion(phase, execution);

      // Record success
      const phaseRecord = this.phaseHistory.find(p => p.phase === phase);
      if (phaseRecord) {
        phaseRecord.endTime = Date.now();
        phaseRecord.status = 'completed';
        phaseRecord.duration = phaseRecord.endTime - startTime;
      }

      return {
        phase,
        status: 'completed',
        validation,
        strategy,
        execution,
        completion,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // Record failure
      const phaseRecord = this.phaseHistory.find(p => p.phase === phase);
      if (phaseRecord) {
        phaseRecord.endTime = Date.now();
        phaseRecord.status = 'failed';
        phaseRecord.error = error.message;
      }

      throw error;
    }
  }

  /**
   * Request strategy from Planner Agent
   */
  async requestStrategy(phase, planner) {
    console.log(`[Supervisor] Requesting strategy from Planner for ${phase}`);

    // In actual implementation, this would SendMessage to Planner
    // Planner queries Knowledge Agent and returns strategy
    return {
      phase,
      recipe: 'default',
      estimatedTime: 600,
      checkpointTarget: `${phase}.enc`,
    };
  }

  /**
   * Execute with Archivist monitoring
   */
  async executeWithMonitoring(phase, strategy, executor, archivist, context) {
    console.log(`[Supervisor] Executing ${phase} with monitoring`);

    // In actual implementation:
    // - Executor queries Knowledge for Tcl, executes via EDA MCP
    // - Archivist monitors output via Knowledge.parseOutput
    // - Both report progress

    return {
      phase,
      strategy,
      status: 'completed',
      output: null, // Would contain actual tool output
    };
  }

  /**
   * Validate phase completion
   */
  async validateCompletion(phase, execution) {
    console.log(`[Supervisor] Validating completion of ${phase}`);

    // Check if checkpoint was created
    const checkpoint = await this.checkCheckpoint(phase);

    // Query Knowledge for QoR validation
    const qorSummary = await this.knowledge.queryProject({
      type: 'qor_progression',
      metric: 'wns',
    });

    return {
      checkpoint,
      qorSummary,
      valid: checkpoint.passed,
    };
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      currentPhase: this.currentPhase,
      phaseHistory: this.phaseHistory,
      phasesCompleted: this.phaseHistory.filter(p => p.status === 'completed').length,
      phasesFailed: this.phaseHistory.filter(p => p.status === 'failed').length,
    };
  }
}

export default SupervisorAgent;
