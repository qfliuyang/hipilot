# AI in ASIC: A Developer's Guide for Chip Designers

> **Building AI Agents for Chip Design: Concepts, Architecture, and Development**
>
> *You design complex silicon. Understanding AI development is simpler than you think.*

---

## Table of Contents

1. [The Agent Revolution: Why Hardware Engineers Must Understand AI](#chapter-1-the-agent-revolution)
2. [Agent Architecture: The Three-Layer Model](#chapter-2-agent-architecture)
3. [MCP: The Protocol That Makes AI Agents Work](#chapter-3-mcp)
4. [Skills: Encoding Expertise as Agent Instructions](#chapter-4-skills)
5. [The HiPilot Codebase: A Walkthrough](#chapter-5-codebase-walkthrough)
6. [Development Patterns for ASIC Engineers](#chapter-6-development-patterns)
7. [Building Your First Agent Extension](#chapter-7-building-extensions)

---

## Chapter 1: The Agent Revolution

### What Are AI Agents?

An **AI Agent** is a system that:
1. **Perceives** its environment (reads files, captures output, monitors state)
2. **Decides** what to do (uses LLM reasoning to plan actions)
3. **Acts** on its decisions (runs tools, executes commands, generates code)
4. **Learns** from feedback (adjusts based on results)

**Think of it like an automated regression suite**—but instead of running fixed test vectors, it reasons about what tests to run based on what it discovers.

### The Shift: From Scripts to Agents

**Traditional EDA Automation (Scripts):**
```
Fixed Flow: Step A → Step B → Step C → Report
- Cannot adapt to errors
- Hardcoded decisions
- Brittle to changes
```

**AI Agents (HiPilot):**
```
Intelligent Flow: Observe → Reason → Act → Verify → Iterate
- Adapts when tools fail
- Makes decisions based on context
- Self-correcting
```

### Why Hardware Engineers Are Uniquely Qualified

| Skill from ASIC Design | Translates To |
|------------------------|---------------|
| Understanding timing constraints | Defining agent success criteria |
| Debugging DRC violations | Debugging agent behavior |
| Writing Tcl/Perl scripts | Creating agent tools |
| Knowledge of EDA tool quirks | Encoding expertise into agent logic |
| Corner case analysis | Edge case handling in agents |

**You already think in terms of state machines, timing diagrams, and verification. Agent development uses the same mental models.**

---

## Chapter 2: Agent Architecture

### The Three-Layer Model

Every AI agent system has three layers. Understanding this architecture is key to development.

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: ORCHESTRATION (The Brain)                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Large Language Model (Claude)                          │   │
│  │  - Interprets user intent                               │   │
│  │  - Plans sequences of actions                           │   │
│  │  - Reasons about tool outputs                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  Uses: Skills, Templates, Context                              │
└──────────────────────────┼──────────────────────────────────────┘
                           │ MCP Protocol (JSON-RPC)
┌──────────────────────────┼──────────────────────────────────────┐
│  LAYER 2: PROTOCOL (The Nervous System)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  MCP Server (Node.js)                                   │   │
│  │  - Receives structured requests                         │   │
│  │  - Manages tool execution                               │   │
│  │  - Returns structured responses                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  Transforms: Intent → Action                                   │
└──────────────────────────┼──────────────────────────────────────┘
                           │ System Calls / tmux
┌──────────────────────────┼──────────────────────────────────────┐
│  LAYER 1: EXECUTION (The Hands)                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  EDA Tools (Innovus, ICC2, PrimeTime)                   │   │
│  │  - Execute Tcl commands                                 │   │
│  │  - Generate reports                                     │   │
│  │  - Return output                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  Produces: Results, QoR, Files                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Layer 1: Execution (You Know This)

This is the EDA tools you use daily. No new concepts here.

```tcl
# Layer 1: Standard EDA Tcl
report_timing -max_paths 10 -outfile timing.rpt
```

### Layer 2: Protocol (The New Concept)

**MCP** is the bridge. It translates between:
- **Natural language intent** ("check timing")
- **Structured tool calls** (`{"tool": "eda.execute_and_verify", "params": {...}}`)
- **System commands** (`tmux send-keys`, file I/O)

**Key Insight:** MCP is like a standardized API layer. Without it, every AI would need custom code for every tool.

### Layer 3: Orchestration (The Intelligence)

The LLM (Claude) acts as the orchestrator. It:
1. Reads skills (your documented expertise)
2. Plans multi-step workflows
3. Decides which tools to call
4. Interprets results and adapts

---

## Chapter 3: MCP Deep Dive

### Why MCP Exists

**The Problem:** Every AI assistant needs to interact with external tools. Without a standard:
- Every tool needs custom integration code
- Security is inconsistent
- Context management is ad-hoc

**The Solution:** Model Context Protocol (MCP)
- Standardized communication
- Secure sandboxing
- Structured inputs/outputs
- Tool discovery

### MCP Architecture

```
┌─────────────┐     JSON-RPC      ┌─────────────┐     System Calls    ┌─────────────┐
│   Claude    │ ◄────────────────► │  MCP Server │ ◄──────────────────► │  EDA Tool   │
│   (Client)  │    stdin/stdout    │  (Bridge)   │    tmux/process     │  (Target)   │
└─────────────┘                    └─────────────┘                     └─────────────┘
```

**Critical Concept:** MCP servers are **child processes** of Claude. They communicate over stdin/stdout using JSON-RPC—not network sockets.

### MCP Message Flow

**1. Tool Discovery (Initialization)**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "eda.execute_and_verify",
        "description": "Execute Tcl in EDA tool and verify success",
        "inputSchema": {
          "type": "object",
          "properties": {
            "tcl": {"type": "string"},
            "timeout": {"type": "number"}
          }
        }
      }
    ]
  }
}
```

**2. Tool Invocation**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "eda.execute_and_verify",
    "arguments": {
      "tcl": "report_timing -max_paths 10",
      "timeout": 60
    }
  }
}
```

Response:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {"type": "text", "text": "Setup WNS: -0.059ns"}
    ],
    "isError": false
  }
}
```

### MCP Server Structure (Code Walkthrough)

Here's how an MCP server actually works:

```javascript
// servers/eda/index.js - Simplified Core

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// 1. Define available tools
const TOOLS = [
  {
    name: 'eda.execute_and_verify',
    description: 'Execute Tcl and check for errors',
    inputSchema: {
      type: 'object',
      properties: {
        tcl: { type: 'string', description: 'Tcl commands to execute' },
        timeout: { type: 'number', description: 'Timeout in seconds' }
      },
      required: ['tcl']
    }
  },
  {
    name: 'eda.detect_tool',
    description: 'Check if EDA tool is running',
    inputSchema: { type: 'object', properties: {} }
  }
];

