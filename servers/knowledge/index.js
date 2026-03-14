#!/usr/bin/env node
/**
 * HiPilot Knowledge MCP Server
 *
 * Provides documentation search, command reference, skill management,
 * and command search for VLSI physical design workflows.
 *
 * Key features:
 * - 3-level skill resolution: project > user > built-in
 * - Command reference from structured JSON database
 * - Full-text search across docs, skills, and data
 * - Methodology guide retrieval
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { VERSION } from '../../src/lib/version.js';
import { createMcpLogger } from '../../src/lib/mcp-logger.js';
import {
  quickGenerate,
  quickParse,
  quickPlan,
  sanitizeAndValidate,
  recordError,
  getSuggestedFix,
  recordSuccess,
  getBestPractice,
  processHiTestBotEvidence,
} from './asic-brain/index.js';
import {
  getToolInfo,
  listTools,
  getCommand,
  searchCommands as searchEDACommands,
  matchErrorPattern,
  getBestPractices as getEDABestPractices,
  validateCommandSyntax,
} from './eda-brain/index.js';
import {
  remember,
  recall,
  searchProjectBrain,
  getProjectContext,
  setProjectStage,
  recordProjectQoR,
  getQoRProgression,
  recordProjectErrorPattern,
  getProjectSummary,
  exportProjectMemories,
  isProjectBrainAvailable,
  MEMORY_TYPES,
  STAGE_NAMES,
} from './project-brain/index.js';

// Auto-detect project root from server location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const DOCS_DIR = join(PROJECT_ROOT, 'docs');
const DATA_DIR = join(PROJECT_ROOT, 'data');

// 3-level skill directories (project > user > built-in)
// Uses PROJECT_ROOT (not process.cwd()) for project-level paths to avoid
// dependency on Claude Code's working directory when spawning this MCP server.
const SKILL_DIRS = [
  join(PROJECT_ROOT, '.hipilot', 'skills'),         // project-level (highest priority)
  join(homedir(), '.hipilot', 'skills'),            // user-level
  join(PROJECT_ROOT, 'skills'),                     // built-in (lowest priority)
];

// Additional doc search paths (team/project knowledge)
const DOC_SEARCH_PATHS = [
  DOCS_DIR,
  join(PROJECT_ROOT, '.hipilot', 'docs'),           // project docs
  join(homedir(), '.hipilot', 'docs'),              // user docs
];

/**
 * Load command reference from JSON file
 */
let commandReference = null;

function loadCommandReference() {
  if (commandReference) return commandReference;

  const refPath = join(DATA_DIR, 'command-reference.json');
  if (!existsSync(refPath)) {
    commandReference = { version: '0.0.0', commands: [] };
    return commandReference;
  }

  try {
    commandReference = JSON.parse(readFileSync(refPath, 'utf-8'));
  } catch {
    commandReference = { version: '0.0.0', commands: [] };
  }
  return commandReference;
}

/**
 * Full-text search across all document directories
 */
function searchDocs(query, maxResults = 10) {
  const results = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 2);

  for (const searchPath of DOC_SEARCH_PATHS) {
    if (!existsSync(searchPath)) continue;
    searchDir(searchPath, queryLower, queryWords, results, maxResults, 0);
    if (results.length >= maxResults) break;
  }

  results.sort((a, b) => b.score - a.score);
  return { results: results.slice(0, maxResults), query };
}

function searchDir(dir, queryLower, queryWords, results, maxResults, depth) {
  if (depth > 5 || results.length >= maxResults) return;

  let files;
  try {
    files = readdirSync(dir, { withFileTypes: true });
  } catch { return; }

  for (const file of files) {
    if (results.length >= maxResults) break;
    const fullPath = join(dir, file.name);

    if (file.isDirectory()) {
      if (file.name.startsWith('.') || file.name === 'node_modules') continue;
      searchDir(fullPath, queryLower, queryWords, results, maxResults, depth + 1);
    } else if (file.name.match(/\.(md|txt|tcl|html|json)$/i)) {
      try {
        const content = readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break;
          const lineLower = lines[i].toLowerCase();

          if (lineLower.includes(queryLower) || queryWords.some(w => lineLower.includes(w))) {
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 3);
            const context = lines.slice(start, end).join('\n').trim();

            results.push({
              file: fullPath.replace(PROJECT_ROOT + '/', ''),
              line: i + 1,
              context: context.substring(0, 500),
              score: calculateRelevance(lineLower, queryLower, queryWords),
            });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }
  }
}

/**
 * Calculate relevance score for a match
 */
function calculateRelevance(line, query, queryWords) {
  let score = 0;

  // Exact match
  if (line === query) score += 100;
  if (line.includes(query)) score += 20;

  // Word-level matches
  for (const word of queryWords) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(line)) score += 10;
    else if (line.includes(word)) score += 3;
  }

  // Boost for headings
  if (line.startsWith('#')) score += 5;
  // Boost for command names
  if (line.match(/^[a-z_]+\s/)) score += 2;

  return score;
}

/**
 * Get command reference from structured data
 */
function getCommandRef(command, tool = 'auto') {
  const ref = loadCommandReference();
  const cmdLower = command.toLowerCase();

  let matches = ref.commands.filter(c =>
    c.name.toLowerCase() === cmdLower ||
    c.name.toLowerCase().includes(cmdLower)
  );

  // Sort exact matches first
  matches.sort((a, b) => {
    const aExact = a.name.toLowerCase() === cmdLower ? 1 : 0;
    const bExact = b.name.toLowerCase() === cmdLower ? 1 : 0;
    return bExact - aExact;
  });

  if (tool !== 'auto') {
    const toolFilter = matches.filter(c => c.tool.toLowerCase() === tool.toLowerCase());
    if (toolFilter.length > 0) matches = toolFilter;
  }

  if (matches.length === 0) {
    // Try fuzzy match on synopsis
    matches = ref.commands.filter(c =>
      c.synopsis.toLowerCase().includes(cmdLower)
    );
  }

  if (matches.length === 0) {
    return {
      command,
      found: false,
      message: `No reference found for: ${command}`,
      hint: `Try: knowledge.search_commands with a broader query`,
    };
  }

  return {
    command,
    found: true,
    count: matches.length,
    results: matches.map(c => ({
      name: c.name,
      tool: c.tool,
      category: c.category,
      synopsis: c.synopsis,
      syntax: c.syntax,
      key_options: c.key_options,
      examples: c.examples,
      related: c.related,
    })),
  };
}

