Run DRC check on the current design. Detect the EDA tool, send the DRC check command, capture results, and analyze violations.

Steps:
1. Detect EDA tool (eda.detect_tool)
2. Generate DRC check Tcl (eda.generate_tcl with operation=check_drc)
3. Send to EDA terminal (eda.send_to_terminal)
4. Capture output (tmux.capture_pane pane=eda)
5. Analyze: count violations by type (short, spacing, width, via, antenna)
6. Present summary with fix recommendations
