Generate and execute a timing report for the current design.

Usage: /timing [path_group]

This command uses the `eda.quick` MCP tool with operation="timing" for a one-call solution.

Steps:
1. Call `eda.quick` with operation="timing" and optional path_group parameter
2. The tool generates appropriate Tcl, analyzes risk, and queues for approval (in manual mode)
3. If approved, the Tcl is sent to the EDA pane automatically
4. After execution, offer to capture and analyze the results

Arguments:
- path_group (optional): Focus on specific path group (e.g., "reg2reg", "in2reg")

Example: /timing reg2reg
