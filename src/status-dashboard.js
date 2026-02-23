#!/usr/bin/env node
import React from 'react';
import { render, Box, Text, useApp } from 'ink';
import { Header, StatusItem, QuickStart, QuickCommands, Divider, COLORS, STATUS_ICONS } from './tui/index.js';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { VERSION } from './lib/version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

function checkMcpRegistered() {
  const settingsPath = join(PROJECT_ROOT, '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return { registered: false, path: settingsPath };
  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const servers = Object.keys(settings.mcpServers || {});
    return { registered: servers.length > 0, servers, path: settingsPath };
  } catch {
    return { registered: false, path: settingsPath };
  }
}

function checkSkills() {
  const skillsDir = join(PROJECT_ROOT, 'skills');
  if (!existsSync(skillsDir)) return [];

  return readdirSync(skillsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = readFileSync(join(skillsDir, f), 'utf-8');
      if (content.trim().length === 0) return null;
      const nameMatch = content.match(/name:\s*(.*)/);
      const descMatch = content.match(/description:\s*(.*)/);
      return {
        file: f,
        name: nameMatch ? nameMatch[1].trim() : f.replace('.md', ''),
        description: descMatch ? descMatch[1].trim() : '',
      };
    })
    .filter(Boolean);
}

function checkTemplates() {
  const templatesDir = join(PROJECT_ROOT, 'templates');
  if (!existsSync(templatesDir)) return [];

  const templates = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.tcl') && entry.name !== '.gitkeep') {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (content.trim().length > 0) {
            templates.push(fullPath.replace(templatesDir + '/', ''));
          }
        } catch { }
      }
    }
  };
  walk(templatesDir);
  return templates;
}

function checkDeps() {
  return existsSync(join(PROJECT_ROOT, 'node_modules'));
}

function detectEdaTool() {
  try { execSync('pgrep -f icc2_shell', { stdio: 'pipe' }); return 'ICC2'; } catch { }
  try { execSync('pgrep -f innovus', { stdio: 'pipe' }); return 'Innovus'; } catch { }
  try { execSync('pgrep -f pt_shell', { stdio: 'pipe' }); return 'PrimeTime'; } catch { }
  return null;
}

function checkSlashCommands() {
  const cmdDir = join(PROJECT_ROOT, '.claude', 'commands');
  if (!existsSync(cmdDir)) return [];
  return readdirSync(cmdDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
}

function checkCommandRef() {
  const cmdRefPath = join(PROJECT_ROOT, 'data', 'command-reference.json');
  if (!existsSync(cmdRefPath)) return 0;
  try {
    const ref = JSON.parse(readFileSync(cmdRefPath, 'utf-8'));
    return ref.commands ? ref.commands.length : 0;
  } catch {
    return 0;
  }
}

function StatusDashboard() {
  const depsOk = checkDeps();
  const mcp = checkMcpRegistered();
  const skills = checkSkills();
  const templates = checkTemplates();
  const slashCmds = checkSlashCommands();
  const cmdCount = checkCommandRef();
  const edaTool = detectEdaTool();

  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Header, { version: VERSION }),
    React.createElement(Divider, null),
    
    React.createElement(Box, { flexDirection: 'column', paddingX: 2 },
      React.createElement(Text, { bold: true, color: COLORS.cyan }, 'System Status:'),
      React.createElement(Text, null, ''),
      
      React.createElement(StatusItem, {
        icon: depsOk ? STATUS_ICONS.ok : STATUS_ICONS.no,
        label: 'Dependencies',
        value: depsOk ? 'installed' : 'not installed',
        status: depsOk ? 'ok' : 'no'
      }),
      
      React.createElement(StatusItem, {
        icon: mcp.registered ? STATUS_ICONS.ok : STATUS_ICONS.no,
        label: 'MCP Servers',
        value: mcp.registered ? mcp.servers.join(', ') : 'not registered',
        status: mcp.registered ? 'ok' : 'no'
      }),
      
      React.createElement(StatusItem, {
        icon: skills.length > 0 ? STATUS_ICONS.ok : STATUS_ICONS.warn,
        label: 'Skills',
        value: `${skills.length} loaded`,
        status: skills.length > 0 ? 'ok' : 'warn'
      }),
      
      React.createElement(StatusItem, {
        icon: templates.length > 0 ? STATUS_ICONS.ok : STATUS_ICONS.warn,
        label: 'Templates',
        value: `${templates.length} available`,
        status: templates.length > 0 ? 'ok' : 'warn'
      }),
      
      React.createElement(StatusItem, {
        icon: cmdCount > 0 ? STATUS_ICONS.ok : STATUS_ICONS.warn,
        label: 'Command Reference',
        value: `${cmdCount} commands`,
        status: cmdCount > 0 ? 'ok' : 'warn'
      }),
      
      React.createElement(StatusItem, {
        icon: slashCmds.length > 0 ? STATUS_ICONS.ok : STATUS_ICONS.warn,
        label: 'Quick Commands',
        value: `${slashCmds.length} available`,
        status: slashCmds.length > 0 ? 'ok' : 'warn'
      }),
      
      React.createElement(StatusItem, {
        icon: edaTool ? STATUS_ICONS.running : '○',
        label: 'EDA Tool',
        value: edaTool || 'none detected',
        status: edaTool ? 'ok' : 'pending'
      })
    ),
    
    React.createElement(Divider, null),
    
    !depsOk && React.createElement(Box, { paddingX: 2 },
      React.createElement(Text, { color: COLORS.yellow }, 
        `  ${STATUS_ICONS.warn} Run "hipilot setup" to install dependencies`)
    ),
    
    !mcp.registered && React.createElement(Box, { paddingX: 2 },
      React.createElement(Text, { color: COLORS.yellow }, 
        `  ${STATUS_ICONS.warn} Run "hipilot setup" to register MCP servers`)
    ),
    
    depsOk && mcp.registered && React.createElement(React.Fragment, null,
      React.createElement(QuickStart, null),
      React.createElement(Divider, null),
      React.createElement(QuickCommands, null)
    ),
    
    React.createElement(Box, { marginTop: 2, paddingX: 2 },
      React.createElement(Text, { color: COLORS.gray, dimColor: true }, 
        '  Type "hipilot help" for more commands.')
    )
  );
}

render(React.createElement(StatusDashboard));
