#!/usr/bin/env node
/**
 * HiPilot Team Launcher - Creates 5-Agent Team using native Team API
 * This script launches the Supervisor and creates the team programmatically
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_DIR = join(__dirname, '..');

const HIPILOT_SESSION = process.env.HIPILOT_SESSION || 'hipilot';
const HIPILOT_TMPDIR = `/tmp/hipilot-${process.env.USER || 'user'}`;

mkdirSync(`${HIPILOT_TMPDIR}/agents`, { recursive: true });

console.log('HiPilot v0.9.0 - Team Launcher');
console.log('');

// Create Supervisor identity
createSupervisorIdentity();

// Create tmux session with 2 panes
createTmuxSession();

// Launch Supervisor in pane 0
launchSupervisor();

// Wait for Supervisor to be ready, then create team
console.log('Waiting for Supervisor to initialize...');
await sleep(10000);

createTeam();

console.log('');
console.log('✓ HiPilot Team workspace created!');
console.log('  - Pane 0: Supervisor (Team Lead)');
console.log('  - Teammates will appear in new panes via Team API');
console.log('  - Pane 1: EDA Tool (controlled by Executor)');
console.log('');

if (process.argv.includes('--no-terminal')) {
  console.log('Running in headless mode');
} else {
  console.log('Attaching to session...');
  execSync(`tmux -L ${HIPILOT_SESSION} attach-session`, { stdio: 'inherit' });
}

function createSupervisorIdentity() {
  const identity = `# You Are HiPilot - Supervisor Agent (TEAM LEAD)

**CRITICAL: Create the team immediately using TeamCreate API.**

## IMMEDIATE ACTION (Do This First!)

Create your team with these exact commands:

\`\`\`javascript
TeamCreate({ team_name: "hipilot-team", description: "HiPilot 5-Agent ASIC Design Team", teammateMode: "tmux" });

TaskCreate({ subject: "Knowledge Agent", description: "Brain interface - ASIC/EDA/Project queries" });
TaskCreate({ subject: "Planner Agent", description: "Strategy - execution planning" });
TaskCreate({ subject: "Executor Agent", description: "EDA controller - ONLY using eda.* MCP tools" });
TaskCreate({ subject: "Archivist Agent", description: "Recording - QoR metrics and history" });

Task({ team_name: "hipilot-team", name: "Knowledge", subagent_type: "general-purpose" });
Task({ team_name: "hipilot-team", name: "Planner", subagent_type: "general-purpose" });
Task({ team_name: "hipilot-team", name: "Executor", subagent_type: "general-purpose" });
Task({ team_name: "hipilot-team", name: "Archivist", subagent_type: "general-purpose" });
\`\`\`

## Rules

1. Create team IMMEDIATELY on startup
2. You NEVER use eda.* tools - ONLY Executor does
3. Use SendMessage for ALL coordination
4. You are the ONLY external interface
`;

  writeFileSync(`${HIPILOT_TMPDIR}/agents/Supervisor-CLAUDE.md`, identity);
}

function createTmuxSession() {
  try {
    execSync(`tmux -L ${HIPILOT_SESSION} kill-session 2>/dev/null || true`);
  } catch {}

  // Create session with 2 panes
  execSync(`tmux -L ${HIPILOT_SESSION} new-session -d -s ${HIPILOT_SESSION} -n "HiPilot" -c "${PROJECT_DIR}"`);
  execSync(`tmux -L ${HIPILOT_SESSION} split-window -h -l 50% -c "${PROJECT_DIR}"`);

  // Set environment
  execSync(`tmux -L ${HIPILOT_SESSION} set-environment CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS "1"`);
  execSync(`tmux -L ${HIPILOT_SESSION} set-environment HIPILOT_SESSION "${HIPILOT_SESSION}"`);

  // Status bar
  execSync(`tmux -L ${HIPILOT_SESSION} set-option status-left "#[fg=#00d4ff]HiPilot Team#[fg=#666666]|" 2>/dev/null || true`);

  // Setup EDA pane
  execSync(`tmux -L ${HIPILOT_SESSION} send-keys -t 1 "echo 'EDA Tool Pane - Ready for innovus/dc_shell/pt_shell'" C-m`);
}

function launchSupervisor() {
  console.log('Launching Supervisor Agent...');

  execSync(`tmux -L ${HIPILOT_SESSION} send-keys -t 0 "clear" C-m`);
  execSync(`tmux -L ${HIPILOT_SESSION} send-keys -t 0 "export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1" C-m`);
  execSync(`tmux -L ${HIPILOT_SESSION} send-keys -t 0 "export HIPILOT_AGENT_NAME=Supervisor" C-m`);
  execSync(`tmux -L ${HIPILOT_SESSION} send-keys -t 0 "cp '${HIPILOT_TMPDIR}/agents/Supervisor-CLAUDE.md' ./CLAUDE.md" C-m`);
  execSync(`tmux -L ${HIPILOT_SESSION} send-keys -t 0 "claude --dangerously-skip-permissions" C-m`);
}

function createTeam() {
  console.log('Sending team creation commands to Supervisor...');

  // Send the team creation prompt
  const teamCmd = `Create team 'hipilot-team' with 4 teammates using teammateMode: tmux. Teammates: Knowledge (brain queries), Planner (strategy), Executor (ONLY using eda.* MCP tools to control EDA pane), Archivist (recording).`;

  execSync(`tmux -L ${HIPILOT_SESSION} send-keys -t 0 "${teamCmd}" C-m`);

  console.log('Team creation command sent. Waiting for teammates to appear...');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
