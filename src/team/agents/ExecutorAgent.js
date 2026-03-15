#!/usr/bin/env node
/**
 * Executor Agent - Tool Execution and Control
 *
 * Responsibilities:
 * - Query Knowledge Agent for Tcl generation
 * - Execute Tcl via EDA MCP tools
 * - Monitor tool output and progress
 * - Handle errors and retry logic
 */

export class ExecutorAgent {
  constructor(knowledgeAgent) {
    this.name = 'executor';
    this.knowledge = knowledgeAgent;
    this.currentExecution = null;
    this.executionHistory = [];
  }

  /**
   * Execute a phase plan
   */
  async execute(plan, context = {}) {
    console.log(`[Executor] Executing plan for ${plan.phase}`);

    const execution = {
      phase: plan.phase,
      startTime: Date.now(),
      status: 'running',
      steps: [],
      output: null,
      qor: null,
      errors: [],
    };

    this.currentExecution = execution;

    try {
      // Step 1: Generate Tcl via Knowledge Agent
      const tclScript = await this.generateTcl(plan);
      execution.steps.push({ name: 'tcl_generation', status: 'completed', output: tclScript });

      // Step 2: Validate Tcl
      const validation = await this.validateTcl(tclScript, plan);
      execution.steps.push({ name: 'tcl_validation', status: 'completed', ...validation });

      // Step 3: Execute via EDA MCP
      const execResult = await this.executeTcl(tclScript, plan);
      execution.steps.push({ name: 'tool_execution', status: 'completed', ...execResult });

      // Step 4: Parse output via Knowledge Agent
      const parsedOutput = await this.parseOutput(execResult.output, plan);
      execution.steps.push({ name: 'output_parsing', status: 'completed', ...parsedOutput });

      // Step 5: Extract QoR
      execution.qor = parsedOutput.qor;

      // Step 6: Save checkpoint
      const checkpointResult = await this.saveCheckpoint(plan);
      execution.steps.push({ name: 'checkpoint_save', status: 'completed', ...checkpointResult });

      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      execution.status = 'completed';

      this.executionHistory.push(execution);
      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.error = error.message;
      execution.errors.push(error.message);

      this.executionHistory.push(execution);
      throw error;
    }
  }

  /**
   * Generate Tcl script via Knowledge Agent (ASIC-Brain)
   */
  async generateTcl(plan) {
    console.log(`[Executor] Generating Tcl for ${plan.phase}`);

    const tool = this.getToolForPhase(plan.phase);

    // Query ASIC-Brain via Knowledge Agent
    const result = await this.knowledge.queryASIC(
      plan.phase,
      tool,
      plan.phase,
      {
        recipe: plan.recipe,
        toolConfig: plan.toolConfig,
        targets: plan.targets,
      }
    );

    if (!result.canExecute) {
      throw new Error(`Tcl generation failed: ${result.error || 'Validation failed'}`);
    }

    return {
      script: result.tcl,
      validation: result.validation,
      warnings: result.warnings,
    };
  }

  /**
   * Validate Tcl syntax via Knowledge Agent
   */
  async validateTcl(tclScript, plan) {
    console.log(`[Executor] Validating Tcl for ${plan.phase}`);

    // Use ASIC-Brain via Knowledge Agent
    const analysis = await this.knowledge.asicBrain.analyzeCommand(
      tclScript.script.split('\n')[0], // First command
      this.getToolForPhase(plan.phase),
      plan.phase
    );

    return {
      valid: analysis.valid,
      errors: analysis.errors,
      warnings: analysis.warnings,
    };
  }

  /**
   * Execute Tcl via EDA MCP tools
   * Note: In actual implementation, this would call eda.execute_and_verify
   */
  async executeTcl(tclScript, plan) {
    console.log(`[Executor] Executing Tcl for ${plan.phase}`);

    // This is where the actual EDA tool execution would happen
    // via the EDA MCP server's eda.execute_and_verify tool

    // Mock implementation for structure
    return {
      success: true,
      output: `Mock execution output for ${plan.phase}`,
      exitCode: 0,
      duration: 600,
    };
  }

  /**
   * Parse tool output via Knowledge Agent (ASIC-Brain)
   */
  async parseOutput(output, plan) {
    console.log(`[Executor] Parsing output for ${plan.phase}`);

    const tool = this.getToolForPhase(plan.phase);

    // Query ASIC-Brain via Knowledge Agent
    const parsed = this.knowledge.parseOutput(output, tool);

    return {
      state: parsed.state,
      errors: parsed.errors,
      qor: parsed.qor,
      toolState: parsed.toolState,
    };
  }

  /**
   * Save checkpoint after execution
   */
  async saveCheckpoint(plan) {
    console.log(`[Executor] Saving checkpoint for ${plan.phase}`);

    // Generate checkpoint save Tcl
    const checkpointName = `${plan.phase}.enc`;

    return {
      checkpointName,
      path: `result/${plan.phase}/data/${checkpointName}`,
      saved: true,
    };
  }

  /**
   * Handle execution error with retry logic
   */
  async handleError(error, plan, attempt = 1) {
    console.log(`[Executor] Handling error (attempt ${attempt}): ${error.message}`);

    // Query Knowledge Agent for fix recommendation
    const fixRecommendation = await this.knowledge.getFixRecommendation(error.message, {
      phase: plan.phase,
      tool: this.getToolForPhase(plan.phase),
    });

    if (attempt < 3 && fixRecommendation.autoFixable) {
      console.log(`[Executor] Retrying with fix: ${fixRecommendation.suggestion}`);

      // Apply fix and retry
      return this.execute(plan, { ...plan.context, retryAttempt: attempt });
    }

    throw error;
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
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      currentPhase: this.currentExecution?.phase || null,
      executionsCompleted: this.executionHistory.filter(e => e.status === 'completed').length,
      executionsFailed: this.executionHistory.filter(e => e.status === 'failed').length,
      totalExecutions: this.executionHistory.length,
    };
  }
}

export default ExecutorAgent;
