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

### 1. Check current tool and load the flow guide

```
mcp__hipilot-eda__eda.detect_tool({})
mcp__hipilot-knowledge__knowledge.get_skill({name: "ibex-rtl2gds-flow"})
```

**CRITICAL:** Do NOT start any tool yet. First read the skill to understand the flow stages.

**Tool Usage by Stage:**
- Stage 0 (Synthesis): Use **dc_shell**
- Stages 1-9 (P&R): Use **innovus**

Use the `HIPILOT_DESIGN_DIR` environment variable for the design directory:
```javascript
const designDir = process.env.HIPILOT_DESIGN_DIR || "/home/EDA/ibex_work_upload";
```

### 2. Load the flow guide

```
mcp__hipilot-knowledge__knowledge.get_skill({name: "ibex-rtl2gds-flow"})
```

Read the skill carefully. It contains the exact file paths (DEF, LEF, SDC), Tcl commands, and methodology for every stage. The Tcl in the skill is specific to the Ibex design on this server.

### 4. Execute each stage

**CRITICAL:** Run ALL stages from Stage 0 through Stage 9. NEVER skip a stage just because output files exist. HiPilot runs the COMPLETE flow.

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
| 0 | Synthesis + DFT | dc_shell | 300s | RTL → gate-level netlist. **ALWAYS run — never skip.** |
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

### 5. Extract and Report Final Timing Metrics

After Stage 9 completes, you MUST extract and display the final timing metrics. The engineer needs to see explicit WNS/TNS values.

**Step 1: Generate and run a timing report to get current WNS/TNS**
```
mcp__hipilot-eda__eda.execute_and_verify({
  tcl: "timeDesign -postRoute -prefix final_summary -outDir result/pr/report/final_timing\nputs \"FINAL_WNS=[get_metric timing.setup.WNS]\"\nputs \"FINAL_TNS=[get_metric timing.setup.TNS]\"\nputs \"FINAL_VIOLATIONS=[get_metric timing.setup.numViolatingPaths]\"",
  description: "Extract final timing metrics",
  timeout: 120
})
```

**Step 2: Call qor.snapshot to save the metrics**
```
mcp__hipilot-eda__qor.snapshot({name: "rtl2gds_final", description: "Final QoR after complete RTL-to-GDS flow"})
```

**Step 3: Report to the engineer with EXPLICIT timing numbers**

Format your final report as a table:

```
✅ RTL-to-GDS Flow Complete!

Final QoR Summary:
┌──────────────────┬───────────────────────────────────────────┐
│      Metric      │                   Value                   │
├──────────────────┼───────────────────────────────────────────┤
│ WNS (Setup)      │ X.XXX ns                                  │
├──────────────────┼───────────────────────────────────────────┤
│ TNS (Setup)      │ X.XXX ns                                  │
├──────────────────┼───────────────────────────────────────────┤
│ Setup Violations │ N paths                                   │
├──────────────────┼───────────────────────────────────────────┤
│ Hold Violations  │ N paths                                   │
├──────────────────┼───────────────────────────────────────────┤
│ GDS              │ result/pr/data/ibex_core.gds              │
└──────────────────┴───────────────────────────────────────────┘

All stages completed: X passed, Y failed
```

**CRITICAL:** You MUST include the actual WNS and TNS numbers in your final report. Do not say "flow complete" without showing the timing metrics.

**CRITICAL: After EVERY stage, you MUST report WNS/TNS values explicitly**

⚠️ **L5 QoR SCORING REQUIREMENT:** The test looks for patterns `WNS: X.XX` and `TNS: Y.YY` in your output. Without these EXACT patterns, L5 scores 0.0.

**Even if the flow doesn't complete all stages, reporting intermediate QoR after each completed stage earns partial L5 credit.**

The test requires seeing explicit timing numbers in your output. Use this exact format:

After Stage 0 (Synthesis):
```
mcp__hipilot-eda__eda.send_tcl_nonblocking({
  tcl: "report_timing -max_paths 5 > result/syn/report/timing.rpt\nreport_area > result/syn/report/area.rpt",
  description: "Generate synthesis reports"
})
mcp__hipilot-eda__eda.await_idle({timeout: 30})
mcp__hipilot-eda__eda.get_last_result({lines: 20})
```
Then report to the engineer EXACTLY like this:
**"Stage 0 Synthesis: WNS = X.XXX ns, TNS = Y.YYY ns"**

After Stage 4 (Placement):
```
mcp__hipilot-eda__qor.snapshot({name: "placement_complete", description: "QoR after placement"})
mcp__hipilot-eda__eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get placement timing"})
mcp__hipilot-eda__eda.await_idle({timeout: 30})
mcp__hipilot-eda__eda.get_last_result({lines: 20})
```
Then report to the engineer EXACTLY like this:
**"Stage 4 Placement: WNS = X.XXX ns, TNS = Y.YYY ns"**

After Stage 5 (CTS):
```
mcp__hipilot-eda__qor.snapshot({name: "cts_complete", description: "QoR after CTS"})
mcp__hipilot-eda__eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get CTS timing"})
mcp__hipilot-eda__eda.await_idle({timeout: 30})
```
Then report:
**"Stage 5 CTS: WNS = X.XXX ns, TNS = Y.YYY ns"**

After Stage 7 (Routing):
```
mcp__hipilot-eda__qor.snapshot({name: "routing_complete", description: "QoR after routing"})
mcp__hipilot-eda__eda.send_tcl_nonblocking({tcl: "report_timing -max_paths 5", description: "Get routing timing"})
mcp__hipilot-eda__eda.await_idle({timeout: 30})
```
Then report:
**"Stage 7 Routing: WNS = X.XXX ns, TNS = Y.YYY ns"**

### Rules

- You drive each stage. Never hand off to a batch executor.
- Always check for errors after `execute_and_verify`. Never assume success.
- Always call `diagnose_error` when something fails. Do not guess at fixes.
- Always call `qor.snapshot` after placement, CTS, and routing.
- If a stage fails twice after diagnosis and retry, stop and tell the engineer.
