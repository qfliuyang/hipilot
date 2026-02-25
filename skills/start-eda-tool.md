---
name: start-eda-tool
description: >
  Start Innovus, ICC2, or PrimeTime in the EDA pane via MCP so the user does not launch it manually.
hipilot:
  vendors: [cadence, synopsys]
  tools:
    cadence: [innovus]
    synopsys: [icc2_shell, pt_shell]
  triggers:
    - "start innovus"
    - "start EDA tool"
    - "launch innovus"
    - "run innovus"
  qor_metrics: []
  risk_level: low
  typical_duration: "10-90 seconds"
---

# Start EDA Tool via MCP

## Overview

This skill describes how HiPilot (Claude Code) starts an EDA tool in the right tmux pane via MCP, so the user does not need to manually type `innovus -no_gui` or `icc2_shell`. On modern EDA servers, tool binaries are typically preset in PATH via `module load` or environment setup.

## MCP Pattern

1. **Detect** — `eda.detect_tool` to check if an EDA tool is already running.
2. **Start** — If none detected, call `eda.start_tool`:
   - Innovus (RTL2GDS): `eda.start_tool({"tool":"innovus","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"})`
   - ICC2: `eda.start_tool({"tool":"icc2_shell","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"})`
   - PrimeTime: `eda.start_tool({"tool":"pt_shell","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"})`
3. **Wait** — `eda.start_tool` internally waits for the tool prompt (up to 90s for Innovus).
4. **Proceed** — Once ready, run workflows (e.g. `eda.rtl2gds.run_full_flow`).

## Slash Commands

- `/start-eda` — Explicitly start the EDA tool before running flows.
- `/rtl2gds` — Will call `eda.start_tool` internally if Innovus is not running.

## Notes

- Design directory for Ibex: `/home/EDA/hipilot_test/ibex_work_upload`
- Innovus startup can take 30–90 seconds; timeout is 90s by default.
- ICC2 and PrimeTime typically start in under 60s.
