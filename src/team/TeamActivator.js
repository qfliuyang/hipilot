/**
 * TeamActivator — Activates HiPilot Team Mode using Claude Code Native Team API
 *
 * This module enables HiPilot to act as Team Lead, spawning 5 specialized agents
 * that communicate via SendMessage. HiPilot maintains exclusive control of the
 * EDA pane - agents request actions, HiPilot executes.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const AGENT_REGISTRY = {
  supervisor: {
    role: 'coordinator',
    description: 'Validates prerequisites and coordinates phase execution',
    responsibilities: ['prerequisite_check', 'phase_validation', 'approval'],
    canApprove: true,
  },
  knowledge: {
    role: 'expert',
    description: 'Central brain interface - queries ASIC/EDA/Project brains',
    responsibilities: ['brain_query', 'tcl_generation', 'output_parsing'],
    ownsBrains: ['asic', 'eda', 'project'],
  },
  planner: {
    role: 'strategist',
    description: 'Creates execution plans by querying Knowledge Agent',
    responsibilities: ['stage_planning', 'recipe_selection', 'strategy'],
  },
  executor: {
    role: 'operator',
    description: 'Requests Tcl from Knowledge, asks HiPilot to execute via MCP',
    responsibilities: ['tcl_execution_request', 'monitoring'],
    canRequestExecution: true,
  },
  archivist: {
    role: 'recorder',
    description: 'Records QoR metrics and learnings to Project-Brain',
    responsibilities: ['qor_tracking', 'pattern_recording', 'history'],
  },
};

/**
 * Get agent preamble for Team.spawn
 * This tells the agent how to behave as a team worker
 */
function getAgentPreamble(agentName, agentConfig) {
  return `You are a TEAM WORKER in team "hipilot-team". Your name is "${agentName}".
You report to the team lead ("hipilot" / "team-lead").

== YOUR ROLE ==
Name: ${agentName}
Role: ${agentConfig.role}
Description: ${agentConfig.description}
Responsibilities: ${agentConfig.responsibilities.join(', ')}

== CRITICAL RULES ==
1. You NEVER touch the EDA pane directly - only HiPilot (team-lead) controls it
2. You communicate with HiPilot via SendMessage with type "message"
3. You request actions; HiPilot executes them
4. You use these message types:
   - "query_brain" - Ask HiPilot to query ASIC/EDA/Project brains
   - "execute_tcl" - Ask HiPilot to execute Tcl in EDA pane (executor only)
   - "request_approval" - Ask supervisor to approve phase completion (supervisor only)
   - "report_status" - Update HiPilot on your progress
   - "phase_complete" - Report phase completion with evidence

== WORK PROTOCOL ==
1. CLAIM: Call TaskList to see your assigned tasks
2. WORK: Execute by sending messages to team-lead via SendMessage
3. COMPLETE: Mark task completed with TaskUpdate
4. REPORT: Notify team-lead of status via SendMessage
5. SHUTDOWN: When receiving shutdown_request, respond with shutdown_response(approve: true)

== ANTI-CHEAT ==
All phase completions require:
- EDA pane activity (3+ content changes over time)
- Active EDA process running
- Minimum duration met
- Evidence: pane logs + duration

You are part of HiPilot's multi-agent coordination system for EDA workflows.`;
}

/**
 * TeamActivator class - manages team lifecycle
 */
export class TeamActivator {
  constructor(options = {}) {
    this.teamName = options.teamName || 'hipilot-team';
    this.teamDir = join('/tmp', 'hipilot-team', Date.now().toString());
    this.agents = new Map();
    this.isActive = false;
  }

  /**
   * Activate team mode - create team and spawn agents
   * This uses Claude Code's native Team API
   */
  async activate() {
    console.log('[TeamActivator] Activating HiPilot Team Mode...');
    console.log('[TeamActivator] HiPilot will be Team Lead');

    // Create team directory
    mkdirSync(this.teamDir, { recursive: true });

    // Save team configuration
    writeFileSync(
      join(this.teamDir, 'team_config.json'),
      JSON.stringify({
        teamName: this.teamName,
        lead: 'hipilot',
        agents: Object.keys(AGENT_REGISTRY),
        activatedAt: new Date().toISOString(),
      }, null, 2)
    );

    // Create agent configurations
    for (const [name, config] of Object.entries(AGENT_REGISTRY)) {
      this.agents.set(name, {
        name,
        ...config,
        preamble: getAgentPreamble(name, config),
        status: 'ready',
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

    console.log('[TeamActivator] Team configuration saved');
    console.log('[TeamActivator] Agents ready:', Array.from(this.agents.keys()).join(', '));
    console.log('[TeamActivator] To spawn agents, use TeamCreate API');

    return {
      success: true,
      teamName: this.teamName,
      teamDir: this.teamDir,
      agents: Array.from(this.agents.keys()),
      instructions: 'Use TeamCreate to spawn agents, then TaskCreate for assignments',
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
      })),
    };
  }

  /**
   * Get agent preamble for spawning
   */
  getAgentPreamble(agentName) {
    const agent = this.agents.get(agentName);
    return agent ? agent.preamble : null;
  }

  /**
   * Shutdown team
   */
  async shutdown() {
    console.log('[TeamActivator] Shutting down team...');
    this.isActive = false;

    // Save final status
    writeFileSync(
      join(this.teamDir, 'final_status.json'),
      JSON.stringify(this.getStatus(), null, 2)
    );

    return { success: true };
  }
}

/**
 * Factory function to create activator
 */
export function createTeamActivator(options = {}) {
  return new TeamActivator(options);
}

/**
 * Get agent registry (for external use)
 */
export function getAgentRegistry() {
  return AGENT_REGISTRY;
}

export default {
  TeamActivator,
  createTeamActivator,
  getAgentRegistry,
  AGENT_REGISTRY,
};
