---
name: /synthesis
description: >
  Run Stage 0: RTL Synthesis using Design Compiler.
  Synthesizes RTL Verilog into gate-level netlist.
  Uses HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME environment variables.
---

# /synthesis

Run Stage 0: RTL Synthesis for the current design.

## Prerequisites

Environment variables must be set:
```bash
export HIPILOT_DESIGN_DIR="/path/to/design"
export HIPILOT_DESIGN_NAME="my_design"
```

Required files in design directory:
- `rtl/*.v` or `rtl/*.sv` - RTL source files
- `constraints/${HIPILOT_DESIGN_NAME}.sdc` - Timing constraints
- `tech/lib/*.db` - Technology libraries

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
      stage: "synthesis",
      tool: "dc_shell",
      designDir: process.env.HIPILOT_DESIGN_DIR,
      designName: process.env.HIPILOT_DESIGN_NAME
    }
  },
  summary: "Delegate synthesis to Executor via Knowledge"
})
```

### 2. Knowledge Agent routes to Executor

Knowledge Agent will:
1. Log the message for audit trail
2. Route the request to Executor with `execute_stage` message
3. Executor executes and sends results back to Knowledge
4. Knowledge routes `record_qor` to Archivist and `stage_complete` to you

### 3. Receive completion from Knowledge

When Knowledge Agent sends you `stage_complete`:
```
Stage 0 Synthesis Complete:
- WNS: X.XXX ns
- TNS: Y.YYY ns
- Netlist: result/syn/data/${designName}.syn.v
```

**CRITICAL in Team Mode:**
- ❌ DO NOT send messages directly to Executor or Archivist
- ✅ ALL messages go through Knowledge Agent (to: "knowledge")
- ✅ Use type: "delegate_execution" with targetAgent field
- ✅ Knowledge is the ONLY hub for inter-agent communication

---

## SOLO MODE: Execute Directly

If you have NO teammates, execute synthesis yourself.

### 1. Verify environment

```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR;
const designName = process.env.HIPILOT_DESIGN_NAME;

if (!designDir || !designName) {
  console.error("Set HIPILOT_DESIGN_DIR and HIPILOT_DESIGN_NAME");
  return;
}
```

### 2. Start dc_shell

```javascript
eda.start_tool({tool: "dc_shell", design_dir: designDir});
```

### 3. Run synthesis flow

Work incrementally:
1. Setup directories and libraries
2. Read and analyze RTL
3. Elaborate and link design
4. Apply constraints
5. Compile with `compile_ultra`
6. Write output netlist

### 4. Report QoR (L5 REQUIRED)

After synthesis completes:
```javascript
eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get timing"});
eda.await_idle({timeout: 30});
const result = eda.get_last_result({lines: 50});

// Parse and report EXACT WNS/TNS
console.log(`Stage 0 Synthesis: WNS: X.XXX ns, TNS: Y.YYY ns`);
```

---

## Output

- Netlist: `result/syn/data/${HIPILOT_DESIGN_NAME}.syn.v`
- Reports: `result/syn/report/timing.rpt`, `area.rpt`

## Next Step

After synthesis completes successfully:
- Run `/design-init` to load the netlist into Innovus

## Hub-and-Spoke Architecture

```
User: /synthesis
    │
    ▼
Supervisor ──SendMessage──> Knowledge
                                   │
                                   ├── logs message
                                   │
                                   ▼
                              Executor (execute_stage)
                                   │
                                   ▼
                              EDA Tool (via MCP)
                                   │
                                   ▼
                              Knowledge (execution_result)
                                   │
                                   ├──> Archivist (record_qor)
                                   │
                                   ▼
                              Supervisor (stage_complete)
```
