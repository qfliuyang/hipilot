/**
 * TeamCoordinator - Native Claude Code Team API Coordination
 *
 * Manages 5 agents using TeamCreate, Task, and SendMessage APIs.
 * HiPilot (Supervisor) is Team Lead, coordinates all agent communication.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const AGENT_CONFIGS = {
  supervisor: {
    role: 'coordinator',
    description: 'Team Lead - validates prerequisites, coordinates flow',
    responsibilities: ['prerequisite_check', 'phase_coordination', 'approval'],
    canApprove: true,
  },
  knowledge: {
    role: 'expert',
    description: 'Brain interface - ASIC + EDA + Project brains',
    responsibilities: ['brain_query', 'knowledge_synthesis'],
    ownsBrains: ['asic', 'eda', 'project'],
  },
  planner: {
    role: 'strategist',
    description: 'Creates execution strategies',
    responsibilities: ['stage_planning', 'recipe_selection'],
  },
  executor: {
    role: 'operator',
    description: 'ONLY agent that controls EDA pane via MCP',
    responsibilities: ['tcl_execution', 'tool_control', 'output_monitoring'],
    controlsEDA: true,
  },
  archivist: {
    role: 'recorder',
    description: 'Records QoR metrics to Project-Brain',
    responsibilities: ['qor_tracking', 'pattern_recording'],
  },
};

/**
 * Get agent preamble for Team.spawn
 */
function getAgentPreamble(agentName, agentConfig) {
  const isExecutor = agentName === 'executor';
  const isSupervisor = agentName === 'supervisor';

  return `You are a TEAM WORKER in team "hipilot-team". Your name is "${agentName}".
You report to the team lead ("supervisor").

== YOUR IDENTITY ==
Name: ${agentName}
Role: ${agentConfig.role}
Description: ${agentConfig.description}
Responsibilities: ${agentConfig.responsibilities.join(', ')}

== EXTERNAL INPUT RULE ==
${isSupervisor ? `
**YOU ARE THE SUPERVISOR - EXTERNAL INTERFACE**
- HiTestBot and human engineers interact ONLY with you (Pane 0)
- You receive all external input and commands
- You delegate work to other agents via SendMessage
- You coordinate the overall workflow
` : `
**NO EXTERNAL INPUT - SUPERVISOR ONLY**
- HiTestBot and humans NEVER interact with you directly
- You ONLY receive instructions from Supervisor via SendMessage
- You report results back to Supervisor via SendMessage
- Do NOT wait for human input - wait for Supervisor messages only
`}

== CRITICAL RULES ==
${isExecutor ? `
**YOU ARE THE EXECUTOR - ONLY YOU CONTROL THE EDA PANE**
- You have exclusive access to MCP tools (eda.*, tmux.*)
- Supervisor and other agents send you SendMessage requests to execute Tcl
- Use eda.execute_and_verify() to run commands in the EDA pane
- Report results back via SendMessage to Supervisor
` : `
**YOU NEVER CONTROL THE EDA PANE DIRECTLY**
- You do NOT have access to eda.* MCP tools
- To execute Tcl, ask Supervisor to route to Executor via SendMessage:
  {
    "type": "execute_tcl",
    "tcl": "your command",
    "description": "what this does",
    "requester": "${agentName}"
  }
- Wait for Supervisor to coordinate and Executor to complete
`}

== COMMUNICATION PROTOCOL ==
All communication goes through SendMessage:
${isSupervisor ? `
**As Supervisor, you:**
- Receive ALL external input (HiTestBot, human commands)
- Send tasks to agents: knowledge, planner, executor, archivist
- Receive results from agents
- Coordinate the workflow
- Report final results to external (HiTestBot/human)
` : `
**As ${agentName}, you:**
- ONLY receive messages from Supervisor
- Do your assigned work
- Report results back to Supervisor
- NEVER interact directly with external users
`}

**Message Types:**
1. query_brain - Ask knowledge agent for information
   { "type": "query_brain", "brain": "eda", "query": "floorplan" }

2. execute_tcl - Ask executor to run command (only if not executor)
   { "type": "execute_tcl", "tcl": "...", "description": "..." }

3. tcl_complete - Executor reports completion
   { "type": "tcl_complete", "success": true, "output": "..." }

4. report_status - Update on your progress
   { "type": "report_status", "status": "working", "progress": 50 }

5. request_approval - Ask supervisor for approval
   { "type": "request_approval", "phase": "floorplan", "evidence": {...} }

**Recipients:**
- "supervisor" - Team lead, coordinator
- "knowledge" - Brain queries
- "planner" - Strategy requests
- "executor" - Tcl execution (ONLY if you're not executor)
- "archivist" - Recording data

== WORKFLOW ==
1. Read your inbox for assigned tasks
2. Do your work (query brains, plan, etc.)
3. Send results via SendMessage to requester
4. If you need EDA execution, SendMessage to executor
5. Wait for executor response before continuing

== RULES ==
- NEVER use MCP tools unless you are executor
- ALWAYS use SendMessage for communication
- ALWAYS include your agent name in messages
- ALWAYS respond to messages within 30 seconds
- When done with task, report completion to supervisor
`;
}

/**
 * TeamCoordinator class - manages team lifecycle
 */
export class TeamCoordinator {
  constructor(options = {}) {
    this.teamName = options.teamName || 'hipilot-team';
    this.teamDir = join('/tmp', 'hipilot-team', Date.now().toString());
    this.agents = new Map();
    this.messageQueue = [];
    this.isActive = false;
    this.supervisor = null; // Reference to HiPilot
  }