// 2. Create server instance
const server = new Server(
  { name: 'hipilot-eda', version: '0.7.0' },
  { capabilities: { tools: {} } }
);

// 3. Handle tool list requests
server.setRequestHandler('tools/list', async () => ({
  tools: TOOLS
}));

// 4. Handle tool execution
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'eda.execute_and_verify':
      return await executeTcl(args.tcl, args.timeout);
    case 'eda.detect_tool':
      return await detectRunningTool();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// 5. Execute Tcl (Layer 1 interaction)
async function executeTcl(tcl, timeout) {
  // Write Tcl to temp file
  const tmpFile = `/tmp/hipilot_${Date.now()}.tcl`;
  await writeFile(tmpFile, tcl);

  // Send to tmux (EDA pane)
  execSync(`tmux -L hipilot send-keys -t hipilot:0.1 "source ${tmpFile}" C-m`);

  // Wait and capture output
  await sleep(timeout * 1000);
  const output = execSync('tmux -L hipilot capture-pane -p -t hipilot:0.1');

  // Check for errors
  const hasError = /\*\*ERROR/i.test(output);

  return {
    content: [{ type: 'text', text: output }],
    isError: hasError
  };
}

// 6. Start listening on stdin
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Key Takeaways:**
- Tools are registered in a list with schemas
- Claude calls them by name with arguments
- Server handles the messy system-level work
- Response goes back as structured JSON

---

## Chapter 4: Skills Deep Dive

### What Skills Really Are

**Skills are not code.** Skills are **structured expertise** that the LLM reads and follows.

**Analogy:**
- A skill is like a **detailed runbook** you write for a new hire
- The new hire (AI) reads it and follows the steps
- If something goes wrong, they refer to the troubleshooting section

### Skill as State Machine

A skill implicitly defines a state machine:

