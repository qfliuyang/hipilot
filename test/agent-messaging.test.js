/**
 * Tests for agent-messaging module
 * Tests the file-based inter-agent communication system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sendToAgent,
  readMessages,
  hasMessages,
  getMessageCount,
  clearAllMessages,
} from '../src/lib/agent-messaging.js';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const MESSAGES_DIR = join(tmpdir(), 'hipilot-messages');

describe('agent-messaging', () => {
  beforeEach(() => {
    // Clear all messages before each test
    clearAllMessages();
  });

  afterEach(() => {
    // Clean up after each test
    clearAllMessages();
  });

  describe('sendToAgent', () => {
    it('should send a message to an agent', () => {
      const result = sendToAgent('Knowledge', {
        type: 'generate_tcl',
        stage: 'synthesis',
      });

      expect(result.sent).toBe(true);
      expect(result.to).toBe('Knowledge');
    });

    it('should create messages directory if it does not exist', () => {
      // Ensure directory doesn't exist initially
      clearAllMessages();

      sendToAgent('Executor', { type: 'test' });

      expect(existsSync(MESSAGES_DIR)).toBe(true);
    });

    it('should append multiple messages to the same queue', () => {
      sendToAgent('Planner', { type: 'message1' });
      sendToAgent('Planner', { type: 'message2' });
      sendToAgent('Planner', { type: 'message3' });

      const messages = readMessages('Planner');
      expect(messages).toHaveLength(3);
      expect(messages[0].message.type).toBe('message1');
      expect(messages[1].message.type).toBe('message2');
      expect(messages[2].message.type).toBe('message3');
    });

    it('should include timestamp in message', () => {
      const beforeSend = new Date().toISOString();
      sendToAgent('Archivist', { type: 'record_qor' });
      const messages = readMessages('Archivist');
      const afterSend = new Date().toISOString();

      expect(messages[0].timestamp).toBeDefined();
      expect(messages[0].timestamp >= beforeSend).toBe(true);
      expect(messages[0].timestamp <= afterSend).toBe(true);
    });

    it('should include summary if provided', () => {
      sendToAgent('Executor', { type: 'execute' }, 'Execute synthesis');

      const messages = readMessages('Executor');
      expect(messages[0].summary).toBe('Execute synthesis');
    });

    it('should handle string messages', () => {
      sendToAgent('Knowledge', 'simple message');

      const messages = readMessages('Knowledge');
      expect(messages[0].message).toBe('simple message');
    });

    it('should handle complex object messages', () => {
      const complexMessage = {
        type: 'generate_tcl',
        stage: 'floorplan',
        tool: 'innovus',
        config: {
          effort: 'high',
          timeout: 300,
        },
        nested: {
          deeply: {
            value: 42,
          },
        },
      };

      sendToAgent('Knowledge', complexMessage);

      const messages = readMessages('Knowledge');
      expect(messages[0].message).toEqual(complexMessage);
    });
  });

  describe('readMessages', () => {
    it('should return empty array for non-existent queue', () => {
      const messages = readMessages('NonExistent');
      expect(messages).toEqual([]);
    });

    it('should read and clear messages', () => {
      sendToAgent('Executor', { type: 'test1' });
      sendToAgent('Executor', { type: 'test2' });

      // First read should get all messages
      const firstRead = readMessages('Executor');
      expect(firstRead).toHaveLength(2);

      // Second read should return empty (queue was cleared)
      const secondRead = readMessages('Executor');
      expect(secondRead).toEqual([]);
    });

    it('should parse JSON correctly', () => {
      sendToAgent('Planner', { type: 'strategy', data: [1, 2, 3] });

      const messages = readMessages('Planner');
      expect(messages[0].message.data).toEqual([1, 2, 3]);
    });
  });

  describe('hasMessages', () => {
    it('should return false for agent with no messages', () => {
      expect(hasMessages('Knowledge')).toBe(false);
    });

    it('should return true for agent with pending messages', () => {
      sendToAgent('Knowledge', { type: 'test' });
      expect(hasMessages('Knowledge')).toBe(true);
    });

    it('should return false after messages are read', () => {
      sendToAgent('Executor', { type: 'test' });
      expect(hasMessages('Executor')).toBe(true);

      readMessages('Executor');
      expect(hasMessages('Executor')).toBe(false);
    });
  });

  describe('getMessageCount', () => {
    it('should return 0 for agent with no messages', () => {
      expect(getMessageCount('Planner')).toBe(0);
    });

    it('should return correct count for agent with messages', () => {
      expect(getMessageCount('Executor')).toBe(0);

      sendToAgent('Executor', { type: 'msg1' });
      expect(getMessageCount('Executor')).toBe(1);

      sendToAgent('Executor', { type: 'msg2' });
      sendToAgent('Executor', { type: 'msg3' });
      expect(getMessageCount('Executor')).toBe(3);
    });

    it('should return 0 after messages are read', () => {
      sendToAgent('Archivist', { type: 'test' });
      expect(getMessageCount('Archivist')).toBe(1);

      readMessages('Archivist');
      expect(getMessageCount('Archivist')).toBe(0);
    });
  });

  describe('clearAllMessages', () => {
    it('should clear all message queues', () => {
      sendToAgent('Knowledge', { type: 'test1' });
      sendToAgent('Planner', { type: 'test2' });
      sendToAgent('Executor', { type: 'test3' });

      expect(hasMessages('Knowledge')).toBe(true);
      expect(hasMessages('Planner')).toBe(true);
      expect(hasMessages('Executor')).toBe(true);

      clearAllMessages();

      expect(hasMessages('Knowledge')).toBe(false);
      expect(hasMessages('Planner')).toBe(false);
      expect(hasMessages('Executor')).toBe(false);
    });

    it('should handle clearing when directory does not exist', () => {
      // Should not throw
      clearAllMessages();
      clearAllMessages();
      expect(true).toBe(true);
    });
  });

  describe('message isolation', () => {
    it('should maintain separate queues for each agent', () => {
      sendToAgent('Knowledge', { agent: 'Knowledge' });
      sendToAgent('Planner', { agent: 'Planner' });
      sendToAgent('Executor', { agent: 'Executor' });

      const knowledgeMessages = readMessages('Knowledge');
      const plannerMessages = readMessages('Planner');
      const executorMessages = readMessages('Executor');

      expect(knowledgeMessages).toHaveLength(1);
      expect(knowledgeMessages[0].message.agent).toBe('Knowledge');

      expect(plannerMessages).toHaveLength(1);
      expect(plannerMessages[0].message.agent).toBe('Planner');

      expect(executorMessages).toHaveLength(1);
      expect(executorMessages[0].message.agent).toBe('Executor');
    });

    it('should not affect one agents queue when reading another', () => {
      sendToAgent('Agent1', { msg: 1 });
      sendToAgent('Agent2', { msg: 2 });
      sendToAgent('Agent1', { msg: 3 });

      const agent2Messages = readMessages('Agent2');
      expect(agent2Messages).toHaveLength(1);

      const agent1Messages = readMessages('Agent1');
      expect(agent1Messages).toHaveLength(2);
      expect(agent1Messages[0].message.msg).toBe(1);
      expect(agent1Messages[1].message.msg).toBe(3);
    });
  });

  describe('message order', () => {
    it('should preserve message order within a queue', () => {
      const timestamps = [];

      for (let i = 0; i < 5; i++) {
        sendToAgent('Executor', { index: i });
        timestamps.push(i);
      }

      const messages = readMessages('Executor');
      expect(messages).toHaveLength(5);

      for (let i = 0; i < 5; i++) {
        expect(messages[i].message.index).toBe(i);
      }
    });
  });
});
