---
name: /design-init
description: >
  Run Stage 1: Design Initialization using Innovus.
  Loads synthesized netlist, LEF files, and MMMC setup.
  Uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME environment variables.
---

# /design-init

Run Stage 1: Design Initialization for the current design.

## Prerequisites

**Stage 0 (Synthesis) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
export HIPILOT_DESIGN_NAME="my_design"
```

Required files:
- `result/syn/data/${HIPILOT_DESIGN_NAME}.syn.v` - From Stage 0
- `tech/lef/*.lef` or `tech/lef/*.tlef` - LEF files
- `constraints/${HIPILOT_DESIGN_NAME}.sdc` - Constraints

## Team Mode Detection

Check if you have teammates (team mode) or are running solo:

```javascript
// If you have teammates spawned via TeamCreate, you are in TEAM MODE
// In team mode: ALL messages route through Knowledge Agent (hub-and-spoke)
// In solo mode: Execute directly using MCP tools
```

---

## TEAM MODE: Route Through Knowledge Agent (Hub-and-Spoke)

If you have teammates, you are the **Supervisor**. Your job is to COORDINATE, not execute.

**CRITICAL: ALL communication goes through Knowledge Agent. Never talk directly to Executor/Archivist.**

### 1. Delegate execution to Knowledge Agent

```javascript
SendMessage({
  to: "knowledge",
  message: {
    type: "delegate_execution",
    targetAgent: "executor",
    payload: {
      stage: "design_init",
      tool: "innovus",
      designDir: process.env.HIPILOT_DESIGN_DIR,
      designName: process.env.HIPILOT_DESIGN_NAME
    }
  },
  summary: "Delegate design init to Executor via Knowledge"
})
```

### 2. Knowledge Agent handles routing

Knowledge will:
1. Route to Executor with `execute_stage`
2. Executor loads netlist, LEF files, MMMC setup
3. Route results to Archivist and back to you

### 3. Receive completion from Knowledge

```
Stage 1 Design Init Complete:
- Cell Count: XXXXX
- Checkpoint: result/pr/data/init_design.enc
```

**CRITICAL in Team Mode:**
- ❌ DO NOT send messages directly to Executor or Archivist
- ✅ ALL messages go through Knowledge Agent (to: "knowledge")
- ✅ Knowledge is the ONLY hub for inter-agent communication

---

## SOLO MODE: Execute Directly

If you have NO teammates, execute design init yourself.

### 1. Verify synthesis output exists

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
const designName = process.env.HIPILOT_DESIGN_NAME;
const netlist = `${designDir}/result/syn/data/${designName}.syn.v`;

// Verify file exists before proceeding
console.log(`Loading netlist: ${netlist}`);
```

### 2. Start innovus

```javascript
eda.start_tool({tool: "innovus", design_dir: designDir});
```

### 3. Initialize design

Key steps:
1. Set LEF files (**Tech LEF first!**)
2. Set netlist path
3. Create MMMC constraint mode
4. Run `init_design`
5. Save checkpoint

### 4. Report status

```javascript
console.log(`Stage 1 Design Init: Cell Count: XXXXX`);
```

---

## Output

- Checkpoint: `result/pr/data/init_design.enc`

## Next Step

- Run `/floorplan` to create die area and IO placement

## Hub-and-Spoke Architecture

```
User: /design-init
    │
    ▼
Supervisor ──SendMessage──> Knowledge
                                   │
                                   ▼
                              Executor (execute_stage)
                                   │
                                   ▼
                              EDA Tool (init_design)
                                   │
                                   ▼
                              Knowledge (execution_result)
                                   │
                                   ├──> Archivist (record_qor)
                                   │
                                   ▼
                              Supervisor (stage_complete)
```