```
[Start]
   │
   ▼
[Check Prerequisites] ──No──► [Report Error]
   │                            │
  Yes                           ▼
   │                         [End]
   ▼
[Step 1: Analyze]
   │
   ▼
[Step 2: Execute Fix] ◄──────► [Handle Errors]
   │                              │
   ▼                              │
[Step 3: Verify] ────Fail───────┘
   │
  Pass
   │
   ▼
[Report Success]
   │
   ▼
[End]
```

### Skill Structure (Production-Quality)

```markdown
---
name: timing-closure-expert
description: |
  Expert-level timing closure methodology for advanced nodes.
  Handles setup violations through useful skew, sizing, and buffering.
  Includes hold fixing and DRV cleanup.
author: "Senior PD Engineer"
version: "1.2.0"
prerequisites:
  - design_stage: "placed_or_routed"
  - required_views: ["setup", "hold"]
  - tools: ["innovus", "tempus"]
---

# Timing Closure Expert Methodology

## Overview

This skill implements a systematic approach to timing closure that prioritizes:
1. Setup fixing with minimal area impact
2. Hold closure without creating new setup violations
3. DRV cleanup as final polish

## Decision Tree

```
WNS < 0?
├── Yes → High Fanout? → Yes → Buffer insertion
│         └── No  → Long wire? → Yes → Rebuffer net
│                   └── No  → High cell delay? → Yes → Upsize cell
│                             └── No → Useful skew
└── No  → Check Hold
          ├── Hold violations → Delay data path
          └── Clean DRVs
```

## Implementation

### Phase 1: Analysis (Always Do This First)

Collect metrics before any changes:

```tcl
# Capture baseline
set baseline_wns [get_metric timing.setup.WNS]
set baseline_tns [get_metric timing.setup.TNS]
set violation_count [get_metric timing.setup.numViolatingPaths]

report_timing -max_paths 50 -max_slack 0 -outfile pre_fix_analysis.rpt
```

**Decision Point:** If violations > 1000, consider global optimization before local fixes.

### Phase 2: Setup Fixing (Priority Order)

#### Strategy A: Useful Skew (Lowest Cost)

When to use:
- Design is post-CTS
- Clock skew > 100ps available
- No hold margin constraints

```tcl
setOptMode -usefulSkew true
setOptMode -usefulSkewPreCTS false
setOptMode -usefulSkewPostCTS true
optDesign -postCTS -setup
```

**Risk:** May worsen hold. Monitor hold WNS after this step.

#### Strategy B: Cell Sizing (Medium Cost)

When to use:
- Cell delay dominates path delay
- Congestion < 80%

```tcl
# Target specific cells on critical paths
set crit_cells [get_cells -of_pins [get_pins -filter "slack < 0"]]
ecoChangeCell -upsize -cells $crit_cells
optDesign -postRoute -setup -incremental
```

#### Strategy C: Buffer Insertion (Higher Cost)

When to use:
- Wire delay dominates
- Long nets without buffers

```tcl
set long_nets [get_nets -filter "total_delay > 0.5"]
addBuffer -net $long_nets -cell BUFX2
```

### Phase 3: Hold Fixing

**Constraint:** Must not degrade setup WNS by > 50ps.

```tcl
# Check setup margin
set setup_margin [expr [get_metric timing.setup.WNS] - (-0.050)]

if {$setup_margin > 0} {
  # Safe to use useful skew for hold
  setOptMode -usefulSkewHold true
  optDesign -postCTS -hold
} else {
  # Use buffer insertion (safer)
  addDelay -pins [get_pins -filter "hold_slack < 0"] -cell DELAYX1
}
```

### Phase 4: Verification

Required checks before completion:

- [ ] Setup WNS ≥ target (typically 0 or -0.010)
- [ ] Hold WNS ≥ 0
- [ ] DRV count < 100
- [ ] Congestion < 85%
- [ ] No new timing paths created

## Error Recovery

| Error | Cause | Resolution |
|-------|-------|------------|
| "Useful skew failed" | Hold margin insufficient | Switch to buffer insertion |
| "Sizing caused congestion" | Area increase too high | Size only top 20% critical cells |
| "DRV explosion" | Rebuffering created overlaps | Run ecoRoute -fix_drc |
| "OptDesign diverged" | Conflicting constraints | Check MMMC view consistency |

## Success Metrics

```tcl
# Final report
puts "=== Timing Closure Summary ==="
puts "Setup WNS: [get_metric timing.setup.WNS] (target: 0)"
puts "Setup TNS: [get_metric timing.setup.TNS]"
puts "Hold WNS: [get_metric timing.hold.WNS]"
puts "DRV Count: [get_metric drc.total_count]"
puts "Congestion: [get_metric route.congestion]"
```

Acceptable: All metrics green OR setup WNS within 10ps of target with closure plan.
```

