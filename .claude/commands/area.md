Run area/utilization report on the current design.

Arguments: $ARGUMENTS

Steps:
1. Detect EDA tool (eda.detect_tool)
2. Generate area report Tcl (eda.generate_tcl with operation=report_area)
3. Send to EDA terminal (eda.send_to_terminal)
4. Capture output (tmux.capture_pane pane=eda)
5. Extract: total area, cell count, utilization percentage, macro count
6. Present summary, flag high-utilization regions
