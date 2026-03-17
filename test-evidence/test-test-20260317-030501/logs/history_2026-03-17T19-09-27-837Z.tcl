# Sent at: 2026-03-17T19:09:27.837Z
# Pane: eda


# Check environment
echo "RESULT_DIR: $::env(RESULT_DIR)"
echo "DESIGN_NAME: $::env(DESIGN_NAME)"
echo "DB_FILES: $::env(DB_FILES)"

# Run synthesis scripts
source scripts/syn/dc_setup.tcl
source scripts/syn/dc_main.tcl