### Deep Concept: Skills as Constraint Satisfaction

A skill is essentially a **constraint satisfaction problem**:

- **Hard constraints:** Must be satisfied (hold timing ≥ 0)
- **Soft constraints:** Optimize if possible (setup timing ≥ 0)
- **Resource constraints:** Limited by area, power, congestion
- **Decision variables:** Which optimization strategy to apply

The AI uses the skill as a heuristic guide to navigate this search space.

---

## Chapter 5: The HiPilot Codebase Walkthrough

### Project Structure

```
hipilot/
├── bin/hipilot                    # Entry point (bash)
├── servers/                       # MCP Layer (Layer 2)
│   ├── eda/index.js              # EDA tool MCP server
│   ├── tmux/index.js             # Tmux/pane MCP server
│   └── knowledge/index.js        # Skills/knowledge MCP server
├── skills/                        # Agent instructions (Layer 3)
│   ├── fix-setup-timing.md
│   ├── cts-clock-tree.md
│   └── ... (36 skills)
├── templates/                     # Tcl generation
│   ├── cadence/
│   └── synopsys/
└── src/hitestbot/                # Testing framework
    └── core/FlowCertifier.js     # Virtual human tester
```

### Key File: EDA MCP Server

```javascript
// servers/eda/index.js - Architecture Overview

// ┌─────────────────────────────────────────┐
// │  MCP Server (Node.js Process)           │
// │  - Spawned by Claude on startup         │
// │  - Communicates via stdin/stdout        │
// │  - Lifespan: As long as Claude runs     │
// └─────────────────────────────────────────┘

// Tool Registry: What capabilities we expose
const toolRegistry = {
  // Tool discovery
  'tools/list': handleToolList,

  // Core execution
  'tools/call': handleToolCall,

  // Resource management (for context)
  'resources/list': handleResourceList,
  'resources/read': handleResourceRead
};

// The "execute_and_verify" tool (most important)
async function handleExecuteAndVerify(args) {
  const { tcl, description, timeout = 60 } = args;

  // 1. Generate execution context
  const execId = `exec_${Date.now()}`;
  const tmpFile = `/tmp/hipilot/${execId}.tcl`;

  // 2. Write Tcl to temp file
  await fs.writeFile(tmpFile, `
    # HiPilot execution: ${description}
    puts "HIPILOT_START:${execId}"
    ${tcl}
    puts "HIPILOT_END:${execId}"
  `);

  // 3. Send to EDA tool via tmux
  execSync(`
    tmux -L hipilot send-keys -t hipilot:0.1 \
    "source ${tmpFile}" C-m
  `);

  // 4. Poll for completion
  const startTime = Date.now();
  while (Date.now() - startTime < timeout * 1000) {
    const paneOutput = execSync(
      'tmux -L hipilot capture-pane -p -t hipilot:0.1'
    );

    if (paneOutput.includes(`HIPILOT_END:${execId}`)) {
      // Execution complete - analyze results
      const errors = extractErrors(paneOutput);
      const qor = extractQoR(paneOutput);

      return {
        status: errors.length > 0 ? 'error' : 'success',
        errors,
        qor,
        output: paneOutput
      };
    }

    await sleep(1000);
  }

  return { status: 'timeout', error: 'Execution timed out' };
}

// QoR Extraction: The magic that makes L5 scoring work
function extractQoR(output) {
  const wnsMatch = output.match(/WNS[:\s]+([\-\d.]+)/i);
  const tnsMatch = output.match(/TNS[:\s]+([\-\d.]+)/i);

  return {
    wns: wnsMatch ? parseFloat(wnsMatch[1]) : null,
    tns: tnsMatch ? parseFloat(tnsMatch[1]) : null,
    extracted: !!(wnsMatch && tnsMatch)
  };
}
```

### Key File: FlowCertifier (Testing)

