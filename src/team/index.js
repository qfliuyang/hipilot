/**
 * HiPilot Team Mode - Multi-Agent Collaboration for Physical Design
 *
 * Six essential agents that leverage the three-brain architecture:
 * - SupervisorAgent: Oversees team, resolves conflicts, makes decisions
 * - KnowledgeAgent: Queries all three brains, provides unified knowledge interface
 * - PlannerAgent: Flow design, stage sequencing, methodology
 * - ExecutorAgent: Tcl generation, tool execution, validation
 * - MemoryAgent: Design history, error tracking, QoR progression
 * - LearningAgent: Self-improvement, pattern recognition, knowledge transfer
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { remember, recall, searchProjectBrain } from '../servers/knowledge/project-brain/index.js';
import * as asicBrain from '../servers/knowledge/asic-brain/index.js';
import * as edaBrain from '../servers/knowledge/eda-brain/index.js';

// ============================================================================
// Agent Registry - 6 Essential Roles
// ============================================================================

const AGENT_REGISTRY = {
  /**
   * PlannerAgent - Designs the RTL2GDS flow
   * Uses: ASIC-Brain (flow planning) + EDA-Brain (tool selection) + Project-Brain (design context)
   */
  planner: {
    name: 'PlannerAgent',
    description: 'Designs RTL2GDS flow, determines stage sequence, checks prerequisites',
    primary_brain: 'asic',
    uses_all_brains: true,
    capabilities: {
      asic: ['plan_stage', 'generate_tcl', 'analyze_command'],
      eda: ['get_tool_info', 'get_tool_practices'],
      project: ['get_context', 'recall'],
    },
    responsibilities: [
      'Analyze design requirements',
      'Determine optimal flow stages',
      'Check prerequisites before execution',
      'Select appropriate tools per stage',
      'Recommend stage skipping when checkpoints exist',
    ],
    parallel: false,
  },

  /**
   * ExecutorAgent - Runs the EDA tools
   * Uses: ASIC-Brain (Tcl generation) + EDA-Brain (commands/errors) + Project-Brain (checkpoints)
   */
  executor: {
    name: 'ExecutorAgent',
    description: 'Generates Tcl, executes tools, validates results, handles errors',
    primary_brain: 'eda',
    uses_all_brains: true,
    capabilities: {
      asic: ['generate_tcl', 'sanitize_script', 'parse_output'],
      eda: ['get_command', 'match_error', 'validate_syntax'],
      project: ['remember', 'set_stage'],
    },
    responsibilities: [
      'Generate validated Tcl from intent',
      'Execute EDA tool commands',
      'Validate command syntax before execution',
      'Extract and analyze QoR metrics',
      'Diagnose and fix errors',
      'Save checkpoints after stages',
    ],
    parallel: true,
  },

  /**
   * MemoryAgent - Manages design knowledge
   * Uses: Project-Brain (primary) + ASIC-Brain (QoR analysis) + EDA-Brain (error patterns)
   */
  memory: {
    name: 'MemoryAgent',
    description: 'Tracks design evolution, records history, monitors progression',
    primary_brain: 'project',
    uses_all_brains: true,
    capabilities: {
      asic: ['parse_output', 'get_best_practice'],
      eda: ['match_error', 'get_suggested_fix'],
      project: ['remember', 'recall', 'search', 'record_qor', 'record_error'],
    },
    responsibilities: [
      'Record stage transitions and checkpoints',
      'Track QoR progression across stages',
      'Log errors with context and resolutions',
      'Search historical patterns',
      'Provide design context to other agents',
    ],
    parallel: true,
  },

  /**
   * LearningAgent - Enables self-improvement
   * Uses: All three brains for cross-domain learning
   */
  learner: {
    name: 'LearningAgent',
    description: 'Records mistakes, learns patterns, improves future executions',
    primary_brain: 'meta',
    uses_all_brains: true,
    capabilities: {
      asic: ['record_success', 'get_best_practice'],
      eda: ['record_error', 'get_suggested_fix'],
      project: ['search', 'recall', 'remember'],
    },
    responsibilities: [
      'Record successful command sequences',
      'Capture error patterns and fixes',
      'Analyze failure modes across designs',
      'Suggest improvements based on history',
      'Transfer knowledge between designs',
      'Update best practices database',
    ],
    parallel: true,
  },

  /**
   * SupervisorAgent - Oversees and coordinates all agents
   * Uses: All three brains for decision making, conflict resolution, and team management
   */
  supervisor: {
    name: 'SupervisorAgent',
    description: 'Manages agent execution, resolves conflicts, makes final decisions',
    primary_brain: 'meta',
    uses_all_brains: true,
    capabilities: {
      asic: ['plan_stage', 'get_best_practice'],
      eda: ['get_tool_info', 'match_error'],
      project: ['get_context', 'search', 'recall'],
    },
    responsibilities: [
      'Coordinate agent execution order',
      'Resolve conflicts between agents',
      'Make final decisions on disputes',
      'Monitor agent health and progress',
      'Restart failed agents if needed',
      'Approve or reject agent suggestions',
      'Escalate to human when necessary',
    ],
    parallel: false,
    manages: ['knowledge', 'planner', 'executor', 'memory', 'learner'],
  },

  /**
   * KnowledgeAgent - Interface to all three knowledge bases
   * Operates: ASIC-Brain + EDA-Brain + Project-Brain as unified knowledge layer
   */
  knowledge: {
    name: 'KnowledgeAgent',
    description: 'Queries and manages all three knowledge bases (ASIC, EDA, Project)',
    primary_brain: 'all',
    operates_all_brains: true,
    capabilities: {
      asic: [
        'generate_tcl',
        'sanitize_script',
        'parse_output',
        'plan_stage',
        'analyze_command',
        'get_best_practice',
        'record_success',
      ],
      eda: [
        'get_tool_info',
        'get_command',
        'search_commands',
        'match_error',
        'get_suggested_fix',
        'validate_syntax',
        'get_tool_practices',
      ],
      project: [
        'remember',
        'recall',
        'search',
        'get_context',
        'set_stage',
        'record_qor',
        'get_qor_progression',
        'record_error',
        'get_summary',
      ],
    },
    responsibilities: [
      'Query ASIC-Brain for methodology and Tcl generation',
      'Query EDA-Brain for tool commands and error patterns',
      'Query Project-Brain for design-specific memory',
      'Route knowledge requests to appropriate brain',
      'Synthesize answers from multiple brains',
      'Cache frequently accessed knowledge',
      'Update knowledge bases with new learnings',
    ],
    parallel: true,
  },
};

