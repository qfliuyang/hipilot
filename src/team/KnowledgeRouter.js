/**
 * KnowledgeRouter - Routes messages through Knowledge Agent (hub-and-spoke)
 *
 * ALL inter-agent communication goes through Knowledge Agent.
 * Knowledge delegates to appropriate agent based on message type.
 *
 * Message Flow:
 *   Supervisor -> Knowledge (delegate_execution) -> Executor (execute_stage)
 *   Executor -> Knowledge (execution_result) -> Archivist (record_qor) + Supervisor (stage_complete)
 */

export const MESSAGE_TYPES = {
  // Supervisor -> Knowledge -> Executor
  DELEGATE_EXECUTION: 'delegate_execution',

  // Knowledge -> Executor
  EXECUTE_STAGE: 'execute_stage',

  // Executor -> Knowledge
  EXECUTION_RESULT: 'execution_result',

  // Knowledge -> Archivist
  RECORD_QOR: 'record_qor',

  // Knowledge -> Supervisor
  STAGE_COMPLETE: 'stage_complete',

  // Any agent -> Knowledge (brain query)
  QUERY_BRAIN: 'query_brain',

  // Knowledge response
  BRAIN_RESPONSE: 'brain_response',

  // Supervisor -> Knowledge -> Planner
  GET_STRATEGY: 'get_strategy',

  // Knowledge -> Planner
  CREATE_STRATEGY: 'create_strategy',

  // Error handling
  ERROR: 'error',
};

export const AGENT_NAMES = {
  SUPERVISOR: 'supervisor',
  KNOWLEDGE: 'knowledge',
  PLANNER: 'planner',
  EXECUTOR: 'executor',
  ARCHIVIST: 'archivist',
};

/**
 * KnowledgeRouter - Central message routing for hub-and-spoke architecture
 */
export class KnowledgeRouter {
  constructor(options = {}) {
    this.messageLog = [];
    this.maxLogSize = options.maxLogSize || 1000;
    this.designDir = options.designDir || process.env.HIPILOT_DESIGN_DIR;
    this.designName = options.designName || process.env.HIPILOT_DESIGN_NAME;
  }

  /**
   * Route message to appropriate handler(s)
   * @param {object} message - {type, from, payload}
   * @returns {object|array} - Single route or array of routes
   */
  route(message) {
    this.log(message);

    switch (message.type) {
      case MESSAGE_TYPES.DELEGATE_EXECUTION:
        // Supervisor -> Knowledge -> Executor
        return this._routeDelegateExecution(message);

      case MESSAGE_TYPES.EXECUTION_RESULT:
        // Executor -> Knowledge -> Archivist + Supervisor
        return this._routeExecutionResult(message);

      case MESSAGE_TYPES.QUERY_BRAIN:
        // Any agent -> Knowledge (internal handling)
        return this._routeBrainQuery(message);

      case MESSAGE_TYPES.GET_STRATEGY:
        // Supervisor -> Knowledge -> Planner
        return this._routeGetStrategy(message);

      case MESSAGE_TYPES.EXECUTE_STAGE:
      case MESSAGE_TYPES.RECORD_QOR:
      case MESSAGE_TYPES.STAGE_COMPLETE:
      case MESSAGE_TYPES.CREATE_STRATEGY:
      case MESSAGE_TYPES.BRAIN_RESPONSE:
        // These are target messages, just route to destination
        return this._routeDirect(message);

      default:
        return {
          to: AGENT_NAMES.SUPERVISOR,
          message: {
            type: MESSAGE_TYPES.ERROR,
            error: `Unknown message type: ${message.type}`,
            originalMessage: message,
          },
        };
    }
  }

  /**
   * Route delegate_execution: Supervisor -> Knowledge -> Executor
   */
  _routeDelegateExecution(message) {
    const { targetAgent, stage, tool, tcl, timeout, ...rest } = message.payload || {};

    // Validate required fields
    if (!stage) {
      return {
        to: AGENT_NAMES.SUPERVISOR,
        message: {
          type: MESSAGE_TYPES.ERROR,
          error: 'delegate_execution requires stage in payload',
        },
      };
    }

    // Determine target agent (default to executor for EDA operations)
    const target = targetAgent || AGENT_NAMES.EXECUTOR;

    return {
      to: target,
      message: {
        type: MESSAGE_TYPES.EXECUTE_STAGE,
        stage,
        tool: tool || this._getToolForStage(stage),
        designDir: rest.designDir || this.designDir,
        designName: rest.designName || this.designName,
        tcl,
        timeout: timeout || this._getTimeoutForStage(stage),
      },
    };
  }

  /**
   * Route execution_result: Executor -> Knowledge -> Archivist + Supervisor
   * Returns array of messages to send
   */
  _routeExecutionResult(message) {
    const { stage, success, metrics, error } = message.payload || {};

    const messages = [];

    // Always notify Archivist for QoR recording
    if (metrics) {
      messages.push({
        to: AGENT_NAMES.ARCHIVIST,
        message: {
          type: MESSAGE_TYPES.RECORD_QOR,
          stage,
          metrics,
        },
      });
    }

    // Notify Supervisor of completion
    messages.push({
      to: AGENT_NAMES.SUPERVISOR,
      message: {
        type: MESSAGE_TYPES.STAGE_COMPLETE,
        stage,
        success,
        metrics,
        error,
      },
    });

    return messages;
  }