```javascript
// src/hitestbot/core/FlowCertifier.js - Testing Architecture

/**
 * FlowCertifier is a "virtual human" that:
 * 1. Launches HiPilot like a user would
 * 2. Types commands into Claude's input
 * 3. Captures both panes (screenshots + logs)
 * 4. Scores based on what a human would observe
 *
 * This is NOT unit testing. It's behavioral verification.
 */

class FlowCertifier {
  // State detection: What would a human see?
  detectState(claudePane, edaPane) {
    // Working: Claude output changing
    if (claudePane.changed) return { state: 'working' };

    // Waiting: EDA running, Claude idle
    if (edaPane.changing && claudePane.idle) {
      return { state: 'waiting_for_eda' };
    }

    // Done: Claude prompt visible
    if (claudePane.contains('❯') && claudePane.idle) {
      return { state: 'done' };
    }

    // Needs approval: Manual mode prompt
    if (claudePane.contains('bypass permissions')) {
      return { state: 'needs_approval' };
    }

    return { state: 'idle' };
  }

  // L1-L5 Scoring (What humans observe)
  scoreExecution(claudeOutput, edaOutput) {
    return {
      L1: this.scoreResponse(claudeOutput),      // Did Claude respond?
      L2: this.scoreIntent(claudeOutput),        // Did it understand?
      L3: this.scoreToolUsage(claudeOutput, edaOutput), // Used MCP?
      L4: this.scoreEdaExecution(edaOutput),     // EDA success?
      L5: this.scoreQoR(claudeOutput)            // Reported metrics?
    };
  }

  // L5: The critical score for ASIC
  scoreQoR(claudeOutput) {
    // Human looks for: "WNS: X.XXX ns"
    const hasWNS = /WNS[:\s]+[\-\d.]+\s*ns/i.test(claudeOutput);
    const hasTNS = /TNS[:\s]+[\-\d.]+\s*ns/i.test(claudeOutput);

    if (hasWNS && hasTNS) return { score: 1.0, reason: 'Explicit WNS/TNS' };
    if (hasWNS || hasTNS) return { score: 0.5, reason: 'Partial QoR' };
    return { score: 0.0, reason: 'No QoR reported' };
  }
}
```

---

## Chapter 6: Development Patterns for ASIC Engineers

### Pattern 1: The Verification Mindset

In ASIC, you verify at every step:
```
Synthesis → Equivalence Check → Place → Timing Check → Route → DRC
```

In agent development, same principle:
```
Write Skill → Test with HiTestBot → Analyze Evidence → Refine
```

### Pattern 2: State Machine Thinking

You already design state machines. Apply that to agent behavior:

```javascript
// State machine for a routing agent
const routingStates = {
  INITIAL: {
    onEnter: () => loadDesign(),
    transitions: {
      DESIGN_LOADED: 'CHECK_CONGESTION'
    }
  },
  CHECK_CONGESTION: {
    onEnter: () => analyzeCongestion(),
    transitions: {
      HIGH_CONGESTION: 'OPTIMIZE_PLACEMENT',
      ACCEPTABLE: 'RUN_ROUTING'
    }
  },
  RUN_ROUTING: {
    onEnter: () => routeDesign(),
    transitions: {
      SUCCESS: 'VERIFY_DRC',
      CONGESTION_ERROR: 'CHECK_CONGESTION',
      COMPLETION_ERROR: 'REPORT_FAILURE'
    }
  },
  // ... more states
};
```

### Pattern 3: The Constraint-Driven Approach

ASIC: Timing constraints → Implementation
Agent: Success criteria → Skill design

Define your "signoff criteria" before writing the skill:

```markdown
## Success Criteria (Signoff)

Before this skill completes, the following must be true:

1. Timing Constraints
   - Setup WNS ≥ -0.050ns (or signoff target)
   - Hold WNS ≥ 0

2. Physical Constraints
   - Congestion < 85%
   - DRV count < 100

3. Verification
   - timeDesign report generated
   - All metrics captured in QoR snapshot
```

### Pattern 4: Corner Case Handling

You handle corners in silicon. Handle them in agents:

```markdown
## Corner Cases

### Case 1: Clock Gating with Async Reset
- **Scenario:** Clock gating cell has async reset path
- **Risk:** Hold violations on async pins
- **Handling:** Skip useful skew for async paths. Use `set_false_path` verification.

### Case 2: Multi-Bit Flip-Flop Banks
- **Scenario:** Data path goes through MBFF
- **Risk:** Sizing affects multiple bits
- **Handling:** Use `ecoChangeCell` with `-cell_list` to maintain matching.

### Case 3: Low Power Islands
- **Scenario:** Path crosses power domain
- **Risk:** Level shifter insertion affects timing
- **Handling:** Check UPF constraints before optimization.
```

