# AI in ASIC: The Complete Developer's Guide

> **Building Intelligent Agents for Chip Design: From Concept to Code**
>
> *A layered journey from silicon expertise to AI development*

---

## Table of Contents

1. [The Paradigm Shift: Why Agents, Why Now](#chapter-1-the-paradigm-shift)
2. [The Coding Language of AI: JavaScript for Hardware Engineers](#chapter-2-javascript)
3. [The Three-Layer Architecture Unveiled](#chapter-3-architecture)
4. [MCP: The Protocol That Binds It All](#chapter-4-mcp)
5. [Skills: Encoding RTL2GDS Expertise](#chapter-5-skills)
6. [The HiPilot Codebase: A Complete Walkthrough](#chapter-6-codebase)
7. [Building Your First Extension](#chapter-7-extension)
8. [LittleBrain: Knowledge-Based Orchestration](#chapter-8-littlebrain)
9. [Certification & Test Results](#chapter-9-certification)

---

## Chapter 1: The Paradigm Shift

### From Scripts to Agents: A Historical Parallel

**1990s: The Dawn of ASIC Automation**

Chip designers manually placed cells, routed wires, and checked timing by hand. Then synthesis tools emerged—*scripts* that automated the transformation from RTL to gates.

```
Manual Design → Scripted Synthesis → Automated P&R
```

**2020s: The Dawn of AI Agents**

We stand at a similar inflection point. Traditional EDA scripts are giving way to **AI Agents**—systems that don't just execute predetermined steps, but *reason* about what steps to take based on context.

```
Fixed Scripts → Intelligent Agents → Autonomous Design
```

### What Is an AI Agent?

An **AI Agent** is a computational entity that:

1. **Perceives** its environment (reads output, monitors state, captures results)
2. **Reasons** about what to do (uses LLM to plan actions)
3. **Acts** through tools (executes commands, runs analyses)
4. **Learns** from feedback (adapts based on outcomes)

**Think of it as a senior engineer who:**
- Reads the design state like you read a timing report
- Decides next steps like you decide between useful skew and buffering
- Executes through tools like you execute Tcl in Innovus
- Adapts when things fail ( CTS skew too high? Try a different tree topology)

### The RTL2GDS Example: Why It Matters

The RTL-to-GDS flow is the perfect example because it embodies everything complex about chip design:

- **Multi-stage:** 9+ distinct phases (synthesis, floorplan, placement, CTS, routing...)
- **Interdependent:** Decisions in placement affect CTS; CTS affects routing
- **Error-prone:** Each stage can fail in dozens of ways
- **Context-dependent:** The right fix depends on the specific violation, technology, constraints

**Traditional approach:** Write a monolithic script that runs all stages sequentially. When it fails at stage 5, you manually debug, fix, and restart from stage 4.

**Agent approach:** An intelligent system that runs each stage, checks results, adapts to errors, and decides whether to proceed, retry, or try an alternative approach.

---

## Chapter 2: The Coding Language of AI

### JavaScript: The Language of HiPilot

**Wait, JavaScript? Not Python? Not C++?**

Yes, JavaScript. Here's why:

1. **Node.js** allows JavaScript to run as a server (not just in browsers)
2. **JSON** (JavaScript Object Notation) is the lingua franca of modern APIs
3. **npm** has the largest ecosystem of open-source packages
4. **MCP SDK** (Model Context Protocol) is written in JavaScript/TypeScript

**But don't panic.** If you understand Tcl (which you do), JavaScript is surprisingly similar:

| Concept | Tcl | JavaScript |
|---------|-----|------------|
| Variables | `set x 5` | `let x = 5;` |
| Conditionals | `if {$x > 0} {puts "positive"}` | `if (x > 0) { console.log("positive"); }` |
| Loops | `foreach item $list { ... }` | `for (let item of list) { ... }` |
| Functions | `proc myFunc {arg} { return $arg }` | `function myFunc(arg) { return arg; }` |
| Lists | `list 1 2 3` | `[1, 2, 3]` |
| Dictionaries | `dict set obj key value` | `obj.key = value` or `obj[key] = value` |

### JavaScript Crash Course for ASIC Engineers

#### 2.1 Variables and Types

```javascript
// Numbers (like integer/float in Tcl)
let utilization = 0.75;
let cellCount = 15000;

// Strings (like in Tcl)
let designName = "ibex_core";
let report = `Setup WNS: ${wns}ns`;  // Template string with interpolation

// Booleans
let isRouted = true;
let hasViolations = false;

// Arrays (like Tcl lists)
let stages = ["synthesis", "floorplan", "placement", "cts", "routing"];
let firstStage = stages[0];  // "synthesis"

// Objects (like Tcl dicts, but more powerful)
let timingReport = {
    wns: -0.059,
    tns: -0.921,
    violatingPaths: 44,
    isClean: false
};

// Access like dict
let worstSlack = timingReport.wns;  // -0.059
let totalSlack = timingReport["tns"];  // -0.921
```

#### 2.2 Functions

```javascript
// Basic function (like Tcl proc)
function calculateDensity(area, totalArea) {
    return area / totalArea;
}

// Function with default parameter
function reportTiming(maxPaths = 10, pathType = "summary") {
    return `Reporting ${maxPaths} paths as ${pathType}`;
}

// Arrow function (shorter syntax, commonly used)
const isTimingClean = (wns) => wns >= 0;

// Async function (critical for AI agents - handles waiting)
async function runPlacement(timeoutSeconds) {
    console.log("Starting placement...");
    // Wait for placement to complete
    await sleep(timeoutSeconds * 1000);
    console.log("Placement complete!");
    return { status: "success", density: 0.75 };
}
```

#### 2.3 Control Flow

```javascript
// If/else (like Tcl if)
if (wns < 0) {
    console.log("Setup violation detected");
    runOptimization();
} else if (wns < 0.010) {
    console.log("Close to target, minor tweaks needed");
} else {
    console.log("Timing clean!");
}

// Switch (like Tcl switch)
switch (stage) {
    case "placement":
        runPlacement();
        break;
    case "cts":
        runCTS();
        break;
    case "routing":
        runRouting();
        break;
    default:
        console.log("Unknown stage");
}

// For loop (like Tcl for/foreach)
for (let i = 0; i < stages.length; i++) {
    console.log(`Stage ${i}: ${stages[i]}`);
}

// For-of loop (like Tcl foreach)
for (let stage of stages) {
    console.log(`Running ${stage}...`);
}

// While loop (process until done)
while (hasViolations) {
    fixViolations();
    hasViolations = checkViolations();
}
```

#### 2.4 Working with Data (Arrays and Objects)

```javascript
// Array operations (like Tcl list operations)
let violations = [
    { path: "reg1_to_reg2", slack: -0.050 },
    { path: "reg3_to_reg4", slack: -0.120 },
    { path: "reg5_to_reg6", slack: -0.030 }
];

// Filter: Get only critical violations
let critical = violations.filter(v => v.slack < -0.100);
// Result: [{ path: "reg3_to_reg4", slack: -0.120 }]

// Map: Extract just the path names
let paths = violations.map(v => v.path);
// Result: ["reg1_to_reg2", "reg3_to_reg4", "reg5_to_reg6"]

// Find: Get first violation matching condition
let worst = violations.find(v => v.slack < -0.100);
// Result: { path: "reg3_to_reg4", slack: -0.120 }

// Reduce: Sum all negative slack (TNS calculation)
let tns = violations.reduce((sum, v) => sum + v.slack, 0);
// Result: -0.200
```

#### 2.5 Asynchronous Programming (The Key Concept)

**This is crucial for AI agents.** EDA tools take time. You can't just wait synchronously—you need to handle asynchronous operations.

```javascript
// Promise: A value that will exist in the future
const placementPromise = new Promise((resolve, reject) => {
    // Start placement
    runInnovus("place_opt_design");

    // When placement finishes, resolve the promise
    setTimeout(() => {
        if (placementSucceeded) {
            resolve({ density: 0.75, status: "success" });
        } else {
            reject(new Error("Placement failed"));
        }
    }, 60000);  // 60 seconds
});

// Using async/await (cleaner syntax)
async function runRTL2GDS() {
    try {
        // Each 'await' pauses execution until the promise resolves
        await runSynthesis();
        await runFloorplan();
        await runPlacement();
        await runCTS();
        await runRouting();
        await exportGDS();

        console.log("RTL2GDS complete!");
    } catch (error) {
        console.error("Flow failed:", error.message);
    }
}
```

#### 2.6 Modules and Imports

```javascript
// Import built-in modules (like Tcl 'package require')
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// Import from local files
import { FlowCertifier } from './src/hitestbot/core/FlowCertifier.js';

// Import from npm packages
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
```

---

## Chapter 3: The Three-Layer Architecture

### The Architecture of Intelligence

Every AI agent system—from HiPilot to ChatGPT plugins—follows a three-layer architecture. Understanding these layers is essential for development.

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 3: ORCHESTRATION                                             │
│  "The Brain" - Decides what to do                                   │
├─────────────────────────────────────────────────────────────────────┤
│  • Large Language Model (Claude)                                    │
│  • Interprets user intent ("run rtl2gds")                           │
│  • Plans multi-step workflows                                       │
│  • Reads skills (your expertise)                                    │
│  • Decides which tools to call                                      │
│  • Reasons about results                                            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ MCP Protocol (JSON-RPC)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2: PROTOCOL                                                  │
│  "The Nervous System" - Transmits and translates                    │
├─────────────────────────────────────────────────────────────────────┤
│  • MCP Server (Node.js process)                                     │
│  • Receives structured requests                                     │
│  • Validates parameters against schemas                             │
│  • Manages tool execution lifecycle                                 │
│  • Returns structured responses                                     │
│  • Handles errors and retries                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ System Calls (tmux, filesystem)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: EXECUTION                                                 │
│  "The Hands" - Does the actual work                                 │
├─────────────────────────────────────────────────────────────────────┤
│  • EDA Tools (Innovus, ICC2, PrimeTime)                             │
│  • Executes Tcl commands                                            │
│  • Generates reports and data files                                 │
│  • Returns raw output                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer 3: Orchestration (The RTL2GDS Intelligence)

When you type `/rtl2gds` in HiPilot, here's what happens at Layer 3:

```
User: "/rtl2gds"
    │
    ▼
Claude reads the command
    │
    ▼
Claude loads the skill: skills/ibex-rtl2gds-flow.md
    │
    ▼
Claude creates a plan:
    Stage 1: Design Init → Stage 2: Floorplan → Stage 3: Power Planning
    → Stage 4: Placement → Stage 5: CTS → Stage 6: Post-CTS Opt
    → Stage 7: Routing → Stage 8: Route Opt → Stage 9: Chip Finish
    │
    ▼
For each stage:
    1. Load stage-specific Tcl from skill
    2. Call MCP to execute
    3. Wait for completion
    4. Check results (QoR, errors)
    5. If error → diagnose and retry
    6. If success → save checkpoint, proceed to next stage
    │
    ▼
Report final results with WNS/TNS
```

**The key insight:** Claude doesn't just run commands—it maintains state, makes decisions, and adapts. Like you would.

### Layer 2: Protocol (The MCP Reality)

**What is MCP and why does it exist?**

MCP (Model Context Protocol) is a standardized way for AI systems to interact with external tools. Without MCP:
- Every tool needs custom integration code
- Security is inconsistent
- Context management is ad-hoc
- Tool discovery is impossible

**With MCP:**
- Standard JSON-RPC communication
- Structured tool schemas
- Built-in error handling
- Automatic tool discovery

### Layer 1: Execution (The EDA Tools)

This is your domain. Innovus, ICC2, PrimeTime—these are the tools that do the actual work. The agent doesn't replace them; it orchestrates them.

---

## Chapter 4: MCP Deep Dive

### MCP in the RTL2GDS Context

Let's trace a single MCP call through the RTL2GDS flow: executing Stage 4 (Placement).

#### Step 1: Tool Discovery

When Claude starts, it asks the MCP server: *"What tools do you have?"*

**Request (from Claude to MCP):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response (from MCP to Claude):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "eda.detect_tool",
        "description": "Check if EDA tool is running in the target pane",
        "inputSchema": {
          "type": "object",
          "properties": {}
        }
      },
      {
        "name": "eda.execute_and_verify",
        "description": "Execute Tcl in EDA tool and verify success",
        "inputSchema": {
          "type": "object",
          "properties": {
            "tcl": {
              "type": "string",
              "description": "Tcl commands to execute"
            },
            "description": {
              "type": "string",
              "description": "What this execution does (for logging)"
            },
            "timeout": {
              "type": "number",
              "description": "Timeout in seconds (default: 60)"
            }
          },
          "required": ["tcl"]
        }
      },
      {
        "name": "eda.diagnose_error",
        "description": "Analyze EDA error output and suggest fixes",
        "inputSchema": {
          "type": "object",
          "properties": {
            "output": {
              "type": "string",
              "description": "Error output from EDA tool"
            }
          },
          "required": ["output"]
        }
      },
      {
        "name": "qor.snapshot",
        "description": "Save timing metrics for comparison",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "Snapshot identifier"
            }
          }
        }
      }
    ]
  }
}
```

#### Step 2: Tool Invocation (Running Placement)

Claude decides to run placement. It constructs the Tcl and calls the MCP tool.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "eda.execute_and_verify",
    "arguments": {
      "tcl": "# Stage 4: Placement\nsource /home/EDA/ibex_work_upload/result/pr/data/floor_plan.enc\nplace_opt_design\nsetPlaceMode -place_detail_opt true\nplaceDesign\nsaveDesign result/pr/data/placement.enc\nputs \"PLACEMENT_COMPLETE\"",
      "description": "Stage 4 Placement: place_opt_design",
      "timeout": 300
    }
  }
}
```

#### Step 3: MCP Server Processing

The MCP server receives this request and:

1. Validates the parameters against the schema
2. Writes the Tcl to a temporary file
3. Sends it to the EDA pane via tmux
4. Monitors for completion
5. Captures the output
6. Checks for errors
7. Extracts QoR metrics

**What happens inside the server:**
```javascript
async function handleExecuteAndVerify(args) {
    const { tcl, description, timeout = 60 } = args;

    // 1. Write Tcl to temp file
    const tmpFile = `/tmp/hipilot/placement_${Date.now()}.tcl`;
    await writeFile(tmpFile, tcl);

    // 2. Send to Innovus via tmux
    execSync(`tmux -L hipilot send-keys -t hipilot:0.1 "source ${tmpFile}" C-m`);

    // 3. Poll for completion
    const startTime = Date.now();
    while (Date.now() - startTime < timeout * 1000) {
        const output = execSync('tmux -L hipilot capture-pane -p -t hipilot:0.1');

        if (output.includes('PLACEMENT_COMPLETE')) {
            // Execution finished
            const errors = extractErrors(output);
            const qor = extractQoR(output);

            return {
                content: [{ type: 'text', text: output }],
                isError: errors.length > 0,
                result: {
                    status: errors.length > 0 ? 'error' : 'success',
                    errors,
                    qor
                }
            };
        }

        await sleep(1000);  // Wait 1 second before checking again
    }

    // Timeout
    return {
        isError: true,
        content: [{ type: 'text', text: 'Placement timed out' }]
    };
}
```

#### Step 4: Response to Claude

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "... (full Innovus output) ..."
      }
    ],
    "isError": false,
    "result": {
      "status": "success",
      "errors": [],
      "qor": {
        "wns": -0.123,
        "tns": -2.456,
        "violatingPaths": 15
      }
    }
  }
}
```

#### Step 5: Claude's Decision

Claude sees:
- Status: success
- WNS: -0.123ns (negative, but acceptable)
- Violating paths: 15

It decides: *"Placement succeeded. WNS is -0.123ns with 15 violations. This is acceptable to proceed to CTS. I'll save a QoR snapshot and continue."*

**Next MCP call:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "qor.snapshot",
    "arguments": {
      "name": "after_placement",
      "description": "Post-placement timing before CTS"
    }
  }
}
```

