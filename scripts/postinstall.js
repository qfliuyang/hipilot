#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  
  if (major < 20) {
    console.log(`Warning: Node.js ${version} detected. HiPilot requires Node.js 20+.`);
    return false;
  }
  return true;
}

function checkTmux() {
  try {
    execSync('which tmux', { stdio: 'ignore' });
    return true;
  } catch {
    console.log('Note: tmux not found (required for workspace management)');
    return false;
  }
}

function createConfigDirectory() {
  const hipilotDir = join(homedir(), '.hipilot');
  if (!existsSync(hipilotDir)) {
    mkdirSync(hipilotDir, { recursive: true });
  }
}

async function main() {
  checkNodeVersion();
  checkTmux();
  createConfigDirectory();
  
  console.log('\nHiPilot installed. Run "hipilot" to start.');
  console.log('Documentation: docs_latest/QUICK_START.md');
}

main().catch(console.error);
