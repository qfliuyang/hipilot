---
name: /start-eda
description: >
  Start the EDA tool in the right pane via MCP so the user does not need to launch it manually.
---

# /start-eda — Start EDA Tool

## When to use

Use `/start-eda` when the EDA pane shows a shell prompt but no EDA tool (Innovus, ICC2, PrimeTime) is running. This lets the user run flows without manually typing `innovus -no_gui` or `icc2_shell` in the right pane.

## What HiPilot does

When the user types `/start-eda`:

1. **Detect** — Call `eda.detect_tool` to check if an EDA tool is already running.
2. **If already running** — Report the detected tool and that it is ready.
3. **If not running** — Call `eda.start_tool` to launch the tool in the EDA pane:
   - For Innovus (RTL2GDS): `eda.start_tool({"tool":"innovus","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"})`
   - For ICC2: `eda.start_tool({"tool":"icc2_shell","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"})`
   - For PrimeTime: `eda.start_tool({"tool":"pt_shell","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"})`
4. Wait for the tool prompt (up to 90s for Innovus) and confirm when ready.
5. Tell the user the tool is running and they can now run `/rtl2gds` or other commands.

## Parameters (optional)

If the user specifies a tool or design dir:
- `tool`: innovus | icc2_shell | pt_shell (default: innovus)
- `design_dir`: Path to design (default for Ibex: /home/EDA/hipilot_test/ibex_work_upload)

## MCP calls (conceptual)

```json
eda.detect_tool
eda.start_tool {"tool":"innovus","design_dir":"/home/EDA/hipilot_test/ibex_work_upload"}
```

## Notes

- On modern EDA servers, tool binaries (innovus, icc2_shell, pt_shell) are typically in PATH via module load or env setup.
- The Ibex design directory is `/home/EDA/hipilot_test/ibex_work_upload`.
- `/rtl2gds` will call `eda.start_tool` internally if needed, but `/start-eda` lets the user explicitly start the tool first.
