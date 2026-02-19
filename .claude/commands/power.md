Run power analysis on the current design. Generate and execute power report, then analyze results.

Arguments: $ARGUMENTS

Steps:
1. Detect EDA tool (eda.detect_tool)
2. Generate power report Tcl (eda.generate_tcl with operation=report_power)
3. Send to EDA terminal (eda.send_to_terminal)
4. Capture output (tmux.capture_pane pane=eda)
5. Extract: leakage power, internal power, switching power, total power
6. Present breakdown table, compare to budget if provided
