/**
 * TeamManager — Multi-Agent Coordination for HiPilot
 *
 * HiPilot acts as the Team Lead. It:
 *   1. Spawns 5 specialized agents (Supervisor, Knowledge, Planner, Executor, Archivist)
 *   2. Receives messages from agents via SendMessage
 *   3. Controls the SINGLE EDA pane exclusively
 *   4. Coordinates agent workflow via hub-and-spoke pattern
 *
 * Agents NEVER touch the EDA pane directly. They:
 *   - Request actions from HiPilot via SendMessage
 *   - Query the 3-Brain system via HiPilot
 *   - Report status and results to HiPilot
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class TeamManager {
  constructor(options = {}) {
    this.teamName = options.teamName || 'hipilot-team';
    this.socket = options.socket || 'hipilot';
    this.session = options.session || 'hipilot';
    this.isTeamLead = true;
    this.agents = new Map();
    this.currentPhase = 'idle';
    this.phaseStatus = {};
    this.coordinator = options.coordinator; // Reference to HiPilot coordinator

    // Agent registry configuration
    this.AGENT_REGISTRY = {
      supervisor: {
        role: 'coordinator',
        description: 'Validates prerequisites and coordinates phase execution',
        brains: ['asic', 'eda', 'project'],
        canApprove: true,
      },
      knowledge: {
        role: 'expert',
        description: 'Queries EDA-Brain for tool/library information',
        brains: ['eda'],
        canApprove: false,
      },
      planner: {
        role: 'strategist',
        description: 'Creates execution plans for RTL2GDS stages',
        brains: ['asic', 'project'],
        canApprove: false,
      },
      executor: {
        role: 'operator',
        description: 'Executes Tcl commands through HiPilot',
        brains: ['asic', 'eda'],
        canApprove: false,
      },
      archivist: {
        role: 'recorder',
        description: 'Records QoR metrics and updates Project-Brain',
        brains: ['project'],
        canApprove: false,
      },
    };
  }

  /**
   * Initialize team mode - spawn all 5 agents
   */
  async initialize() {
    console.log('[TeamManager] Initializing HiPilot Team Mode...');
    console.log('[TeamManager] HiPilot is Team Lead - exclusive EDA pane control');

    // Set team mode flag
    this.currentPhase = 'initializing';

    // Create team directory for evidence
    const teamDir = join('/tmp', 'hipilot-team', Date.now().toString());
    mkdirSync(teamDir, { recursive: true });
    this.teamDir = teamDir;

    // Log team configuration
    writeFileSync(
      join(teamDir, 'team_config.json'),
      JSON.stringify({
        teamName: this.teamName,
        lead: 'hipilot',
        agents: Object.keys(this.AGENT_REGISTRY),
        createdAt: new Date().toISOString(),
      }, null, 2)
    );

    console.log('[TeamManager] Team config saved to:', teamDir);
    console.log('[TeamManager] Agents registered:', Object.keys(this.AGENT_REGISTRY).join(', '));

    return { success: true, teamDir };
  }

  /**
   * Handle incoming message from an agent
   * This is called when an agent sends a message via SendMessage
   */
  async handleAgentMessage(agentName, message) {
    console.log(`[TeamManager] Message from ${agentName}:`, message.type || 'unknown');

    switch (message.type) {
      case 'query_brain':
        return await this._handleBrainQuery(agentName, message);

      case 'execute_tcl':
        return await this._handleTclExecution(agentName, message);

      case 'request_approval':
        return await this._handleApprovalRequest(agentName, message);

      case 'report_status':
        return await this._handleStatusReport(agentName, message);

      case 'phase_complete':
        return await this._handlePhaseComplete(agentName, message);

      default:
        console.log(`[TeamManager] Unknown message type from ${agentName}:`, message.type);
        return { error: 'Unknown message type' };
    }
  }

  /**
   * Handle brain query from agent
   * Agents ask HiPilot to query the 3-Brain system
   */
  async _handleBrainQuery(agentName, message) {
    const { brain, query } = message;
    console.log(`[TeamManager] ${agentName} querying ${brain}-brain: ${query}`);

    // Validate agent can use this brain
    const agent = this.AGENT_REGISTRY[agentName];
    if (!agent || !agent.brains.includes(brain)) {
      return {
        error: `Agent ${agentName} not authorized for ${brain}-brain`,
        allowed: agent?.brains || [],
      };
    }

    // HiPilot queries the brain on behalf of the agent
    // This keeps all MCP calls centralized through HiPilot
    try {
      const result = await this.coordinator.queryBrain(brain, query);
      return { success: true, result };
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * Handle Tcl execution request from agent
   * Agents request Tcl execution - HiPilot executes exclusively
   */
  async _handleTclExecution(agentName, message) {
    const { tcl, description, stage } = message;
    console.log(`[TeamManager] ${agentName} requesting Tcl execution: ${description}`);

    // Only executor agent can request Tcl execution
    if (agentName !== 'executor') {
      return {
        error: `Agent ${agentName} cannot execute Tcl. Only 'executor' agent has this permission.`,
      };
    }

    // HiPilot executes the Tcl through its exclusive EDA pane control
    try {
      const result = await this.coordinator.executeTcl(tcl, description, stage);
      return { success: true, result };
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * Handle approval request
   * Agents request approval for phase completion
   */
  async _handleApprovalRequest(agentName, message) {
    const { phase, evidence } = message;
    console.log(`[TeamManager] ${agentName} requesting approval for ${phase}`);

    // Only supervisor can request approvals
    if (agentName !== 'supervisor') {
      return {
        error: `Agent ${agentName} cannot request approvals. Only 'supervisor' agent has this permission.`,
      };
    }

    // HiPilot validates the approval request
    const validation = await this._validatePhaseCompletion(phase, evidence);

    if (validation.valid) {
      this.phaseStatus[phase] = 'approved';
      return { success: true, approved: true, validation };
    } else {
      return { success: false, approved: false, validation };
    }
  }

  /**
   * Validate phase completion using anti-cheat rules
   */
  async _validatePhaseCompletion(phase, evidence) {
    console.log(`[TeamManager] Validating ${phase} completion...`);

    // Check required evidence
    const required = ['eda_pane_log', 'claude_pane_log', 'duration'];
    const missing = required.filter(r => !evidence[r]);

    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing required evidence: ${missing.join(', ')}`,
      };
    }

    // Check minimum duration
    const minDuration = this._getMinDurationForPhase(phase);
    if (evidence.duration < minDuration) {
      return {
        valid: false,
        reason: `Duration too short: ${evidence.duration}s (minimum: ${minDuration}s)`,
      };
    }

    // Check EDA pane activity
    if (!evidence.eda_activity || evidence.eda_activity.changes < 3) {
      return {
        valid: false,
        reason: `Insufficient EDA pane activity: ${evidence.eda_activity?.changes || 0} changes (need 3+)`,
      };
    }

    return { valid: true, checks: ['duration', 'activity', 'evidence'] };
  }

  /**
   * Get minimum duration for phase (anti-cheat)
   */
  _getMinDurationForPhase(phase) {
    const durations = {
      'phase0': 300,    // 5 min - Environment setup
      'phase1': 600,    // 10 min - 3-Brain system
      'phase2': 600,    // 10 min - Agent registry
      'phase3': 900,    // 15 min - Agent skills
      'phase4': 600,    // 10 min - Mission pack
      'phase5': 600,    // 10 min - Coordination
      'phase6': 1800,   // 30 min - Synthesis
      'phase7': 1800,   // 30 min - Self-improvement
      'phase8': 3600,   // 60 min - Full flow
    };
    return durations[phase] || 300;
  }

  /**
   * Handle status report from agent
   */
  async _handleStatusReport(agentName, message) {
    const { status, progress, detail } = message;
    console.log(`[TeamManager] Status from ${agentName}: ${status} (${progress}%)`);

    this.agents.set(agentName, {
      ...this.agents.get(agentName),
      status,
      progress,
      detail,
      lastUpdate: Date.now(),
    });

    return { success: true };
  }

  /**
   * Handle phase completion report
   */
  async _handlePhaseComplete(agentName, message) {
    const { phase, result, evidence } = message;
    console.log(`[TeamManager] ${agentName} reports ${phase} complete`);

    // Save phase evidence
    const phaseDir = join(this.teamDir, phase);
    mkdirSync(phaseDir, { recursive: true });

    writeFileSync(
      join(phaseDir, 'result.json'),
      JSON.stringify({ agent: agentName, result, completedAt: new Date().toISOString() }, null, 2)
    );

    if (evidence) {
      writeFileSync(join(phaseDir, 'evidence.json'), JSON.stringify(evidence, null, 2));
    }

    return { success: true, phase, status: 'recorded' };
  }

  /**
   * Broadcast message to all agents
   */
  async broadcastToAgents(message) {
    console.log('[TeamManager] Broadcasting to all agents:', message.type || message);
    // This would use SendMessage to broadcast
    // Implementation depends on Team API
  }

  /**
   * Get current team status
   */
  getStatus() {
    return {
      teamName: this.teamName,
      currentPhase: this.currentPhase,
      phaseStatus: this.phaseStatus,
      agents: Object.fromEntries(this.agents),
      isTeamLead: this.isTeamLead,
    };
  }

  /**
   * Shutdown team mode
   */
  async shutdown() {
    console.log('[TeamManager] Shutting down team mode...');
    this.currentPhase = 'shutdown';

    // Save final team state
    writeFileSync(
      join(this.teamDir, 'final_status.json'),
      JSON.stringify(this.getStatus(), null, 2)
    );

    return { success: true };
  }
}
