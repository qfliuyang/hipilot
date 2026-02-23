#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  
  if (major < 20) {
    log(`⚠ Warning: Node.js ${version} detected. HiPilot requires Node.js 20+.`, COLORS.yellow);
    return false;
  }
  
  log(`✓ Node.js ${version} detected`, COLORS.green);
  return true;
}

function checkTmux() {
  try {
    execSync('which tmux', { stdio: 'ignore' });
    log('✓ tmux is installed', COLORS.green);
  } catch {
    log('⚠ tmux not found (required for workspace management)', COLORS.yellow);
  }
}

function createConfigDirectory() {
  const hipilotDir = join(homedir(), '.hipilot');
  
  if (!existsSync(hipilotDir)) {
    mkdirSync(hipilotDir, { recursive: true });
    log(`✓ Created config directory: ${hipilotDir}`, COLORS.green);
  }
}

function displayWelcome() {
  console.log('');
  log('╔════════════════════════════════════════════════════════════╗', COLORS.cyan);
  log('║                                                            ║', COLORS.cyan);
  log('║   ╔╦╗╔═╗╔═╗╔═╗╦═╗╔╦╗  ╔═╗╦ ╦╔═╗╦═╗  ╦ ╦╔═╗╦═╗╦ ╦        ║', COLORS.cyan);
  log('║    ║ ║╣ ╠╣ ║╣ ╠╦╝ ║   ║ ║║ ║╠╦╝  ╠═╣╠═╣╠╦╝╠═╣         ║', COLORS.cyan);
  log('║    ╩ ╚═╝╚  ╚═╝╩╚═ ╩   ╚═╝╚═╝╩╚═  ╩ ╩╩ ╩╩╚═╩ ╩         ║', COLORS.cyan);
  log('║                                                            ║', COLORS.cyan);
  log('║          VLSI Physical Design Copilot v0.5.0              ║', COLORS.cyan);
  log('║                                                            ║', COLORS.cyan);
  log('╚════════════════════════════════════════════════════════════╝', COLORS.cyan);
  console.log('');
}

function displayNextSteps() {
  console.log('');
  log('═══════════════════════════════════════════════════════════', COLORS.bold);
  log('                    NEXT STEPS', COLORS.bold);
  log('═══════════════════════════════════════════════════════════', COLORS.bold);
  console.log('');
  log('1. Configure MCP servers:', COLORS.blue);
  log('   $ hipilot setup', COLORS.cyan);
  console.log('');
  log('2. Start HiPilot workspace:', COLORS.blue);
  log('   $ hipilot', COLORS.cyan);
  console.log('');
  log('3. View available skills:', COLORS.blue);
  log('   $ hipilot skills list', COLORS.cyan);
  console.log('');
  log('4. Read documentation:', COLORS.blue);
  log('   $ cat docs_latest/QUICK_START.md', COLORS.cyan);
  console.log('');
  log('═══════════════════════════════════════════════════════════', COLORS.bold);
  console.log('');
  log('📚 Documentation: docs_latest/', COLORS.green);
  log('🐛 Issues: https://github.com/qfliuyang/hipilot/issues', COLORS.green);
  console.log('');
}

async function main() {
  displayWelcome();
  
  log('Checking installation...', COLORS.blue);
  console.log('');
  
  checkNodeVersion();
  
  console.log('');
  log('Checking dependencies...', COLORS.blue);
  checkTmux();
  
  console.log('');
  log('Setting up configuration...', COLORS.blue);
  createConfigDirectory();
  
  displayNextSteps();
}

main().catch(console.error);