// ============================================================================
// Team Manager
// ============================================================================

export class TeamManager {
  constructor(config) {
    this.config = config;
    this.agents = new Map();
    this.state = 'idle';
    this.sessionId = `team_${Date.now()}`;
    this.results = [];
  }

  async initialize() {
    console.error(`[Team] Initializing: ${this.config.name}`);

    for (const agentConfig of this.config.agents) {
      const agent = this.createAgent(agentConfig);
      this.agents.set(agentConfig.id, agent);
    }

    // Record in Project-Brain
    remember('team_sessions', this.sessionId, {
      name: this.config.name,
      design_dir: this.config.design_dir,
      agents: Array.from(this.agents.keys()),
      strategy: this.config.strategy,
      initialized_at: new Date().toISOString(),
    });

    this.state = 'initialized';
    return { success: true, agents: this.agents.size };
  }

  createAgent(config) {
    const registry = AGENT_REGISTRY[config.role];
    if (!registry) {
      throw new Error(`Unknown agent role: ${config.role}`);
    }

    return {
      id: config.id,
      role: config.role,
      name: registry.name,
      status: 'idle',
      currentTask: null,
      results: [],
      config,
    };
  }

  async start() {
    if (this.state !== 'initialized') {
      throw new Error(`Team not initialized. State: ${this.state}`);
    }

    console.error(`[Team] Starting with ${this.agents.size} agents`);
    this.state = 'running';

    const maxParallel = this.config.strategy.max_parallel || 4;

    // Phase 1: Supervisor always runs first
    const supervisorResult = await this.executePhase('supervisor');
    if (!supervisorResult.continue) return supervisorResult.result;

    // Phase 2: Knowledge provides context for others
    const knowledgeResult = await this.executePhase('knowledge');
    if (!knowledgeResult.continue) return knowledgeResult.result;

    // Phase 3: Planner (must complete before executor)
    const plannerResult = await this.executePhase('planner');
    if (!plannerResult.continue) return plannerResult.result;

    // Phase 4: Executor (depends on planner output)
    const executorResult = await this.executePhase('executor');
    if (!executorResult.continue) return executorResult.result;

    // Phase 5: Memory and Learner can run in parallel
    const parallelAgents = this.getParallelAgents(['memory', 'learner']);
    if (parallelAgents.length > 0) {
      const parallelResult = await this.executeParallelPhase(parallelAgents, maxParallel);
      if (!parallelResult.continue) return parallelResult.result;
    }

    this.state = 'completed';
    return { success: true, results: this.results };
  }

  /**
   * Execute a single agent phase with error handling
   * @returns {Object} { continue: boolean, result: Object | null }
   */
  async executePhase(role) {
    const agent = this.getAgentByRole(role);
    if (!agent) return { continue: true, result: null };

    const result = await this.executeAgent(agent);
    this.results.push(result);

    if (result.error && !this.config.strategy.auto_recovery) {
      this.state = 'error';
      return {
        continue: false,
        result: { success: false, error: result.error, results: this.results }
      };
    }

    return { continue: true, result };
  }

  /**
   * Get list of agents that can run in parallel from specified roles
   */
  getParallelAgents(roles) {
    const agents = [];
    for (const role of roles) {
      const agent = this.getAgentByRole(role);
      if (agent && AGENT_REGISTRY[role]?.parallel) {
        agents.push(agent);
      }
    }
    return agents;
  }

  /**
   * Execute parallel agents with max_parallel limit and error handling
   * @returns {Object} { continue: boolean, result: Object | null }
   */
  async executeParallelPhase(agents, maxParallel) {
    console.error(`[Team] Executing ${agents.length} parallel agents (max: ${maxParallel})`);

    // Execute in batches if needed
    for (let i = 0; i < agents.length; i += maxParallel) {
      const batch = agents.slice(i, i + maxParallel);
      const batchResults = await Promise.all(
        batch.map(agent => this.executeAgent(agent))
      );
      this.results.push(...batchResults);

      // Check for errors in this batch
      for (const result of batchResults) {
        if (result.error && !this.config.strategy.auto_recovery) {
          this.state = 'error';
          return {
            continue: false,
            result: { success: false, error: result.error, results: this.results }
          };
        }
      }
    }

    return { continue: true, result: null };
  }