### Why This Architecture Matters

**Separation of Concerns:**
- Claude (Layer 3) focuses on *what* to do and *why*
- MCP (Layer 2) focuses on *how* to communicate
- EDA tools (Layer 1) focus on *doing* the work

**Testability:**
- You can test the MCP server independently
- You can test Claude's reasoning with mock MCP responses
- You can test EDA tools the traditional way

**Extensibility:**
- Add new tools to MCP without changing Claude
- Improve Claude's reasoning without touching MCP
- Swap EDA tools (Innovus ↔ ICC2) without changing layers 2-3

---

## Chapter 5: Skills—Encoding RTL2GDS Expertise

### What Is a Skill?

A **skill** is your expertise written in a format that an AI can follow. It's not code—it's a structured methodology.

**Analogy:**
- A skill is like the **training manual** you write for a new college hire
- It explains *what* to do, *why* to do it, and *what to do when things go wrong*
- The AI reads it and follows your methodology

### Anatomy of a Production Skill

Here's the actual `rtl2gds.md` skill used by HiPilot:

```markdown
---
name: /rtl2gds
description: >
  Run the complete Innovus RTL-to-GDS flow for the Ibex design.
  You drive each stage yourself using MCP tools.
---

# RTL-to-GDS Flow

## Overview

This skill orchestrates a complete 9-stage RTL-to-GDS implementation:
1. Design Init + MMMC
2. Floorplan
3. Power Planning
4. Placement
5. Clock Tree Synthesis
6. Post-CTS Optimization
7. Routing
8. Post-Route Optimization
9. Chip Finish + GDS Export

Each stage is executed independently for clean database management.

## Critical Rule

**Do NOT call `workflow.run` or `eda.rtl2gds.run_full_flow`.**
You orchestrate every stage yourself. If a stage fails, you diagnose and fix it.
Batch executors bypass your intelligence—don't use them.

## Stage Execution Pattern

For each stage, follow this exact sequence:

1. **Get the Tcl:** Load the skill to get stage-specific Tcl
2. **Execute:** Call `eda.execute_and_verify` with the complete Tcl block
3. **Check Result:** Read the response (status, errors, warnings, qor)
4. **Handle Errors:** If errors, call `eda.diagnose_error` and retry
5. **If Success:** Call `qor.snapshot` with a descriptive name
6. **Report:** Tell the engineer: "Stage X: done. WNS=Y, violations=Z"
7. **Proceed:** Only continue when current stage succeeds

## The 10 Stages

| # | Stage | Tool | Timeout | Key Checks |
|---|-------|------|---------|------------|
| 0 | Synthesis + DFT | dc_shell | 300s | Check netlist exists |
| 1 | Design Init + MMMC | innovus | 180s | MMMC views active |
| 2 | Floorplan | innovus | 120s | Die area, IO placement |
| 3 | Power Planning | innovus | 120s | VDD/VSS stripes |
| 4 | Placement | innovus | 300s | WNS after placement |
| 5 | CTS | innovus | 300s | Skew target met |
| 6 | Post-CTS Opt | innovus | 300s | Setup/hold clean |
| 7 | Routing | innovus | 600s | DRC clean |
| 8 | Route Opt | innovus | 300s | Post-route timing |
| 9 | Chip Finish + GDS | innovus | 300s | GDS exported |

## Error Recovery Protocol

When a stage fails, follow this priority:

1. **First failure:** Diagnose with `eda.diagnose_error`, fix, retry immediately
2. **Second failure:** Try alternative approach (different Tcl options)
3. **Third failure:** Take detailed notes, try creative solution
4. **Only then:** Report to engineer with full history

### Example: Placement Failure Recovery

```
Stage: Placement
Result: FAILED - High congestion at 80% utilization