  /**
   * Route brain query: handled internally by Knowledge
   */
  _routeBrainQuery(message) {
    const { brain, query, replyTo } = message.payload || {};

    return {
      to: replyTo || AGENT_NAMES.SUPERVISOR,
      message: {
        type: MESSAGE_TYPES.BRAIN_RESPONSE,
        query,
        result: this._queryBrain(brain, query),
      },
    };
  }

  /**
   * Route get_strategy: Supervisor -> Knowledge -> Planner
   */
  _routeGetStrategy(message) {
    const { stage, context } = message.payload || {};

    return {
      to: AGENT_NAMES.PLANNER,
      message: {
        type: MESSAGE_TYPES.CREATE_STRATEGY,
        stage,
        context,
      },
    };
  }

  /**
   * Direct route to destination
   */
  _routeDirect(message) {
    return {
      to: message.to || AGENT_NAMES.SUPERVISOR,
      message: message.payload || message,
    };
  }

  /**
   * Query the appropriate brain
   */
  _queryBrain(brain, query) {
    // Brain types: 'asic', 'eda', 'project'
    return {
      brain: brain || 'asic',
      query,
      timestamp: Date.now(),
      // In production, this would query the actual brain system
    };
  }

  /**
   * Get tool for a given stage
   */
  _getToolForStage(stage) {
    const stageToolMap = {
      synthesis: 'dc_shell',
      design_init: 'innovus',
      floorplan: 'innovus',
      powerplan: 'innovus',
      placement: 'innovus',
      cts: 'innovus',
      postcts_opt: 'innovus',
      routing: 'innovus',
      routeopt: 'innovus',
      chip_finish: 'innovus',
    };
    return stageToolMap[stage] || 'innovus';
  }

  /**
   * Get default timeout for a stage (in seconds)
   */
  _getTimeoutForStage(stage) {
    const stageTimeoutMap = {
      synthesis: 1800,    // 30 min
      design_init: 300,   // 5 min
      floorplan: 300,     // 5 min
      powerplan: 300,     // 5 min
      placement: 600,     // 10 min
      cts: 600,           // 10 min
      postcts_opt: 600,   // 10 min
      routing: 1200,      // 20 min
      routeopt: 600,      // 10 min
      chip_finish: 300,   // 5 min
    };
    return stageTimeoutMap[stage] || 600;
  }

  /**
   * Log a message for audit trail
   */
  log(message) {
    this.messageLog.push({
      timestamp: Date.now(),
      isoTimestamp: new Date().toISOString(),
      ...message,
    });

    // Trim log if too large
    if (this.messageLog.length > this.maxLogSize) {
      this.messageLog = this.messageLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Get message log for verification
   */
  getMessageLog() {
    return [...this.messageLog];
  }

  /**
   * Clear message log
   */
  clearLog() {
    this.messageLog = [];
  }

  /**
   * Get statistics about message routing
   */
  getStats() {
    const stats = {
      totalMessages: this.messageLog.length,
      byType: {},
      byFrom: {},
      errors: 0,
    };

    for (const msg of this.messageLog) {
      // Count by type
      const type = msg.type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count by source
      const from = msg.from || 'unknown';
      stats.byFrom[from] = (stats.byFrom[from] || 0) + 1;

      // Count errors
      if (msg.type === MESSAGE_TYPES.ERROR || msg.error) {
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Verify hub-and-spoke compliance
   * Returns true if all messages follow the expected patterns
   */
  verifyHubAndSpokeCompliance() {
    const violations = [];

    // Expected patterns:
    // 1. Supervisor -> Knowledge (delegate_*)
    // 2. Knowledge -> Executor/Planner/Archivist
    // 3. Executor -> Knowledge (execution_result)
    // 4. Knowledge -> Supervisor (stage_complete)

    for (const msg of this.messageLog) {
      const { from, type } = msg;

      // Supervisor should only send to Knowledge
      if (from === AGENT_NAMES.SUPERVISOR) {
        if (![MESSAGE_TYPES.DELEGATE_EXECUTION, MESSAGE_TYPES.QUERY_BRAIN, MESSAGE_TYPES.GET_STRATEGY].includes(type)) {
          violations.push({
            message: `Supervisor sent unexpected message type: ${type}`,
            timestamp: msg.timestamp,
          });
        }
      }

      // Executor should only send results to Knowledge
      if (from === AGENT_NAMES.EXECUTOR) {
        if (type !== MESSAGE_TYPES.EXECUTION_RESULT) {
          violations.push({
            message: `Executor sent unexpected message type: ${type}`,
            timestamp: msg.timestamp,
          });
        }
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }
}

/**
 * Factory function
 */
export function createKnowledgeRouter(options = {}) {
  return new KnowledgeRouter(options);
}

export default {
  KnowledgeRouter,
  createKnowledgeRouter,
  MESSAGE_TYPES,
  AGENT_NAMES,
};
