/**
 * Agent Messaging System - File-based inter-agent communication
 *
 * Implements a simple message queue system using JSONL files in temp directory.
 * Each agent has its own queue file: {agentName}.jsonl
 *
 * This allows agents running in different tmux panes to communicate
 * through the filesystem without requiring network services.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const MESSAGES_DIR = join(tmpdir(), 'hipilot-messages');

/**
 * Ensure messages directory exists
 */
function ensureMessagesDir() {
  if (!existsSync(MESSAGES_DIR)) {
    mkdirSync(MESSAGES_DIR, { recursive: true });
  }
}

/**
 * Send a message to an agent
 * @param {string} to - Target agent name
 * @param {object|string} message - Message content
 * @param {string} [summary] - Brief summary for notifications
 * @returns {object} Send result with sent status and target
 */
export function sendToAgent(to, message, summary = '') {
  ensureMessagesDir();
  const queueFile = join(MESSAGES_DIR, `${to}.jsonl`);
  const entry = {
    timestamp: new Date().toISOString(),
    from: 'team-lead', // Will be overridden by actual sender
    to,
    message,
    summary,
  };
  writeFileSync(queueFile, JSON.stringify(entry) + '\n', { flag: 'a' });
  return { sent: true, to };
}

/**
 * Read and clear messages for an agent
 * @param {string} agentName - Agent to read messages for
 * @returns {array} Array of messages
 */
export function readMessages(agentName) {
  const queueFile = join(MESSAGES_DIR, `${agentName}.jsonl`);
  if (!existsSync(queueFile)) return [];

  const content = readFileSync(queueFile, 'utf-8');

  // Clear the queue after reading
  unlinkSync(queueFile);

  return content.trim().split('\n')
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line));
}

/**
 * Check if agent has pending messages
 * @param {string} agentName - Agent to check
 * @returns {boolean} True if messages pending
 */
export function hasMessages(agentName) {
  const queueFile = join(MESSAGES_DIR, `${agentName}.jsonl`);
  return existsSync(queueFile);
}

/**
 * Get message count for an agent
 * @param {string} agentName - Agent to check
 * @returns {number} Number of pending messages
 */
export function getMessageCount(agentName) {
  const queueFile = join(MESSAGES_DIR, `${agentName}.jsonl`);
  if (!existsSync(queueFile)) return 0;

  const content = readFileSync(queueFile, 'utf-8');
  return content.trim().split('\n').filter(line => line.length > 0).length;
}

/**
 * Clear all message queues (useful for testing)
 */
export function clearAllMessages() {
  if (!existsSync(MESSAGES_DIR)) return;

  const { readdirSync } = require('fs');
  const files = readdirSync(MESSAGES_DIR);
  for (const file of files) {
    if (file.endsWith('.jsonl')) {
      unlinkSync(join(MESSAGES_DIR, file));
    }
  }
}

export default {
  sendToAgent,
  readMessages,
  hasMessages,
  getMessageCount,
  clearAllMessages,
};