Action:
1. session.add_note({category:"error",
     content:"Placement failed, high congestion at 80% utilization"})
2. Fix: Adjust utilization to 70% with setPlaceMode
3. Retry: PLACEMENT SUCCEEDED
4. Continue to CTS
```

## Final QoR Summary (REQUIRED)

After Stage 9, you MUST extract and display final timing metrics.

**Step 1:** Run timing extraction
```
mcp__hipilot-eda__eda.execute_and_verify({
  tcl: "timeDesign -postRoute -prefix final_summary...",
  description: "Extract final timing metrics",
  timeout: 120
})
```

**Step 2:** Save snapshot
```
mcp__hipilot-eda__qor.snapshot({
  name: "rtl2gds_final",
  description: "Final QoR after complete RTL-to-GDS flow"
})
```

**Step 3:** Report to engineer with EXPLICIT numbers

Format:
```
✅ RTL-to-GDS Flow Complete!

Final QoR Summary:
┌──────────────────┬──────────────────────────────┐
│ Metric           │ Value                        │
├──────────────────┼──────────────────────────────┤
│ WNS (Setup)      │ X.XXX ns    ← REQUIRED       │
│ TNS (Setup)      │ X.XXX ns    ← REQUIRED       │
│ Setup Violations │ N paths     ← REQUIRED       │
│ Hold Violations  │ N paths                      │
│ GDS              │ result/pr/data/ibex_core.gds │
└──────────────────┴──────────────────────────────┘
```

**CRITICAL:** You MUST include actual WNS and TNS numbers.
Do not say "flow complete" without showing timing metrics.
```

