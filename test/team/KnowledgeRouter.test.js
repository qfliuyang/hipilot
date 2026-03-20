/**
 * KnowledgeRouter Unit Tests
 *
 * Tests for hub-and-spoke message routing through Knowledge Agent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeRouter, MESSAGE_TYPES, AGENT_NAMES } from '../../src/team/KnowledgeRouter.js';

describe('KnowledgeRouter', () => {
  let router;

  beforeEach(() => {
    router = new KnowledgeRouter({
      designDir: '/test/design',
      designName: 'test_design',
    });
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      const defaultRouter = new KnowledgeRouter();
      expect(defaultRouter.messageLog).toEqual([]);
      expect(defaultRouter.maxLogSize).toBe(1000);
    });

    it('should accept custom options', () => {
      const customRouter = new KnowledgeRouter({
        designDir: '/custom/path',
        designName: 'custom_design',
        maxLogSize: 500,
      });
      expect(customRouter.designDir).toBe('/custom/path');
      expect(customRouter.designName).toBe('custom_design');
      expect(customRouter.maxLogSize).toBe(500);
    });
  });

  describe('Message Routing', () => {
    describe('delegate_execution', () => {
      it('should route delegate_execution to Executor', () => {
        const result = router.route({
          type: MESSAGE_TYPES.DELEGATE_EXECUTION,
          from: AGENT_NAMES.SUPERVISOR,
          payload: {
            stage: 'synthesis',
            tool: 'dc_shell',
          },
        });

        expect(result.to).toBe(AGENT_NAMES.EXECUTOR);
        expect(result.message.type).toBe(MESSAGE_TYPES.EXECUTE_STAGE);
        expect(result.message.stage).toBe('synthesis');
        expect(result.message.tool).toBe('dc_shell');
      });

      it('should infer tool from stage if not provided', () => {
        const result = router.route({
          type: MESSAGE_TYPES.DELEGATE_EXECUTION,
          from: AGENT_NAMES.SUPERVISOR,
          payload: {
            stage: 'synthesis',
          },
        });

        expect(result.message.tool).toBe('dc_shell');
      });

      it('should use innovus for P&R stages', () => {
        const stages = ['floorplan', 'placement', 'cts', 'routing'];
        for (const stage of stages) {
          const result = router.route({
            type: MESSAGE_TYPES.DELEGATE_EXECUTION,
            from: AGENT_NAMES.SUPERVISOR,
            payload: { stage },
          });
          expect(result.message.tool).toBe('innovus');
        }
      });

      it('should error if stage is missing', () => {
        const result = router.route({
          type: MESSAGE_TYPES.DELEGATE_EXECUTION,
          from: AGENT_NAMES.SUPERVISOR,
          payload: {},
        });

        expect(result.to).toBe(AGENT_NAMES.SUPERVISOR);
        expect(result.message.type).toBe(MESSAGE_TYPES.ERROR);
      });
    });

    describe('execution_result', () => {
      it('should route execution_result to Archivist and Supervisor', () => {
        const results = router.route({
          type: MESSAGE_TYPES.EXECUTION_RESULT,
          from: AGENT_NAMES.EXECUTOR,
          payload: {
            stage: 'synthesis',
            success: true,
            metrics: { wns: 0.0, tns: 0.0 },
          },
        });

        expect(Array.isArray(results)).toBe(true);
        expect(results).toHaveLength(2);

        // First should be to Archivist
        expect(results[0].to).toBe(AGENT_NAMES.ARCHIVIST);
        expect(results[0].message.type).toBe(MESSAGE_TYPES.RECORD_QOR);

        // Second should be to Supervisor
        expect(results[1].to).toBe(AGENT_NAMES.SUPERVISOR);
        expect(results[1].message.type).toBe(MESSAGE_TYPES.STAGE_COMPLETE);
      });

      it('should not route to Archivist if no metrics', () => {
        const results = router.route({
          type: MESSAGE_TYPES.EXECUTION_RESULT,
          from: AGENT_NAMES.EXECUTOR,
          payload: {
            stage: 'synthesis',
            success: true,
          },
        });

        // Should only route to Supervisor
        const archivistRoute = results.find(r => r.to === AGENT_NAMES.ARCHIVIST);
        expect(archivistRoute).toBeUndefined();
      });
    });

    describe('query_brain', () => {
      it('should handle brain queries', () => {
        const result = router.route({
          type: MESSAGE_TYPES.QUERY_BRAIN,
          from: AGENT_NAMES.SUPERVISOR,
          payload: {
            brain: 'asic',
            query: 'What is CTS?',
          },
        });

        expect(result.message.type).toBe(MESSAGE_TYPES.BRAIN_RESPONSE);
        expect(result.message.query).toBe('What is CTS?');
      });

      it('should reply to the sender', () => {
        const result = router.route({
          type: MESSAGE_TYPES.QUERY_BRAIN,
          from: AGENT_NAMES.PLANNER,
          payload: {
            brain: 'eda',
            query: 'test query',
            replyTo: 'planner',
          },
        });

        expect(result.to).toBe('planner');
      });
    });

    describe('get_strategy', () => {
      it('should route get_strategy to Planner', () => {
        const result = router.route({
          type: MESSAGE_TYPES.GET_STRATEGY,
          from: AGENT_NAMES.SUPERVISOR,
          payload: {
            stage: 'floorplan',
            context: { designDir: '/test' },
          },
        });

        expect(result.to).toBe(AGENT_NAMES.PLANNER);
        expect(result.message.type).toBe(MESSAGE_TYPES.CREATE_STRATEGY);
        expect(result.message.stage).toBe('floorplan');
      });
    });

    describe('unknown message type', () => {
      it('should return error for unknown types', () => {
        const result = router.route({
          type: 'unknown_type',
          from: AGENT_NAMES.SUPERVISOR,
          payload: {},
        });

        expect(result.to).toBe(AGENT_NAMES.SUPERVISOR);
        expect(result.message.type).toBe(MESSAGE_TYPES.ERROR);
        expect(result.message.error).toContain('Unknown message type');
      });
    });
  });

  describe('Message Logging', () => {
    it('should log all messages', () => {
      router.route({
        type: MESSAGE_TYPES.DELEGATE_EXECUTION,
        from: AGENT_NAMES.SUPERVISOR,
        payload: { stage: 'synthesis' },
      });

      const log = router.getMessageLog();
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe(MESSAGE_TYPES.DELEGATE_EXECUTION);
      expect(log[0].from).toBe(AGENT_NAMES.SUPERVISOR);
    });

    it('should trim log when exceeding max size', () => {
      const smallRouter = new KnowledgeRouter({ maxLogSize: 5 });

      for (let i = 0; i < 10; i++) {
        smallRouter.route({
          type: MESSAGE_TYPES.DELEGATE_EXECUTION,
          from: AGENT_NAMES.SUPERVISOR,
          payload: { stage: 'synthesis' },
        });
      }

      expect(smallRouter.getMessageLog().length).toBeLessThanOrEqual(5);
    });

    it('should clear log', () => {
      router.route({
        type: MESSAGE_TYPES.DELEGATE_EXECUTION,
        from: AGENT_NAMES.SUPERVISOR,
        payload: { stage: 'synthesis' },
      });

      router.clearLog();
      expect(router.getMessageLog()).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate message statistics', () => {
      router.route({ type: MESSAGE_TYPES.DELEGATE_EXECUTION, from: AGENT_NAMES.SUPERVISOR, payload: { stage: 'synthesis' } });
      router.route({ type: MESSAGE_TYPES.DELEGATE_EXECUTION, from: AGENT_NAMES.SUPERVISOR, payload: { stage: 'floorplan' } });
      router.route({ type: MESSAGE_TYPES.GET_STRATEGY, from: AGENT_NAMES.SUPERVISOR, payload: { stage: 'floorplan' } });

      const stats = router.getStats();
      expect(stats.totalMessages).toBe(3);
      expect(stats.byType[MESSAGE_TYPES.DELEGATE_EXECUTION]).toBe(2);
      expect(stats.byType[MESSAGE_TYPES.GET_STRATEGY]).toBe(1);
      expect(stats.byFrom[AGENT_NAMES.SUPERVISOR]).toBe(3);
    });
  });

  describe('Hub-and-Spoke Compliance', () => {
    it('should pass compliance for correct message flow', () => {
      // Supervisor -> Knowledge (correct)
      router.route({ type: MESSAGE_TYPES.DELEGATE_EXECUTION, from: AGENT_NAMES.SUPERVISOR, payload: { stage: 'synthesis' } });
      router.route({ type: MESSAGE_TYPES.GET_STRATEGY, from: AGENT_NAMES.SUPERVISOR, payload: { stage: 'floorplan' } });

      // Executor -> Knowledge (correct)
      router.route({ type: MESSAGE_TYPES.EXECUTION_RESULT, from: AGENT_NAMES.EXECUTOR, payload: { stage: 'synthesis', success: true } });

      const compliance = router.verifyHubAndSpokeCompliance();
      expect(compliance.compliant).toBe(true);
      expect(compliance.violations).toHaveLength(0);
    });

    it('should detect violations when Supervisor sends wrong message types', () => {
      // Supervisor sending execution_result is a violation
      router.log({ type: MESSAGE_TYPES.EXECUTION_RESULT, from: AGENT_NAMES.SUPERVISOR });

      const compliance = router.verifyHubAndSpokeCompliance();
      expect(compliance.compliant).toBe(false);
      expect(compliance.violations.length).toBeGreaterThan(0);
    });

    it('should detect violations when Executor sends wrong message types', () => {
      // Executor sending delegate_execution is a violation
      router.log({ type: MESSAGE_TYPES.DELEGATE_EXECUTION, from: AGENT_NAMES.EXECUTOR });

      const compliance = router.verifyHubAndSpokeCompliance();
      expect(compliance.compliant).toBe(false);
    });
  });

  describe('Stage Tool Mapping', () => {
    it('should map synthesis to dc_shell', () => {
      expect(router._getToolForStage('synthesis')).toBe('dc_shell');
    });

    it('should map P&R stages to innovus', () => {
      const prStages = ['design_init', 'floorplan', 'powerplan', 'placement', 'cts', 'postcts_opt', 'routing', 'routeopt', 'chip_finish'];
      for (const stage of prStages) {
        expect(router._getToolForStage(stage)).toBe('innovus');
      }
    });
  });

  describe('Stage Timeout Mapping', () => {
    it('should return reasonable timeouts for stages', () => {
      expect(router._getTimeoutForStage('synthesis')).toBe(1800);
      expect(router._getTimeoutForStage('routing')).toBe(1200);
      expect(router._getTimeoutForStage('design_init')).toBe(300);
    });

    it('should return default timeout for unknown stages', () => {
      expect(router._getTimeoutForStage('unknown_stage')).toBe(600);
    });
  });
});

describe('MESSAGE_TYPES', () => {
  it('should export all expected message types', () => {
    expect(MESSAGE_TYPES.DELEGATE_EXECUTION).toBe('delegate_execution');
    expect(MESSAGE_TYPES.EXECUTE_STAGE).toBe('execute_stage');
    expect(MESSAGE_TYPES.EXECUTION_RESULT).toBe('execution_result');
    expect(MESSAGE_TYPES.RECORD_QOR).toBe('record_qor');
    expect(MESSAGE_TYPES.STAGE_COMPLETE).toBe('stage_complete');
    expect(MESSAGE_TYPES.QUERY_BRAIN).toBe('query_brain');
    expect(MESSAGE_TYPES.GET_STRATEGY).toBe('get_strategy');
    expect(MESSAGE_TYPES.ERROR).toBe('error');
  });
});

describe('AGENT_NAMES', () => {
  it('should export all expected agent names', () => {
    expect(AGENT_NAMES.SUPERVISOR).toBe('supervisor');
    expect(AGENT_NAMES.KNOWLEDGE).toBe('knowledge');
    expect(AGENT_NAMES.PLANNER).toBe('planner');
    expect(AGENT_NAMES.EXECUTOR).toBe('executor');
    expect(AGENT_NAMES.ARCHIVIST).toBe('archivist');
  });
});