  /**
   * Initialize team - create configurations for all agents
   */
  async initialize() {
    console.log('[TeamCoordinator] Initializing team coordination...');
    console.log('[TeamCoordinator] Supervisor (HiPilot) is Team Lead');

    mkdirSync(this.teamDir, { recursive: true });
    mkdirSync(join(this.teamDir, 'messages'), { recursive: true });

    // Create agent configurations
    for (const [name, config] of Object.entries(AGENT_CONFIGS)) {
      this.agents.set(name, {
        name,
        ...config,
        preamble: getAgentPreamble(name, config),
        status: 'ready',
        inbox: [],
      });

      // Save agent config
      mkdirSync(join(this.teamDir, 'agents', name), { recursive: true });
      writeFileSync(
        join(this.teamDir, 'agents', name, 'config.json'),
        JSON.stringify({
          name,
          ...config,
          preamble: getAgentPreamble(name, config),
        }, null, 2)
      );
    }

    this.isActive = true;

    console.log('[TeamCoordinator] Team ready for activation');
    console.log('[TeamCoordinator] Agents:', Array.from(this.agents.keys()).join(', '));

    return {
      success: true,
      teamName: this.teamName,
      teamDir: this.teamDir,
      agents: Array.from(this.agents.keys()),
    };
  }

  /**
   * Get spawn configuration for an agent
   * Use this with Agent.spawn()
   */
  getAgentSpawnConfig(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) return null;

    return {
      name: agentName,
      teamName: this.teamName,
      preamble: agent.preamble,
      role: agent.role,
    };
  }

  /**
   * Handle incoming SendMessage from an agent
   */
  async handleMessage(from, message) {
    console.log(`[TeamCoordinator] Message from ${from}: ${message.type}`);

    const timestamp = Date.now();
    const entry = { from, message, timestamp };
    this.messageQueue.push(entry);

    // Route message based on type and recipient
    switch (message.type) {
      case 'query_brain':
        return await this._routeToKnowledge(from, message);

      case 'execute_tcl':
        return await this._routeToExecutor(from, message);

      case 'tcl_complete':
        return await this._routeToRequester(from, message);

      case 'request_approval':
        return await this._routeToSupervisor(from, message);

      case 'report_status':
        return await this._broadcastStatus(from, message);

      case 'record_data':
        return await this._routeToArchivist(from, message);

      default:
        console.log(`[TeamCoordinator] Unknown message type: ${message.type}`);
        return { error: 'Unknown message type' };
    }
  }

  /**
   * Route brain query to Knowledge agent
   */
  async _routeToKnowledge(from, message) {
    console.log(`[TeamCoordinator] Routing brain query from ${from} to knowledge`);

    // Knowledge agent handles the query
    // In actual implementation, this would SendMessage to knowledge agent
    return {
      success: true,
      routedTo: 'knowledge',
      from,
      query: message.query,
    };
  }

  /**
   * Route Tcl execution to Executor agent
   */
  async _routeToExecutor(from, message) {
    console.log(`[TeamCoordinator] Routing Tcl execution from ${from} to executor`);

    if (from === 'executor') {
      return { error: 'Executor cannot send execute_tcl to itself' };
    }

    // Executor handles the execution
    // In actual implementation, this would SendMessage to executor agent
    return {
      success: true,
      routedTo: 'executor',
      from,
      tcl: message.tcl,
    };
  }

  /**
   * Route completion back to original requester
   */
  async _routeToRequester(from, message) {
    console.log(`[TeamCoordinator] Routing completion from executor to ${message.requester}`);

    // Route back to the agent that requested execution
    return {
      success: true,
      routedTo: message.requester || 'supervisor',
      from: 'executor',
      result: message.result,
    };
  }

  /**
   * Route approval request to Supervisor
   */
  async _routeToSupervisor(from, message) {
    console.log(`[TeamCoordinator] Routing approval request from ${from} to supervisor`);

    // Supervisor validates and approves
    return {
      success: true,
      routedTo: 'supervisor',
      from,
      phase: message.phase,
    };
  }

  /**
   * Broadcast status update to all agents
   */
  async _broadcastStatus(from, message) {
    console.log(`[TeamCoordinator] Broadcasting status from ${from}`);

    // Update agent status
    const agent = this.agents.get(from);
    if (agent) {
      agent.status = message.status;
      agent.progress = message.progress;
      agent.lastUpdate = Date.now();
    }

    return {
      success: true,
      broadcast: true,
      from,
      status: message.status,
    };
  }

  /**
   * Route data recording to Archivist
   */
  async _routeToArchivist(from, message) {
    console.log(`[TeamCoordinator] Routing data from ${from} to archivist`);

    // Archivist records the data
    return {
      success: true,
      routedTo: 'archivist',
      from,
      data: message.data,
    };
  }

  /**
   * Get team status
   */
  getStatus() {
    return {
      teamName: this.teamName,
      isActive: this.isActive,
      teamDir: this.teamDir,
      agents: Array.from(this.agents.values()).map(a => ({
        name: a.name,
        role: a.role,
        status: a.status,
        progress: a.progress,
      })),
      messageQueueLength: this.messageQueue.length,
    };
  }

  /**
   * Shutdown team
   */
  async shutdown() {
    console.log('[TeamCoordinator] Shutting down team...');
    this.isActive = false;

    writeFileSync(
      join(this.teamDir, 'final_status.json'),
      JSON.stringify(this.getStatus(), null, 2)
    );

    return { success: true };
  }
}

/**
 * Factory function
 */
export function createTeamCoordinator(options = {}) {
  return new TeamCoordinator(options);
}

export default {
  TeamCoordinator,
  createTeamCoordinator,
  AGENT_CONFIGS,
};