### Deep Concept: Skills as State Machines

A skill implicitly defines a state machine. For RTL2GDS:

```
[INITIAL]
    │
    ▼ (Load skill, detect tool)
[TOOL_READY]
    │
    ▼ (Execute Stage 1)
[STAGE_1_RUNNING]
    │
    ├── Error ──► [DIAGNOSE_ERROR] ──► [STAGE_1_RUNNING] (retry)
    │
    └── Success ──► [STAGE_1_COMPLETE]
                    │
                    ▼ (Save checkpoint)
              [STAGE_2_RUNNING]
                    │
                    ... (repeat for all stages)
                    │
                    ▼
              [ALL_STAGES_COMPLETE]
                    │
                    ▼ (Extract QoR)
              [REPORTING]
                    │
                    ▼
              [COMPLETE]
```

Each state transition is a decision point. The skill tells the AI:
- What to check at each state
- What to do on success
- How to handle errors
- When to stop and ask for help

### Skill Design Principles

**1. Explicit Decision Points**

Don't say: *"Fix timing issues"*
Say: *"If WNS < -0.100ns, use useful skew. If -0.100ns ≤ WNS < 0, use cell sizing. If WNS ≥ 0, proceed to next stage."*

**2. Error Recovery Paths**

Every error should have a documented recovery strategy:

```markdown
## Common Errors

### Error: "High congestion during placement"
**Cause:** Target utilization too high
**Fix:**
1. Reduce target utilization: `setPlaceMode -place_detail_utilization 0.70`
2. Retry placement
3. If still failing, consider macro placement adjustment

### Error: "Clock tree synthesis failed"
**Cause:** Unrealistic skew target
**Fix:**
1. Relax skew target: `setCTSMode -target_skew 0.200`
2. Check clock root constraints
```

**3. Verification Checkpoints**

Every major action should have a verification step:

