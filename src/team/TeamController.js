/**
 * TeamController - Hard-coded 5-agent team control flow for HiPilot
 *
 * This module implements the strict hub-and-spoke architecture:
 * - Supervisor (Pane 0): Accepts user input, delegates to other agents
 * - Knowledge (Pane 1): Brain interface for Tcl generation, MESSAGE HUB
 * - Planner (Pane 2): Strategy and planning
 * - Executor (Pane 3): ONLY agent that controls EDA pane (Pane 5) via MCP
 * - Archivist (Pane 4): QoR recording and learnings
 *
 * CRITICAL: All communication goes through Knowledge Agent (hub-and-spoke).
 * Supervisor NEVER talks directly to Executor/Planner/Archivist.
 */

import { KnowledgeRouter, MESSAGE_TYPES, AGENT_NAMES as ROUTER_AGENTS } from './KnowledgeRouter.js';

const AGENTS = {
  SUPERVISOR: 'Supervisor',
  KNOWLEDGE: 'Knowledge',
  PLANNER: 'Planner',
  EXECUTOR: 'Executor',
  ARCHIVIST: 'Archivist',
};

/**
 * TeamController - Coordinates the 5-agent team using hub-and-spoke
 */
export class TeamController {
  constructor(options = {}) {
    this.session = options.session || 'hipilot';
    this.designDir = options.designDir || process.env.HIPILOT_DESIGN_DIR;
    this.designName = options.designName || process.env.HIPILOT_DESIGN_NAME;
    this.activeAgents = new Map();
    this.currentStage = null;
    this.router = new KnowledgeRouter({
      designDir: this.designDir,
      designName: this.designName,
    });
  }

  /**
   * Initialize the team - all agents are ready
   */
  async initialize() {
    console.log('[TeamController] Initializing 5-agent team...');

    // Register all agents
    for (const [key, name] of Object.entries(AGENTS)) {
      this.activeAgents.set(name, {
        name,
        status: 'ready',
        lastActivity: Date.now(),
      });
    }

    console.log('[TeamController] Team ready (hub-and-spoke architecture):');
    console.log('  - Supervisor: Accepts user input, coordinates');
    console.log('  - Knowledge: MESSAGE HUB + Brain interface');
    console.log('  - Planner: Strategy');
    console.log('  - Executor: EXCLUSIVE EDA pane control');
    console.log('  - Archivist: QoR recording');
    console.log('[TeamController] ALL messages route through Knowledge Agent');

    return { success: true, agents: Array.from(this.activeAgents.keys()) };
  }

  /**
   * Supervisor receives user command and delegates
   */
  async handleUserCommand(command) {
    console.log(`[Supervisor] Received command: ${command}`);

    // Parse command intent
    const intent = this._parseCommand(command);

    switch (intent.type) {
      case 'synthesis':
        return await this._runSynthesisFlow(intent);
      case 'floorplan':
        return await this._runFloorplanFlow(intent);
      case 'placement':
        return await this._runPlacementFlow(intent);
      case 'cts':
        return await this._runCTSFlow(intent);
      case 'routing':
        return await this._runRoutingFlow(intent);
      default:
        return { error: `Unknown command: ${command}` };
    }
  }

