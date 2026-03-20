---
name: /cts
description: >
  Run Stage 5: Clock Tree Synthesis using Innovus.
  Builds clock tree with skew balancing and NDR rules.
  Reports WNS/TNS after CTS (L5 requirement).
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /cts

Run Stage 5: Clock Tree Synthesis for the current design.

## Prerequisites

**Stage 4 (Placement) must complete first.**

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
      stage: "cts",
      tool: "innovus",
      designDir: process.env.HIPILOT_DESIGN_DIR
    }
  },
  summary: "Delegate CTS to Executor via Knowledge"
})
```

### 2. Knowledge Agent handles routing

Knowledge will:
1. Route to Executor with `execute_stage`
2. Executor creates clock tree spec, runs ccopt_design
3. Route results to Archivist and back to you

### 3. Receive completion from Knowledge

```
Stage 5 CTS Complete:
- WNS: X.XXX ns
- TNS: Y.YYY ns
- Clock Skew: Z.ZZZ ps
- Checkpoint: result/pr/data/cts.enc
```

**CRITICAL in Team Mode:**
- ❌ DO NOT send messages directly to Executor or Archivist
- ✅ ALL messages go through Knowledge Agent (to: "knowledge")
- ✅ Knowledge is the ONLY hub for inter-agent communication

---

## SOLO MODE: Execute Directly

If you have NO teammates, execute CTS yourself.

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/placement.enc`, description: "Load placement"});
eda.await_idle({timeout: 60});
```

### 2. Run CTS

Key steps:
1. Create clock tree spec
2. Run `ccopt_design`
3. Verify clock skew
4. Report timing

```javascript
eda.send_tcl_nonblocking({tcl: "create_ccopt_clock_tree_spec", description: "Create CTS spec"});
eda.await_idle({timeout: 30});

eda.send_tcl_nonblocking({tcl: "ccopt_design", description: "Run CTS"});
eda.await_idle({timeout: 600});
```

### 3. Report QoR (L5 CRITICAL)

```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get CTS timing"});
eda.await_idle({timeout: 30});

console.log(`Stage 5 CTS: WNS: X.XXX ns, TNS: Y.YYY ns, Clock Skew: Z.ZZZ ps`);

qor.snapshot({name: "cts_complete", description: "QoR after CTS"});
```

---

## Output

- Checkpoint: `result/pr/data/cts.enc`
- QoR: WNS/TNS, clock skew reported

## Next Step

- Run `/postcts-opt` for post-CTS optimization

## Hub-and-Spoke Architecture

```
User: /cts
    │
    ▼
Supervisor ──SendMessage──> Knowledge
                                   │
                                   ▼
                              Executor (execute_stage)
                                   │
                                   ▼
                              EDA Tool (ccopt_design)
                                   │
                                   ▼
                              Knowledge (execution_result)
                                   │
                                   ├──> Archivist (record_qor)
                                   │
                                   ▼
                              Supervisor (stage_complete)
```
