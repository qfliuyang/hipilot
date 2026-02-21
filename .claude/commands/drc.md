Run DRC (Design Rule Check) on the current design.

Usage: /drc

This command uses the `eda.quick` MCP tool with operation="drc" for a one-call solution.

Steps:
1. Call `eda.quick` with operation="drc"
2. The tool generates appropriate Tcl, analyzes risk, and queues for approval (in manual mode)
3. If approved, the Tcl is sent to the EDA pane automatically
4. After execution, offer to capture and analyze the results for violations

The DRC check will report violations by type (short, spacing, width, via, antenna).