/**
 * Search commands by category or keyword
 */
function searchCommands(query, category = null, tool = null) {
  const ref = loadCommandReference();
  const queryLower = query.toLowerCase();

  let matches = ref.commands.filter(c => {
    const nameMatch = c.name.toLowerCase().includes(queryLower);
    const synopsisMatch = c.synopsis.toLowerCase().includes(queryLower);
    const categoryMatch = c.category.toLowerCase().includes(queryLower);
    return nameMatch || synopsisMatch || categoryMatch;
  });

  if (category) {
    matches = matches.filter(c => c.category.toLowerCase() === category.toLowerCase());
  }

  if (tool) {
    matches = matches.filter(c => c.tool.toLowerCase() === tool.toLowerCase());
  }

  return matches.map(c => ({
    name: c.name,
    tool: c.tool,
    category: c.category,
    synopsis: c.synopsis,
  }));
}

/**
 * List available skills with 3-level resolution
 * Priority: project > user > built-in
 */
function listSkills() {
  const skills = [];
  const seenNames = new Set();

  for (const skillDir of SKILL_DIRS) {
    if (!existsSync(skillDir)) continue;

    const level = skillDir.includes('.hipilot/skills')
      ? (skillDir.startsWith(homedir()) ? 'user' : 'project')
      : 'built-in';

    let files;
    try {
      files = readdirSync(skillDir, { withFileTypes: true });
    } catch { continue; }

    for (const file of files) {
      if (!file.name.endsWith('.md')) continue;

      const skillName = file.name.replace('.md', '');
      // Higher-priority dirs shadow lower-priority ones
      if (seenNames.has(skillName)) continue;

      const skillPath = join(skillDir, file.name);
      try {
        const content = readFileSync(skillPath, 'utf-8');
        if (content.trim().length === 0) continue;

        const frontmatterMatch = content.match(/^---\n(.*?)\n---/s);
        if (frontmatterMatch) {
          const fm = frontmatterMatch[1];
          const nameMatch = fm.match(/name:\s*(.*)/);
          const descMatch = fm.match(/description:\s*(.*)/);
          const vendorMatch = fm.match(/vendor:\s*\[(.*?)\]/);
          const triggerMatch = fm.match(/triggers?:\s*\[(.*?)\]/);

          skills.push({
            file: file.name,
            name: nameMatch ? nameMatch[1].trim() : skillName,
            description: descMatch ? descMatch[1].trim() : 'No description',
            vendors: vendorMatch ? vendorMatch[1].split(',').map(v => v.trim()) : [],
            triggers: triggerMatch ? triggerMatch[1].split(',').map(t => t.trim().replace(/"/g, '')) : [],
            level,
            path: skillPath,
          });
          seenNames.add(skillName);
        }
      } catch {
        // Skip invalid skill files
      }
    }
  }

  return { skills };
}

/**
 * Get a specific skill by name (respects 3-level resolution)
 */
function getSkill(name) {
  const skillFileName = name.endsWith('.md') ? name : `${name}.md`;

  for (const skillDir of SKILL_DIRS) {
    const skillPath = join(skillDir, skillFileName);
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf-8');
      if (content.trim().length > 0) {
        const level = skillDir.includes('.hipilot/skills')
          ? (skillDir.startsWith(homedir()) ? 'user' : 'project')
          : 'built-in';
        return { found: true, content, path: skillPath, level };
      }
    }
  }

  return { found: false };
}

/**
 * Match user intent to a skill based on trigger phrases
 */
function matchSkill(intent) {
  const { skills } = listSkills();
  const intentLower = intent.toLowerCase();
  const matches = [];

  for (const skill of skills) {
    let score = 0;

    // Check trigger phrases
    for (const trigger of skill.triggers) {
      if (intentLower.includes(trigger.toLowerCase())) {
        score += 20;
      }
    }

    // Check name
    const nameWords = skill.name.replace(/-/g, ' ').split(' ');
    for (const word of nameWords) {
      if (intentLower.includes(word)) score += 5;
    }

    // Check description words
    const descWords = skill.description.toLowerCase().split(/\s+/);
    for (const word of descWords) {
      if (word.length > 3 && intentLower.includes(word)) score += 2;
    }

    if (score > 0) {
      matches.push({ ...skill, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * Create server
 */
const server = new Server(
  {
    name: 'hipilot-knowledge-mcp-server',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'knowledge.search_docs',
        description: 'Full-text search across project docs, team docs, and user docs',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            max_results: { type: 'number', description: 'Max results (default: 10)', default: 10 },
          },
          required: ['query'],
        },
      },
      {
        name: 'knowledge.get_command_ref',
        description: 'Get detailed reference for a specific EDA command (syntax, options, examples)',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command name (e.g., "report_timing", "routeDesign")' },
            tool: {
              type: 'string',
              description: 'EDA tool filter',
              enum: ['icc2', 'innovus', 'primetime', 'auto'],
              default: 'auto',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'knowledge.search_commands',
        description: 'Search EDA commands by keyword or category',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keyword' },
            category: {
              type: 'string',
              description: 'Filter by category',
              enum: ['timing', 'placement', 'routing', 'power', 'drc', 'cts', 'floorplan', 'general'],
            },
            tool: {
              type: 'string',
              description: 'Filter by EDA tool',
              enum: ['icc2', 'innovus', 'primetime'],
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'knowledge.list_skills',
        description: 'List all available HiPilot skills (3-level: project > user > built-in)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'knowledge.get_skill',
        description: 'Get the full content of a specific skill (resolves project > user > built-in)',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name (e.g., "fix-setup-timing")' },
          },
          required: ['name'],
        },
      },
      {
        name: 'knowledge.match_skill',
        description: 'Match a user intent to the best available skill based on trigger phrases',
        inputSchema: {
          type: 'object',
          properties: {
            intent: { type: 'string', description: 'User intent or request in natural language' },
          },
          required: ['intent'],
        },
      },
      {
        name: 'knowledge.get_methodology',
        description: 'Get methodology guide for a specific flow stage (timing closure, CTS, routing, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Methodology topic (e.g., "timing closure", "CTS", "routing")' },
            vendor: {
              type: 'string',
              description: 'Vendor preference',
              enum: ['synopsys', 'cadence', 'any'],
              default: 'any',
            },
          },
          required: ['topic'],
        },
      },
      {
        name: 'knowledge.generate_tcl',
        description: 'Generate validated Tcl script from natural language intent using ASIC-Brain',
        inputSchema: {
          type: 'object',
          properties: {
            intent: { type: 'string', description: 'Natural language description of what to do' },
            tool: { type: 'string', description: 'Target EDA tool', enum: ['dc_shell', 'innovus', 'pt_shell'] },
            stage: { type: 'string', description: 'Flow stage (synthesis, floorplan, placement, etc.)' },
            context: { type: 'object', description: 'Additional context variables' },
          },
          required: ['intent', 'tool'],
        },
      },
      {
        name: 'knowledge.sanitize_script',
        description: 'Sanitize and auto-fix Tcl script for common errors',
        inputSchema: {
          type: 'object',
          properties: {
            tcl: { type: 'string', description: 'Tcl script to sanitize' },
            tool: { type: 'string', description: 'Target EDA tool', enum: ['dc_shell', 'innovus', 'pt_shell'] },
            stage: { type: 'string', description: 'Flow stage for context' },
          },
          required: ['tcl', 'tool'],
        },
      },
      {
        name: 'knowledge.parse_output',
        description: 'Parse EDA tool output and extract structured information (errors, QoR, state)',
        inputSchema: {
          type: 'object',
          properties: {
            output: { type: 'string', description: 'Raw output from EDA tool' },
            tool: { type: 'string', description: 'EDA tool that produced output', enum: ['dc_shell', 'innovus', 'pt_shell'] },
            extract_qor: { type: 'boolean', description: 'Extract QoR metrics', default: true },
            extract_errors: { type: 'boolean', description: 'Extract errors and warnings', default: true },
          },
          required: ['output', 'tool'],
        },
      },
      {
        name: 'knowledge.plan_stage',
        description: 'Get detailed execution plan for a flow stage with prerequisites and steps',
        inputSchema: {
          type: 'object',
          properties: {
            stage: { type: 'string', description: 'Stage name', enum: ['synthesis', 'design_init', 'floorplan', 'power_planning', 'placement', 'cts', 'routing', 'export'] },
            context: { type: 'object', description: 'Additional context (design, tool version, etc.)' },
          },
          required: ['stage'],
        },
      },
      {
        name: 'knowledge.analyze_command',
        description: 'Analyze a Tcl command for validity before execution',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Tcl command to analyze' },
            tool: { type: 'string', description: 'Target EDA tool', enum: ['dc_shell', 'innovus', 'pt_shell'] },
            stage: { type: 'string', description: 'Current flow stage' },
          },
          required: ['command', 'tool'],
        },
      },
      {
        name: 'knowledge.record_error',
        description: 'Record an error pattern and its fix for learning',
        inputSchema: {
          type: 'object',
          properties: {
            error_output: { type: 'string', description: 'Error message/output from EDA tool' },
            tool: { type: 'string', description: 'EDA tool that produced the error' },
            stage: { type: 'string', description: 'Flow stage where error occurred' },
            fix: { type: 'object', description: 'The fix that was applied' },
            success: { type: 'boolean', description: 'Whether the fix worked' },
            source: { type: 'string', description: 'Source of learning (hitestbot, user, etc.)' },
          },
          required: ['error_output', 'success'],
        },
      },
      {
        name: 'knowledge.get_suggested_fix',
        description: 'Get suggested fix for a known error pattern',
        inputSchema: {
          type: 'object',
          properties: {
            error_output: { type: 'string', description: 'Error message/output from EDA tool' },
            tool: { type: 'string', description: 'EDA tool' },
            stage: { type: 'string', description: 'Flow stage' },
          },
          required: ['error_output'],
        },
      },
      {
        name: 'knowledge.record_success',
        description: 'Record a successful command sequence',
        inputSchema: {
          type: 'object',
          properties: {
            stage: { type: 'string', description: 'Flow stage' },
            tool: { type: 'string', description: 'EDA tool used' },
            commands: { type: 'array', description: 'Command sequence that succeeded' },
            outcomes: { type: 'object', description: 'QoR outcomes' },
          },
          required: ['stage', 'commands'],
        },
      },
      {
        name: 'knowledge.get_best_practice',
        description: 'Get best practice recommendations for a stage',
        inputSchema: {
          type: 'object',
          properties: {
            stage: { type: 'string', description: 'Flow stage' },
            limit: { type: 'number', description: 'Max recommendations', default: 3 },
          },
          required: ['stage'],
        },
      },
      {
        name: 'knowledge.process_evidence',
        description: 'Process HiTestBot evidence package for learning',
        inputSchema: {
          type: 'object',
          properties: {
            evidence_dir: { type: 'string', description: 'Path to HiTestBot evidence directory' },
          },
          required: ['evidence_dir'],
        },
      },
      // EDA-Brain Tools
      {
        name: 'knowledge.eda.get_tool_info',
        description: 'Get EDA tool information from EDA-Brain',
        inputSchema: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: 'Tool name (innovus, dc_shell, pt_shell, etc.)' },
          },
          required: ['tool'],
        },
      },
      {
        name: 'knowledge.eda.list_tools',
        description: 'List supported EDA tools',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Filter by category (synthesis, pnr, signoff)', enum: ['synthesis', 'pnr', 'signoff', 'extraction'] },
          },
        },
      },
      {
        name: 'knowledge.eda.get_command',
        description: 'Get EDA command reference with syntax and examples',
        inputSchema: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: 'Tool name' },
            command: { type: 'string', description: 'Command name' },
          },
          required: ['tool', 'command'],
        },
      },
      {
        name: 'knowledge.eda.search_commands',
        description: 'Search EDA commands by name or description',
        inputSchema: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: 'Tool name' },
            query: { type: 'string', description: 'Search query' },
          },
          required: ['tool', 'query'],
        },
      },
      {
        name: 'knowledge.eda.match_error',
        description: 'Match EDA error output to known patterns',
        inputSchema: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: 'Tool name' },
            output: { type: 'string', description: 'Error output text' },
          },
          required: ['tool', 'output'],
        },
      },
      {
        name: 'knowledge.eda.get_tool_practices',
        description: 'Get best practices for EDA tool and stage',
        inputSchema: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: 'Tool name' },
            stage: { type: 'string', description: 'Flow stage (floorplan, placement, cts, etc.)' },
          },
          required: ['tool'],
        },
      },
      // Project-Brain Tools
      {
        name: 'knowledge.project.remember',
        description: 'Store information in Project-Brain memory for current design',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Memory category (rtl_memory, floorplan_memory, placement_memory, cts_memory, routing_memory, timing_memory, error_patterns, drc_memory)' },
            key: { type: 'string', description: 'Unique key for this memory' },
            value: { type: 'object', description: 'Value to store (any JSON object)' },
            context: { type: 'object', description: 'Additional context' },
          },
          required: ['category', 'key', 'value'],
        },
      },
      {
        name: 'knowledge.project.recall',
        description: 'Retrieve information from Project-Brain memory',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Memory category' },
            key: { type: 'string', description: 'Specific key to retrieve (null for all entries)' },
          },
          required: ['category'],
        },
      },
      {
        name: 'knowledge.project.search',
        description: 'Search across all Project-Brain memories',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            categories: { type: 'array', description: 'Categories to search (default: all)' },
            limit: { type: 'number', description: 'Max results (default: 20)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'knowledge.project.get_context',
        description: 'Get current design context for decision making',
        inputSchema: {
          type: 'object',
          properties: {
            needs: { type: 'array', description: 'Memory categories to include in context' },
          },
        },
      },
      {
        name: 'knowledge.project.set_stage',
        description: 'Set current flow stage in Project-Brain',
        inputSchema: {
          type: 'object',
          properties: {
            stage: { type: 'number', description: 'Stage number (0-9)' },
          },
          required: ['stage'],
        },
      },
      {
        name: 'knowledge.project.record_qor',
        description: 'Record QoR snapshot for current stage',
        inputSchema: {
          type: 'object',
          properties: {
            stage: { type: 'number', description: 'Stage number' },
            metrics: { type: 'object', description: 'QoR metrics (wns, tns, area, power, etc.)' },
            context: { type: 'object', description: 'Additional context' },
          },
          required: ['stage', 'metrics'],
        },
      },
      {
        name: 'knowledge.project.get_qor_progression',
        description: 'Get QoR progression across stages',
        inputSchema: {
          type: 'object',
          properties: {
            metric: { type: 'string', description: 'Metric to track (wns, tns, etc.)', default: 'wns' },
          },
        },
      },
      {
        name: 'knowledge.project.record_error',
        description: 'Record design-specific error pattern',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Error pattern identifier' },
            error_output: { type: 'string', description: 'Error message/output' },
            resolution: { type: 'string', description: 'How the error was resolved' },
            auto_fixable: { type: 'boolean', description: 'Whether this error can be auto-fixed' },
          },
          required: ['pattern', 'error_output', 'resolution'],
        },
      },
      {
        name: 'knowledge.project.get_summary',
        description: 'Get summary of all project knowledge',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'knowledge.project.is_available',
        description: 'Check if Project-Brain is available for current design',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

/**
 * Handle tool calls
 */
const mcpLog = createMcpLogger('knowledge');

server.setRequestHandler(CallToolRequestSchema, mcpLog.wrapHandler(async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'knowledge.search_docs': {
        const { query, max_results = 10 } = args;
        const { results } = searchDocs(query, max_results);

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `No results found for: "${query}"\nTry broader terms or check knowledge.search_commands for EDA commands.` }],
          };
        }

        const formatted = results.map((r, i) =>
          `[${i + 1}] ${r.file}:${r.line} (score: ${r.score})\n${r.context}\n`
        ).join('\n');

        return {
          content: [{ type: 'text', text: `Search results for "${query}" (${results.length} matches):\n\n${formatted}` }],
        };
      }

      case 'knowledge.get_command_ref': {
        const { command, tool = 'auto' } = args;
        const ref = getCommandRef(command, tool);

        if (!ref.found) {
          return {
            content: [{ type: 'text', text: `${ref.message}\n${ref.hint}` }],
          };
        }

        const formatted = ref.results.map(r => {
          let text = `Command: ${r.name} (${r.tool})\n`;
          text += `Category: ${r.category}\n`;
          text += `Synopsis: ${r.synopsis}\n`;
          text += `Syntax: ${r.syntax}\n`;
          if (r.key_options && r.key_options.length > 0) {
            text += `\nKey Options:\n`;
            r.key_options.forEach(o => { text += `  ${o.option}: ${o.description}\n`; });
          }
          if (r.examples && r.examples.length > 0) {
            text += `\nExamples:\n`;
            r.examples.forEach(e => { text += `  ${e}\n`; });
          }
          if (r.related && r.related.length > 0) {
            text += `\nRelated: ${r.related.join(', ')}\n`;
          }
          return text;
        }).join('\n---\n');

        return {
          content: [{ type: 'text', text: formatted }],
        };
      }

      case 'knowledge.search_commands': {
        const { query, category, tool } = args;
        const results = searchCommands(query, category, tool);

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: `No commands found for: "${query}"` }],
          };
        }

        const formatted = results.map(r =>
          `  ${r.name} (${r.tool}) [${r.category}] - ${r.synopsis}`
        ).join('\n');

        return {
          content: [{ type: 'text', text: `Commands matching "${query}" (${results.length}):\n${formatted}` }],
        };
      }

      case 'knowledge.list_skills': {
        const { skills } = listSkills();

        if (skills.length === 0) {
          return {
            content: [{ type: 'text', text: 'No skills found.\nSkill directories searched:\n' + SKILL_DIRS.map(d => `  ${d}`).join('\n') }],
          };
        }

        // Group by level
        const byLevel = { project: [], user: [], 'built-in': [] };
        for (const s of skills) {
          byLevel[s.level] = byLevel[s.level] || [];
          byLevel[s.level].push(s);
        }

        let text = `Available Skills (${skills.length} total):\n\n`;

        for (const [level, levelSkills] of Object.entries(byLevel)) {
          if (levelSkills.length === 0) continue;
          text += `${level.toUpperCase()} (${levelSkills.length}):\n`;
          for (const s of levelSkills) {
            const vendors = s.vendors.length > 0 ? ` [${s.vendors.join(', ')}]` : '';
            text += `  ${s.name}${vendors}: ${s.description}\n`;
          }
          text += '\n';
        }

        text += `Resolution order: project (.hipilot/skills/) > user (~/.hipilot/skills/) > built-in`;

        return {
          content: [{ type: 'text', text }],
        };
      }

      case 'knowledge.get_skill': {
        if (!args.name) {
          return { content: [{ type: 'text', text: 'Error: name parameter is required. Example: knowledge.get_skill({name: "fix-setup-timing"})' }], isError: true };
        }
        const result = getSkill(args.name);

        if (!result.found) {
          const { skills } = listSkills();
          const available = skills.map(s => s.name).join(', ');
          return {
            content: [{
              type: 'text',
              text: `Skill not found: ${args.name}\nAvailable: ${available || 'none'}\nSearched: ${SKILL_DIRS.map(d => d).join(', ')}`,
            }],
          };
        }

        return {
          content: [{ type: 'text', text: `[${result.level}] ${result.path}\n\n${result.content}` }],
        };
      }

      case 'knowledge.match_skill': {
        const matches = matchSkill(args.intent);

        if (matches.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No matching skill for: "${args.intent}"\nUse knowledge.list_skills to see available skills, or proceed with doc-based generation.`,
            }],
          };
        }

        const top = matches[0];
        let text = `Best match: ${top.name} (score: ${top.score}, ${top.level})\n`;
        text += `Description: ${top.description}\n`;
        if (top.vendors.length > 0) text += `Vendors: ${top.vendors.join(', ')}\n`;
        text += `\nUse knowledge.get_skill to load the full workflow.\n`;

        if (matches.length > 1) {
          text += `\nOther matches:\n`;
          for (const m of matches.slice(1, 4)) {
            text += `  ${m.name} (score: ${m.score}): ${m.description}\n`;
          }
        }

        return {
          content: [{ type: 'text', text }],
        };
      }

      case 'knowledge.get_methodology': {
        const { topic, vendor = 'any' } = args;

        // Search skills and docs for methodology content
        const skillMatches = matchSkill(topic);
        const docResults = searchDocs(topic, 5);

        let text = `Methodology: ${topic}\n\n`;

        if (skillMatches.length > 0) {
          text += `Related Skills:\n`;
          for (const s of skillMatches.slice(0, 3)) {
            text += `  ${s.name} [${s.level}]: ${s.description}\n`;
          }
          text += `\nUse knowledge.get_skill to load detailed workflow.\n\n`;
        }

        if (docResults.results.length > 0) {
          text += `Documentation References:\n`;
          for (const r of docResults.results.slice(0, 3)) {
            text += `  ${r.file}:${r.line}\n  ${r.context.substring(0, 200)}\n\n`;
          }
        }

        // Search command reference for related commands
        const cmdResults = searchCommands(topic);
        if (cmdResults.length > 0) {
          text += `Related Commands:\n`;
          for (const c of cmdResults.slice(0, 5)) {
            text += `  ${c.name} (${c.tool}): ${c.synopsis}\n`;
          }
        }

        if (skillMatches.length === 0 && docResults.results.length === 0 && cmdResults.length === 0) {
          text += `No methodology content found for "${topic}".\nTry: "timing closure", "CTS", "routing", "hold fix", "DRC"`;
        }

        return {
          content: [{ type: 'text', text }],
        };
      }

      case 'knowledge.generate_tcl': {
        const { intent, tool, stage, context = {} } = args;
        const result = quickGenerate(intent, tool, stage, context);
        if (result.error) {
          return {
            content: [{ type: 'text', text: `Generation Error: ${result.error}\nSuggestions: ${result.suggestions?.join(', ') || 'none'}` }],
            isError: true,
          };
        }
        let text = `Generated Tcl for ${tool}${stage ? ` (${stage})` : ''}:\n\n`;
        text += result.tcl;
        if (result.fixes?.length > 0) {
          text += `\n\nAuto-fixes applied (${result.fixes.length}):\n`;
          result.fixes.forEach(f => { text += `  [FIX] ${f}\n`; });
        }
        if (result.warnings?.length > 0) {
          text += `\nWarnings (${result.warnings.length}):\n`;
          result.warnings.forEach(w => { text += `  [!] ${w.message}\n`; });
        }
        text += `\nCan execute: ${result.canExecute ? 'YES' : 'NO'}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.sanitize_script': {
        const { tcl, tool, stage } = args;
        const result = sanitizeAndValidate(tcl, tool, stage);
        let text = `Sanitization Result: ${result.valid ? 'VALID' : 'INVALID'}\n\n`;
        if (result.fixes?.length > 0) {
          text += `Fixes applied (${result.fixes.length}):\n`;
          result.fixes.forEach(f => { text += `  [FIX] ${f}\n`; });
          text += '\n';
        }
        if (result.errors?.length > 0) {
          text += `Errors (${result.errors.length}):\n`;
          result.errors.forEach(e => { text += `  [ERROR] ${e.message || e}\n`; });
          text += '\n';
        }
        if (result.warnings?.length > 0) {
          text += `Warnings (${result.warnings.length}):\n`;
          result.warnings.forEach(w => { text += `  [WARN] ${w.message || w}\n`; });
          text += '\n';
        }
        text += '--- Corrected Tcl ---\n';
        text += result.corrected || result.tcl;
        return { content: [{ type: 'text', text }], isError: !result.valid };
      }

      case 'knowledge.parse_output': {
        const { output, tool, extract_qor = true, extract_errors = true } = args;
        const parsed = quickParse(output, tool);
        let text = `Parsed Output for ${tool}\n\n`;
        if (extract_errors && (parsed.errors?.length > 0 || parsed.warnings?.length > 0)) {
          text += `ERRORS (${parsed.errors?.length || 0}):\n`;
          parsed.errors?.forEach(e => {
            text += `  [${e.severity?.toUpperCase() || 'ERROR'}] ${e.message}\n`;
            if (e.line) text += `    Line: ${e.line}\n`;
          });
          text += `\nWARNINGS (${parsed.warnings?.length || 0}):\n`;
          parsed.warnings?.forEach(w => { text += `  [!] ${w.message}\n`; });
          text += '\n';
        }
        if (extract_qor && parsed.qor) {
          text += 'QoR Metrics:\n';
          if (parsed.qor.wns !== undefined) text += `  WNS: ${parsed.qor.wns} ns\n`;
          if (parsed.qor.tns !== undefined) text += `  TNS: ${parsed.qor.tns} ns\n`;
          if (parsed.qor.area !== undefined) text += `  Area: ${parsed.qor.area}\n`;
          if (parsed.qor.power !== undefined) text += `  Power: ${parsed.qor.power}\n`;
          if (parsed.qor.setup_wns !== undefined) text += `  Setup WNS: ${parsed.qor.setup_wns} ns\n`;
          if (parsed.qor.hold_wns !== undefined) text += `  Hold WNS: ${parsed.qor.hold_wns} ns\n`;
          text += '\n';
        }
        if (parsed.tool_state) {
          text += `Tool State: ${parsed.tool_state.state}\n`;
          if (parsed.tool_state.detail) text += `  Detail: ${parsed.tool_state.detail}\n`;
        }
        if (parsed.recovery) {
          text += `\nRecovery: ${parsed.recovery.action}\n`;
          if (parsed.recovery.suggestion) text += `  Suggestion: ${parsed.recovery.suggestion}\n`;
        }
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.plan_stage': {
        const { stage, context = {} } = args;
        const plan = quickPlan(stage, context);
        if (plan.error) {
          return { content: [{ type: 'text', text: `Error: ${plan.error}` }], isError: true };
        }
        let text = `Execution Plan: ${plan.stage}\n`;
        text += `Purpose: ${plan.purpose}\n`;
        text += `Tool: ${plan.tool}\n\n`;
        if (plan.prerequisites?.length > 0) text += `Prerequisites: ${plan.prerequisites.join(', ')}\n`;
        text += `Inputs: ${plan.inputs?.join(', ') || 'none'}\n`;
        text += `Outputs: ${plan.outputs?.join(', ') || 'none'}\n\n`;
        if (plan.exit_criteria?.length > 0) {
          text += `Exit Criteria:\n`;
          plan.exit_criteria.forEach(c => { text += `  • ${c}\n`; });
          text += '\n';
        }
        if (plan.steps?.length > 0) {
          text += `Execution Steps:\n`;
          plan.steps.forEach(s => { text += `  ${s.order}. [${s.action}] ${s.description}\n`; });
        }
        text += `\nCan Start: ${plan.canStart ? 'YES' : 'NO'}`;
        if (!plan.canStart && plan.missingPrerequisites?.length > 0) {
          text += `\nMissing: ${plan.missingPrerequisites.join(', ')}`;
        }
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.analyze_command': {
        const { command, tool, stage } = args;
        const ASICBrain = (await import('./asic-brain/index.js')).ASICBrain;
        const brain = new ASICBrain();
        const analysis = brain.analyzeCommand(command, tool, stage);
        let text = `Command Analysis\n\n`;
        text += `Command: ${analysis.command}\n`;
        text += `Tool: ${analysis.tool}\n`;
        if (analysis.stage) text += `Stage: ${analysis.stage}\n`;
        text += `Valid: ${analysis.valid ? 'YES' : 'NO'}\n`;
        if (analysis.errors?.length > 0) {
          text += `\nErrors (${analysis.errors.length}):\n`;
          analysis.errors.forEach(e => { text += `  [X] ${e.message || e}\n`; });
        }
        if (analysis.warnings?.length > 0) {
          text += `\nWarnings (${analysis.warnings.length}):\n`;
          analysis.warnings.forEach(w => { text += `  [!] ${w.message || w}\n`; });
        }
        if (analysis.syntax) {
          text += `\nSyntax: ${analysis.syntax.syntax || 'N/A'}\n`;
          if (analysis.syntax.example) text += `Example: ${analysis.syntax.example}\n`;
        }
        text += `\nCan Execute: ${analysis.canExecute ? 'YES' : 'NO'}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.record_error': {
        const { error_output, tool, stage, fix, success, source } = args;
        const pattern = recordError(error_output, { tool, stage, source }, fix, success);
        let text = `Error Pattern Recorded\n\n`;
        text += `Pattern ID: ${pattern.id}\n`;
        text += `Status: ${pattern.meta.validated ? 'VALIDATED' : 'LEARNING'}\n`;
        text += `Occurrences: ${pattern.meta.occurrence_count}\n`;
        text += `Success Rate: ${(pattern.meta.fix_success_rate * 100).toFixed(1)}%\n`;
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.get_suggested_fix': {
        const { error_output, tool, stage } = args;
        const suggestion = getSuggestedFix(error_output, { tool, stage });
        if (!suggestion) {
          return { content: [{ type: 'text', text: 'No known fix for this error pattern.' }] };
        }
        let text = `Suggested Fix (confidence: ${(suggestion.confidence * 100).toFixed(0)}%)\n\n`;
        text += `Root Cause: ${suggestion.root_cause.description}\n`;
        text += `Category: ${suggestion.root_cause.category}\n\n`;
        if (suggestion.fix) {
          text += `Action: ${suggestion.fix.action}\n`;
          if (suggestion.fix.tcl_template) {
            text += `\nTcl Template:\n${suggestion.fix.tcl_template}\n`;
          }
        }
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.record_success': {
        const { stage, tool, commands, outcomes } = args;
        recordSuccess({ stage, tool }, commands, outcomes);
        return { content: [{ type: 'text', text: `Success recorded for ${stage} (${tool})` }] };
      }

      case 'knowledge.get_best_practice': {
        const { stage, limit = 3 } = args;
        const practices = getBestPractice(stage, limit);
        if (practices.length === 0) {
          return { content: [{ type: 'text', text: `No best practices recorded for ${stage} yet.` }] };
        }
        let text = `Best Practices for ${stage}\n\n`;
        practices.forEach((p, i) => {
          text += `${i + 1}. Success Rate: ${(p.outcomes.success_rate * 100).toFixed(0)}% (${p.meta.observation_count} runs)\n`;
          text += `   Commands: ${p.pattern.command_sequence.map(c => c.cmd).join(' → ')}\n\n`;
        });
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.process_evidence': {
        const { evidence_dir } = args;
        const results = await processHiTestBotEvidence(evidence_dir);
        let text = `HiTestBot Evidence Processed\n\n`;
        text += `Patterns Learned: ${results.patterns_learned.length}\n`;
        if (results.patterns_learned.length > 0) {
          text += `  IDs: ${results.patterns_learned.join(', ')}\n`;
        }
        if (results.metrics) {
          text += `\nMetrics Recorded:\n`;
          text += `  Score: ${results.metrics.score}\n`;
          text += `  Stages: ${results.metrics.stages?.length || 0}\n`;
        }
        if (results.errors?.length > 0) {
          text += `\nErrors: ${results.errors.join(', ')}\n`;
        }
        return { content: [{ type: 'text', text }] };
      }

      // EDA-Brain Handlers
      case 'knowledge.eda.get_tool_info': {
        const { tool } = args;
        const info = getToolInfo(tool);
        if (!info) {
          return { content: [{ type: 'text', text: `Unknown tool: ${tool}` }] };
        }
        let text = `${info.name}\n`;
        text += `Vendor: ${info.vendor}\n`;
        text += `Category: ${info.category}\n`;
        text += `Description: ${info.description}\n`;
        text += `Capabilities: ${info.capabilities?.join(', ')}\n`;
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.eda.list_tools': {
        const { category } = args;
        const tools = listTools(category);
        let text = category ? `Tools (${category}):\n\n` : 'All EDA Tools:\n\n';
        tools.forEach(t => {
          text += `- ${t.id}: ${t.name} (${t.vendor})\n`;
          text += `  Capabilities: ${t.capabilities?.slice(0, 3).join(', ')}...\n`;
        });
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.eda.get_command': {
        const { tool, command } = args;
        const cmd = getCommand(tool, command);
        if (!cmd) {
          return { content: [{ type: 'text', text: `Command not found: ${tool}.${command}` }] };
        }
        let text = `${cmd.command}\n`;
        text += `Description: ${cmd.description}\n`;
        text += `Syntax: ${cmd.syntax}\n`;
        if (cmd.example) {
          text += `\nExample:\n${cmd.example}\n`;
        }
        if (cmd.prerequisites?.length > 0) {
          text += `\nPrerequisites: ${cmd.prerequisites.join(', ')}\n`;
        }
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.eda.search_commands': {
        const { tool, query } = args;
        const cmds = searchEDACommands(tool, query);
        if (cmds.length === 0) {
          return { content: [{ type: 'text', text: `No commands found for "${query}" in ${tool}` }] };
        }
        let text = `Commands matching "${query}" in ${tool}:\n\n`;
        cmds.forEach((c, i) => {
          text += `${i + 1}. ${c.command} - ${c.description}\n`;
        });
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.eda.match_error': {
        const { tool, output } = args;
        const match = matchErrorPattern(tool, output);
        if (!match) {
          return { content: [{ type: 'text', text: 'No known error pattern matched.' }] };
        }
        let text = `Error Pattern Matched: ${match.id}\n`;
        text += `Code: ${match.code}\n`;
        text += `Severity: ${match.severity}\n`;
        text += `Description: ${match.description}\n`;
        text += `Fix: ${match.fix}\n`;
        text += `Auto-fixable: ${match.autoFixable ? 'Yes' : 'No'}\n`;
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.eda.get_tool_practices': {
        const { tool, stage } = args;
        const practices = getEDABestPractices(tool, stage);
        if (practices.length === 0) {
          return { content: [{ type: 'text', text: `No practices found for ${tool}${stage ? `/${stage}` : ''}` }] };
        }
        let text = `Best Practices for ${tool}${stage ? ` (${stage})` : ''}:\n\n`;
        practices.forEach((p, i) => {
          text += `${i + 1}. ${p.title}\n`;
          text += `   ${p.description}\n`;
          if (p.rationale) text += `   Why: ${p.rationale}\n`;
          if (p.commands) text += `   Commands: ${p.commands.join(', ')}\n`;
          text += '\n';
        });
        return { content: [{ type: 'text', text }] };
      }

      // Project-Brain Handlers
      case 'knowledge.project.remember': {
        const { category, key, value, context = {} } = args;
        const result = remember(category, key, value, context);
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
        }
        let text = `Memory stored: ${result.category}.${result.key}\n`;
        text += `Update: ${result.is_update ? 'Yes' : 'No'}\n`;
        text += `Total entries: ${result.entry_count}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.project.recall': {
        const { category, key = null } = args;
        const result = recall(category, key);
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
        }
        if (key === null) {
          let text = `${result.category} entries (${result.count}):\n\n`;
          result.entries.forEach((e, i) => {
            text += `[${i + 1}] ${e.key}\n`;
            text += `    Value: ${JSON.stringify(e.value).substring(0, 100)}\n`;
            text += `    Stage: ${e.stage_name} (${e.stage})\n`;
            text += `    Time: ${e.timestamp}\n\n`;
          });
          return { content: [{ type: 'text', text }] };
        }
        let text = `${result.category}.${result.key}:\n`;
        text += `Value: ${JSON.stringify(result.entry.value, null, 2)}\n`;
        text += `Stage: ${result.entry.stage_name} (${result.entry.stage})\n`;
        text += `Time: ${result.entry.timestamp}\n`;
        if (result.entry.update_count) {
          text += `Updates: ${result.entry.update_count}\n`;
        }
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.project.search': {
        const { query, categories, limit = 20 } = args;
        const result = searchProjectBrain(query, { categories, limit });
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
        }
        if (result.results.length === 0) {
          return { content: [{ type: 'text', text: `No memories found for: "${query}"` }] };
        }
        let text = `Search results for "${query}" (${result.results.length} of ${result.total}):\n\n`;
        result.results.forEach((r, i) => {
          text += `[${i + 1}] ${r.category}.${r.key} (score: ${r.score})\n`;
          text += `    Stage: ${r.stage_name} (${r.stage})\n`;
          text += `    Value: ${JSON.stringify(r.value).substring(0, 80)}\n`;
          text += `    Time: ${r.timestamp}\n\n`;
        });
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.project.get_context': {
        const { needs = [] } = args;
        const result = getProjectContext(needs);
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
        }
        const ctx = result.context;
        let text = `Design Context: ${ctx.design_name}\n`;
        text += `Current Stage: ${ctx.current_stage_name} (${ctx.current_stage})\n`;
        text += `Completed: ${ctx.completed_stages.map(s => STAGE_NAMES[s]).join(', ') || 'none'}\n`;
        text += `Design Dir: ${ctx.design_dir}\n`;
        if (needs.length > 0) {
          text += `\nRequested Memories:\n`;
          for (const category of needs) {
            if (ctx[category]) {
              text += `  ${category}: ${ctx[category].entries?.length || 0} entries\n`;
            }
          }
        }
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.project.set_stage': {
        const { stage } = args;
        const result = setProjectStage(stage);
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
        }
        let text = `Stage updated: ${result.stage_name} (${result.stage})\n`;
        text += `Completed stages: ${result.completed_stages.map(s => STAGE_NAMES[s]).join(', ') || 'none'}`;
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.project.record_qor': {
        const { stage, metrics, context = {} } = args;
        const result = recordProjectQoR(stage, metrics, context);
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
        }
        return { content: [{ type: 'text', text: `QoR recorded for stage ${stage}: ${JSON.stringify(metrics)}` }] };
      }

      case 'knowledge.project.get_qor_progression': {
        const { metric = 'wns' } = args;
        const result = getQoRProgression(metric);
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
        }
        if (result.progression.length === 0) {
          return { content: [{ type: 'text', text: `No QoR data for metric: ${metric}` }] };
        }
        let text = `${metric.toUpperCase()} Progression (${result.count} snapshots):\n\n`;
        result.progression.forEach((p) => {
          text += `${p.stage_name}: ${p.value} ${metric === 'wns' || metric === 'tns' ? 'ns' : ''}\n`;
          text += `    Time: ${new Date(p.timestamp).toLocaleString()}\n`;
        });
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.project.record_error': {
        const { pattern, error_output, resolution, auto_fixable = false } = args;
        const result = recordProjectErrorPattern(pattern, error_output, resolution, auto_fixable);
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
        }
        return { content: [{ type: 'text', text: `Error pattern recorded: ${pattern}\nEntry count: ${result.entry_count}` }] };
      }

      case 'knowledge.project.get_summary': {
        const result = getProjectSummary();
        if (!result.success) {
          return { content: [{ type: 'text', text: `Error: ${result.error}` }] };
        }
        const s = result.summary;
        let text = `Project-Brain Summary: ${s.design_name}\n`;
        text += `Current: ${s.current_stage_name} (${s.current_stage})\n`;
        text += `Completed: ${s.completed_stages.join(', ') || 'none'}\n`;
        text += `Total entries: ${s.total_entries}\n\n`;
        text += 'Memories:\n';
        for (const [cat, info] of Object.entries(s.memories)) {
          text += `  ${cat}: ${info.entry_count} entries\n`;
        }
        return { content: [{ type: 'text', text }] };
      }

      case 'knowledge.project.is_available': {
        const available = isProjectBrainAvailable();
        return { content: [{ type: 'text', text: `Project-Brain ${available ? 'IS' : 'IS NOT'} available${available ? '' : ' (set HIPILOT_DESIGN_DIR)'}` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}));

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('HiPilot Knowledge MCP Server running');
  console.error(`  Skills dirs: ${SKILL_DIRS.filter(d => existsSync(d)).join(', ')}`);
  console.error(`  Docs dirs: ${DOC_SEARCH_PATHS.filter(d => existsSync(d)).join(', ')}`);

  const ref = loadCommandReference();
  console.error(`  Commands: ${ref.commands.length} in reference`);

  const { skills } = listSkills();
  console.error(`  Skills: ${skills.length} loaded`);
}

main().catch(console.error);
