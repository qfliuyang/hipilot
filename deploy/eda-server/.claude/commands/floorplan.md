---
name: /floorplan
description: >
  Run Stage 2: Floorplanning using Innovus.
  Creates die area, core utilization, IO placement, and macro placement.
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /floorplan

Run Stage 2: Floorplanning for the current design.

## Prerequisites

**Stage 1 (Design Init) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
```

Required:
- `result/pr/data/init_design.enc` - From Stage 1

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

### 1. Get strategy from Knowledge (optional)

```javascript
SendMessage({
  to: "knowledge",
  message: {
    type: "get_strategy",
    payload: {
      stage: "floorplan",
      context: { designDir: process.env.HIPILOT_DESIGN_DIR }
    }
  },
  summary: "Get floorplan strategy via Knowledge"
})
```

### 2. Delegate execution to Knowledge Agent

```javascript
SendMessage({
  to: "knowledge",
  message: {
    type: "delegate_execution",
    targetAgent: "executor",
    payload: {
      stage: "floorplan",
      tool: "innovus",
      designDir: process.env.HIPILOT_DESIGN_DIR
    }
  },
  summary: "Delegate floorplan to Executor via Knowledge"
})
```

### 3. Knowledge Agent handles routing

Knowledge will:
1. Route to Planner for strategy (if needed)
2. Route to Executor for execution
3. Route results to Archivist and back to you

### 4. Receive completion from Knowledge

```
Stage 2 Floorplan Complete:
- Utilization: XX%
- Die Area: X.XX mm²
- Checkpoint: result/pr/data/floor_plan.enc
```

**CRITICAL in Team Mode:**
- ❌ DO NOT send messages directly to Executor or Archivist
- ✅ ALL messages go through Knowledge Agent (to: "knowledge")
- ✅ Knowledge is the ONLY hub for inter-agent communication

---

## SOLO MODE: Execute Directly

If you have NO teammates, execute floorplan yourself.

### 1. Verify checkpoint exists

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
const checkpoint = `${designDir}/result/pr/data/init_design.enc`;
```

### 2. Start innovus and load checkpoint

```javascript
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${checkpoint}`, description: "Load checkpoint"});
eda.await_idle({timeout: 60});
```

### 3. Run floorplan

Key steps:
1. Create floorplan with target utilization
2. Place IO pins
3. Place macros (if any)
4. Add placement blockages
5. Save checkpoint

### 4. Report QoR

```javascript
console.log(`Stage 2 Floorplan: Utilization: XX%, Die Area: X.XX mm²`);
```

---

## Output

- Checkpoint: `result/pr/data/floor_plan.enc`

## Next Step

- Run `/powerplan` to add power rings and stripes

## Hub-and-Spoke Architecture

```
User: /floorplan
    │
    ▼
Supervisor ──SendMessage──> Knowledge
                                   │
                                   ├── Planner (strategy, optional)
                                   │
                                   ▼
                              Executor (execute_stage)
                                   │
                                   ▼
                              Knowledge (execution_result)
                                   │
                                   ├──> Archivist (record_qor)
                                   │
                                   ▼
                              Supervisor (stage_complete)
```
