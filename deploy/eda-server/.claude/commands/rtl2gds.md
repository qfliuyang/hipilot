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
mcp__hipilot-eda__eda.start_tool({tool: "innovus", design_dir: "/home/EDA/hipilot_test/ibex_work_upload"})
```

### 2. Load the flow guide

```
mcp__hipilot-knowledge__knowledge.get_skill({name: "ibex-rtl2gds-flow"})
```

Read the skill carefully. It contains the exact file paths (DEF, LEF, SDC), Tcl commands, and methodology for every stage. The Tcl in the skill is specific to the Ibex design on this server.

### 3. Execute each stage

For each stage, follow this exact pattern:

1. **Generate Tcl:** Call `mcp__hipilot-eda__eda.generate_tcl` with the operation name, OR copy the Tcl directly from the skill.
2. **Execute:** Call `mcp__hipilot-eda__eda.execute_and_verify` with the Tcl, a description, and a timeout.
3. **Check the result:** The response includes `status`, `errors`, `warnings`, and `qor`. Read them.
4. **If errors:** Call `mcp__hipilot-eda__eda.diagnose_error` with the error text. Fix and retry.
5. **If success:** Call `mcp__hipilot-eda__qor.snapshot` with a name like `"after_placement"`.
6. **Report:** Tell the engineer: "Stage 3/8 Placement: done. WNS=-0.05ns, 0 violations."
7. **Next stage:** Only proceed when the current stage succeeds.

### The 8 stages

| # | Stage | What to do | Timeout |
|---|-------|-----------|---------|
| 1 | Design Init | Load netlist + LEF + constraints. Use `eda.generate_tcl({operation: "read_design"})` or the Tcl from the skill. | 180s |
| 2 | Floorplan | Define die area and rows. The skill has the exact Tcl. Check if a floorplan already exists before running. | 120s |
| 3 | Placement | Place standard cells. For Innovus: `place_opt_design`. | 300s |
| 4 | CTS | Build the clock tree. Use `eda.generate_tcl({operation: "run_cts"})`. Requires clock definitions in the design. | 300s |
| 5 | Post-CTS Opt | Fix setup/hold violations that CTS introduced. Use `eda.generate_tcl({operation: "optimize_design"})`. | 300s |
| 6 | Routing | Route all signal nets (global + detail). Use `eda.generate_tcl({operation: "route_design"})`. This is the longest stage. | 600s |
| 7 | Timing Report | Generate a timing report. Use `eda.generate_tcl({operation: "report_timing"})`. If this fails, skip it — it is not critical. | 120s |
| 8 | Chip Finish | Save the design (DEF, netlist). Use `eda.generate_tcl({operation: "save_design"})`. | 120s |

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