  /**
   * Synthesis flow: Supervisor -> Knowledge -> Executor -> Knowledge -> Archivist
   *
   * Hub-and-spoke: Supervisor ONLY talks to Knowledge
   */
  async _runSynthesisFlow(intent) {
    console.log('[Supervisor] Starting Synthesis flow (Stage 0)');
    this.currentStage = 'synthesis';

    // Step 1: Delegate to Knowledge (hub) to route to Executor
    console.log('[Supervisor] -> Knowledge: delegate_execution for synthesis');

    const route = this.router.route({
      type: MESSAGE_TYPES.DELEGATE_EXECUTION,
      from: ROUTER_AGENTS.SUPERVISOR,
      payload: {
        stage: 'synthesis',
        tool: 'dc_shell',
        designDir: this.designDir,
        designName: this.designName,
      },
    });

    // Step 2: Simulate Executor handling (in real system, SendMessage API would be used)
    const execResult = await this._simulateExecutorExecution(route.message);

    // Step 3: Route execution result through Knowledge to Archivist + Supervisor
    const resultRoutes = this.router.route({
      type: MESSAGE_TYPES.EXECUTION_RESULT,
      from: ROUTER_AGENTS.EXECUTOR,
      payload: {
        stage: 'synthesis',
        success: execResult.success,
        metrics: execResult.metrics,
      },
    });

    // Step 4: Simulate Archivist recording
    for (const r of resultRoutes) {
      if (r.to === ROUTER_AGENTS.ARCHIVIST) {
        console.log(`[Archivist] Recording QoR via Knowledge routing`);
      }
    }

    console.log('[Supervisor] Synthesis flow complete');
    return {
      success: true,
      stage: 'synthesis',
      metrics: execResult.metrics,
    };
  }

  /**
   * Floorplan flow: Supervisor -> Knowledge -> Planner/Executor -> Knowledge -> Archivist
   */
  async _runFloorplanFlow(intent) {
    console.log('[Supervisor] Starting Floorplan flow (Stage 1)');
    this.currentStage = 'floorplan';

    // Step 1: Get strategy via Knowledge -> Planner
    console.log('[Supervisor] -> Knowledge: get_strategy for floorplan');

    const strategyRoute = this.router.route({
      type: MESSAGE_TYPES.GET_STRATEGY,
      from: ROUTER_AGENTS.SUPERVISOR,
      payload: {
        stage: 'floorplan',
        context: { designDir: this.designDir },
      },
    });

    // Step 2: Delegate execution via Knowledge -> Executor
    console.log('[Supervisor] -> Knowledge: delegate_execution for floorplan');

    const route = this.router.route({
      type: MESSAGE_TYPES.DELEGATE_EXECUTION,
      from: ROUTER_AGENTS.SUPERVISOR,
      payload: {
        stage: 'floorplan',
        tool: 'innovus',
        designDir: this.designDir,
        designName: this.designName,
      },
    });

    // Step 3: Simulate Executor handling
    const execResult = await this._simulateExecutorExecution(route.message);

    // Step 4: Route result through Knowledge
    const resultRoutes = this.router.route({
      type: MESSAGE_TYPES.EXECUTION_RESULT,
      from: ROUTER_AGENTS.EXECUTOR,
      payload: {
        stage: 'floorplan',
        success: execResult.success,
        metrics: execResult.metrics,
      },
    });

    console.log('[Supervisor] Floorplan flow complete');
    return {
      success: true,
      stage: 'floorplan',
      metrics: execResult.metrics,
    };
  }

  /**
   * Placement flow: Supervisor -> Knowledge -> Executor -> Knowledge -> Archivist
   */
  async _runPlacementFlow(intent) {
    console.log('[Supervisor] Starting Placement flow (Stage 4)');
    this.currentStage = 'placement';

    const route = this.router.route({
      type: MESSAGE_TYPES.DELEGATE_EXECUTION,
      from: ROUTER_AGENTS.SUPERVISOR,
      payload: {
        stage: 'placement',
        tool: 'innovus',
        designDir: this.designDir,
      },
    });

    const execResult = await this._simulateExecutorExecution(route.message);

    this.router.route({
      type: MESSAGE_TYPES.EXECUTION_RESULT,
      from: ROUTER_AGENTS.EXECUTOR,
      payload: { stage: 'placement', success: execResult.success, metrics: execResult.metrics },
    });

    return { success: true, stage: 'placement', metrics: execResult.metrics };
  }

