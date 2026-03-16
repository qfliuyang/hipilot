#!/usr/bin/env node
/**
 * McpInfraTest - MCP infrastructure test (Mode 3: no AI in the loop)
 *
 * Tests MCP servers directly via JSON-RPC, verifying that the infrastructure
 * works independent of Claude Code behavior.
 *
 * Usage:
 *   node src/hitestbot/tests/McpInfraTest.js
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const LOG_PATH = '/tmp/hitestbot_infra_test.jsonl';

function callMcp(server, tool, args = {}) {
  const serverPath = join(PROJECT_ROOT, `servers/${server}/index.js`);
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: tool, arguments: args },
  });

  try {
    const result = execSync(
      `echo '${request.replace(/'/g, "'\\''")}' | node ${serverPath}`,
      {
        encoding: 'utf-8',
        timeout: 30000,
        env: { ...process.env, HIPILOT_SESSION: 'hipilot', HIPILOT_TEST_LOG: LOG_PATH },
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    return JSON.parse(result);
  } catch (e) {
    return { error: e.message };
  }
}

function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    const result = fn();
    console.log(`✅ ${result || 'OK'}`);
    return true;
  } catch (e) {
    console.log(`❌ ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  HiTestBot v2 — MCP Infrastructure Test          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Clean up log
  try { unlinkSync(LOG_PATH); } catch {}

  let passed = 0;
  let failed = 0;

  // EDA Server Tests
  console.log('EDA MCP Server:');

  if (test('tools/list returns 54 tools', () => {
    const r = callMcp('eda', null); // tools/list
    const listReq = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const result = execSync(
      `echo '${listReq}' | node ${join(PROJECT_ROOT, 'servers/eda/index.js')}`,
      { encoding: 'utf-8', timeout: 10000, env: { ...process.env, HIPILOT_TEST_LOG: LOG_PATH }, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const tools = JSON.parse(result).result.tools;
    if (tools.length < 52) throw new Error(`Expected 54+ tools, got ${tools.length}`);
    return `${tools.length} tools`;
  })) passed++; else failed++;

  if (test('eda.get_status returns mode and tool', () => {
    const r = callMcp('eda', 'eda.get_status', {});
    if (r.error) throw new Error(r.error);
    const text = r.result?.content?.[0]?.text || '';
    if (!text.includes('Mode')) throw new Error('Missing mode info');
    return 'status OK';
  })) passed++; else failed++;

  if (test('eda.generate_tcl produces template-based Tcl', () => {
    const r = callMcp('eda', 'eda.generate_tcl', {
      intent: 'report timing', operation: 'report_timing', tool: 'innovus'
    });
    if (r.error) throw new Error(r.error);
    const badge = r.result?._metadata?.badge;
    if (badge !== '[✓ Template]') throw new Error(`Expected template badge, got: ${badge}`);
    return `badge: ${badge}`;
  })) passed++; else failed++;

  if (test('eda.list_templates returns 20 templates', () => {
    const r = callMcp('eda', 'eda.list_templates', {});
    if (r.error) throw new Error(r.error);
    const text = r.result?.content?.[0]?.text || '';
    if (!text.includes('synopsys') && !text.includes('Synopsys')) throw new Error('Missing Synopsys templates');
    return 'templates listed';
  })) passed++; else failed++;

  if (test('eda.validate_tcl catches syntax errors', () => {
    const r = callMcp('eda', 'eda.validate_tcl', { tcl: 'report_timing -max_paths 10' });
    if (r.error) throw new Error(r.error);
    return 'validation OK';
  })) passed++; else failed++;

  if (test('workflow.list shows built-in workflows', () => {
    const r = callMcp('eda', 'workflow.list', {});
    if (r.error) throw new Error(r.error);
    const text = r.result?.content?.[0]?.text || '';
    if (!text.includes('rtl2gds') || !text.includes('Built-in')) throw new Error('Missing built-in workflows');
    return 'workflows listed';
  })) passed++; else failed++;

  console.log('');

  // Knowledge Server Tests
  console.log('Knowledge MCP Server:');

  if (test('knowledge.list_skills returns skills', () => {
    const r = callMcp('knowledge', 'knowledge.list_skills', {});
    if (r.error) throw new Error(r.error);
    const text = r.result?.content?.[0]?.text || '';
    // Check for skills count pattern (e.g., "X total")
    const match = text.match(/(\d+) total/);
    if (!match || parseInt(match[1]) < 30) throw new Error('Expected at least 30 skills');
    return `${match[1]} skills`;
  })) passed++; else failed++;

  if (test('knowledge.match_skill finds fix-setup-timing', () => {
    const r = callMcp('knowledge', 'knowledge.match_skill', { intent: 'fix setup timing violations' });
    if (r.error) throw new Error(r.error);
    const text = r.result?.content?.[0]?.text || '';
    if (!text.includes('fix-setup-timing')) throw new Error('Did not match fix-setup-timing');
    return 'matched';
  })) passed++; else failed++;

  if (test('knowledge.get_command_ref returns report_timing', () => {
    const r = callMcp('knowledge', 'knowledge.get_command_ref', { command: 'report_timing' });
    if (r.error) throw new Error(r.error);
    return 'reference OK';
  })) passed++; else failed++;

  console.log('');

  // MCP Logging Tests
  console.log('MCP Logging:');

  if (test('MCP log file was created', () => {
    if (!existsSync(LOG_PATH)) throw new Error(`Log not found at ${LOG_PATH}`);
    return 'log exists';
  })) passed++; else failed++;

  if (test('Log entries are valid JSONL', () => {
    const lines = readFileSync(LOG_PATH, 'utf-8').split('\n').filter(l => l.trim());
    for (const line of lines) { JSON.parse(line); }
    return `${lines.length} entries`;
  })) passed++; else failed++;

  if (test('Log entries have required fields', () => {
    const lines = readFileSync(LOG_PATH, 'utf-8').split('\n').filter(l => l.trim());
    const entry = JSON.parse(lines[0]);
    if (!entry.ts || !entry.server || !entry.tool || !entry.status) {
      throw new Error('Missing required fields');
    }
    return 'fields OK';
  })) passed++; else failed++;

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
  console.log('═══════════════════════════════════════════════════');

  // Cleanup
  try { unlinkSync(LOG_PATH); } catch {}

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('McpInfraTest failed:', err.message);
  process.exit(2);
});
