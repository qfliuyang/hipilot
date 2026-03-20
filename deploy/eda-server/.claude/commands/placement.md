---
name: /placement
description: >
  Run Stage 4: Placement using Innovus.
  Places standard cells with timing-driven optimization.
  Reports WNS/TNS after placement (L5 requirement).
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /placement

Run Stage 4: Standard Cell Placement for the current design.

## Prerequisites

**Stage 3 (Power Planning) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
```

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
      stage: "placement",
      tool: "innovus",
      designDir: process.env.HIPILOT_DESIGN_DIR
    }
  },
  summary: "Delegate placement to Executor via Knowledge"
})
```

### 2. Knowledge Agent handles routing

Knowledge will:
1. Route to Executor with `execute_stage`
2. Executor runs place_opt_design
3. Route results to Archivist and back to you

### 3. Receive completion from Knowledge

```
Stage 4 Placement Complete:
- WNS: X.XXX ns
- TNS: Y.YYY ns
- Checkpoint: result/pr/data/placement.enc
```

**CRITICAL in Team Mode:**
- ❌ DO NOT send messages directly to Executor or Archivist
- ✅ ALL messages go through Knowledge Agent (to: "knowledge")
- ✅ Knowledge is the ONLY hub for inter-agent communication

---

## SOLO MODE: Execute Directly

If you have NO teammates, execute placement yourself.

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/powerplan.enc`, description: "Load powerplan"});
eda.await_idle({timeout: 60});
```

### 2. Run placement

```javascript
eda.send_tcl_nonblocking({tcl: "place_opt_design", description: "Run placement"});
eda.await_idle({timeout: 600}); // Placement takes time
```

### 3. Report QoR (L5 CRITICAL)

```javascript
// Get timing after placement
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get placement timing"});
eda.await_idle({timeout: 30});
const result = eda.get_last_result({lines: 50});

// MUST report EXACT WNS/TNS
console.log(`Stage 4 Placement: WNS: X.XXX ns, TNS: Y.YYY ns`);

// Save QoR snapshot
qor.snapshot({name: "placement_complete", description: "QoR after placement"});
```

---

## Output

- Checkpoint: `result/pr/data/placement.enc`
- QoR: WNS/TNS reported

## Next Step

- Run `/cts` for clock tree synthesis

## Hub-and-Spoke Architecture

```
User: /placement
    │
    ▼
Supervisor ──SendMessage──> Knowledge
                                   │
                                   ▼
                              Executor (execute_stage)
                                   │
                                   ▼
                              EDA Tool (place_opt_design)
                                   │
                                   ▼
                              Knowledge (execution_result)
                                   │
                                   ├──> Archivist (record_qor)
                                   │
                                   ▼
                              Supervisor (stage_complete)
```