---

## Chapter 7: Building Your First Agent Extension

### Exercise: Extend HiPilot with a Power Analysis Skill

**Goal:** Create a skill that analyzes power and suggests optimizations.

**Architecture Plan:**

```
User Request: "Analyze power consumption"
    │
    ▼
Skill: power-analysis-expert
    │
    ├── Step 1: Generate power report (Template)
    │   └── Template: cadence/report_power.tcl
    │
    ├── Step 2: Analyze results (AI reasoning)
    │   └── Check efficiency, identify hotspots
    │
    ├── Step 3: Suggest optimizations (Conditional logic)
    │   ├── If clock power high → Clock gating suggestions
    │   ├── If leakage high → VT swap suggestions
    │   └── If dynamic high → Activity analysis
    │
    └── Step 4: Generate action plan (Output formatting)
```

**Implementation Steps:**

1. **Create the skill file** (`skills/power-analysis.md`)
2. **Create the template** (`templates/cadence/report_power.tcl`)
3. **Test with HiTestBot**
4. **Analyze evidence and refine**

**Key Code:**

```markdown
## Power Analysis Logic

### Data Collection

```tcl
# Generate comprehensive power report
report_power -outfile power_summary.rpt
report_power -hier -outfile power_hier.rpt
report_clock_gating -outfile clock_gating.rpt
```

### Analysis Decision Tree

```
Total Power > Budget?
├── Yes → Which component dominates?
│         ├── Leakage (static) → VT optimization
│         ├── Dynamic (switching) → Activity reduction
│         └── Clock → Gating efficiency improvement
└── No  → Report "Power within spec"
```

### Automated Optimization Suggestions

```tcl
# If clock power is high
set cg_efficiency [get_metric clock_gating.efficiency]
if {$cg_efficiency < 85} {
  puts "RECOMMENDATION: Clock gating efficiency at ${cg_efficiency}%"
  puts "  Action: Review clock gating enable conditions"
  puts "  Command: report_clock_gating -inefficient"
}

# If leakage is high
set leakage_ratio [expr [get_metric power.leakage] / [get_metric power.total]]
if {$leakage_ratio > 0.4} {
  puts "RECOMMENDATION: Leakage is ${leakage_ratio*100}% of total power"
  puts "  Action: Consider HVT cell swap for non-critical paths"
}
```
```

---

## Appendix: Concept Map

```
Agent Development (HiPilot)
│
├── Core Concepts
│   ├── Agent: Perceive → Decide → Act → Learn
│   ├── MCP: Standardized tool protocol (JSON-RPC)
│   ├── Skills: Structured expertise (Markdown)
│   └── Templates: Parameterized Tcl (Nunjucks)
│
├── Architecture Layers
│   ├── Layer 3 (Orchestration): LLM reasoning
│   ├── Layer 2 (Protocol): MCP servers
│   └── Layer 1 (Execution): EDA tools
│
├── Development Workflow
│   ├── Define success criteria (like timing constraints)
│   ├── Write skill (like a runbook)
│   ├── Create template (if needed)
│   ├── Test with HiTestBot (like simulation)
│   └── Analyze evidence (like debugging waveforms)
│
└── ASIC Analogies
    ├── Skills ↔ Runbooks
    ├── Templates ↔ Parameterized scripts
    ├── MCP ↔ Standard cell library interface
    ├── HiTestBot ↔ Testbench
    └── Evidence ↔ Waveforms/VCD
```

---

## You're Ready to Build

You now understand:
- ✅ **Agent architecture** (three-layer model)
- ✅ **MCP protocol** (how AI talks to tools)
- ✅ **Skills** (encoding expertise as instructions)
- ✅ **Development patterns** (verification mindset, state machines)
- ✅ **Code structure** (how HiPilot actually works)

**Your ASIC expertise is the differentiator.** The AI provides the reasoning layer. You provide the methodology.

**Start here:**
1. Pick a task you do frequently
2. Write it as a skill (explain to a new hire)
3. Test it
4. Iterate

*Welcome to AI-assisted chip design.* 🚀

---

**Resources:**
- HiPilot Source: `/home/EDA/hipilot/current/`
- Skills: `skills/`
- Templates: `templates/`
- MCP SDK: https://github.com/modelcontextprotocol
