---
name: /chipfinish
description: >
  Run Stage 9: Chip Finish using Innovus.
  Adds filler cells, seal rings, and exports GDS/DEF/Netlist.
  Reports final WNS/TNS (L5 requirement).
  Uses HIPILOT_DESIGN_DIR environment variable.
---

# /chipfinish

Run Stage 9: Chip Finish and GDS Export for the current design.

## Prerequisites

**Stage 8 (Route Optimization) must complete first.**

Environment variables:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
export HIPILOT_DESIGN_NAME="my_design"
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
      stage: "chip_finish",
      tool: "innovus",
      designDir: process.env.HIPILOT_DESIGN_DIR,
      designName: process.env.HIPILOT_DESIGN_NAME
    }
  },
  summary: "Delegate chip finish to Executor via Knowledge"
})
```

### 2. Knowledge Agent handles routing

Knowledge will:
1. Route to Executor with `execute_stage`
2. Executor adds filler cells, exports GDS/DEF/Netlist
3. Route results to Archivist and back to you

### 3. Receive completion from Knowledge

```
Stage 9 Chip Finish Complete:
- WNS: X.XXX ns
- TNS: Y.YYY ns
- GDS: result/pr/data/${designName}.gds
- Checkpoint: result/pr/data/chip_done.enc
```

**CRITICAL in Team Mode:**
- ❌ DO NOT send messages directly to Executor or Archivist
- ✅ ALL messages go through Knowledge Agent (to: "knowledge")
- ✅ Knowledge is the ONLY hub for inter-agent communication

---

## SOLO MODE: Execute Directly

If you have NO teammates, execute chip finish yourself.

### 1. Start innovus and load checkpoint

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
const designName = process.env.HIPILOT_DESIGN_NAME;
eda.start_tool({tool: "innovus", design_dir: designDir});
eda.send_tcl_nonblocking({tcl: `source ${designDir}/result/pr/data/routing_opt.enc`, description: "Load route opt checkpoint"});
eda.await_idle({timeout: 60});
```

### 2. Run chip finish steps

Key steps:
1. Add filler cells
2. Add seal ring (if required)
3. Verify DRC
4. Generate final reports

```javascript
eda.send_tcl_nonblocking({tcl: "addFiller -cell FILLCELL* -prefix FILL", description: "Add fillers"});
eda.await_idle({timeout: 60});
```

### 3. Export outputs

```javascript
// GDS
eda.send_tcl_nonblocking({tcl: `streamOut ${designDir}/result/pr/data/${designName}.gds`, description: "Export GDS"});
eda.await_idle({timeout: 60});

// DEF
eda.send_tcl_nonblocking({tcl: `defOut ${designDir}/result/pr/data/${designName}.def`, description: "Export DEF"});
eda.await_idle({timeout: 30});

// Netlist
eda.send_tcl_nonblocking({tcl: `saveNetlist ${designDir}/result/pr/data/${designName}.final.v`, description: "Export netlist"});
eda.await_idle({timeout: 30});

// SDC
eda.send_tcl_nonblocking({tcl: `saveSdc ${designDir}/result/pr/data/${designName}.final.sdc`, description: "Export SDC"});
eda.await_idle({timeout: 30});
```

### 4. Final QoR report (L5 CRITICAL)

```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 10", description: "Final timing"});
eda.await_idle({timeout: 30});

console.log(`Stage 9 Chip Finish: WNS: X.XXX ns, TNS: Y.YYY ns`);
console.log(`GDS: ${designDir}/result/pr/data/${designName}.gds`);

qor.snapshot({name: "chipfinish_final", description: "Final QoR after chip finish"});
```

### 5. Save final checkpoint

```javascript
eda.send_tcl_nonblocking({tcl: `saveDesign ${designDir}/result/pr/data/chip_done.enc`, description: "Save final checkpoint"});
eda.await_idle({timeout: 30});
```

---

## Output

| File | Description |
|------|-------------|
| `chip_done.enc` | Final Innovus checkpoint |
| `${designName}.gds` | GDSII layout for tapeout |
| `${designName}.def` | DEF for LVS/DRC |
| `${designName}.final.v` | Final netlist |
| `${designName}.final.sdc` | Final constraints |

## Flow Complete!

All 10 stages complete. The design is ready for:
- LVS (Layout vs Schematic)
- DRC (Design Rule Check)
- Tapeout

## Hub-and-Spoke Architecture

```
User: /chipfinish
    │
    ▼
Supervisor ──SendMessage──> Knowledge
                                   │
                                   ▼
                              Executor (execute_stage)
                                   │
                                   ▼
                              EDA Tool (filler, GDS export)
                                   │
                                   ▼
                              Knowledge (execution_result)
                                   │
                                   ├──> Archivist (record_qor)
                                   │
                                   ▼
                              Supervisor (stage_complete)
```