  getAgentByRole(role) {
    return Array.from(this.agents.values()).find(a => a.role === role);
  }

  async executeAgent(agent) {
    console.error(`[Team] Executing ${agent.name}`);
    agent.status = 'working';
    agent.startedAt = Date.now();

    const maxRetries = this.config.strategy.recovery_attempts ?? 3;
    const autoRecovery = this.config.strategy.auto_recovery ?? false;
    let lastError = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.error(`[Team] Retrying ${agent.name} (attempt ${attempt}/${maxRetries}) after ${backoffMs}ms backoff`);

        // Reset agent status for retry
        agent.status = 'working';
        agent.error = null;

        // Record retry attempt in Project-Brain for learning
        remember('team_retries', `${this.sessionId}_${agent.role}_${attempt}`, {
          agent: agent.role,
          attempt,
          max_retries: maxRetries,
          previous_error: lastError?.message,
          backoff_ms: backoffMs,
          timestamp: new Date().toISOString(),
        });

        await this.sleep(backoffMs);
      }

      try {
        const result = await this.runAgentLogic(agent);

        agent.results.push(result);
        agent.status = 'completed';
        agent.completedAt = Date.now();

        // Record success for learning
        remember('team_results', `${this.sessionId}_${agent.role}`, {
          agent: agent.role,
          success: true,
          attempts: attempt + 1,
          timestamp: new Date().toISOString(),
        });

        return { agent: agent.id, role: agent.role, success: true, result, attempts: attempt + 1 };
      } catch (error) {
        lastError = error;
        agent.error = error.message;
        attempt++;

        // Record error for learning
        remember('team_errors', `${this.sessionId}_${agent.role}_${attempt}`, {
          agent: agent.role,
          error: error.message,
          attempt,
          timestamp: new Date().toISOString(),
        });

        // If auto_recovery is disabled, fail immediately
        if (!autoRecovery) {
          console.error(`[Team] ${agent.name} failed (auto_recovery disabled): ${error.message}`);
          agent.status = 'error';
          return { agent: agent.id, role: agent.role, success: false, error: error.message, attempts: attempt };
        }

        // If we've exhausted retries, mark as failed
        if (attempt > maxRetries) {
          console.error(`[Team] ${agent.name} failed after ${attempt} attempts: ${error.message}`);
          agent.status = 'error';

          // Check if we should escalate to human
          if (this.config.strategy.escalate_on_failure) {
            await this.escalateToHuman(agent, lastError);
          }

          return { agent: agent.id, role: agent.role, success: false, error: error.message, attempts: attempt };
        }

        // Log retry attempt
        console.error(`[Team] ${agent.name} error on attempt ${attempt}: ${error.message}. Will retry...`);
      }
    }

    // Should not reach here, but just in case
    agent.status = 'error';
    return { agent: agent.id, role: agent.role, success: false, error: lastError?.message, attempts: attempt };
  }

  /**
   * Sleep utility for exponential backoff
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Escalate to human when retries are exhausted and strategy requires it
   */
  async escalateToHuman(agent, error) {
    console.error(`[Team] ESCALATION: ${agent.name} requires human intervention`);

    const escalationRecord = {
      agent: agent.role,
      agent_id: agent.id,
      error: error.message,
      session_id: this.sessionId,
      team_name: this.config.name,
      design_name: this.config.design_name,
      design_dir: this.config.design_dir,
      escalation_time: new Date().toISOString(),
      status: 'pending_human_response',
    };

    // Record escalation in Project-Brain
    remember('team_escalations', `${this.sessionId}_${agent.role}`, escalationRecord);

    // Also write to a file for immediate visibility
    const escalationPath = `/tmp/hipilot_escalation_${this.sessionId}_${agent.role}.json`;
    try {
      writeFileSync(escalationPath, JSON.stringify(escalationRecord, null, 2));
      console.error(`[Team] Escalation written to: ${escalationPath}`);
    } catch (fsError) {
      console.error(`[Team] Failed to write escalation file: ${fsError.message}`);
    }

    // If blocking escalation is configured, wait for human response
    if (this.config.strategy.block_on_escalation) {
      console.error(`[Team] Waiting for human response (block_on_escalation is true)...`);
      // In a real implementation, this might poll for a response file or use a notification system
      // For now, we just record the escalation and continue
    }

    return escalationRecord;
  }

  async runAgentLogic(agent) {
    const registry = AGENT_REGISTRY[agent.role];
    const designDir = this.config.design_dir;
    const designName = this.config.design_name;

    switch (agent.role) {
      case 'supervisor':
        return await runSupervisorAgent(registry, this.agents, this.config);

      case 'planner':
        return await runPlannerAgent(registry, designDir, designName, this.results);

      case 'executor':
        const plan = this.results.find(r => r.role === 'planner')?.result?.plan;
        return await runExecutorAgent(registry, designDir, plan);

      case 'memory':
        const execResults = this.results.find(r => r.role === 'executor')?.result;
        return await runMemoryAgent(registry, designDir, execResults);

      case 'learner':
        return await runLearnerAgent(registry, this.sessionId, this.results);

      case 'knowledge':
        return await runKnowledgeAgent(registry, designDir, designName);

      default:
        throw new Error(`Unknown role: ${agent.role}`);
    }
  }

  getStatus() {
    const agents = Array.from(this.agents.values()).map(a => ({
      id: a.id,
      name: a.name,
      role: a.role,
      status: a.status,
    }));

    const completed = agents.filter(a => a.status === 'completed').length;

    return {
      name: this.config.name,
      state: this.state,
      session_id: this.sessionId,
      agents,
      progress: {
        total: agents.length,
        completed,
        percent: Math.round((completed / agents.length) * 100),
      },
    };
  }
}

