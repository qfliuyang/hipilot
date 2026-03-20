---
name: /routing
description: >
  Run Stage 7: Routing using Innovus.
  Performs global and detail routing with DRC cleanup.
  Reports WNS/TNS after routing (L5 requirement).
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /routing

Run Stage 7: Global and Detail Routing for the current design.

## Prerequisites

**Stage 6 (Post-CTS Opt) must complete first.**

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
      stage: "routing",
      tool: "innovus",
      designDir: process.env.HIPILOT_DESIGN_DIR
    }
  },
  summary: "Delegate routing to Executor via Knowledge"
})
```

### 2. Knowledge Agent handles routing

Knowledge will:
1. Route to Executor with `execute_stage`
2. Executor runs route_design, verifies DRC
3. Route results to Archivist and back to you

### 3. Receive completion from Knowledge

```
Stage 7 Routing Complete:
- WNS: X.XXX ns
- TNS: Y.YYY ns
- DRC Violations: N
- Checkpoint: result/pr/data/routing.enc
```

**CRITICAL in Team Mode:**
- ❌ DO NOT send messages directly to Executor or Archivist
- ✅ ALL messages go through Knowledge Agent (to: "knowledge")
- ✅ Knowledge is the ONLY hub for inter-agent communication

---

## SOLO MODE: Execute Directly

If you have NO teammates, execute routing yourself.

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/post_cts_opt.enc`, description: "Load post-CTS checkpoint"});
eda.await_idle({timeout: 60});
```

### 2. Run routing

```javascript
eda.send_tcl_nonblocking({tcl: "route_design", description: "Run routing"});
eda.await_idle({timeout: 1200}); // Longest stage
```

### 3. Check and fix DRC violations

```javascript
eda.send_tcl_nonblocking({tcl: "verify_drc", description: "Check DRC"});
eda.await_idle({timeout: 60});
```

### 4. Report QoR (L5 CRITICAL)

```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get routing timing"});
eda.await_idle({timeout: 30});

console.log(`Stage 7 Routing: WNS: X.XXX ns, TNS: Y.YYY ns, DRC Violations: N`);

qor.snapshot({name: "routing_complete", description: "QoR after routing"});
```

---

## Output

- Checkpoint: `result/pr/data/routing.enc`
- QoR: WNS/TNS and DRC status reported

## Next Step

- Run `/routeopt` for post-route optimization

## Hub-and-Spoke Architecture

```
User: /routing
    │
    ▼
Supervisor ──SendMessage──> Knowledge
                                   │
                                   ▼
                              Executor (execute_stage)
                                   │
                                   ▼
                              EDA Tool (route_design)
                                   │
                                   ▼
                              Knowledge (execution_result)
                                   │
                                   ├──> Archivist (record_qor)
                                   │
                                   ▼
                              Supervisor (stage_complete)
```