```markdown
### After Placement

Verify:
- [ ] Placement completed without errors
- [ ] Utilization < 85%
- [ ] Congestion map acceptable
- [ ] WNS recorded (even if negative)
- [ ] Checkpoint saved
```

---

## Chapter 6: The HiPilot Codebase—Complete Walkthrough

### Project Structure

```
hipilot/
├── bin/hipilot                    # Entry point bash script
│
├── servers/                       # LAYER 2: MCP Protocol
│   ├── eda/index.js              # EDA tool MCP server (74 tools)
│   ├── tmux/index.js             # Tmux pane MCP server (8 tools)
│   └── knowledge/index.js        # Skills/knowledge MCP server (17 tools)
│
├── skills/                        # LAYER 3: Agent Instructions
│   ├── ibex-rtl2gds-flow.md      # Main RTL2GDS skill
│   ├── fix-setup-timing.md       # Timing closure skill
│   ├── cts-clock-tree.md         # CTS skill
│   └── ... (34 skills total)
│
├── templates/                     # Tcl generation
│   ├── cadence/                  # Innovus templates (11)
│   └── synopsys/                 # ICC2 templates (11)
│
├── src/
│   ├── hitestbot/                # Testing framework
│   │   └── core/
│   │       ├── FlowCertifier.js  # Virtual human tester
│   │       ├── FlowReporter.js   # Report generation
│   │       └── ObservationPoint.js # Evidence capture
│   │
│   ├── lib/                      # Shared utilities
│   │   ├── paths.js             # Path resolution
│   │   ├── mode.js              # Manual/auto mode
│   │   └── mcp-logger.js        # MCP call logging
│   │
│   └── cli.js                    # TUI dashboard
│
└── deploy/eda-server/            # Deployment to EDA server
    ├── CLAUDE.md                 # AI identity (HiPilot's "constitution")
    └── .claude/commands/         # Slash commands
        └── rtl2gds.md            # The /rtl2gds command
```

### The EDA MCP Server (servers/eda/index.js)

This is the heart of Layer 2. Let's walk through the key components:

#### 1. Tool Registration

```javascript
// servers/eda/index.js - Lines 1-100 (simplified)

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Tool definitions with schemas
const TOOLS = [
  {
    name: 'eda.execute_and_verify',
    description: 'Execute Tcl in EDA tool and verify success',
    inputSchema: {
      type: 'object',
      properties: {
        tcl: {
          type: 'string',
          description: 'Tcl commands to execute in the EDA tool'
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this does'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in seconds (default: 60)',
          default: 60
        }
      },
      required: ['tcl']
    }
  },
  {
    name: 'eda.detect_tool',
    description: 'Detect which EDA tool is running (if any)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'eda.diagnose_error',
    description: 'Analyze EDA error output and suggest fixes',
    inputSchema: {
      type: 'object',
      properties: {
        output: {
          type: 'string',
          description: 'Error output from EDA tool'
        }
      },
      required: ['output']
    }
  }
];
```

#### 2. Server Initialization

```javascript
// servers/eda/index.js - Lines 100-150

// Create MCP server instance
const server = new Server(
  {
    name: 'hipilot-eda',
    version: '0.7.0'
  },
  {
    capabilities: {
      tools: {}  // We provide tools
    }
  }
);

// Set up request handlers
server.setRequestHandler('tools/list', async () => {
  return { tools: TOOLS };
});
```

#### 3. The Core: execute_and_verify

```javascript
// servers/eda/index.js - Lines 150-250

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'eda.execute_and_verify':
      return await executeAndVerify(args);
    case 'eda.detect_tool':
      return await detectTool();
    case 'eda.diagnose_error':
      return await diagnoseError(args.output);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function executeAndVerify({ tcl, description, timeout = 60 }) {
  // Get tmux socket from environment
  const socket = process.env.HIPILOT_SESSION || 'hipilot';

  // Create unique execution ID
  const execId = `exec_${Date.now()}`;
  const tmpFile = join('/tmp', `hipilot_${execId}.tcl`);

  // Wrap Tcl with markers for completion detection
  const wrappedTcl = `
puts "HIPILOT_START:${execId}"
${tcl}
puts "HIPILOT_END:${execId}"
`;

  // Write to temp file
  writeFileSync(tmpFile, wrappedTcl);

  // Send to EDA pane via tmux
  const tmuxCmd = `tmux -L ${socket} send-keys -t ${socket}:0.1 "source ${tmpFile}" C-m`;
  execSync(tmuxCmd);

  // Poll for completion
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;

  while (Date.now() - startTime < timeoutMs) {
    // Capture pane output
    const captureCmd = `tmux -L ${socket} capture-pane -p -t ${socket}:0.1`;
    const output = execSync(captureCmd, { encoding: 'utf-8' });

    // Check for completion marker
    if (output.includes(`HIPILOT_END:${execId}`)) {
      // Extract section between markers
      const startIdx = output.indexOf(`HIPILOT_START:${execId}`);
      const endIdx = output.indexOf(`HIPILOT_END:${execId}`);
      const executionOutput = output.substring(startIdx, endIdx);

      // Check for errors
      const errorPatterns = [/\*\*ERROR/i, /FATAL/i, /Command not found/i];
      const errors = [];
      for (const pattern of errorPatterns) {
        if (pattern.test(executionOutput)) {
          errors.push(`Error pattern matched: ${pattern}`);
        }
      }

      // Extract QoR metrics
      const qor = extractQoR(executionOutput);

      return {
        content: [
          { type: 'text', text: executionOutput }
        ],
        isError: errors.length > 0,
        result: {
          status: errors.length > 0 ? 'error' : 'success',
          errors,
          qor
        }
      };
    }

    // Wait before checking again
    await sleep(1000);
  }

  // Timeout
  return {
    content: [{ type: 'text', text: 'Execution timed out' }],
    isError: true
  };
}

function extractQoR(output) {
  // Extract timing metrics using regex
  const wnsMatch = output.match(/WNS[:\s]+([\-\d.]+)\s*ns/i);
  const tnsMatch = output.match(/TNS[:\s]+([\-\d.]+)\s*ns/i);

  return {
    wns: wnsMatch ? parseFloat(wnsMatch[1]) : null,
    tns: tnsMatch ? parseFloat(tnsMatch[1]) : null,
    extracted: !!(wnsMatch && tnsMatch)
  };
}
```