// ============================================================================
// Agent Logic Implementation
// ============================================================================

async function runPlannerAgent(registry, designDir, designName, previousResults) {
  console.error(`[PlannerAgent] Analyzing design: ${designName}`);

  // Check Project-Brain for existing context
  const contextResult = recall('design_context', designName);
  const existingContext = contextResult.success ? contextResult.entry : null;

  // Determine flow stages based on design
  const stages = ['synthesis', 'design_init', 'floorplan', 'placement', 'cts', 'routing', 'export'];

  // Check for existing checkpoints
  const checkpoints = existingContext?.checkpoints || {};
  const stagesToRun = stages.filter(s => !checkpoints[s]);

  const plan = {
    design_name: designName,
    stages,
    stages_to_run: stagesToRun,
    can_skip: stagesToRun.length < stages.length,
    estimated_time_minutes: stagesToRun.length * 15,
  };

  console.error(`[PlannerAgent] Plan: ${stagesToRun.length} stages to run`);

  return {
    plan,
    stages,
    checkpoints_found: Object.keys(checkpoints),
  };
}

async function runExecutorAgent(registry, designDir, plan) {
  console.error(`[ExecutorAgent] Executing ${plan?.stages_to_run?.length || 0} stages`);

  const results = [];

  // Create ASIC-Brain instance for Tcl generation and output parsing
  const asicBrainInstance = asicBrain.createASICBrain(`executor_${plan?.design_name || 'unknown'}`);

  for (const stage of plan?.stages_to_run || []) {
    console.error(`[ExecutorAgent] Stage: ${stage}`);

    try {
      // Step 1: Plan the stage using ASIC-Brain
      const stagePlan = asicBrainInstance.planStage(stage);
      if (!stagePlan.canExecute) {
        console.error(`[ExecutorAgent] Stage ${stage} prerequisites not met: ${stagePlan.reason}`);
        results.push({
          stage,
          status: 'skipped',
          reason: stagePlan.reason,
          checkpoint: null,
        });
        continue;
      }

      // Step 2: Get best practices from EDA-Brain
      const tool = getToolForStage(stage);
      const bestPractices = edaBrain.getBestPractices(tool);
      console.error(`[ExecutorAgent] Using ${tool} with ${bestPractices.length} best practices`);

      // Step 3: Generate Tcl using ASIC-Brain
      const tclIntent = generateStageIntent(stage, plan?.design_name);
      const tclResult = asicBrain.generateTcl(tclIntent, tool, stage);

      if (!tclResult.success) {
        throw new Error(`Tcl generation failed: ${tclResult.error}`);
      }

      // Step 4: Validate Tcl syntax via EDA-Brain
      const validation = edaBrain.validateTclSyntax(tclResult.tcl, tool);
      if (!validation.valid) {
        console.error(`[ExecutorAgent] Tcl validation warnings: ${validation.issues?.join(', ')}`);
        // Auto-fix if possible
        if (validation.canAutoFix) {
          tclResult.tcl = validation.fixedTcl || tclResult.tcl;
        }
      }

      // Step 5: Execute via actual EDA tools (placeholder for MCP integration)
      // TODO: Replace with actual MCP call when EDA server integration is ready
      const execResult = await simulateExecution(stage, tclResult.tcl, designDir, tool);

      // Step 6: Parse output using ASIC-Brain
      const parsedOutput = asicBrain.parseOutput(execResult.output, stage);

      // Step 7: Extract QoR metrics
      const qorMetrics = extractQoRMetrics(parsedOutput);

      // Step 8: Record success in ASIC-Brain
      asicBrainInstance.markStageComplete(stage, {
        timestamp: new Date().toISOString(),
        duration: execResult.duration,
        qor: qorMetrics,
      });

      // Step 9: Save checkpoint reference
      const checkpoint = `${stage}.enc`;

      results.push({
        stage,
        status: 'completed',
        checkpoint,
        tool,
        duration: execResult.duration,
        qor: qorMetrics,
        output_summary: parsedOutput.summary,
      });

      console.error(`[ExecutorAgent] Stage ${stage} completed: WNS=${qorMetrics.wns}ns, TNS=${qorMetrics.tns}ns`);

    } catch (error) {
      console.error(`[ExecutorAgent] Stage ${stage} failed: ${error.message}`);

      // Try to match error pattern using EDA-Brain
      const errorMatch = edaBrain.matchError(error.message);
      if (errorMatch) {
        console.error(`[ExecutorAgent] Known error pattern: ${errorMatch.pattern}`);
      }

      results.push({
        stage,
        status: 'failed',
        error: error.message,
        checkpoint: null,
      });

      // If auto_recovery is disabled, stop execution
      if (!plan?.auto_recovery) {
        break;
      }
    }
  }

  return {
    stages_executed: results.filter(r => r.status === 'completed').length,
    stages_failed: results.filter(r => r.status === 'failed').length,
    stages_skipped: results.filter(r => r.status === 'skipped').length,
    results,
    overall_success: results.every(r => r.status !== 'failed'),
  };
}

/**
 * Map stage to appropriate EDA tool
 */
function getToolForStage(stage) {
  const toolMap = {
    synthesis: 'dc_shell',
    design_init: 'innovus',
    floorplan: 'innovus',
    placement: 'innovus',
    cts: 'innovus',
    routing: 'innovus',
    export: 'innovus',
    signoff: 'pt_shell',
  };
  return toolMap[stage] || 'innovus';
}

/**
 * Generate natural language intent for Tcl generation
 */
function generateStageIntent(stage, designName) {
  const intents = {
    synthesis: `Run synthesis for ${designName} using compile_ultra with area and timing optimization`,
    design_init: `Initialize design for ${designName} with MMMC setup and LEF/DEF loading`,
    floorplan: `Create floorplan for ${designName} with core area, IO placement, and macro placement`,
    placement: `Run placement optimization for ${designName} with timing-driven placement`,
    cts: `Build clock tree for ${designName} using ccopt_design with skew optimization`,
    routing: `Route design ${designName} using nanoRoute with timing and DRC optimization`,
    export: `Export final design ${designName} to GDS and Verilog netlist`,
    signoff: `Run PrimeTime signoff for ${designName} with SI analysis`,
  };
  return intents[stage] || `Execute ${stage} stage for ${designName}`;
}

/**
 * Simulate EDA execution (placeholder for actual MCP integration)
 */
async function simulateExecution(stage, tcl, designDir, tool) {
  const startTime = Date.now();

  // In real implementation, this would:
  // 1. Write Tcl to file
  // 2. Call EDA MCP server to execute
  // 3. Capture output
  // 4. Wait for completion

  // For now, simulate realistic timing and output
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work

  const duration = Date.now() - startTime;

  // Generate realistic-looking output with QoR metrics
  const output = `
[${tool}] Starting ${stage}...
[INFO] Loading design...
[INFO] Running ${stage} commands...
[INFO] Optimization complete
[WNS] ${(-0.1 - Math.random() * 0.5).toFixed(3)} ns
[TNS] ${(-1 - Math.random() * 10).toFixed(3)} ns
[Area] ${(100000 + Math.random() * 50000).toFixed(0)} um2
[${tool}] ${stage} completed in ${duration}ms
`;

  return { output, duration };
}

/**
 * Extract QoR metrics from parsed output
 */
function extractQoRMetrics(parsedOutput) {
  // Try to extract from structured metrics first
  if (parsedOutput.metrics) {
    return {
      wns: parsedOutput.metrics.wns ?? null,
      tns: parsedOutput.metrics.tns ?? null,
      area: parsedOutput.metrics.area ?? null,
      power: parsedOutput.metrics.power ?? null,
    };
  }

  // Fallback: parse from raw output
  const wnsMatch = parsedOutput.raw?.match(/WNS[\s:]+(-?\d+\.?\d*)/i);
  const tnsMatch = parsedOutput.raw?.match(/TNS[\s:]+(-?\d+\.?\d*)/i);
  const areaMatch = parsedOutput.raw?.match(/Area[\s:]+(\d+\.?\d*)/i);

  return {
    wns: wnsMatch ? parseFloat(wnsMatch[1]) : null,
    tns: tnsMatch ? parseFloat(tnsMatch[1]) : null,
    area: areaMatch ? parseFloat(areaMatch[1]) : null,
    power: null, // Would need power analysis
  };
}

async function runMemoryAgent(registry, designDir, execResults) {
  console.error(`[MemoryAgent] Recording design history`);

  // Extract QoR metrics from execution results
  const aggregatedQoR = aggregateQoRFromResults(execResults);

  // Record aggregated QoR history
  if (aggregatedQoR.hasData) {
    remember('qor_history', designDir, {
      timestamp: new Date().toISOString(),
      metrics: aggregatedQoR.metrics,
      stages_contributed: aggregatedQoR.stages,
    });
  }

  // Record per-stage QoR and completion
  let recordsCreated = 0;
  for (const result of execResults?.results || []) {
    // Record stage completion
    remember('stage_history', `${designDir}_${result.stage}`, {
      status: result.status,
      checkpoint: result.checkpoint,
      completed_at: new Date().toISOString(),
      duration: result.duration,
    });
    recordsCreated++;

    // Record per-stage QoR if available
    if (result.qor && Object.values(result.qor).some(v => v !== null)) {
      remember('stage_qor', `${designDir}_${result.stage}`, {
        timestamp: new Date().toISOString(),
        metrics: result.qor,
      });
      recordsCreated++;
    }

    // Record errors for learning
    if (result.status === 'failed' && result.error) {
      remember('execution_errors', `${designDir}_${result.stage}`, {
        timestamp: new Date().toISOString(),
        error: result.error,
        stage: result.stage,
        tool: result.tool,
      });
      recordsCreated++;
    }
  }

  // Record execution summary
  const summary = {
    timestamp: new Date().toISOString(),
    stages_completed: execResults?.results?.filter(r => r.status === 'completed').length || 0,
    stages_failed: execResults?.results?.filter(r => r.status === 'failed').length || 0,
    stages_skipped: execResults?.results?.filter(r => r.status === 'skipped').length || 0,
    overall_success: execResults?.overall_success || false,
    final_qor: aggregatedQoR.metrics,
  };
  remember('execution_summary', designDir, summary);
  recordsCreated++;

  console.error(`[MemoryAgent] Recorded ${recordsCreated} entries, QoR: WNS=${aggregatedQoR.metrics.wns ?? 'N/A'}ns`);

  return {
    records_created: recordsCreated,
    qor_recorded: aggregatedQoR.metrics,
    execution_summary: summary,
  };
}

/**
 * Aggregate QoR metrics from all execution results
 */
function aggregateQoRFromResults(execResults) {
  const metrics = {
    wns: null,
    tns: null,
    area: null,
    power: null,
  };

  const stages = [];

  // Iterate through results to find latest metrics
  for (const result of execResults?.results || []) {
    if (result.status === 'completed' && result.qor) {
      stages.push(result.stage);

      // Take the most recent non-null value for each metric
      if (result.qor.wns !== null && result.qor.wns !== undefined) {
        metrics.wns = result.qor.wns;
      }
      if (result.qor.tns !== null && result.qor.tns !== undefined) {
        metrics.tns = result.qor.tns;
      }
      if (result.qor.area !== null && result.qor.area !== undefined) {
        metrics.area = result.qor.area;
      }
      if (result.qor.power !== null && result.qor.power !== undefined) {
        metrics.power = result.qor.power;
      }
    }
  }

  return {
    hasData: stages.length > 0,
    metrics,
    stages,
  };
}

async function runLearnerAgent(registry, sessionId, allResults) {
  console.error(`[LearningAgent] Analyzing results for patterns`);

  const learnings = [];

  // Analyze successes
  const successes = allResults.filter(r => r.success);
  for (const success of successes) {
    learnings.push({
      type: 'success_pattern',
      agent: success.role,
      action: 'record_success',
      timestamp: new Date().toISOString(),
    });
  }

  // Analyze failures
  const failures = allResults.filter(r => !r.success && r.error);
  for (const failure of failures) {
    learnings.push({
      type: 'error_pattern',
      agent: failure.role,
      error: failure.error,
      action: 'record_error',
      timestamp: new Date().toISOString(),
    });

    // Store error pattern for future reference
    remember('error_patterns', `${sessionId}_${failure.role}`, {
      error: failure.error,
      resolution: 'pending',
    });
  }

  // Search for similar past patterns
  const similarPatterns = searchProjectBrain('error', { categories: ['error_patterns'] });

  // Suggest improvements
  const suggestions = [];
  if (failures.length > 0) {
    suggestions.push('Review error patterns for recurring issues');
  }
  if (successes.length === allResults.length) {
    suggestions.push('All agents completed successfully - consider parallel execution');
  }

  console.error(`[LearningAgent] Recorded ${learnings.length} learnings`);

  return {
    learnings_recorded: learnings.length,
    patterns_found: similarPatterns.results?.length || 0,
    suggestions,
  };
}

async function runKnowledgeAgent(registry, designDir, designName) {
  console.error(`[KnowledgeAgent] Querying all three knowledge bases for ${designName}`);

  // ============================================================================
  // 1. Query ASIC-Brain for methodology context and best practices
  // ============================================================================
  console.error(`[KnowledgeAgent] Querying ASIC-Brain...`);

  // Create ASIC-Brain instance for flow planning
  const asicBrainInstance = asicBrain.createASICBrain(`team_${designName}`);

  // Get flow stages and status
  const flowStatus = asicBrainInstance.getFlowStatus();

  // Get best practices for each stage
  const stageBestPractices = {};
  for (const stage of flowStatus.stages) {
    const stageDef = asicBrain.getStageDefinition(stage.id);
    if (stageDef) {
      stageBestPractices[stage.id] = {
        description: stageDef.description,
        tool: stageDef.tool,
        prerequisites: stageDef.prerequisites,
        estimated_duration: stageDef.estimatedDuration,
      };
    }
  }

  // Get available flow stages
  const availableStages = asicBrain.getFlowStages();

  // ============================================================================
  // 2. Query EDA-Brain for tool recommendations
  // ============================================================================
  console.error(`[KnowledgeAgent] Querying EDA-Brain...`);

  // Get tool recommendations based on design type
  const toolRecommendations = {
    synthesis: edaBrain.getToolInfo('dc_shell'),
    pnr: edaBrain.getToolInfo('innovus'),
    signoff: edaBrain.getToolInfo('pt_shell'),
  };

  // Get best practices for each tool/stage combination
  const edaBestPractices = {};
  for (const tool of ['innovus', 'dc_shell', 'pt_shell']) {
    edaBestPractices[tool] = edaBrain.getBestPractices(tool);
  }

  // Get supported tools list
  const supportedTools = edaBrain.listTools();

  // ============================================================================
  // 3. Query Project-Brain for design-specific context
  // ============================================================================
  console.error(`[KnowledgeAgent] Querying Project-Brain...`);

  // Retrieve design context
  const contextResult = recall('design_context', designName);
  const designContext = contextResult.success ? contextResult.entry : null;

  // Get QoR progression if design was run before
  const qorProgression = {};
  for (const metric of ['wns', 'tns', 'area', 'power']) {
    const progressionResult = recall('timing_memory', null);
    if (progressionResult.success && progressionResult.entries) {
      const metricData = progressionResult.entries
        .filter(e => e.value?.metrics?.[metric] !== undefined)
        .map(e => ({
          stage: e.value.stage,
          value: e.value.metrics[metric],
          timestamp: e.timestamp,
        }));
      if (metricData.length > 0) {
        qorProgression[metric] = metricData;
      }
    }
  }

  // Search for error patterns related to this design
  const errorPatternsResult = searchProjectBrain(designName, { categories: ['error_patterns'] });
  const knownErrorPatterns = errorPatternsResult.success ? errorPatternsResult.results : [];

  // Get stage history
  const stageHistoryResult = recall('stage_history', null);
  const stageHistory = stageHistoryResult.success ? stageHistoryResult.entries : [];

  // Get checkpoint information
  const checkpoints = {};
  for (const stage of ['synthesis', 'design_init', 'floorplan', 'placement', 'cts', 'routing']) {
    const checkpointResult = recall('stage_history', `${designDir}_${stage}`);
    if (checkpointResult.success) {
      checkpoints[stage] = checkpointResult.entry.value;
    }
  }

  // ============================================================================
  // 4. Aggregate knowledge into unified response
  // ============================================================================

  // Determine recommended flow stages based on design type and existing checkpoints
  const stagesToRun = flowStatus.stages
    .filter(s => !checkpoints[s.id] && !s.completed)
    .map(s => s.id);

  const recommendedFlow = {
    stages: flowStatus.stages.map(s => s.id),
    stages_to_run: stagesToRun,
    can_resume: Object.keys(checkpoints).length > 0,
    resume_from: Object.keys(checkpoints).pop() || null,
    estimated_total_time: stagesToRun.length * 15, // minutes
  };

  // Build tool version requirements
  const toolRequirements = {
    synthesis: { tool: 'dc_shell', version: toolRecommendations.synthesis?.version, required: true },
    pnr: { tool: 'innovus', version: toolRecommendations.pnr?.version, required: true },
    signoff: { tool: 'pt_shell', version: toolRecommendations.signoff?.version, required: false },
  };

  // Aggregate historical QoR data
  const historicalQoR = Object.keys(qorProgression).length > 0 ? {
    available: true,
    metrics: qorProgression,
    last_run: stageHistory.length > 0 ? stageHistory[stageHistory.length - 1]?.timestamp : null,
    trend: 'improving', // Could be calculated from actual data
  } : { available: false };

  // Known issues and suggested optimizations
  const knownIssues = knownErrorPatterns.map(p => ({
    pattern: p.key,
    description: p.value?.pattern || p.key,
    resolution: p.value?.resolution,
    auto_fixable: p.value?.auto_fixable,
    times_encountered: p.value?.times_encountered,
  }));

  const suggestedOptimizations = [];
  if (historicalQoR.available) {
    // Suggest optimizations based on past QoR
    if (qorProgression.wns) {
      const lastWNS = qorProgression.wns[qorProgression.wns.length - 1]?.value;
      if (lastWNS < 0) {
        suggestedOptimizations.push({
          type: 'timing',
          issue: 'Negative WNS detected in previous run',
          suggestion: 'Consider increasing placement density or enabling more aggressive optimization',
          priority: 'high',
        });
      }
    }
  }

  // Add tool-specific optimizations from EDA-Brain
  for (const [tool, practices] of Object.entries(edaBestPractices)) {
    for (const practice of practices) {
      suggestedOptimizations.push({
        type: 'best_practice',
        tool: tool,
        title: practice.title,
        description: practice.description,
        rationale: practice.rationale,
        priority: 'medium',
      });
    }
  }

  // ============================================================================
  // 5. Build unified knowledge object
  // ============================================================================
  const knowledge = {
    design_name: designName,
    design_dir: designDir,
    timestamp: new Date().toISOString(),

    // ASIC-Brain knowledge
    asic: {
      capabilities: registry.capabilities.asic,
      flow_status: flowStatus,
      stage_best_practices: stageBestPractices,
      available_stages: availableStages.map(s => s.id),
      methodology_context: {
        recommended_flow: recommendedFlow,
        stage_dependencies: availableStages.reduce((acc, s) => {
          acc[s.id] = s.dependencies || [];
          return acc;
        }, {}),
      },
    },

    // EDA-Brain knowledge
    eda: {
      capabilities: registry.capabilities.eda,
      tool_recommendations: toolRecommendations,
      supported_tools: supportedTools.map(t => t.id),
      tool_requirements: toolRequirements,
      best_practices: edaBestPractices,
      command_reference: {
        innovus: edaBrain.getCommandsByCategory('innovus', 'design_init'),
        dc_shell: edaBrain.getCommandsByCategory('dc_shell', 'synthesis'),
      },
    },

    // Project-Brain knowledge
    project: {
      capabilities: registry.capabilities.project,
      design_exists: !!designContext,
      current_stage: designContext?.current_stage || flowStatus.currentStage || 'unknown',
      completed_stages: flowStatus.completedStages || [],
      checkpoints: checkpoints,
      stage_history: stageHistory.slice(-10), // Last 10 entries
      historical_qor: historicalQoR,
      known_error_patterns: knownIssues,
      suggested_optimizations: suggestedOptimizations,
    },

    // Aggregated recommendations
    recommendations: {
      flow: recommendedFlow,
      tools: toolRequirements,
      optimizations: suggestedOptimizations.slice(0, 5), // Top 5
      warnings: knownIssues.filter(i => !i.resolution).map(i => i.description),
    },
  };

  // ============================================================================
  // 6. Cache aggregated knowledge in Project-Brain
  // ============================================================================
  remember('knowledge_cache', `${designName}_team_knowledge`, {
    timestamp: new Date().toISOString(),
    brains_queried: ['asic', 'eda', 'project'],
    cached_for_agents: ['planner', 'executor', 'memory', 'learner'],
    knowledge_summary: {
      flow_stages: recommendedFlow.stages.length,
      stages_to_run: recommendedFlow.stages_to_run.length,
      checkpoints_found: Object.keys(checkpoints).length,
      known_issues: knownIssues.length,
      optimizations_suggested: suggestedOptimizations.length,
      has_historical_qor: historicalQoR.available,
    },
    tags: ['team_mode', 'knowledge_aggregation', designName],
  });

  // Also cache error patterns for quick lookup
  if (knownIssues.length > 0) {
    remember('knowledge_cache', `${designName}_error_patterns`, {
      timestamp: new Date().toISOString(),
      patterns: knownIssues,
      tags: ['error_patterns', 'quick_reference'],
    });
  }

  console.error(`[KnowledgeAgent] Knowledge base query complete:`);
  console.error(`  - Flow stages: ${recommendedFlow.stages.length} (${recommendedFlow.stages_to_run.length} to run)`);
  console.error(`  - Checkpoints: ${Object.keys(checkpoints).length} found`);
  console.error(`  - Known issues: ${knownIssues.length}`);
  console.error(`  - Optimizations: ${suggestedOptimizations.length}`);

  // ============================================================================
  // 7. Return rich knowledge object for other agents
  // ============================================================================
  return {
    knowledge,
    brains_accessed: ['asic', 'eda', 'project'],
    cache_key: `${designName}_team_knowledge`,
    ready_for_planning: true,

    // Helper methods for other agents
    getStageInfo: (stageId) => knowledge.asic.stage_best_practices[stageId] || null,
    getToolForStage: (stageId) => {
      const stage = knowledge.asic.stage_best_practices[stageId];
      return stage ? { tool: stage.tool, info: knowledge.eda.tool_recommendations[stage.tool] } : null;
    },
    getErrorPatterns: () => knowledge.project.known_error_patterns,
    getOptimizations: (priority = null) => {
      if (priority) {
        return knowledge.project.suggested_optimizations.filter(o => o.priority === priority);
      }
      return knowledge.project.suggested_optimizations;
    },
    hasHistoricalData: () => knowledge.project.historical_qor.available,
  };
}

