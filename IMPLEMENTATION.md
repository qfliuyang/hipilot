# HiPilot Implementation Guide

**For Developers and Contributors**

This document provides deep technical details about HiPilot's architecture, implementation patterns, and extension points.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [MCP Server Implementation](#mcp-server-implementation)
3. [The Tmux Socket Chain](#the-tmux-socket-chain)
4. [Skill System](#skill-system)
5. [Template System](#template-system)
6. [HiTestBot Framework](#hitestbot-framework)
7. [Adding New Features](#adding-new-features)
8. [Code Samples](#code-samples)

---

## Architecture Overview

HiPilot consists of three layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   bin/      │  │  src/cli.js │  │  Claude Code (left) │  │
│  │  hipilot    │  │  (TUI)      │  │  (slashed commands) │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Orchestration Layer                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              MCP Servers (3 processes)                   ││
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────────────┐ ││
│  │  │ hipilot-eda │ │hipilot-tmux │ │ hipilot-knowledge  │ ││
│  │  │  (54 tools) │ │  (8 tools)  │ │    (7 tools)       │ ││
│  │  └─────────────┘ └─────────────┘ └────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                    Execution Layer                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              tmux Session (named socket)                 ││
│  │  ┌───────────────────┬───────────────────────────────┐  ││
│  │  │   Left Pane       │        Right Pane             │  ││
│  │  │   (Claude Code)   │    (EDA Tool Process)         │  ││
│  │  └───────────────────┴───────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## MCP Server Implementation

### What is MCP?

MCP (Model Context Protocol) is a JSON-RPC protocol where:
- **Client**: Claude Code (sends requests)
- **Server**: Node.js processes (handle requests)
- **Transport**: stdio (stdin/stdout pipes)

Claude spawns MCP servers as child processes on startup. Each server registers its tools, and Claude can call them by name.

### Server Structure

All three servers follow the same pattern:

```javascript
// servers/eda/index.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'hipilot-eda', version: '0.7.0' },
  { capabilities: { tools: {} } }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'eda.execute_and_verify',
        description: 'Execute Tcl in EDA tool and verify success',
        inputSchema: {
          type: 'object',
          properties: {
            tcl: { type: 'string', description: 'Tcl commands to execute' },
            description: { type: 'string', description: 'Human-readable description' },
            timeout: { type: 'number', description: 'Timeout in seconds' }
          },
          required: ['tcl', 'description']
        }
      },
      // ... more tools
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'eda.execute_and_verify':
      return await executeAndVerify(args);
    // ... more handlers
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Tool Implementation Pattern

Each tool follows a consistent pattern:

```javascript
async function executeAndVerify({ tcl, description, timeout = 300 }) {
  try {
    // 1. Generate execution script
    const scriptPath = await writeTempScript(tcl);

    // 2. Send to right pane
    await sendToPane(`innovus -no_gui -files ${scriptPath}`);

    // 3. Wait for completion
    const result = await waitForPrompt(timeout);

    // 4. Check for errors
    const errors = extractErrors(result.output);
    if (errors.length > 0) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${errors.join('\n')}`
        }],
        isError: true
      };
    }

    // 5. Return success
    return {
      content: [{
        type: 'text',
        text: `✓ ${description} completed successfully`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: error.message }],
      isError: true
    };
  }
}
```

### EDA Server Tools (54 total)

Key tool categories:

| Category | Tools | Examples |
|----------|-------|----------|
| **Execution** | 12 | `execute_and_verify`, `start_tool`, `stop_tool` |
| **Tcl Generation** | 15 | `generate_tcl`, `apply_template`, `render_nunjucks` |
| **QoR Extraction** | 10 | `extract_timing`, `extract_power`, `extract_area` |
| **Checkpoint** | 8 | `save_checkpoint`, `restore_checkpoint`, `list_checkpoints` |
| **Diagnosis** | 9 | `diagnose_error`, `analyze_violations`, `suggest_fixes` |

---

## The Tmux Socket Chain

### Why Named Sockets Matter

HiPilot uses `tmux -L hipilot` to create a **named tmux server**. This isolates HiPilot's session from any other tmux sessions the user might have.

**Critical**: Every component MUST use the same socket name, or they won't see each other.

### The Chain

```
bin/hipilot creates ────────┐
    tmux -L hipilot         │
         │                  │
         ▼                  │
    ~/.claude/settings.json │
    passes HIPILOT_SESSION  │
    env var to MCP servers  │
         │                  │
         ▼                  │
    MCP servers read        │
    process.env.HIPILOT_SESSION
    and use:                │
    tmux -L ${HIPILOT_SESSION}│
         │                  │
         ▼                  │
    HiTestBot uses          │
    this.socket = 'hipilot' │
                            │
All components connected ◄──┘
```

### Code Example: Tmux Commands

```javascript
// lib/tmux.js - All tmux operations use the socket

import { execSync } from 'child_process';

const SOCKET = process.env.HIPILOT_SESSION || 'hipilot';

export function sendKeys(pane, keys) {
  // CRITICAL: Always use -L ${SOCKET}
  execSync(`tmux -L ${SOCKET} send-keys -t ${pane} '${keys}'`);
}

export function capturePane(pane, lines = 1000) {
  const output = execSync(
    `tmux -L ${SOCKET} capture-pane -t ${pane} -p -S -${lines}`,
    { encoding: 'utf8' }
  );
  return output;
}

export function getPaneStatus() {
  try {
    const info = execSync(
      `tmux -L ${SOCKET} list-panes -F '#{pane_id} #{pane_current_command}'`,
      { encoding: 'utf8' }
    );
    return parsePaneInfo(info);
  } catch {
    return null;
  }
}
```

### Common Bug: Missing -L Flag

**Problem**: MCP server works on dev machine but not on EDA server

**Cause**: Code like this:
```javascript
// WRONG - uses default socket
execSync('tmux capture-pane -t 0.1');
```

**Fix**:
```javascript
// CORRECT - uses HiPilot socket
const socket = process.env.HIPILOT_SESSION || 'hipilot';
execSync(`tmux -L ${socket} capture-pane -t 0.1`);
```

---

## Skill System

### What are Skills?

Skills are markdown files in `skills/` that encode expert knowledge. They're documentation that Claude reads, not code that executes.

### Skill Structure

```markdown
# Skill Name

## When to Use
Describe the situation where this skill applies.

## Prerequisites
- Required files
- Required tools
- Design state requirements

## Procedure

### Step 1: Do Something
```tcl
# Tcl code here
set_var value
run_command
```

### Step 2: Do Next Thing
```tcl
# More Tcl
verify_result
```

## Verification
How to verify success.

## Common Issues
| Error | Cause | Solution |
|-------|-------|----------|
| Error text | Why it happens | How to fix |
```

### How Skills Are Loaded

```javascript
// servers/knowledge/index.js

const SKILL_DIR = join(PROJECT_ROOT, 'skills');

async function loadSkill(name) {
  const skillPath = join(SKILL_DIR, `${name}.md`);
  const content = await readFile(skillPath, 'utf8');

  // Parse frontmatter and content
  const { attributes, body } = parseFrontmatter(content);

  return {
    name,
    whenToUse: extractSection(body, 'When to Use'),
    prerequisites: extractSection(body, 'Prerequisites'),
    procedure: extractSection(body, 'Procedure'),
    verification: extractSection(body, 'Verification'),
    commonIssues: extractTable(body, 'Common Issues')
  };
}

// Tool: knowledge.get_skill
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === 'knowledge.get_skill') {
    const { skill_name } = req.params.arguments;
    const skill = await loadSkill(skill_name);
    return {
      content: [{ type: 'text', text: JSON.stringify(skill, null, 2) }]
    };
  }
});
```

### Example: Using Skills in Practice

When a user says "Fix my setup timing", Claude:

1. Calls `knowledge.search_skills({ query: 'setup timing' })`
2. Receives `fix-setup-timing.md` content
3. Reads the "When to Use" section to confirm relevance
4. Follows the "Procedure" section step by step
5. Uses the "Common Issues" table to diagnose errors

---

## Template System

### Why Templates?

Templates provide trusted, reusable Tcl patterns with variable substitution.

### Template Structure

```tcl
{# templates/cadence/innovus_report_timing.tcl #}

{# Variables #}
{% set delay_type = delay_type | default('max') %}
{% set num_paths = num_paths | default(10) %}
{% set format = format | default('summary') %}

{# Tcl Code #}
{% if format == 'summary' %}
report_timing -delay_type {{ delay_type }} \
    -max_paths {{ num_paths }} \
    -summary
{% else %}
report_timing -delay_type {{ delay_type }} \
    -max_paths {{ num_paths }} \
    -path_type full_clock \
    -nets \
    -transition_time \
    -capacitance
{% endif %}
```

### Rendering Templates

```javascript
// servers/eda/lib/template-renderer.js

import nunjucks from 'nunjucks';

const TEMPLATE_DIR = join(PROJECT_ROOT, 'templates');

// Configure Nunjucks
const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(TEMPLATE_DIR),
  { autoescape: false }
);

export function renderTemplate(templatePath, variables) {
  return new Promise((resolve, reject) => {
    env.render(templatePath, variables, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Tool implementation
async function applyTemplate({ template_name, variables }) {
  const templatePath = `cadence/${template_name}.tcl`;
  const tcl = await renderTemplate(templatePath, variables);

  return {
    content: [{
      type: 'text',
      text: `[✓ Template] ${template_name}\n\n${tcl}`
    }]
  };
}
```

### Template Badges

Generated Tcl is marked to indicate trust level:

| Badge | Meaning |
|-------|---------|
| `[✓ Template]` | Rendered from trusted template |
| `[⚠ Unverified]` | Generated from hardcoded pattern |
| `[✓ Pending Approval]` | Waiting for user approval |

---

## HiTestBot Framework

### Philosophy

HiTestBot tests HiPilot **as a human would**:
- Launches `bin/hipilot`
- Types commands in the left pane
- Reads both panes
- Presses keyboard shortcuts
- Never calls MCP tools directly

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FlowCertifier                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Launch    │──▶│   Observe   │──▶│  Interaction    │  │
│  │   Workspace │   │   Panes     │   │  (type/approve) │  │
│  └─────────────┘   └─────────────┘   └─────────────────┘  │
│         │                   │                   │         │
│         ▼                   ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Evidence Collection                     │  │
│  │  - Screenshots (ffmpeg + import)                    │  │
│  │  - Video recording                                  │  │
│  │  - Pane logs (tmux capture-pane)                    │  │
│  │  - MCP logs (HIPILOT_TEST_LOG)                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                          │                                │
│                          ▼                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Scoring (L1-L5)                         │  │
│  │  L1: Claude responded?                              │  │
│  │  L2: Understood task?                               │  │
│  │  L3: Used MCP tools?                                │  │
│  │  L4: EDA tool executed?                             │  │
│  │  L5: Reported QoR?                                  │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Core Classes

#### FlowCertifier

```javascript
// src/hitestbot/core/FlowCertifier.js

export class FlowCertifier {
  constructor(options) {
    this.socket = options.socket || 'hipilot';
    this.designDir = options.designDir;
    this.maxWait = options.maxWait || 300000;
    this.evidenceDir = options.evidenceDir;

    this.state = 'idle';
    this.timeline = [];
    this.observations = [];
  }

  async run(command) {
    // 1. Setup
    await this.killOldSessions();
    await this.launchHiPilot();
    await this.startRecording();

    // 2. Wait for Claude
    await this.waitForClaudePrompt();

    // 3. Type command
    await this.typeCommand(command);

    // 4. Watch and interact
    await this.monitorUntilDone();

    // 5. Collect evidence
    await this.collectEvidence();

    // 6. Score
    return this.scoreL1L5();
  }

  async typeCommand(command) {
    // Use tmux send-keys (like human typing)
    await this.tmuxSendKeys(`0.0`, command);
    await this.tmuxSendKeys(`0.0`, 'Enter');

    this.timeline.push({
      timestamp: Date.now(),
      event: 'command_typed',
      command
    });
  }

  async tmuxSendKeys(pane, keys) {
    // CRITICAL: Use -L flag
    execSync(`tmux -L ${this.socket} send-keys -t ${pane} -l '${keys}'`);
  }

  async captureObservation() {
    const leftPane = execSync(
      `tmux -L ${this.socket} capture-pane -t 0.0 -p -S -1000`,
      { encoding: 'utf8' }
    );
    const rightPane = execSync(
      `tmux -L ${this.socket} capture-pane -t 0.1 -p -S -1000`,
      { encoding: 'utf8' }
    );

    return new ObservationPoint({
      timestamp: Date.now(),
      leftPane,
      rightPane,
      state: this.detectState(leftPane, rightPane)
    });
  }

  detectState(leftPane, rightPane) {
    // Detect what state HiPilot is in
    if (leftPane.includes('[✓ Pending Approval]')) {
      return 'needs_approval';
    }
    if (rightPane.includes('innovus>') || rightPane.includes('icc2>')) {
      return 'eda_running';
    }
    if (leftPane.includes('❯') && !leftPane.includes('thinking')) {
      return 'claude_idle';
    }
    return 'working';
  }

  async approvePending() {
    // Press prefix+y (like human)
    execSync(`tmux -L ${this.socket} send-keys -t 0.0 C-b`);
    await sleep(100);
    execSync(`tmux -L ${this.socket} send-keys -t 0.0 y`);
  }
}
```

#### ObservationPoint

```javascript
// src/hitestbot/core/ObservationPoint.js

export class ObservationPoint {
  constructor({ timestamp, leftPane, rightPane, state }) {
    this.timestamp = timestamp;
    this.leftPane = leftPane;
    this.rightPane = rightPane;
    this.state = state;
    this.screenshotPath = null;
  }

  async captureScreenshot(outputPath) {
    // Use ImageMagick import (X11)
    execSync(`import -window root ${outputPath}`);
    this.screenshotPath = outputPath;
  }

  hasMcpCalls() {
    return this.leftPane.includes('hipilot-eda') ||
           this.leftPane.includes('hipilot-tmux') ||
           this.leftPane.includes('hipilot-knowledge');
  }

  hasQoRNumbers() {
    // Look for WNS/TNS patterns
    return /WNS[\s:]+-?\d+\.?\d*/.test(this.leftPane) ||
           /TNS[\s:]+-?\d+\.?\d*/.test(this.leftPane);
  }

  getErrors() {
    const errorPattern = /\*\*ERROR:\s*(.+)/g;
    const matches = [];
    let match;
    while ((match = errorPattern.exec(this.rightPane)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }
}
```

#### FlowReporter

```javascript
// src/hitestbot/core/FlowReporter.js

export class FlowReporter {
  generateReport(certifier) {
    const report = {
      summary: {
        command: certifier.command,
        duration: certifier.endTime - certifier.startTime,
        score: this.calculateScore(certifier.observations),
        status: this.determineStatus(certifier)
      },
      l1l5: {
        l1_prompt_delivery: this.scoreL1(certifier),
        l2_intent_recognition: this.scoreL2(certifier),
        l3_mcp_tool_usage: this.scoreL3(certifier),
        l4_eda_execution: this.scoreL4(certifier),
        l5_qor_assessment: this.scoreL5(certifier)
      },
      timeline: certifier.timeline,
      observations: certifier.observations.map(o => ({
        timestamp: o.timestamp,
        state: o.state,
        hasErrors: o.getErrors().length > 0
      }))
    };

    return report;
  }

  scoreL1(certifier) {
    // Did Claude respond?
    const firstObs = certifier.observations[0];
    const lastObs = certifier.observations[certifier.observations.length - 1];
    return lastObs.leftPane.length > firstObs.leftPane.length ? 1.0 : 0.0;
  }

  scoreL3(certifier) {
    // Did Claude use MCP tools?
    const hasMcp = certifier.observations.some(o => o.hasMcpCalls());
    return hasMcp ? 1.0 : 0.0;
  }

  scoreL5(certifier) {
    // Did Claude report QoR numbers?
    const hasQoR = certifier.observations.some(o => o.hasQoRNumbers());
    return hasQoR ? 1.0 : 0.0;
  }
}
```

### Running Tests

```bash
# Deploy and run on EDA server
bin/hitestbot-eda /synthesis

# Pull evidence to dev machine
bin/hitestbot-pull

# Evidence location: test-evidence/latest/
# - FLOW_REPORT.md: Summary and scores
# - timeline.jsonl: Chronological events
# - video.mp4: Full recording
# - screenshots/: Key moments
```

---

## Adding New Features

### Adding a New MCP Tool

1. **Define the tool** in `servers/eda/index.js`:

```javascript
// In ListToolsRequestSchema handler
{
  name: 'eda.my_new_tool',
  description: 'What it does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'What param1 does' }
    },
    required: ['param1']
  }
}
```

2. **Implement the handler**:

```javascript
// In CallToolRequestSchema handler
case 'eda.my_new_tool':
  return await myNewTool(args);
```

3. **Implement the function**:

```javascript
async function myNewTool({ param1 }) {
  // Your implementation
  return {
    content: [{ type: 'text', text: 'Result' }]
  };
}
```

4. **Update tool count** in documentation.

### Adding a New Skill

1. **Create markdown file** in `skills/my-skill.md`:

```markdown
# My Skill

## When to Use
Describe when to use this skill.

## Prerequisites
- List requirements

## Procedure
### Step 1
\`\`\`tcl
# Tcl code here
\`\`\`

## Verification
How to verify.

## Common Issues
| Error | Solution |
|-------|----------|
| Error | Fix |
```

2. **Test the skill** by asking Claude to use it.

### Adding a New Template

1. **Create file** in `templates/cadence/my-template.tcl`:

```tcl
{% set var = var | default('default') %}
command -option {{ var }}
```

2. **Test rendering**:

```bash
node -e "
const { renderTemplate } = require('./servers/eda/lib/template-renderer');
renderTemplate('cadence/my-template.tcl', { var: 'value' }).then(console.log);
"
```

---

## Code Samples

### Sample 1: Complete MCP Tool

```javascript
// servers/eda/tools/extract-timing.js

import { capturePane } from '../../lib/tmux.js';

/**
 * Extract timing metrics from EDA tool output
 */
export async function extractTiming({ report_file }) {
  // Read timing report if provided
  let output;
  if (report_file) {
    output = await readFile(report_file, 'utf8');
  } else {
    // Capture current pane
    output = capturePane('0.1', 5000);
  }

  // Extract WNS/TNS patterns
  const wnsMatch = output.match(/WNS\s*[:=]\s*(-?\d+\.?\d*)/i);
  const tnsMatch = output.match(/TNS\s*[:=]\s*(-?\d+\.?\d*)/i);
  const violMatch = output.match(/Violating\s*Paths?\s*[:=]\s*(\d+)/i);

  const metrics = {
    wns: wnsMatch ? parseFloat(wnsMatch[1]) : null,
    tns: tnsMatch ? parseFloat(tnsMatch[1]) : null,
    violating_paths: violMatch ? parseInt(violMatch[1]) : null,
    unit: 'ns'
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(metrics, null, 2)
    }]
  };
}
```

### Sample 2: Tool with Error Handling

```javascript
// servers/eda/tools/execute-with-retry.js

export async function executeWithRetry({ tcl, maxRetries = 3 }) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeAndVerify({ tcl });

      if (!result.isError) {
        return {
          content: [{
            type: 'text',
            text: `Success on attempt ${attempt}`
          }]
        };
      }

      lastError = result.content[0].text;

      // Wait before retry with exponential backoff
      await sleep(1000 * attempt);

    } catch (error) {
      lastError = error.message;
    }
  }

  return {
    content: [{
      type: 'text',
      text: `Failed after ${maxRetries} attempts. Last error: ${lastError}`
    }],
    isError: true
  };
}
```

### Sample 3: Complex Skill with Decision Logic

```markdown
# Fix Setup Timing Violations

## When to Use
When design has setup timing violations (negative WNS or TNS).

## Prerequisites
- Design is initialized
- Timing constraints are loaded
- A timing report has been run

## Procedure

### Step 1: Analyze Violations
```tcl
# Generate detailed timing report
report_timing -delay_type max \
    -max_paths 100 \
    -path_type full_clock \
    -transition_time \
    -capacitance \
    -nets \
    -outfile setup_vios.rpt
```

### Step 2: Identify Root Cause
Check the timing report for patterns:

**If high fanout nets:**
```tcl
# Apply load balancing
optDesign -preCTS -highFanoutNets
```

**If long wire delays:**
```tcl
# Add buffers
setOptMode -addBuffer true
optDesign -preCTS -drv
```

**If clock skew issue:**
```tcl
# Analyze clock tree
report_clock_timing -type skew
```

### Step 3: Apply Fixes
Run incremental optimization:
```tcl
setOptMode -fixSetupError true
optDesign -preCTS -setup
```

### Step 4: Verify
```tcl
timeDesign -prePlace -prefix after_fix
checkTiming
```

## Verification
- WNS > 0
- TNS = 0 or minimized
- No new DRC violations

## Common Issues
| Error | Cause | Solution |
|-------|-------|----------|
| Cannot meet timing | Over-constrained | Relax constraints or resize cells |
| Optimization diverges | Too aggressive | Reduce effort level |
```

### Sample 4: Tmux Pane Management

```javascript
// lib/pane-manager.js

import { execSync } from 'child_process';

const SOCKET = process.env.HIPILOT_SESSION || 'hipilot';

export class PaneManager {
  /**
   * Get current pane layout
   */
  getLayout() {
    const output = execSync(
      `tmux -L ${SOCKET} list-windows -F '#{window_id} #{window_name} #{window_layout}'`,
      { encoding: 'utf8' }
    );
    return output.trim().split('\n').map(line => {
      const [id, name, layout] = line.split(' ');
      return { id, name, layout };
    });
  }

  /**
   * Check if EDA tool is running
   */
  isEdaRunning() {
    try {
      const cmd = execSync(
        `tmux -L ${SOCKET} list-panes -t 0.1 -F '#{pane_current_command}'`,
        { encoding: 'utf8' }
      );
      const commands = ['innovus', 'icc2', 'pt_shell', 'dc_shell'];
      return commands.some(c => cmd.includes(c));
    } catch {
      return false;
    }
  }

  /**
   * Send interrupt (Ctrl+C) to right pane
   */
  interruptEda() {
    execSync(`tmux -L ${SOCKET} send-keys -t 0.1 C-c`);
  }

  /**
   * Wait for EDA prompt
   */
  async waitForPrompt(timeout = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const pane = execSync(
        `tmux -L ${SOCKET} capture-pane -t 0.1 -p`,
        { encoding: 'utf8' }
      );

      if (/innovus>\s*$/.test(pane) ||
          /icc2>\s*$/.test(pane) ||
          /pt_shell>\s*$/.test(pane)) {
        return true;
      }

      await sleep(1000);
    }
    throw new Error('Timeout waiting for EDA prompt');
  }
}
```

### Sample 5: HiTestBot Test Case

```javascript
// tests/synthesis-stage.test.js

import { FlowCertifier } from '../src/hitestbot/core/FlowCertifier.js';
import { strict as assert } from 'assert';

describe('RTL2GDS Flow', () => {
  let certifier;

  beforeEach(() => {
    certifier = new FlowCertifier({
      socket: 'test-hipilot',
      designDir: '/tmp/test-design',
      maxWait: 600000, // 10 minutes
      evidenceDir: './test-evidence/synthesis'
    });
  });

  afterEach(async () => {
    await certifier.cleanup();
  });

  test('should complete stage 1: design initialization', async () => {
    const result = await certifier.run('/synthesis');

    // L1: Claude responded
    assert(result.l1l5.l1_prompt_delivery >= 1.0, 'L1: Claude should respond');

    // L2: Understood task
    assert(result.l1l5.l2_intent_recognition >= 1.0, 'L2: Should understand RTL2GDS');

    // L3: Used MCP tools
    assert(result.l1l5.l3_mcp_tool_usage >= 1.0, 'L3: Should use MCP tools');

    // L4: EDA executed
    assert(result.l1l5.l4_eda_execution >= 0.5, 'L4: EDA tool should run');

    // Check no errors
    const hasErrors = result.timeline.some(e => e.type === 'error');
    assert(!hasErrors, 'Should have no errors');
  });

  test('should report QoR metrics', async () => {
    const result = await certifier.run('/synthesis');

    // L5: Reported QoR
    assert(result.l1l5.l5_qor_assessment >= 0.5, 'L5: Should report WNS/TNS');

    // Verify actual numbers present
    const hasWNS = result.observations.some(o => /WNS\s*[:=]\s*-?\d+/.test(o.leftPane));
    assert(hasWNS, 'Should have WNS number in output');
  });
});
```

---

## Development Commands

```bash
# Install all dependencies
npm run install:all

# Run unit tests
npm test

# Test MCP servers
node servers/eda/index.js --test
node servers/tmux/index.js --test
node servers/knowledge/index.js --test

# Deploy to EDA server
node src/hitestbot/infra/deploy_hipilot.js

# Run E2E test
bin/hitestbot-eda /synthesis

# Pull evidence
bin/hitestbot-pull

# Launch TUI
node src/cli.js status
node src/cli.js skills
node src/cli.js templates
```

---

## Key Principles

1. **The Socket Chain**: Always use `-L ${HIPILOT_SESSION}` in tmux commands
2. **Separation of Concerns**: HiPilot AI (deploy/eda-server/CLAUDE.md) ≠ Developer AI (root CLAUDE.md)
3. **Human Interface**: HiTestBot must use HiPilot like a human, never call MCP directly
4. **Trusted Templates**: Prefer templates over hardcoded Tcl
5. **Self-Contained**: Deployment includes node_modules, no npm install on EDA server

---

*For questions or contributions, see the project repository.*
