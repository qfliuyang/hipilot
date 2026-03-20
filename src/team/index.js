/**
 * HiPilot Team Mode - Multi-Agent Coordination
 *
 * 5-Agent Architecture:
 * - Supervisor: Flow coordination and validation
 * - Knowledge: Owns all 3 brains (ASIC + EDA + Project), central knowledge interface
 * - Planner: Queries Knowledge for execution strategy
 * - Executor: Queries Knowledge for Tcl, executes via EDA MCP
 * - Archivist: Records results to Knowledge (Project-Brain)
 */

export const AGENT_REGISTRY = {
  supervisor: {
    role: 'coordinator',
    description: 'Validates prerequisites and coordinates flow phases',
    responsibilities: ['prerequisite_check', 'phase_coordination', 'user_communication'],
    priority: 1,
  },
  knowledge: {
    role: 'brain',
    description: 'Owns all 3 brains - central knowledge interface for all agents',
    responsibilities: ['brain_query', 'knowledge_synthesis', 'context_management'],
    ownsBrains: ['asic', 'eda', 'project'],
    priority: 2,
  },
  planner: {
    role: 'strategist',
    description: 'Creates execution plans by querying Knowledge Agent',
    responsibilities: ['stage_planning', 'recipe_selection', 'strategy_formulation'],
    priority: 3,
  },
  executor: {
    role: 'operator',
    description: 'Generates Tcl via Knowledge and executes via EDA MCP',
    responsibilities: ['tcl_generation', 'tool_execution', 'output_monitoring'],
    priority: 3,
  },
  archivist: {
    role: 'recorder',
    description: 'Records QoR and learnings to Knowledge (Project-Brain)',
    responsibilities: ['qor_tracking', 'pattern_recording', 'history_management'],
    priority: 4,
  },
};

export const AGENT_NAMES = Object.keys(AGENT_REGISTRY);

/**
 * Create team mode instance
 */
export function createTeamMode(options = {}) {
  const { teamName = 'hipilot-team', designDir = null } = options;

  return {
    teamName,
    designDir,
    agents: new Map(),
    currentPhase: null,
    status: 'initialized',

    /**
     * Initialize team - creates all agents
     */
    async initialize() {
      console.log(`[Team] Initializing ${teamName} with ${AGENT_NAMES.length} agents`);

      for (const [name, config] of Object.entries(AGENT_REGISTRY)) {
        this.agents.set(name, {
          name,
          ...config,
          status: 'ready',
          lastActivity: null,
        });
      }

      this.status = 'ready';
      return this.getStatus();
    },

    /**
     * Get current team status
     */
    getStatus() {
      return {
        teamName: this.teamName,
        status: this.status,
        currentPhase: this.currentPhase,
        agents: Array.from(this.agents.values()).map(a => ({
          name: a.name,
          role: a.role,
          status: a.status,
        })),
      };
    },

    /**
     * Query Knowledge Agent (central brain interface)
     */
    async queryKnowledge(queryType, params = {}) {
      const knowledge = this.agents.get('knowledge');
      if (!knowledge || knowledge.status !== 'ready') {
        throw new Error('Knowledge Agent not available');
      }

      // In real implementation, this would SendMessage to Knowledge Agent
      // For now, return mock response
      return {
        type: queryType,
        params,
        timestamp: Date.now(),
        // Actual implementation would query the 3-brain system
      };
    },

    /**
     * Execute a flow phase with agent coordination
     */
    async executePhase(phase, context = {}) {
      this.currentPhase = phase;
      console.log(`[Team] Executing phase: ${phase}`);

      // Phase execution sequence:
      // 1. Supervisor validates prerequisites
      // 2. Planner queries Knowledge for strategy
      // 3. Executor runs the tool (while Archivist monitors)
      // 4. Archivist records results to Knowledge

      const sequence = this.getPhaseSequence(phase);
      const results = [];

      for (const step of sequence) {
        console.log(`[Team] Step: ${step.agent} - ${step.action}`);
        results.push({
          step,
          result: await this.executeStep(step, context),
        });
      }

      return { phase, results };
    },

    /**
     * Get execution sequence for a phase
     */
    getPhaseSequence(phase) {
      // Default sequence for most phases
      return [
        { agent: 'supervisor', action: 'validate_prerequisites' },
        { agent: 'planner', action: 'create_strategy' },
        { agent: 'executor', action: 'execute_tool' },
        { agent: 'archivist', action: 'record_results' },
      ];
    },

    /**
     * Execute a single step
     */
    async executeStep(step, context) {
      const agent = this.agents.get(step.agent);
      if (!agent) {
        throw new Error(`Agent ${step.agent} not found`);
      }

      agent.status = 'working';
      agent.lastActivity = Date.now();

      try {
        // Actual implementation would SendMessage to the agent
        const result = { success: true, step, context };
        agent.status = 'ready';
        return result;
      } catch (error) {
        agent.status = 'error';
        throw error;
      }
    },

    /**
     * Shutdown team gracefully
     */
    async shutdown() {
      console.log('[Team] Shutting down...');
      this.status = 'shutdown';
      this.agents.clear();
      return { success: true };
    },
  };
}

/**
 * Get agent configuration
 */
export function getAgentConfig(agentName) {
  return AGENT_REGISTRY[agentName] || null;
}

/**
 * List all available agents
 */
export function listAgents() {
  return Object.entries(AGENT_REGISTRY).map(([name, config]) => ({
    name,
    ...config,
  }));
}

// Export TeamController for hard-coded team flow
export { TeamController, createTeamController, AGENTS } from './TeamController.js';

// Export KnowledgeRouter for hub-and-spoke message routing
export {
  KnowledgeRouter,
  createKnowledgeRouter,
  MESSAGE_TYPES,
  AGENT_NAMES as ROUTER_AGENT_NAMES,
} from './KnowledgeRouter.js';

export default {
  AGENT_REGISTRY,
  AGENT_NAMES,
  createTeamMode,
  getAgentConfig,
  listAgents,
  TeamController,
  createTeamController,
  AGENTS,
  KnowledgeRouter,
  createKnowledgeRouter,
  MESSAGE_TYPES,
};
