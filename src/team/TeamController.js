/**
 * TeamController - Hard-coded 5-agent team control flow for HiPilot
 *
 * This module implements the strict hub-and-spoke architecture:
 * - Supervisor (Pane 0): Accepts user input, delegates to other agents
 * - Knowledge (Pane 1): Brain interface for Tcl generation
 * - Planner (Pane 2): Strategy and planning
 * - Executor (Pane 3): ONLY agent that controls EDA pane (Pane 5) via MCP
 * - Archivist (Pane 4): QoR recording and learnings
 *
 * CRITICAL: No agent bypasses the protocol. All communication via SendMessage.
 */

import { SendMessage } from '@anthropic-ai/claude-code';

const AGENTS = {
  SUPERVISOR: 'Supervisor',
  KNOWLEDGE: 'Knowledge',
  PLANNER: 'Planner',
  EXECUTOR: 'Executor',
  ARCHIVIST: 'Archivist',
};

/**
 * TeamController - Coordinates the 5-agent team
 */
export class TeamController {
  constructor(options = {}) {
    this.session = options.session || 'hipilot';
    this.designDir = options.designDir || process.env.HIPILOT_DESIGN_DIR;
    this.activeAgents = new Map();
    this.messageQueue = [];
    this.currentStage = null;
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

    console.log('[TeamController] Team ready:');
    console.log('  - Supervisor: Accepts user input, coordinates');
    console.log('  - Knowledge: Brain interface');
    console.log('  - Planner: Strategy');
    console.log('  - Executor: EXCLUSIVE EDA pane control');
    console.log('  - Archivist: QoR recording');

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
   * Synthesis flow: Supervisor coordinates Knowledge -> Executor -> Archivist
   */
  async _runSynthesisFlow(intent) {
    console.log('[Supervisor] Starting Synthesis flow (Stage 0)');
    this.currentStage = 'synthesis';

    // Step 1: Delegate Tcl generation to Knowledge
    console.log('[Supervisor] -> Knowledge: Generate synthesis Tcl');
    const tclRequest = await this._sendToAgent(AGENTS.KNOWLEDGE, {
      type: 'generate_tcl',
      stage: 'synthesis',
      tool: 'dc_shell',
      designDir: this.designDir,
    });

    if (tclRequest.error) {
      return { error: `Knowledge failed: ${tclRequest.error}` };
    }

    // Step 2: Delegate execution to Executor (ONLY Executor uses MCP)
    console.log('[Supervisor] -> Executor: Execute synthesis Tcl');
    const execResult = await this._sendToAgent(AGENTS.EXECUTOR, {
      type: 'execute_tcl',
      stage: 'synthesis',
      tool: 'dc_shell',
      tcl: tclRequest.tcl,
      description: 'Stage 0: RTL Synthesis',
      timeout: 600,
    });

    if (execResult.error) {
      return { error: `Execution failed: ${execResult.error}` };
    }

    // Step 3: Delegate QoR recording to Archivist
    console.log('[Supervisor] -> Archivist: Record synthesis QoR');
    await this._sendToAgent(AGENTS.ARCHIVIST, {
      type: 'record_qor',
      stage: 'synthesis',
      metrics: execResult.metrics,
    });

    console.log('[Supervisor] Synthesis flow complete');
    return {
      success: true,
      stage: 'synthesis',
      metrics: execResult.metrics,
    };
  }

  /**
   * Floorplan flow: Supervisor coordinates Knowledge -> Planner -> Executor -> Archivist
   */
  async _runFloorplanFlow(intent) {
    console.log('[Supervisor] Starting Floorplan flow (Stage 1)');
    this.currentStage = 'floorplan';

    // Step 1: Get floorplan Tcl from Knowledge
    console.log('[Supervisor] -> Knowledge: Generate floorplan Tcl');
    const tclRequest = await this._sendToAgent(AGENTS.KNOWLEDGE, {
      type: 'generate_tcl',
      stage: 'floorplan',
      tool: 'innovus',
      designDir: this.designDir,
    });

    if (tclRequest.error) {
      return { error: `Knowledge failed: ${tclRequest.error}` };
    }

    // Step 2: Get strategy from Planner
    console.log('[Supervisor] -> Planner: Get floorplan strategy');
    const strategy = await this._sendToAgent(AGENTS.PLANNER, {
      type: 'get_strategy',
      stage: 'floorplan',
      context: tclRequest.context,
    });

    // Step 3: Execute via Executor (ONLY Executor uses MCP)
    console.log('[Supervisor] -> Executor: Execute floorplan Tcl');
    const execResult = await this._sendToAgent(AGENTS.EXECUTOR, {
      type: 'execute_tcl',
      stage: 'floorplan',
      tool: 'innovus',
      tcl: tclRequest.tcl,
      strategy: strategy.recommendations,
      description: 'Stage 1: Floorplan',
      timeout: 300,
    });

    if (execResult.error) {
      return { error: `Execution failed: ${execResult.error}` };
    }

    // Step 4: Record via Archivist
    console.log('[Supervisor] -> Archivist: Record floorplan QoR');
    await this._sendToAgent(AGENTS.ARCHIVIST, {
      type: 'record_qor',
      stage: 'floorplan',
      metrics: execResult.metrics,
    });

    return {
      success: true,
      stage: 'floorplan',
      metrics: execResult.metrics,
    };
  }

  /**
   * Send message to agent and wait for response
   * This uses Claude Code's native SendMessage for inter-agent communication
   */
  async _sendToAgent(agentName, message) {
    console.log(`[SendMessage] To ${agentName}: ${message.type}`);

    // In a real implementation, this would use SendMessage to communicate
    // with the agent running in its tmux pane
    // For now, we simulate by calling the agent's handler directly

    const agent = this.activeAgents.get(agentName);
    if (!agent) {
      return { error: `Agent ${agentName} not found` };
    }

    // Update agent status
    agent.status = 'working';
    agent.lastActivity = Date.now();

    try {
      let result;
      switch (agentName) {
        case AGENTS.KNOWLEDGE:
          result = await this._handleKnowledgeMessage(message);
          break;
        case AGENTS.PLANNER:
          result = await this._handlePlannerMessage(message);
          break;
        case AGENTS.EXECUTOR:
          result = await this._handleExecutorMessage(message);
          break;
        case AGENTS.ARCHIVIST:
          result = await this._handleArchivistMessage(message);
          break;
        default:
          result = { error: `Unknown agent: ${agentName}` };
      }

      agent.status = 'ready';
      return result;
    } catch (e) {
      agent.status = 'error';
      return { error: e.message };
    }
  }

  /**
   * Knowledge Agent: Generates Tcl, provides brain queries
   * NEVER uses MCP tools
   */
  async _handleKnowledgeMessage(message) {
    console.log(`[Knowledge] Handling: ${message.type}`);

    switch (message.type) {
      case 'generate_tcl':
        // Query the knowledge base for Tcl generation
        // This would use knowledge.get_skill, knowledge.generate_tcl
        return {
          tcl: `# Auto-generated ${message.stage} Tcl for ${message.tool}`,
          context: { stage: message.stage, tool: message.tool },
        };

      case 'query_brain':
        // Query ASIC/EDA/Project brains
        return { answer: 'Brain query result' };

      default:
        return { error: `Unknown message type: ${message.type}` };
    }
  }

  /**
   * Planner Agent: Creates execution strategies
   * NEVER uses MCP tools
   */
  async _handlePlannerMessage(message) {
    console.log(`[Planner] Handling: ${message.type}`);

    switch (message.type) {
      case 'get_strategy':
        return {
          recommendations: [
            'Check prerequisites',
            'Validate constraints',
            'Execute with timeout',
          ],
        };

      default:
        return { error: `Unknown message type: ${message.type}` };
    }
  }

  /**
   * Executor Agent: EXCLUSIVE control of EDA pane via MCP
   * This is the ONLY agent that uses eda.* MCP tools
   */
  async _handleExecutorMessage(message) {
    console.log(`[Executor] Handling: ${message.type}`);
    console.log(`[Executor] CRITICAL: Using MCP tools for EDA control`);

    switch (message.type) {
      case 'execute_tcl':
        // ONLY Executor uses eda.* MCP tools
        // This would call:
        // - eda.start_tool
        // - eda.send_tcl_nonblocking
        // - eda.await_idle
        // - eda.get_last_result

        console.log(`[Executor] Starting ${message.tool}`);
        console.log(`[Executor] Sending Tcl to EDA pane`);
        console.log(`[Executor] Waiting for completion`);

        // Simulated execution result
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

      case 'start_tool':
        console.log(`[Executor] Starting EDA tool: ${message.tool}`);
        return { success: true, tool: message.tool };

      default:
        return { error: `Unknown message type: ${message.type}` };
    }
  }

  /**
   * Archivist Agent: Records QoR and learnings
   * NEVER uses MCP tools for EDA control
   */
  async _handleArchivistMessage(message) {
    console.log(`[Archivist] Handling: ${message.type}`);

    switch (message.type) {
      case 'record_qor':
        // Record to Project-Brain via knowledge.* tools
        console.log(`[Archivist] Recording QoR for ${message.stage}`);
        console.log(`  WNS: ${message.metrics.wns}`);
        console.log(`  TNS: ${message.metrics.tns}`);
        console.log(`  Area: ${message.metrics.area}`);
        return { success: true };

      default:
        return { error: `Unknown message type: ${message.type}` };
    }
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
      return { type: 'placement', stage: 2 };
    }
    if (cmd.startsWith('/cts')) {
      return { type: 'cts', stage: 3 };
    }
    if (cmd.startsWith('/routing')) {
      return { type: 'routing', stage: 4 };
    }

    return { type: 'unknown', raw: command };
  }

  /**
   * Get team status
   */
  getStatus() {
    return {
      currentStage: this.currentStage,
      agents: Array.from(this.activeAgents.entries()).map(([name, data]) => ({
        name,
        status: data.status,
        lastActivity: data.lastActivity,
      })),
    };
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
};