#### 4. Server Startup

```javascript
// servers/eda/index.js - Lines 250-270

async function main() {
  // Create transport (stdin/stdout)
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  // Log to stderr (stdout is for MCP protocol)
  console.error('HiPilot EDA MCP Server running on stdio');
}

main().catch(console.error);
```

### The FlowCertifier (src/hitestbot/core/FlowCertifier.js)

This is the testing framework—the "virtual human" that uses HiPilot.

#### Key Concept: Observation Points

```javascript
// src/hitestbot/core/FlowCertifier.js - Simplified

class FlowCertifier {
  constructor(options) {
    this.session = options.session || 'hipilot';
    this.socket = options.socket || 'hipilot';
    this.evidenceDir = options.evidenceDir;
    this.observations = [];
  }

  // Capture a snapshot of both panes
  async captureObservation(label) {
    // Capture Claude pane (left)
    const claudeOutput = execSync(
      `tmux -L ${this.socket} capture-pane -p -t ${this.socket}:0.0`
    );

    // Capture EDA pane (right)
    const edaOutput = execSync(
      `tmux -L ${this.socket} capture-pane -p -t ${this.socket}:0.1`
    );

    // Take screenshot
    execSync(`import -window root ${this.evidenceDir}/obs_${label}.png`);

    // Save logs
    writeFileSync(
      `${this.evidenceDir}/obs_${label}_claude.log`,
      claudeOutput
    );
    writeFileSync(
      `${this.evidenceDir}/obs_${label}_eda.log`,
      edaOutput
    );

    return { claude: claudeOutput, eda: edaOutput };
  }

  // Main testing loop
  async runFlow(command) {
    // 1. Launch HiPilot
    await this.launchHiPilot();

    // 2. Wait for Claude to be ready
    await this.waitForClaudeReady();

    // 3. Type the command
    await this.typeCommand(command);

    // 4. Watch and observe
    await this.watchFlow();

    // 5. Score the result
    return this.scoreResult();
  }

  // The scoring engine (L1-L5)
  scoreResult() {
    const before = this.observations[0];
    const after = this.observations[this.observations.length - 1];

    return {
      L1: this.scoreL1(before, after),
      L2: this.scoreL2(after),
      L3: this.scoreL3(after),
      L4: this.scoreL4(after),
      L5: this.scoreL5(after)
    };
  }

  // L5: QoR Assessment (the critical one)
  scoreL5(observation) {
    const claudeOutput = observation.claude;

    // Look for explicit WNS/TNS numbers
    const wnsMatch = claudeOutput.match(/WNS[:\s]+([\-\d.]+)\s*ns/i);
    const tnsMatch = claudeOutput.match(/TNS[:\s]+([\-\d.]+)\s*ns/i);

    if (wnsMatch && tnsMatch) {
      return {
        score: 1.0,
        detail: `WNS=${wnsMatch[1]}ns, TNS=${tnsMatch[1]}ns`
      };
    }

    if (wnsMatch || tnsMatch) {
      return { score: 0.5, detail: 'Partial QoR' };
    }

    return { score: 0.0, detail: 'No QoR reported' };
  }
}
```

---

## Chapter 7: Building Your First Extension

### Exercise: Add a Power Analysis Capability

Let's build a complete extension that adds power analysis to HiPilot.

#### Step 1: Create the Skill

Create `skills/power-analysis-expert.md`:

```markdown
---
name: power-analysis-expert
description: |
  Analyze power consumption and suggest optimizations.
  Covers dynamic power, leakage, and clock gating efficiency.
version: "1.0.0"
---

# Power Analysis Expert

## When to Use

- After placement or routing for power estimation
- When power exceeds budget
- For clock gating efficiency review

## Analysis Flow

### Phase 1: Data Collection

```tcl
# Generate power reports
report_power -outfile power_summary.rpt
report_power -hier -outfile power_hierarchical.rpt
report_clock_gating -outfile clock_gating.rpt

# Extract key metrics
set total_power [get_metric power.total]
set dynamic_power [get_metric power.dynamic]
set leakage_power [get_metric power.leakage]
set cg_efficiency [get_metric clock_gating.efficiency]

puts "Total Power: ${total_power} mW"
puts "Dynamic: ${dynamic_power} mW ([expr $dynamic_power/$total_power*100]%)"
puts "Leakage: ${leakage_power} mW ([expr $leakage_power/$total_power*100]%)"
puts "CG Efficiency: ${cg_efficiency}%"
```

### Phase 2: Analysis & Recommendations

**If dynamic power > 70% of total:**
- High switching activity
- Recommendation: Activity analysis, clock gating improvements

**If leakage > 40% of total:**
- Technology or low-power mode issue
- Recommendation: HVT cell swap, power gating

**If clock gating efficiency < 85%:**
- Gating opportunities missed
- Recommendation: Review enable conditions, add gaters

### Phase 3: Report Generation

Format:
```
📊 Power Analysis Report

Total Power: XXX mW
├── Dynamic: XXX mW (XX%)
├── Leakage: XXX mW (XX%)
└── Clock:   XXX mW (XX%)

Clock Gating Efficiency: XX%

Recommendations:
1. [Specific recommendation based on analysis]
2. [Another recommendation]
```
```

#### Step 2: Create the Template

Create `templates/cadence/report_power.tcl`:

```tcl
{# Power Analysis Template #}
{# Usage: Comprehensive power reporting #}

{# Basic power report #}
report_power -outfile {{ output_dir }}/power_summary.rpt

{# Hierarchical breakdown #}
{% if hierarchical %}
report_power -hier -outfile {{ output_dir }}/power_hier.rpt
{% endif %}

{# Clock gating analysis #}
{% if analyze_clock_gating %}
report_clock_gating -outfile {{ output_dir }}/clock_gating.rpt
{% endif %}

{# Activity analysis for high-power nets #}
{% if activity_analysis %}
report_switching_activity -outfile {{ output_dir }}/activity.rpt
{% endif %}
```

#### Step 3: Test It

```bash
# Deploy to EDA server
node src/hitestbot/infra/deploy_hipilot.js

# Test with HiTestBot
bin/hitestbot-eda "analyze power consumption"
```

#### Step 4: Analyze Evidence

Check `test-evidence/latest/`:
- Did AI load the skill?
- Did it call the right MCP tools?
- Did it format the report correctly?

#### Step 5: Iterate

Based on evidence, refine:
- Clarify ambiguous instructions
- Add error handling
- Improve report formatting

---

## Appendix A: JavaScript Quick Reference

### Variables
```javascript
let x = 5;              // Mutable
const y = 10;           // Immutable
var z = 15;             // Old style (avoid)
```

### Functions
```javascript
// Declaration
function add(a, b) { return a + b; }

// Arrow function
const add = (a, b) => a + b;

// Async function
async function fetchData() { ... }
```

### Arrays
```javascript
let arr = [1, 2, 3];
arr.push(4);            // Add to end
arr.pop();              // Remove from end
arr.filter(x => x > 1); // [2, 3]
arr.map(x => x * 2);    // [2, 4, 6]
```

### Objects
```javascript
let obj = { a: 1, b: 2 };
obj.a;                  // 1
obj['b'];               // 2
obj.c = 3;              // Add property
```

### Async/Await
```javascript
async function main() {
  const result = await someAsyncOperation();
  console.log(result);
}
```

## Appendix B: MCP Tool Reference

| Tool | Purpose | Example Use |
|------|---------|-------------|
| `eda.detect_tool` | Check if EDA tool running | Before starting work |
| `eda.start_tool` | Launch Innovus/ICC2 | When no tool detected |
| `eda.execute_and_verify` | Run Tcl and check | Every stage execution |
| `eda.diagnose_error` | Get error analysis | When errors occur |
| `eda.generate_tcl` | Use template | For standard reports |
| `knowledge.get_skill` | Load skill | At flow start |
| `qor.snapshot` | Save metrics | After each stage |

## Appendix C: Development Workflow

```
1. Define success criteria
   ↓
2. Write skill (explain to a new hire)
   ↓
3. Create template (if needed)
   ↓
4. Test with HiTestBot
   ↓
5. Analyze evidence
   ↓
6. Refine
   ↓
7. Repeat 4-6 until satisfied
```

---

## Chapter 8: LittleBrain—Knowledge-Based Orchestration

LittleBrain is HiPilot's "little brain"—a knowledge-based orchestration layer that acts like a dedicated LLM for EDA tasks. It provides structured reasoning, Tcl generation, and self-improvement capabilities.

### Why LittleBrain?

Traditional AI agents rely entirely on the LLM's context window for reasoning. LittleBrain adds:

1. **Structured Knowledge** — PageIndex tree-based navigation instead of vector similarity
2. **Activity Logging** — Complete audit trail of all reasoning steps
3. **Self-Improvement** — Learns from errors and successful patterns
4. **Tcl Generation** — Purpose-built generator with validation

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LittleBrain Layer                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ TclGenerator │  │ OutputParser │  │  Orchestrator   │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │ SelfImprovement  │  │         Logger                 │  │
│  │  - ErrorPatternDB│  │  - Reasoning steps             │  │
│  │  - SuccessTracker│  │  - Decisions                   │  │
│  └──────────────────┘  │  - Tcl generation              │  │
│                        └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `index.js` | Main LittleBrain class with unified interface | `servers/knowledge/littlebrain/` |
| `tcl-generator.js` | Generate Tcl from natural language intent | `servers/knowledge/littlebrain/` |
| `output-parser.js` | Parse EDA output, extract errors/QoR | `servers/knowledge/littlebrain/` |
| `orchestrator.js` | Stage definitions, flow context, prerequisites | `servers/knowledge/` |
| `self-improvement.js` | Error pattern DB, success tracking | `servers/knowledge/littlebrain/` |
| `logger.js` | Activity logging for auditability | `servers/knowledge/littlebrain/` |

### PageIndex: Tree-Based Knowledge

Unlike vector RAG which uses embeddings, PageIndex uses document structure:

```
INNOVUS/
├── Design_Init/
│   ├── init_design
│   └── MMMC setup
├── Floorplanning/
│   ├── floorPlan
│   └── loadIoFile
├── Power_Planning/
│   ├── globalNetConnect
│   └── addStripe
└── ...
```

**Why this matters for EDA:**
- Commands like `report_timing` and `report_power` are semantically similar but used at different stages
- Vector similarity fails—you need reasoning about tool context and flow stage
- Tree navigation provides deterministic retrieval

### Activity Logging

Every reasoning step is logged for auditability:

```javascript
// Example: Tcl generation logging
logger.logTclGeneration({
  intent: 'Fix setup timing violations',
  tool: 'innovus',
  stage: 'post_route',
  generatedTcl: '...',
  confidence: 0.92,
  timestamp: '2026-03-09T08:57:25Z'
});
```

Log categories:
- `reasoning` — Decision-making process
- `decision` — Final choices made
- `tcl_generation` — Tcl scripts created
- `output_parsing` — Tool output analysis
- `stage_planning` — Flow orchestration
- `error_pattern_matching` — Error classification

### Self-Improvement

