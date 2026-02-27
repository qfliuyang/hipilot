---
name: /rtl2gds
description: >
  Run the complete Innovus RTL-to-GDS flow for the Ibex design.
  You drive each stage yourself using MCP tools.
---

# /rtl2gds

The engineer wants you to run the complete place-and-route flow. You will execute 8 stages in sequence, handling errors and reporting progress at each stage.

**Do NOT call `workflow.run` or `eda.rtl2gds.run_full_flow`.** You orchestrate every stage yourself. This is critical — those tools are batch executors that bypass your intelligence. If a stage fails, you need to diagnose and fix it, not just stop.

## What to do

### 0. Verify MCP tools are available

Call this MCP tool directly (it is in your tool list):
```
mcp__hipilot-eda__eda.get_status
```
If this fails, tell the engineer "MCP servers are not connected" and stop.

### 1. Make sure Innovus is running

```
mcp__hipilot-eda__eda.detect_tool({})
```

If no tool is running:

```
mcp__hipilot-eda__eda.start_tool({tool: "innovus", design_dir: "/home/EDA/ibex_work_upload"})
```

### 2. Load the flow guide

```
mcp__hipilot-knowledge__knowledge.get_skill({name: "ibex-rtl2gds-flow"})
```

Read the skill carefully. It contains the exact file paths (DEF, LEF, SDC), Tcl commands, and methodology for every stage. The Tcl in the skill is specific to the Ibex design on this server.

### 3. Execute each stage

For each stage, follow this exact pattern:

Each stage is a **standalone tool invocation** — the tool starts, loads the previous checkpoint, runs the stage, saves a new checkpoint, and exits. This gives a clean environment and enables recovery.

1. **Get the Tcl:** Load the skill with `mcp__hipilot-knowledge__knowledge.get_skill({name: "ibex-rtl2gds-flow"})`. Copy the Tcl block for the current stage. Each block includes `source checkpoint.enc` at the top and `saveDesign + exit` at the bottom.
2. **Execute:** Call `mcp__hipilot-eda__eda.execute_and_verify` with the complete Tcl, a description, and a timeout. The MCP server will start Innovus fresh, run the script, and wait for it to exit.
3. **Check the result:** The response includes `status`, `errors`, `warnings`, and `qor`. Read them.
4. **If errors:** Call `mcp__hipilot-eda__eda.diagnose_error` with the error text. Fix and retry.
5. **If success:** Call `mcp__hipilot-eda__qor.snapshot` with a name like `"after_placement"`.
6. **Next stage:** The tool has exited. The next stage starts a fresh Innovus and loads the new checkpoint.
6. **Report:** Tell the engineer: "Stage 3/8 Placement: done. WNS=-0.05ns, 0 violations."
7. **Next stage:** Only proceed when the current stage succeeds.

### The 10 stages

| # | Stage | Tool | Timeout | Notes |
|---|-------|------|---------|-------|
| 0 | Synthesis + DFT | dc_shell | 300s | RTL → gate-level netlist. Skip if `result/syn/data/ibex_core.syn.v` already exists. |
| 1 | Design Init + MMMC | innovus | 180s | Load netlist + LEF + MMMC. |
| 2 | Floorplan | innovus | 120s | Die area, IO placement, dont-use cells. |
| 3 | Power Planning | innovus | 120s | VDD/VSS stripes, rail routing. |
| 4 | Placement | innovus | 300s | `place_opt_design`. Report WNS after. |
| 5 | CTS | innovus | 300s | Clock tree + NDR rules. |
| 6 | Post-CTS Opt | innovus | 300s | Fix setup/hold violations. |
| 7 | Routing | innovus | 600s | Global + detail routing. Longest stage. |
| 8 | Route Opt | innovus | 300s | Post-route optimization. |
| 9 | Chip Finish + GDS | innovus | 300s | Export DEF, netlist, GDS. |

**Tool switching:** Stage 0 uses `dc_shell`, stages 1-9 use `innovus`. The skill has the exact Tcl for each stage.

### 4. Final summary

After all stages, tell the engineer:
- How many stages passed and failed
- Final WNS and TNS (setup and hold)
- DRC violation count (if you ran a DRC check)
- Which stages needed error recovery
- Where the saved design files are

### Rules

- You drive each stage. Never hand off to a batch executor.
- Always check for errors after `execute_and_verify`. Never assume success.
- Always call `diagnose_error` when something fails. Do not guess at fixes.
- Always call `qor.snapshot` after placement, CTS, and routing.
- If a stage fails twice after diagnosis and retry, stop and tell the engineer.
