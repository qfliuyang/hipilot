Run power analysis on the current design.

Usage: /power

This command uses the `eda.quick` MCP tool with operation="power" for a one-call solution.

Steps:
1. Call `eda.quick` with operation="power"
2. The tool generates appropriate Tcl, analyzes risk, and queues for approval (in manual mode)
3. If approved, the Tcl is sent to the EDA pane automatically
4. After execution, offer to capture and analyze the results

The power report will include: leakage power, internal power, switching power, and total power.
