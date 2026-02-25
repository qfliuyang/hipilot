---
name: /rtl2gds
description: >
  Run the complete Innovus RTL-to-GDS implementation flow for the active design
  using HiPilot workflows and MCP tools (no Makefile or monolithic flow scripts).
---

# /rtl2gds — Full RTL-to-GDS Flow

## When to use

Use `/rtl2gds` when you want HiPilot to drive the **place & route portion** of the RTL-to-GDS flow end-to-end inside Innovus, starting from an initialized design (netlist + LEF + constraints) and producing routed checkpoints and final signoff-ready data.

This command is designed to mirror a human P&R engineer running:

1. Design initialization
2. Floorplanning
3. Placement
4. CTS
5. Post-CTS optimization
6. Routing
7. Chip finish (DEF/netlist export)

## What HiPilot does

When you type `/rtl2gds`, HiPilot will:

1. **Ensure Innovus is running** — Call `eda.detect_tool`. If no EDA tool is detected, call `eda.start_tool({"tool":"innovus","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"})` to start Innovus in the right pane. Then proceed.
2. Confirm the current Innovus context with `eda.get_status` and `context.get_stage`.
3. Match the appropriate skills (`rtl2gds-flow`, `ibex-rtl2gds-flow`, and stage skills like `floorplan`, `placement`, `cts`, `route-design`, `chip-finish`).
4. Invoke the builtin workflow:

   - `eda.rtl2gds.run_full_flow({"design":"ibex"})`
   - Internally this is equivalent to `workflow.run(name="rtl2gds", params={"design":"ibex"})`

5. For each stage, send Tcl via `eda.execute_and_verify` / workflow steps, wait for completion, and track QoR with `qor.snapshot`.
6. Summarize WNS/TNS, DRC status, and key design outputs at the end of the flow.

## MCP calls (conceptual)

HiPilot will follow a pattern like:

```json
// Full-flow execution
eda.rtl2gds.run_full_flow {
  "design": "ibex"
}
```

Under the hood, this expands to:

```json
workflow.run {
  "name": "rtl2gds",
  "params": {
    "design": "ibex"
  }
}
```

The `rtl2gds` workflow steps map to stage skills:

- `design_init`   → `/design-init`
- `floorplan`     → `/floorplan`
- `placement`     → `/placement`
- `cts`           → `/cts`
- `post_cts_opt`  → `/post-cts-opt`
- `routing`       → `/route-design`
- `chip_finish`   → `/chip-finish`

## Notes and limitations

- Synthesis (Design Compiler) and signoff STA (PrimeTime) are handled by the `/synthesis` and `/sta` skills and **are not** part of this Innovus-only `/rtl2gds` command.
- You should ensure the correct design is loaded in Innovus (netlist, LEF, SDC, MMMC) before running `/rtl2gds`. See `/design-init` and `/ibex-rtl2gds-flow` for design-specific setup.
- HiPilot never calls `make` or sources monolithic flow scripts here; it uses **MCP tools + skills + templates** for every operation.

