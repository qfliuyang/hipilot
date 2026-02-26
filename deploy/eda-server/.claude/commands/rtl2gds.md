---
name: /rtl2gds
description: >
  Run the complete Innovus RTL-to-GDS implementation flow for the active design.
  You orchestrate each stage yourself using MCP tools, skills, and templates.
---

# /rtl2gds — Full RTL-to-GDS Flow

You will drive the place & route flow **stage by stage**, using your MCP tools and skills. Do NOT call `workflow.run` or `eda.rtl2gds.run_full_flow` — you must orchestrate each stage yourself so you can handle errors, adapt to results, and use your intelligence.

## Step 1: Preparation

1. Call `eda.detect_tool` to check if Innovus is running in the EDA pane.
2. If not running, call `eda.start_tool({"tool":"innovus","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"})`.
3. Call `knowledge.get_skill({"name":"ibex-rtl2gds-flow"})` to load the design-specific flow guide.
4. Read the skill carefully — it contains the exact Tcl commands, file paths, and methodology for each stage.

## Step 2: Execute Stages

For **each stage** below, follow this pattern:

1. **Generate Tcl**: Call `eda.generate_tcl` with the operation and tool, OR use the Tcl from the skill directly.
2. **Execute**: Call `eda.execute_and_verify` with the Tcl, a description, and an appropriate timeout.
3. **Check result**: Read the response carefully. Look for errors, warnings, and QoR metrics.
4. **Handle errors**: If there are errors, call `eda.diagnose_error` with the error text. Follow the diagnosis to fix the issue, then retry the stage.
5. **Snapshot QoR**: Call `qor.snapshot` with a descriptive name (e.g., "after_placement").
6. **Report progress**: Tell the user what happened and the current QoR (WNS/TNS/violations).
7. **Proceed**: Move to the next stage only when the current one succeeds.

### The stages (in order):

| # | Stage | Operation | Timeout | Notes |
|---|-------|-----------|---------|-------|
| 1 | Design Init | `read_design` | 180s | Load netlist, LEF, MMMC. See skill for paths. |
| 2 | Floorplan | — | 120s | Use Tcl from skill. Check if floorplan exists first. |
| 3 | Placement | — | 300s | `place_opt_design` for Innovus. |
| 4 | CTS | `run_cts` | 300s | Needs clock definitions. Check timing after. |
| 5 | Post-CTS Opt | `optimize_design` | 300s | Fix setup/hold violations from CTS. |
| 6 | Routing | `route_design` | 600s | Global + detail routing. Longest stage. |
| 7 | Timing Report | `report_timing` | 120s | Non-critical — skip if it fails. |
| 8 | Chip Finish | `save_design` | 120s | Export final DEF, netlist. |

## Step 3: Final Report

After all stages complete, summarize:
- How many stages passed/failed
- Final WNS and TNS (setup and hold)
- DRC violation count if available
- Any stages that required error recovery
- Location of saved design files

## Rules

- **Never** call `workflow.run` or `eda.rtl2gds.run_full_flow`. You orchestrate each stage.
- **Always** check for errors after each `execute_and_verify` call.
- **Always** use `diagnose_error` when something fails — don't guess at fixes.
- **Always** snapshot QoR after critical stages (placement, CTS, routing).
- If a stage fails and you cannot fix it after 2 retries, stop and report to the user.