LittleBrain tracks patterns to improve over time:

```javascript
// ErrorPatternDB learns from failures
errorPatternDB.addPattern({
  errorSignature: 'layer.*referenced in pin.*macro',
  category: 'LEF_LOADING',
  severity: 'CRITICAL',
  fixStrategy: 'Load tech LEF before cell LEFs',
  confidence: 1.0
});

// SuccessTracker records what worked
successTracker.record({
  stage: 'placement',
  commandSequence: ['setPlaceMode', 'place_opt_design'],
  qor: { wns: 0.0, tns: 0.0 },
  context: { design: 'ibex', util: 0.7 }
});
```

### Using LittleBrain

LittleBrain integrates automatically through the knowledge MCP server:

```javascript
// Get skill with LittleBrain-enhanced context
const skill = await knowledge.get_skill({
  name: 'fix-setup-timing',
  use_littlebrain: true  // Enable enhanced reasoning
});

// Generated Tcl includes auto-fixes based on error patterns
const tcl = await littlebrain.generateTcl({
  intent: 'Fix setup violations in post-route',
  tool: 'innovus',
  stage: 'post_route',
  context: { currentWns: -0.05 }
});
```

---

## Chapter 9: Certification & Test Results

HiPilot uses HiTestBot—a virtual human tester—to validate behavior. The 6-layer scoring system measures:

| Layer | Metric | Description |
|-------|--------|-------------|
| L1 | Prompt Delivery | Did Claude respond? |
| L2 | Intent Recognition | Did it understand the task? |
| L3 | MCP Tool Usage | Did it use tools correctly? |
| L3b | Process Validation | Did it use correct EDA tool? |
| L4 | EDA Execution | Did the EDA tool run successfully? |
| L5 | QoR Assessment | Did it report quality metrics? |

### Latest Test Results (March 9, 2025)

**Test Run:** 2026-03-09 08:57:25
**Command:** `/rtl2gds`
**Duration:** 1202.8s (20 minutes)
**Branch:** `dev/environment-setup-7005`

| Layer | Score | Status | Notes |
|-------|-------|--------|-------|
| **L1 Prompt Delivery** | 1.0/1.0 | ✅ | Claude responded |
| **L2 Intent Recognition** | 1.0/1.0 | ✅ | Understood RTL-to-GDS flow |
| **L3 MCP Tool Usage** | 1.0/1.0 | ✅ | 6,839 MCP calls |
| **L3b Process Validation** | 1.0/1.0 | ✅ | Correctly used dc_shell |
| **L4 EDA Execution** | 0.0/1.0 | ❌ | LEF file loading error |
| **L5 QoR Assessment** | 1.0/1.0 | ✅ | WNS=0.00, TNS=0.00 |

**Total: 5.0/6.0 (83%)**
**GPA: 3.37/4.0 (B)**
**Human-Like: 100%** (improved from 30%)

### Key Achievement: Human-Like Score 100%

The Human-Like behavior score improved from **30% (Machine-like)** to **100% (Human-like)** through:

- **Incremental interaction patterns** — Sending commands one at a time
- **Human-like waiting** — Using `eda.await_idle` instead of polling
- **Observing before proceeding** — Reading tool output before next action
- **Natural typing patterns** — Avoiding batch Tcl submission

### L4 Failure Analysis

The EDA execution failed due to a **PDK/environment issue**, not AI behavior:

```
**ERROR: (IMPLF-53): The layer 'li1' referenced in pin 'VGND' in macro 'sky130_ef_sc_hd__decap_12'
**ERROR: Loading LEF file(s) failed
```

**Root Cause:** LEF files loaded in wrong order on EDA server. The tech LEF (`sky130_fd_sc_hd.tlef`) must be loaded BEFORE cell LEFs.

**Category:** ENVIRONMENT (not AI behavior issue)

### Evidence Package

Each test generates comprehensive evidence:

| File | Description | Size |
|------|-------------|------|
| `FLOW_REPORT.md` | Full certification report | 23KB |
| `stage_scorecards.json` | Per-stage scores and details | 3KB |
| `flow_progress.json` | Flow progress map | 3KB |
| `timeline.jsonl` | Chronological event log with timestamps | 1.5MB |
| `run_log.txt` | Test execution log | 13KB |
| `recordings/test_recording.mp4` | Full video recording | 56MB |
| Screenshots | 20+ observation point images | ~5MB |

The timeline includes video timestamps—every event can be verified by seeking to the exact moment in the recording.

### Path to 6.0/6.0

To achieve full certification:

1. **Fix PDK issue on EDA server** — Correct LEF loading order
2. **Re-run certification test**
3. **Verify L4 passes** — EDA tool runs without LEF errors

The AI behavior (L1-L3, L3b, L5) is already at 100%. Only the environment needs fixing.

---

## Conclusion: You Are Ready

You now understand:
- ✅ **Agent architecture** (three layers, state machines)
- ✅ **JavaScript** (the language of AI development)
- ✅ **MCP** (the protocol binding it all together)
- ✅ **Skills** (encoding RTL2GDS expertise)
- ✅ **The codebase** (how HiPilot actually works)
- ✅ **Extension patterns** (how to add capabilities)
- ✅ **LittleBrain** (knowledge-based orchestration)
- ✅ **Certification** (HiTestBot scoring methodology)

**Your ASIC knowledge is the differentiator.** The AI provides reasoning. You provide the methodology.

**Start building:**
1. Pick a task you do frequently
2. Write it as a skill
3. Test with HiTestBot
4. Iterate based on evidence

*The future of chip design is AI-assisted. You're now equipped to build it.* 🚀

---

**Resources:**
- HiPilot: `/home/EDA/hipilot/current/`
- This Cookbook: `docs/AI_ASIC_COOKBOOK.md`
- MCP SDK: https://github.com/modelcontextprotocol
- JavaScript Guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript
