#!/usr/bin/env node
/**
 * HiPilot CLI - VLSI Physical Design Copilot
 *
 * Usage:
 *   hipilot           - Show status
 *   hipilot setup     - Install dependencies and register MCP servers
 *   hipilot workspace - Launch tmux workspace
 *   hipilot skills    - List available skills
 *   hipilot templates - List available Tcl templates
 *   hipilot version   - Show version
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { VERSION } from './lib/version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const colors = {
  cyan: '#8be9fd',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  red: '#ff5555',
};

function header() {
  const text = chalk.bold.white('HiPilot v' + VERSION) + '\n' + chalk.dim('VLSI Physical Design Copilot');
  console.log(boxen(text, {
    padding: 1,
    margin: { top: 1, bottom: 0, left: 1, right: 1 },
    borderStyle: 'double',
    borderColor: 'cyan',
  }));
  console.log('');
}

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
        hasContent: content.trim().length > 0,
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
        } catch { /* skip */ }
      }
    }
  };
  walk(templatesDir);
  return templates;
}

function checkDeps() {
  const nodeModules = join(PROJECT_ROOT, 'node_modules');
  return existsSync(nodeModules);
}

function detectEdaTool() {
  try {
    execSync('pgrep -f icc2_shell', { stdio: 'pipe' });
    return 'ICC2';
  } catch { /* not found */ }
  try {
    execSync('pgrep -f innovus', { stdio: 'pipe' });
    return 'Innovus';
  } catch { /* not found */ }
  try {
    execSync('pgrep -f pt_shell', { stdio: 'pipe' });
    return 'PrimeTime';
  } catch { /* not found */ }
  return null;
}

// --- Commands ---

function cmdStatus() {
  header();

  const ok = chalk.hex(colors.green)('✓');
  const no = chalk.hex(colors.red)('✗');
  const warn = chalk.hex(colors.yellow)('⚠');

  // Dependencies
  const depsOk = checkDeps();
  console.log(`  ${depsOk ? ok : no} Dependencies: ${depsOk ? 'installed' : 'not installed (run: hipilot setup)'}`);

  // MCP registration
  const mcp = checkMcpRegistered();
  console.log(`  ${mcp.registered ? ok : no} MCP servers: ${mcp.registered ? mcp.servers.join(', ') : 'not registered'}`);

  // Skills
  const skills = checkSkills();
  console.log(`  ${skills.length > 0 ? ok : warn} Skills: ${skills.length} loaded`);

  // Templates
  const templates = checkTemplates();
  console.log(`  ${templates.length > 0 ? ok : warn} Templates: ${templates.length} available`);

  // Command reference
  const cmdRefPath = join(PROJECT_ROOT, 'data', 'command-reference.json');
  let cmdCount = 0;
  if (existsSync(cmdRefPath)) {
    try {
      const ref = JSON.parse(readFileSync(cmdRefPath, 'utf-8'));
      cmdCount = ref.commands ? ref.commands.length : 0;
    } catch { /* skip */ }
  }
  console.log(`  ${cmdCount > 0 ? ok : warn} Command reference: ${cmdCount} commands`);

  // Quick commands
  const cmdDir = join(PROJECT_ROOT, '.claude', 'commands');
  let slashCmds = 0;
  if (existsSync(cmdDir)) {
    try { slashCmds = readdirSync(cmdDir).filter(f => f.endsWith('.md')).length; } catch { /* skip */ }
  }
  console.log(`  ${slashCmds > 0 ? ok : warn} Quick commands: ${slashCmds} available`);

  // EDA tool
  const edaTool = detectEdaTool();
  console.log(`  ${edaTool ? ok : chalk.dim('-')} EDA tool: ${edaTool || 'none detected'}`);

  console.log('');

  // Usage hint
  if (!depsOk) {
    console.log(chalk.hex(colors.yellow)('  Run "hipilot setup" to install dependencies.'));
  } else if (!mcp.registered) {
    console.log(chalk.hex(colors.yellow)('  Run "hipilot setup" to register MCP servers.'));
  } else {
    console.log(chalk.dim('  Getting started:'));
    console.log(chalk.dim('    1. Run "hipilot workspace" to launch tmux layout'));
    console.log(chalk.dim('    2. Start Claude Code in the chat pane: claude'));
    console.log(chalk.dim('    3. Start your EDA tool in the EDA pane'));
    console.log(chalk.dim('    4. Try: "fix setup timing on pcie_rx" or /project:timing'));
  }
  console.log('');
}

function cmdSetup() {
  header();
  console.log(chalk.hex(colors.cyan)('Running setup...\n'));

  try {
    execSync('bash bin/setup.sh', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.hex(colors.red)('Setup failed: ' + error.message));
    process.exit(1);
  }
}

