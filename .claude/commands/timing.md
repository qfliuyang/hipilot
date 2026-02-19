Report timing for the current design. Use the eda.detect_tool MCP tool to detect which EDA tool is running, then use tmux.send_keys to send the appropriate timing report command to the EDA pane. After the command completes, use tmux.capture_pane to read the output, then analyze the timing results.

If a path group argument is provided: $ARGUMENTS
- Focus the report on that specific path group

Steps:
1. Detect EDA tool (eda.detect_tool)
2. Generate timing report Tcl (eda.generate_tcl with operation=report_timing)
3. Send to EDA terminal (eda.send_to_terminal)
4. Wait briefly, then capture output (tmux.capture_pane pane=eda)
5. Analyze results: extract WNS, TNS, violation count per group
6. Present summary table with recommendations
