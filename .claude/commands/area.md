Run area/utilization report on the current design.

Usage: /area

This command uses the `eda.quick` MCP tool with operation="area" for a one-call solution.

Steps:
1. Call `eda.quick` with operation="area"
2. The tool generates appropriate Tcl, analyzes risk, and queues for approval (in manual mode)
3. If approved, the Tcl is sent to the EDA pane automatically
4. After execution, offer to capture and analyze the results

The area report will include: total area, cell count, utilization percentage, and macro count.