function cmdWorkspace() {
  header();
  console.log(chalk.hex(colors.cyan)('Launching workspace...\n'));

  try {
    execSync('bash bin/hipilot', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.hex(colors.red)('Failed to launch workspace: ' + error.message));
    console.log(chalk.dim('\nMake sure tmux is installed: apt install tmux / brew install tmux'));
    process.exit(1);
  }
}

function cmdSkills() {
  header();

  const skills = checkSkills();

  if (skills.length === 0) {
    console.log(chalk.hex(colors.yellow)('  No skills found. Skills should be in skills/*.md'));
    console.log('');
    return;
  }

  const table = new Table({
    head: [chalk.hex(colors.cyan)('Skill'), chalk.hex(colors.cyan)('Description')],
    colWidths: [25, 55],
  });

  for (const skill of skills) {
    table.push([skill.name, skill.description]);
  }

  console.log(table.toString());
  console.log('');
  console.log(chalk.dim(`  ${skills.length} skills available`));
  console.log(chalk.dim('  Use in Claude Code: "use the fix-setup-timing skill"'));
  console.log('');
}

function cmdTemplates() {
  header();

  const templates = checkTemplates();

  if (templates.length === 0) {
    console.log(chalk.hex(colors.yellow)('  No templates found. Templates should be in templates/**/*.tcl'));
    console.log('');
    return;
  }

  console.log(chalk.bold('  Available Tcl Templates:\n'));
  for (const t of templates) {
    const vendor = t.startsWith('synopsys/') ? chalk.hex(colors.cyan)('[Synopsys]') :
                   t.startsWith('cadence/')  ? chalk.hex(colors.green)('[Cadence]')  : '';
    console.log(`    ${vendor} ${t}`);
  }
  console.log('');
  console.log(chalk.dim(`  ${templates.length} templates available`));
  console.log('');
}

function cmdVersion() {
  console.log(`hipilot v${VERSION}`);
}

function checkSlashCommands() {
  const cmdDir = join(PROJECT_ROOT, '.claude', 'commands');
  if (!existsSync(cmdDir)) return [];
  return readdirSync(cmdDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
}

function cmdHelp() {
  header();
  console.log('  Commands:\n');
  console.log('    hipilot              Show status');
  console.log('    hipilot setup        Install dependencies and detect EDA tools');
  console.log('    hipilot workspace    Launch tmux workspace (50/50 split)');
  console.log('    hipilot skills       List available skills');
  console.log('    hipilot templates    List available Tcl templates');
  console.log('    hipilot version      Show version');
  console.log('    hipilot help         Show this help');
  console.log('');
  console.log('  Quick Commands (in Claude Code):\n');
  console.log('    /project:timing      Run timing report and analyze');
  console.log('    /project:drc         Run DRC check and summarize');
  console.log('    /project:power       Power analysis');
  console.log('    /project:area        Area/utilization report');
  console.log('    /project:compare     Compare QoR with baseline');
  console.log('    /project:history     Show Tcl commands sent this session');
  console.log('');
  console.log('  MCP Tools:\n');
  console.log('    eda.generate_tcl        Generate Tcl from intent (Nunjucks templates)');
  console.log('    eda.send_to_terminal    Send Tcl to EDA pane');
  console.log('    eda.extract_qor         Extract QoR from reports');
  console.log('    eda.detect_tool         Detect running EDA tool');
  console.log('    tmux.send_keys          Send keys to pane');
  console.log('    tmux.capture_pane       Capture pane output');
  console.log('    tmux.update_status      Update status bar');
  console.log('    knowledge.search_docs   Search documentation');
  console.log('    knowledge.get_command_ref   Get command reference');
  console.log('    knowledge.match_skill   Match intent to skill');
  console.log('    knowledge.get_methodology  Get methodology guide');
  console.log('    knowledge.list_skills   List skills (3-level resolution)');
  console.log('');
  console.log('  Keyboard Shortcuts (in tmux workspace):\n');
  console.log('    Ctrl+E      Switch to EDA pane');
  console.log('    Ctrl+S      Save last generated Tcl');
  console.log('    prefix+h    Switch to Chat pane');
  console.log('');
}

// --- Main ---

const command = process.argv[2];

switch (command) {
  case 'setup':     cmdSetup(); break;
  case 'workspace': cmdWorkspace(); break;
  case 'skills':    cmdSkills(); break;
  case 'templates': cmdTemplates(); break;
  case 'version':
  case '--version':
  case '-v':        cmdVersion(); break;
  case 'help':
  case '--help':
  case '-h':        cmdHelp(); break;
  default:          cmdStatus(); break;
}