async function runSupervisorAgent(registry, agents, config) {
  console.error(`[SupervisorAgent] Overseeing team execution`);

  // Validate all agents are ready
  const agentStatus = Array.from(agents.values()).map(a => ({
    id: a.id,
    role: a.role,
    status: a.status,
  }));

  // Check for any conflicts or issues
  const issues = [];
  for (const agent of agents.values()) {
    if (agent.config.dependencies) {
      for (const dep of agent.config.dependencies) {
        const depAgent = agents.get(dep);
        if (!depAgent) {
          issues.push(`Agent ${agent.id} depends on missing agent ${dep}`);
        }
      }
    }
  }

  // Make execution decisions
  const decisions = {
    execution_mode: config.strategy.mode,
    auto_recovery: config.strategy.auto_recovery,
    max_parallel: config.strategy.max_parallel || 4,
  };

  // Approve team readiness
  const approved = issues.length === 0;

  console.error(`[SupervisorAgent] Team ${approved ? 'approved' : 'has issues'}: ${issues.join(', ') || 'none'}`);

  return {
    approved,
    agent_count: agents.size,
    agent_status: agentStatus,
    issues,
    decisions,
  };
}

// ============================================================================
// Configuration Helpers
// ============================================================================

export function createDefaultTeamConfig(designDir, designName) {
  return {
    name: `${designName}_team`,
    design_dir: designDir,
    design_name: designName,
    agents: [
      { id: 'supervisor', role: 'supervisor' },
      { id: 'knowledge', role: 'knowledge' },
      { id: 'planner', role: 'planner' },
      { id: 'executor', role: 'executor' },
      { id: 'memory', role: 'memory' },
      { id: 'learner', role: 'learner' },
    ],
    strategy: {
      mode: 'sequential',
      auto_recovery: true,
      recovery_attempts: 3,
      max_parallel: 4,
      escalate_on_failure: true,
      block_on_escalation: false,
    },
  };
}

export function getAvailableAgents() {
  return Object.entries(AGENT_REGISTRY).map(([id, config]) => ({
    id,
    name: config.name,
    description: config.description,
    primary_brain: config.primary_brain,
    responsibilities: config.responsibilities,
  }));
}

export async function initializeTeamMode(designDir, designName) {
  const config = createDefaultTeamConfig(designDir, designName);
  const manager = new TeamManager(config);
  await manager.initialize();
  return manager;
}

export { AGENT_REGISTRY };