  /**
   * CTS flow: Supervisor -> Knowledge -> Executor -> Knowledge -> Archivist
   */
  async _runCTSFlow(intent) {
    console.log('[Supervisor] Starting CTS flow (Stage 5)');
    this.currentStage = 'cts';

    const route = this.router.route({
      type: MESSAGE_TYPES.DELEGATE_EXECUTION,
      from: ROUTER_AGENTS.SUPERVISOR,
      payload: {
        stage: 'cts',
        tool: 'innovus',
        designDir: this.designDir,
      },
    });

    const execResult = await this._simulateExecutorExecution(route.message);

    this.router.route({
      type: MESSAGE_TYPES.EXECUTION_RESULT,
      from: ROUTER_AGENTS.EXECUTOR,
      payload: { stage: 'cts', success: execResult.success, metrics: execResult.metrics },
    });

    return { success: true, stage: 'cts', metrics: execResult.metrics };
  }

  /**
   * Routing flow: Supervisor -> Knowledge -> Executor -> Knowledge -> Archivist
   */
  async _runRoutingFlow(intent) {
    console.log('[Supervisor] Starting Routing flow (Stage 7)');
    this.currentStage = 'routing';

    const route = this.router.route({
      type: MESSAGE_TYPES.DELEGATE_EXECUTION,
      from: ROUTER_AGENTS.SUPERVISOR,
      payload: {
        stage: 'routing',
        tool: 'innovus',
        designDir: this.designDir,
      },
    });

    const execResult = await this._simulateExecutorExecution(route.message);

    this.router.route({
      type: MESSAGE_TYPES.EXECUTION_RESULT,
      from: ROUTER_AGENTS.EXECUTOR,
      payload: { stage: 'routing', success: execResult.success, metrics: execResult.metrics },
    });

    return { success: true, stage: 'routing', metrics: execResult.metrics };
  }

  /**
   * Simulate Executor execution (in real system, Executor handles via MCP)
   * @param {object} message - The execute_stage message
   * @returns {object} Execution result with metrics
   */
  async _simulateExecutorExecution(message) {
    console.log(`[Executor] Received via Knowledge routing: ${message.type}`);
    console.log(`[Executor] Stage: ${message.stage}, Tool: ${message.tool}`);

    // In real implementation, this would use MCP tools:
    // - eda.start_tool({tool: message.tool, design_dir: message.designDir})
    // - eda.send_tcl_nonblocking(...)
    // - eda.await_idle(...)
    // - eda.get_last_result()

    return {
      success: true,
      metrics: {
        wns: 0.0,
        tns: 0.0,
        area: 100000,
        cells: 10000,
      },
      output: 'EDA execution completed',
    };
  }

  /**
   * Parse user command to determine intent
   */
  _parseCommand(command) {
    const cmd = command.trim().toLowerCase();

    if (cmd.startsWith('/synthesis')) {
      return { type: 'synthesis', stage: 0 };
    }
    if (cmd.startsWith('/floorplan')) {
      return { type: 'floorplan', stage: 1 };
    }
    if (cmd.startsWith('/placement')) {
      return { type: 'placement', stage: 4 };
    }
    if (cmd.startsWith('/cts')) {
      return { type: 'cts', stage: 5 };
    }
    if (cmd.startsWith('/routing')) {
      return { type: 'routing', stage: 7 };
    }

    return { type: 'unknown', raw: command };
  }

  /**
   * Get team status
   */
  getStatus() {
    return {
      currentStage: this.currentStage,
      architecture: 'hub-and-spoke',
      hub: 'Knowledge Agent',
      agents: Array.from(this.activeAgents.entries()).map(([name, data]) => ({
        name,
        status: data.status,
        lastActivity: data.lastActivity,
      })),
      routerStats: this.router.getStats(),
    };
  }

  /**
   * Verify hub-and-spoke compliance
   */
  verifyCompliance() {
    return this.router.verifyHubAndSpokeCompliance();
  }

  /**
   * Get message log for debugging/verification
   */
  getMessageLog() {
    return this.router.getMessageLog();
  }
}

/**
 * Factory function
 */
export function createTeamController(options = {}) {
  return new TeamController(options);
}

export default {
  TeamController,
  createTeamController,
  AGENTS,
  MESSAGE_TYPES,
};
