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

// Auto-detect project root from server location
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const DOCS_DIR = join(PROJECT_ROOT, 'docs');
const DATA_DIR = join(PROJECT_ROOT, 'data');

// 3-level skill directories (project > user > built-in)
const SKILL_DIRS = [
  join(process.cwd(), '.hipilot', 'skills'),      // project-level (highest priority)
  join(homedir(), '.hipilot', 'skills'),            // user-level
  join(PROJECT_ROOT, 'skills'),                     // built-in (lowest priority)
];

// Additional doc search paths (team/project knowledge)
const DOC_SEARCH_PATHS = [
  DOCS_DIR,
  join(process.cwd(), '.hipilot', 'docs'),          // project docs
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
    ],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

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
